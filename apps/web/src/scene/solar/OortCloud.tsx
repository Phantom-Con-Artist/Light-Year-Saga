import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from "three";
import { renderDistance } from "../../astronomy/scale";
import { useSolarStore } from "../../state/solarStore";
import { useSelectionStore } from "../../state/selectionStore";
import { graphics } from "../../state/graphicsStore";
import { ScreenLabel } from "../ScreenLabel";

/**
 * An illustrative Oort cloud: no object in it has ever been observed, so these
 * points only sketch its theorised shape — a flattened inner (Hills) cloud
 * from ~2,000 to 20,000 AU and a spherical outer cloud to ~100,000 AU.
 */

const vertex = /* glsl */ `
attribute float aBright;
uniform float uPixelRatio;
uniform float uOpacity;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.4 + 1.2 * aBright) * uPixelRatio;
  vAlpha = uOpacity * (0.45 + 0.55 * aBright);
}
`;
const fragment = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(c)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.72, 0.82, 1.0) * a, 1.0);
  #include <colorspace_fragment>
}
`;

function build(count: number): BufferGeometry {
  const pos = new Float32Array(count * 3);
  const bright = new Float32Array(count);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const v = new Vector3();
  for (let k = 0; k < count; k++) {
    const inner = rnd() < 0.35;
    // Log-uniform in radius; the inner cloud hugs the ecliptic.
    const au = inner ? 2000 * Math.pow(10, rnd()) : 20_000 * Math.pow(5, rnd());
    const z = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    v.set(s * Math.cos(a), inner ? z * 0.35 : z, s * Math.sin(a)).normalize();
    const r = renderDistance(au);
    pos[k * 3] = v.x * r;
    pos[k * 3 + 1] = v.y * r;
    pos[k * 3 + 2] = v.z * r;
    bright[k] = Math.pow(rnd(), 4);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aBright", new BufferAttribute(bright, 1));
  return g;
}

export function OortCloud() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const points = useMemo(() => {
    const tier = graphics().galaxyParticles;
    const p = new Points(
      build(tier >= 160_000 ? 40_000 : tier >= 80_000 ? 25_000 : 12_000),
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uPixelRatio: { value: 1 }, uOpacity: { value: 0 } },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    p.frustumCulled = false;
    p.raycast = () => {};
    return p;
  }, []);
  useEffect(
    () => () => {
      points.geometry.dispose();
      (points.material as ShaderMaterial).dispose();
    },
    [points],
  );

  useFrame((_, delta) => {
    const u = (points.material as ShaderMaterial).uniforms;
    const on = useSolarStore.getState().oort || useSelectionStore.getState().selectedId === "oort-cloud";
    const target = on ? Math.min(1, Math.max(0, (camera.position.length() - 700) / 900)) : 0;
    u.uOpacity.value += (target - u.uOpacity.value) * Math.min(1, delta * 3);
    u.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    points.visible = u.uOpacity.value > 0.01;
  });

  const labelPos = useMemo(() => new Vector3(0.6, 0.15, 0.78).normalize().multiplyScalar(renderDistance(2500)), []);
  return (
    <>
      <primitive object={points} />
      <ScreenLabel
        position={labelPos}
        text="Oort cloud (illustrative)"
        className="region-label"
        opacity={() => (useSolarStore.getState().oort ? Math.min(1, Math.max(0, (camera.position.length() - 1400) / 800)) : 0)}
      />
    </>
  );
}
