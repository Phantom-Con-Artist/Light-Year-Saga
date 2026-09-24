import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  PlaneGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  TextureLoader,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from "three";
import { skyPlaneBasis } from "../../astronomy/sky";
import { photoSize, type CatalogObject } from "../../data/catalog";
import { useSelectionStore } from "../../state/selectionStore";

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
uniform float uBlack;
uniform float uSoft;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uMap, vUv).rgb;
  // Pull the sky background to true black so only the object adds light.
  c = max(c - uBlack, 0.0) / (1.0 - uBlack);
  vec2 p = abs(vUv - 0.5) * 2.0;
  // Frame-filling images fade out radially; dark-sky images keep their full frame
  // and only soften a thin rounded border, so the rectangle never shows.
  float round = pow(pow(p.x, 6.0) + pow(p.y, 6.0), 1.0 / 6.0);
  float mask = mix(1.0 - smoothstep(0.82, 1.0, round), 1.0 - smoothstep(0.35, 1.0, length(p)), uSoft);
  gl_FragColor = vec4(c * mask * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;

/* ------------------------------------------------------ texture residency */

interface Resident {
  texture: Texture | null;
  loading: boolean;
  /** Seconds since the texture arrived (drives the fade-in). */
  age: number;
}
const resident = new Map<string, Resident>();
const loader = new TextureLoader();

function request(id: string, file: string, gl: WebGLRenderer): Resident {
  let r = resident.get(id);
  if (!r) {
    r = { texture: null, loading: true, age: 0 };
    resident.set(id, r);
    const entry = r;
    loader.load(
      file,
      (tex) => {
        tex.colorSpace = SRGBColorSpace;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
        if (resident.get(id) !== entry) return tex.dispose(); // evicted meanwhile
        entry.texture = tex;
        entry.loading = false;
      },
      undefined,
      () => {
        entry.loading = false;
      },
    );
  }
  return r;
}

function evict(id: string) {
  const r = resident.get(id);
  if (!r) return;
  r.texture?.dispose();
  resident.delete(id);
}

/** 0–1 visibility of an object's photo right now (galaxy disks cross-fade against it). */
const weights = new Map<string, number>();
export function photoWeight(id: string): number {
  return weights.get(id) ?? 0;
}

/* ------------------------------------------------------------- component */

interface SkyPhotosProps {
  objects: CatalogObject[];
  /** Level units per catalogue unit (1, or 1e6 for Universe objects shown in light-years). */
  unitScale?: number;
  /**
   * "billboard": always faces the camera, keeping sky-north up (nebulae — the
   * photo is our only view of them). "sky": fixed in the plane of the sky as seen
   * from Earth, fading out off-axis where an illustrated 3D disk takes over (galaxies).
   */
  mode: "billboard" | "sky";
  /** Overall brightness from the camera position (e.g. fade by level). */
  gain?: (cameraPosition: Vector3) => number;
}

interface Item {
  obj: CatalogObject;
  mesh: Mesh;
  material: ShaderMaterial;
  centre: Vector3;
  right: Vector3;
  up: Vector3;
  normal: Vector3;
  width: number;
  height: number;
}

const toCam = new Vector3();
const bUp = new Vector3();
const bRight = new Vector3();
const bNormal = new Vector3();
const scaleV = new Vector3();

/** Real telescope photographs placed at their true position, size and orientation. */
export function SkyPhotos({ objects, unitScale = 1, mode, gain }: SkyPhotosProps) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  const items = useMemo<Item[]>(
    () =>
      objects
        .filter((o) => o.photo)
        .map((obj) => {
          const p = obj.photo!;
          const distance = obj.position.length() * unitScale;
          const [width, height] = photoSize(p, distance);
          const { right, up, normal } = skyPlaneBasis(p.ra, p.dec, p.northDeg);
          const centre = normal.clone().negate().multiplyScalar(distance);
          if (p.anchor) {
            // Put the anchor pixel on the catalogue position instead of trusting the listed centre.
            centre.copy(obj.position).multiplyScalar(unitScale);
            centre.addScaledVector(right, -(p.anchor[0] - 0.5) * width).addScaledVector(up, -(0.5 - p.anchor[1]) * height);
          }
          const material = new ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: fragment,
            uniforms: {
              uMap: { value: null },
              uOpacity: { value: 0 },
              uBlack: { value: p.black ?? 0.004 },
              uSoft: { value: p.edge === "soft" ? 1 : 0 },
            },
            side: DoubleSide,
            transparent: true,
            blending: AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          });
          const mesh = new Mesh(new PlaneGeometry(1, 1), material);
          mesh.matrixAutoUpdate = false;
          mesh.frustumCulled = false;
          mesh.raycast = () => {};
          mesh.renderOrder = -2;
          mesh.visible = false;
          return { obj, mesh, material, centre, right, up, normal, width, height };
        }),
    [objects, unitScale],
  );

  useEffect(
    () => () => {
      for (const it of items) {
        it.material.dispose();
        it.mesh.geometry.dispose();
        weights.delete(it.obj.id);
      }
    },
    [items],
  );

  useFrame((_, delta) => {
    const g = gain ? gain(camera.position) : 1;
    const selected = useSelectionStore.getState().selectedId;
    for (const it of items) {
      const id = it.obj.id;
      const size = Math.max(it.width, it.height);
      toCam.subVectors(camera.position, it.centre);
      const d = toCam.length();

      // Keep the texture only while it can be more than a few dozen pixels wide.
      const wanted = g > 0.01 && (d < size * 70 || selected === id);
      if (wanted) request(id, it.obj.photo!.file, gl);
      else if (d > size * 160 && selected !== id) evict(id);
      const r = resident.get(id);
      if (!r?.texture || !wanted) {
        it.mesh.visible = false;
        weights.set(id, 0);
        continue;
      }
      r.age += delta;
      it.material.uniforms.uMap.value = r.texture;

      toCam.divideScalar(Math.max(d, 1e-9));
      // Flying through the image: fade so it never floods the screen.
      let w = smoothstep(size * 0.12, size * 0.55, d);
      if (mode === "sky") w *= smoothstep(0.55, 0.85, toCam.dot(it.normal));
      w *= Math.min(1, r.age / 0.8);
      weights.set(id, w);
      const opacity = w * g * (it.obj.photo!.gain ?? 1);
      it.material.uniforms.uOpacity.value = opacity;
      it.mesh.visible = opacity > 0.002;
      if (!it.mesh.visible) continue;

      if (mode === "billboard") {
        // Face the camera, keeping the photo's up as close to sky-up as possible.
        bNormal.copy(toCam);
        bUp.copy(it.up).addScaledVector(bNormal, -bNormal.dot(it.up));
        if (bUp.lengthSq() < 1e-6) bUp.copy(it.right).addScaledVector(bNormal, -bNormal.dot(it.right));
        bUp.normalize();
        bRight.crossVectors(bUp, bNormal);
      } else {
        bRight.copy(it.right);
        bUp.copy(it.up);
        bNormal.copy(it.normal);
      }
      it.mesh.matrix.makeBasis(bRight, bUp, bNormal).scale(scaleV.set(it.width, it.height, 1)).setPosition(it.centre);
      it.mesh.matrixWorldNeedsUpdate = true;
    }
  });

  return (
    <group>
      {items.map((it) => (
        <primitive key={it.obj.id} object={it.mesh} />
      ))}
    </group>
  );
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
