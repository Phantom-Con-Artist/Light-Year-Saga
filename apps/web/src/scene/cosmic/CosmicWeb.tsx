import { useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, Points, ShaderMaterial, SphereGeometry, Vector3 } from "three";
import { getCatalogObject } from "../../data/catalog";
import { SUPERCLUSTER_COLORS } from "../../data/catalog/structures";
import { useSelectionStore } from "../../state/selectionStore";
import { useCosmicStore } from "../../state/cosmicStore";
import { smoothstep } from "../interstellar/visibility";

const vertex = /* glsl */ `
attribute float aType;
attribute float aStruct;
attribute float aSuper;
uniform float uScale;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uColorBy;
uniform float uSelStruct;
uniform float uSelSuper;
uniform vec3 uSuperColors[${SUPERCLUSTER_COLORS.length}];
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // ~80,000 ly galaxy × focal length / distance.
  float px = 0.08 * 1087.0 * uScale / max(-mv.z, 1e-3);

  // Early types (ellipticals, T <= 0) golden; spirals blue-white.
  vec3 c = aType <= 0.0 ? vec3(1.0, 0.82, 0.58) : vec3(0.72, 0.8, 1.0);
  float a = min(1.0, 0.5 + px * px * 0.3);

  // Colour by supercluster: members take its colour, the field recedes.
  if (uColorBy > 0.5) {
    int s = int(aSuper + 0.5);
    if (aSuper > -0.5) {
      c = mix(c, uSuperColors[s], 0.85);
      a = min(1.0, a * 1.4);
    } else {
      a *= 0.4;
    }
  }

  // A selected structure: its members light up, everything else dims.
  bool selecting = uSelStruct > -0.5 || uSelSuper > -0.5;
  bool member = (uSelStruct > -0.5 && abs(aStruct - uSelStruct) < 0.5) || (uSelSuper > -0.5 && abs(aSuper - uSelSuper) < 0.5);
  float size = clamp(px, 1.3, 3.0);
  if (selecting) {
    if (member) {
      c = mix(c, vec3(1.0, 0.92, 0.72), 0.35);
      a = min(1.0, a * 1.6 + 0.2);
      size = clamp(px * 1.3, 2.2, 4.5);
    } else {
      a *= 0.3;
    }
  }
  gl_PointSize = size * uPixelRatio;
  vAlpha = a * uOpacity;
  vColor = c;
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 12.0) * vAlpha;
  if (a < 0.005) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * 43,700 real galaxies: the 2MASS Redshift Survey plus the nearby galaxies
 * with measured distances, each tagged with its group, cluster and supercluster.
 */
export function CosmicWeb() {
  const camera = useThree((s) => s.camera);
  const [points, setPoints] = useState<Points | null>(null);

  useEffect(() => {
    let cancelled = false;
    let made: Points | null = null;
    fetch("/data/cosmic-web.bin")
      .then((r) => {
        if (!r.ok) throw new Error(`cosmic-web.bin: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        if (cancelled) return;
        const raw = new Float32Array(buf);
        const n = raw.length / 6;
        const pos = new Float32Array(n * 3);
        const type = new Float32Array(n);
        const struct = new Float32Array(n);
        const sup = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          pos[i * 3] = raw[i * 6];
          pos[i * 3 + 1] = raw[i * 6 + 1];
          pos[i * 3 + 2] = raw[i * 6 + 2];
          type[i] = raw[i * 6 + 3];
          struct[i] = raw[i * 6 + 4];
          sup[i] = raw[i * 6 + 5];
        }
        const g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(pos, 3));
        g.setAttribute("aType", new BufferAttribute(type, 1));
        g.setAttribute("aStruct", new BufferAttribute(struct, 1));
        g.setAttribute("aSuper", new BufferAttribute(sup, 1));
        const m = new ShaderMaterial({
          vertexShader: vertex,
          fragmentShader: fragment,
          uniforms: {
            uScale: { value: 1 },
            uPixelRatio: { value: 1 },
            uOpacity: { value: 0 },
            uColorBy: { value: 1 },
            uSelStruct: { value: -1 },
            uSelSuper: { value: -1 },
            uSuperColors: { value: SUPERCLUSTER_COLORS.map((c) => new Color(c)) },
          },
          transparent: true,
          blending: AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
        made = new Points(g, m);
        made.frustumCulled = false;
        made.raycast = () => {};
        setPoints(made);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      made?.geometry.dispose();
      (made?.material as ShaderMaterial | undefined)?.dispose();
    };
  }, []);

  useFrame(({ size, gl }, delta) => {
    if (!points) return;
    const u = (points.material as ShaderMaterial).uniforms;
    u.uScale.value = size.height / 900;
    u.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    // Fade in on load; nearby galaxies reach almost to the Milky Way itself.
    const target = smoothstep(0.12, 0.5, camera.position.length());
    u.uOpacity.value += (target - u.uOpacity.value) * Math.min(1, delta * 2);
    u.uColorBy.value = useCosmicStore.getState().colorBySupercluster ? 1 : 0;
    const sel = getCatalogObject(useSelectionStore.getState().selectedId);
    u.uSelStruct.value = sel?.structureIndex ?? -1;
    u.uSelSuper.value = sel?.superclusterIndex ?? -1;
  });

  return points ? <primitive object={points} /> : null;
}

const shellVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const shellFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vN;
varying vec3 vView;
void main() {
  float rim = pow(1.0 - abs(dot(vN, vView)), 6.0);
  gl_FragColor = vec4(uColor * rim * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;

/** A faint rim sphere around the selected group, cluster or supercluster, sized from the data. */
export function StructureOutline() {
  const camera = useThree((s) => s.camera);
  const mesh = useMemo(() => {
    const m = new Mesh(
      new SphereGeometry(1, 48, 24),
      new ShaderMaterial({
        vertexShader: shellVertex,
        fragmentShader: shellFragment,
        uniforms: { uColor: { value: new Color("#ffd08a") }, uOpacity: { value: 0 } },
        side: DoubleSide,
        transparent: true,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    m.frustumCulled = false;
    m.raycast = () => {};
    return m;
  }, []);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as ShaderMaterial).dispose();
    },
    [mesh],
  );

  const inside = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    const sel = getCatalogObject(useSelectionStore.getState().selectedId);
    const u = (mesh.material as ShaderMaterial).uniforms;
    const show = sel && (sel.structureIndex !== undefined || sel.superclusterIndex !== undefined);
    if (show) {
      mesh.position.copy(sel.position);
      mesh.scale.setScalar(sel.extent / 2);
      u.uColor.value.set(sel.accent);
      // From inside, render the back faces so the rim still reads as a boundary.
      const within = inside.copy(camera.position).sub(sel.position).length() < sel.extent / 2;
      (mesh.material as ShaderMaterial).side = within ? BackSide : DoubleSide;
    }
    const target = show ? 0.14 : 0;
    u.uOpacity.value += (target - u.uOpacity.value) * Math.min(1, delta * 4);
    mesh.visible = u.uOpacity.value > 0.01;
  });
  return <primitive object={mesh} />;
}
