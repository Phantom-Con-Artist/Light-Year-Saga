import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  DoubleSide,
  Matrix4,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
  Vector3,
} from "three";
import { diskBasis } from "../../astronomy/sky";
import type { CatalogObject, GalaxyVisual } from "../../data/catalog";
import { bakeGalaxyTexture } from "./galaxyBake";

const diskVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const diskFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uGain;
uniform float uSize;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;
void main() {
  vec3 col = texture2D(uMap, vUv).rgb;
  vec3 toCam = cameraPosition - vWorldPos;
  float facing = abs(dot(normalize(toCam), vNormalW));
  float edge = mix(0.25, 1.0, smoothstep(0.02, 0.4, facing));
  // Don't let a disk the camera is flying through smear across the screen.
  float near = smoothstep(uSize * 0.08, uSize * 0.5, length(toCam));
  vec3 c = col * uGain * edge * near;
  c = c / (1.0 + c * 0.4);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

let glowTexture: CanvasTexture | null = null;
/** Soft radial glow used for bulges and elliptical galaxies. */
export function radialGlowTexture(): CanvasTexture {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.15, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.12)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new CanvasTexture(c);
  return glowTexture;
}

const BULGE: Partial<Record<GalaxyVisual["style"], [size: number, color: string]>> = {
  spiral: [0.28, "#ffe2b8"],
  barred: [0.24, "#ffe2b8"],
  sombrero: [0.5, "#ffe0b0"],
  lenticular: [0.4, "#ffe0b0"],
  ring: [0.14, "#ffe2b8"],
  interacting: [0.3, "#ffe8d0"],
};

interface GalaxyDisksProps {
  objects: CatalogObject[];
  /** Level units per catalog unit (1 in the Universe view, 1e6 in light-years). */
  unitScale: number;
  /** Overall brightness as a function of camera position (e.g. fade by level). */
  gain?: (cameraPosition: Vector3) => number;
}

/** Galaxies as oriented, textured disks (+ bulge glow), or glows for ellipticals. */
export function GalaxyDisks({ objects, unitScale, gain }: GalaxyDisksProps) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  const items = useMemo(() => {
    const out: { disk?: Mesh; sprite?: Sprite; material?: ShaderMaterial; spriteMaterial?: SpriteMaterial }[] = [];
    for (const o of objects) {
      const visual = o.visual;
      if (visual?.type !== "galaxy") continue;
      const size = o.extent * unitScale;
      const pos = o.position.clone().multiplyScalar(unitScale);
      const item: (typeof out)[number] = {};

      if (visual.style !== "elliptical") {
        const material = new ShaderMaterial({
          vertexShader: diskVertex,
          fragmentShader: diskFragment,
          uniforms: { uMap: { value: bakeGalaxyTexture(gl, o.id, visual) }, uGain: { value: 1 }, uSize: { value: size } },
          side: DoubleSide,
          transparent: true,
          blending: AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
        const disk = new Mesh(new PlaneGeometry(1, 1), material);
        const { major, minor, normal } = diskBasis(visual.ra, visual.dec, visual.positionAngleDeg, visual.inclinationDeg);
        disk.matrixAutoUpdate = false;
        disk.matrix.copy(new Matrix4().makeBasis(major, minor, normal).scale(new Vector3(size, size, size)).setPosition(pos));
        disk.frustumCulled = false;
        disk.raycast = () => {};
        disk.renderOrder = -4;
        item.disk = disk;
        item.material = material;
      }

      const bulge = visual.style === "elliptical" ? ([0.9, "#ffd9a8"] as const) : BULGE[visual.style];
      if (bulge) {
        const spriteMaterial = new SpriteMaterial({
          map: radialGlowTexture(),
          color: bulge[1],
          blending: AdditiveBlending,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
        const sprite = new Sprite(spriteMaterial);
        sprite.position.copy(pos);
        sprite.scale.setScalar(size * bulge[0]);
        sprite.raycast = () => {};
        sprite.renderOrder = -3;
        item.sprite = sprite;
        item.spriteMaterial = spriteMaterial;
      }
      out.push(item);
    }
    return out;
  }, [objects, unitScale, gl]);

  useEffect(
    () => () => {
      for (const it of items) {
        it.material?.dispose();
        it.disk?.geometry.dispose();
        it.spriteMaterial?.dispose();
      }
    },
    [items],
  );

  useFrame(() => {
    const g = gain ? gain(camera.position) : 1;
    for (const it of items) {
      if (it.material) it.material.uniforms.uGain.value = 2.2 * g;
      if (it.spriteMaterial) it.spriteMaterial.opacity = 0.55 * g;
      if (it.disk) it.disk.visible = g > 0.001;
      if (it.sprite) it.sprite.visible = g > 0.001;
    }
  });

  return (
    <group>
      {items.map((it, i) => (
        <group key={i}>
          {it.disk && <primitive object={it.disk} />}
          {it.sprite && <primitive object={it.sprite} />}
        </group>
      ))}
    </group>
  );
}

