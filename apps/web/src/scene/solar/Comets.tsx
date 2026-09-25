import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from "three";
import type { SpaceObject } from "../../domain/types";
import { SOLAR_SYSTEM } from "../../data/solarSystem";
import { relativePosition, type Vec3 } from "../../astronomy/ephemeris";
import { heliocentricToRender, type RenderTuple } from "../../astronomy/scale";
import { useTimeStore } from "../../state/timeStore";
import { layerOn, useSolarStore } from "../../state/solarStore";
import { useSelectionStore } from "../../state/selectionStore";
import { getRenderPosition, isPresent } from "../renderRegistry";
import { graphics } from "../../state/graphicsStore";

/**
 * Comet comas and tails. Directions are physical: the ion (plasma) tail is
 * blown straight away from the Sun by the solar wind; the dust tail is pushed
 * more gently by sunlight, so it lags behind along the orbit and curves.
 * Activity switches on inside ~4 AU as ices sublimate. Lengths are
 * illustrative, scaled by nucleus size and distance from the Sun.
 */

const vertex = /* glsl */ `
attribute vec4 aTail;     // s (0 head … 1 tip), u, v (lateral), kind (0 ion, 1 dust, 2 coma)
attribute float aSeed;
uniform vec3 uHead;
uniform vec3 uIonEnd;
uniform vec3 uDustCtrl;
uniform vec3 uDustEnd;
uniform vec3 uSide1;
uniform vec3 uSide2;
uniform float uWidth;
uniform float uComa;
uniform float uActivity;
uniform float uTime;
uniform float uPixelRatio;
uniform float uViewH;
varying vec3 vColor;
varying float vAlpha;

void main() {
  float kind = aTail.w;
  vec3 p;
  float s = aTail.x;
  if (kind < 0.5) {
    // Ion streamers flow outward.
    s = fract(s + uTime * (0.08 + 0.05 * aSeed));
    p = mix(uHead, uIonEnd, s) + (uSide1 * aTail.y + uSide2 * aTail.z) * uWidth * (0.15 + 0.6 * s);
    vColor = vec3(0.5, 0.72, 1.0);
    vAlpha = (1.0 - s) * 0.35;
  } else if (kind < 1.5) {
    float t = s;
    p = (1.0 - t) * (1.0 - t) * uHead + 2.0 * t * (1.0 - t) * uDustCtrl + t * t * uDustEnd;
    p += (uSide1 * aTail.y + uSide2 * aTail.z) * uWidth * (0.2 + 1.6 * t);
    vColor = vec3(1.0, 0.9, 0.72);
    vAlpha = pow(1.0 - t, 1.5) * 0.3;
  } else {
    p = uHead + (uSide1 * aTail.y + uSide2 * aTail.z + normalize(uIonEnd - uHead) * aTail.x) * uComa;
    vColor = vec3(0.75, 1.0, 0.86);
    vAlpha = aSeed < 0.04 ? 0.25 : 0.4;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // Soft sprites sized in world units, growing down the tail, so they merge into a glow.
  float world = kind > 1.5 ? uComa * (aSeed < 0.04 ? 1.8 : 0.35) : uWidth * (kind < 0.5 ? 0.35 + 0.7 * s : 0.5 + 1.8 * s);
  gl_PointSize = clamp(world * projectionMatrix[1][1] * uViewH * 0.5 / max(-mv.z, 1e-3), 1.5, 72.0);
  vAlpha *= clamp(4.0 / gl_PointSize, 0.12, 1.0) * 0.7;
  vAlpha *= uActivity;
}
`;
const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 14.0) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

function tailGeometry(count: number): BufferGeometry {
  const tail = new Float32Array(count * 4);
  const seed = new Float32Array(count);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  for (let k = 0; k < count; k++) {
    const r = Math.random();
    const kind = r < 0.4 ? 0 : r < 0.85 ? 1 : 2;
    const s = kind === 2 ? gauss() * 0.6 : Math.pow(Math.random(), kind === 1 ? 1.3 : 1);
    // Ion tails are thin rays; dust fans out.
    const spread = kind === 0 ? 0.35 : 1;
    tail.set([s, gauss() * spread, gauss() * spread, kind], k * 4);
    seed[k] = Math.random();
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("aTail", new BufferAttribute(tail, 4));
  g.setAttribute("aSeed", new BufferAttribute(seed, 1));
  return g;
}

interface CometFx {
  obj: SpaceObject;
  points: Points;
  size: number;
}

const P: Vec3 = { x: 0, y: 0, z: 0 };
const Q: Vec3 = { x: 0, y: 0, z: 0 };
const T: RenderTuple = [0, 0, 0];
const anti = new Vector3();
const lag = new Vector3();
const toCam = new Vector3();
const axisV = new Vector3();

function renderOf(x: number, y: number, z: number, out: Vector3): Vector3 {
  heliocentricToRender({ x, y, z }, T);
  return out.set(T[0], T[1], T[2]);
}

export function Comets() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const fx = useMemo<CometFx[]>(() => {
    const count = graphics().galaxyParticles >= 80_000 ? 1400 : 800;
    return SOLAR_SYSTEM.filter((o) => o.type === "comet").map((obj) => {
      const m = new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uHead: { value: new Vector3() },
          uIonEnd: { value: new Vector3() },
          uDustCtrl: { value: new Vector3() },
          uDustEnd: { value: new Vector3() },
          uSide1: { value: new Vector3() },
          uSide2: { value: new Vector3() },
          uWidth: { value: 0 },
          uComa: { value: 0 },
          uActivity: { value: 0 },
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uViewH: { value: 1 },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const points = new Points(tailGeometry(count), m);
      points.frustumCulled = false;
      points.raycast = () => {};
      // Bigger nuclei make bigger comets (Hale–Bopp's was ~60 km across).
      const size = Math.min(2.2, Math.max(0.5, Math.sqrt(obj.physical.meanRadiusKm / 4)));
      return { obj, points, size };
    });
  }, []);

  useEffect(
    () => () => {
      for (const f of fx) {
        f.points.geometry.dispose();
        (f.points.material as ShaderMaterial).dispose();
      }
    },
    [fx],
  );

  const ion = useMemo(() => new Vector3(), []);
  const dustEnd = useMemo(() => new Vector3(), []);
  const ctrl = useMemo(() => new Vector3(), []);
  const side1 = useMemo(() => new Vector3(), []);
  const side2 = useMemo(() => new Vector3(), []);

  useFrame(({ clock }) => {
    const ms = useTimeStore.getState().timeMs;
    const layers = useSolarStore.getState();
    const selectedId = useSelectionStore.getState().selectedId;
    for (const f of fx) {
      const u = (f.points.material as ShaderMaterial).uniforms;
      const shown = isPresent(f.obj.id) && (layerOn(f.obj, layers) || selectedId === f.obj.id);
      const pos = shown ? relativePosition(f.obj, new Date(ms), P) : null;
      const r = pos ? Math.hypot(pos.x, pos.y, pos.z) : 99;
      // Water ice sublimates vigorously inside ~3 AU; CO/CO₂ start a faint coma further out.
      const activity = Math.pow(Math.min(1, Math.max(0, (4.5 - r) / 3.5)), 1.5);
      f.points.visible = !!pos && activity > 0.01;
      if (!pos || !f.points.visible) continue;
      relativePosition(f.obj, new Date(ms + 86_400_000), Q);

      anti.set(pos.x, pos.y, pos.z).normalize();
      lag.set(pos.x - Q.x, pos.y - Q.y, pos.z - Q.z).normalize();
      const L = Math.min(1.2, 0.22 * f.size * activity / Math.sqrt(Math.max(r, 0.2)));
      const head = getRenderPosition(f.obj.id);
      renderOf(pos.x + anti.x * L, pos.y + anti.y * L, pos.z + anti.z * L, ion);
      const Ld = L * 0.75;
      const dx = anti.x * 0.75 + lag.x * 0.55;
      const dy = anti.y * 0.75 + lag.y * 0.55;
      const dz = anti.z * 0.75 + lag.z * 0.55;
      const dn = Math.hypot(dx, dy, dz);
      renderOf(pos.x + (dx / dn) * Ld, pos.y + (dy / dn) * Ld, pos.z + (dz / dn) * Ld, dustEnd);
      renderOf(pos.x + anti.x * Ld * 0.55, pos.y + anti.y * Ld * 0.55, pos.z + anti.z * Ld * 0.55, ctrl);

      const axis = axisV.copy(ion).sub(head);
      const len = axis.length();
      axis.normalize();
      toCam.copy(camera.position).sub(head).normalize();
      side1.crossVectors(axis, toCam).normalize();
      side2.crossVectors(axis, side1).normalize();

      u.uHead.value.copy(head);
      u.uIonEnd.value.copy(ion);
      u.uDustCtrl.value.copy(ctrl);
      u.uDustEnd.value.copy(dustEnd);
      u.uSide1.value.copy(side1);
      u.uSide2.value.copy(side2);
      u.uWidth.value = len * 0.045;
      u.uComa.value = Math.max(len * 0.018, 0.03) * (0.6 + activity);
      u.uActivity.value = activity;
      u.uTime.value = clock.elapsedTime;
      u.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
      u.uViewH.value = gl.domElement.height;
    }
  });

  return (
    <>
      {fx.map((f) => (
        <primitive key={f.obj.id} object={f.points} />
      ))}
    </>
  );
}
