import { useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial, Vector2 } from "three";
import { SMALL_BODY_EPOCH_JD } from "../../data/solar/elements.gen";
import { SMALL_BODY_CLASSES } from "../../data/solar/regions";
import { DISTANCE_SCALE } from "../../astronomy/scale";
import { jdFromMs } from "../../astronomy/kepler";
import { useTimeStore } from "../../state/timeStore";
import { useSolarStore } from "../../state/solarStore";
import { useSelectionStore } from "../../state/selectionStore";
import { graphics } from "../../state/graphicsStore";

/**
 * Real asteroids, trojans, centaurs and Kuiper belt objects (JPL SBDB), each
 * moved along its own Keplerian orbit on the GPU: the vertex shader solves
 * Kepler's equation for every point, every frame, at the simulation time.
 */

const vertex = /* glsl */ `
attribute vec2 aAE;        // semi-major axis (AU), eccentricity
attribute vec4 aAngles;    // i, node, peri, M0 (radians)
attribute vec2 aHC;        // absolute magnitude H, class
uniform float uDays;       // days since the element epoch
uniform float uScale;      // render units per sqrt(AU)
uniform float uPixelRatio;
uniform float uColorBy;
uniform vec2 uHighlight;   // class range to highlight, or (-1, -1)
uniform vec3 uColors[${SMALL_BODY_CLASSES.length}];
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;

void main() {
  float a = aAE.x;
  float e = aAE.y;
  float n = 0.01720209895 / (a * sqrt(a));          // rad/day
  float M = mod(aAngles.w + n * uDays, 6.28318530718);
  float E = M + e * sin(M);
  for (int k = 0; k < 6; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  float xp = a * (cos(E) - e);
  float yp = a * sqrt(1.0 - e * e) * sin(E);

  float ci = cos(aAngles.x), si = sin(aAngles.x);
  float cO = cos(aAngles.y), sO = sin(aAngles.y);
  float cw = cos(aAngles.z), sw = sin(aAngles.z);
  vec3 p = vec3(
    (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
    (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
    sw * si * xp + cw * si * yp);
  float r = length(p);
  // Same compression as the planets: distance → scale · sqrt(AU); ecliptic → render axes.
  vec3 world = vec3(p.x, p.z, -p.y) * (uScale * sqrt(r) / r);

  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;

  int c = int(aHC.y + 0.5);
  vec3 col = uColorBy > 0.5 ? uColors[c] : vec3(0.82, 0.76, 0.66);
  // Brighter (larger) bodies are bigger dots.
  float big = clamp((16.0 - aHC.x) / 12.0, 0.0, 1.0);
  float size = mix(1.4, 3.0, big);
  float alpha = mix(0.5, 1.0, big);
  if (uHighlight.x > -0.5) {
    bool on = aHC.y > uHighlight.x - 0.5 && aHC.y < uHighlight.y + 0.5;
    alpha *= on ? 1.6 : 0.25;
    size *= on ? 1.35 : 1.0;
  }
  gl_PointSize = size * uPixelRatio;
  // Keep the same overall brightness on high-density screens.
  vAlpha = alpha * uOpacity / uPixelRatio;
  vColor = col;
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.15, length(c)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

const RECORD = 20;
const U16 = 65535;
const DEG = Math.PI / 180;

function parse(buf: ArrayBuffer) {
  const v = new DataView(buf);
  const n = buf.byteLength / RECORD;
  const ae = new Float32Array(n * 2);
  const ang = new Float32Array(n * 4);
  const hc = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) {
    const o = k * RECORD;
    ae[k * 2] = v.getFloat32(o, true);
    ae[k * 2 + 1] = v.getFloat32(o + 4, true);
    ang[k * 4] = (v.getUint16(o + 8, true) / U16) * 180 * DEG;
    ang[k * 4 + 1] = (v.getUint16(o + 10, true) / U16) * 360 * DEG;
    ang[k * 4 + 2] = (v.getUint16(o + 12, true) / U16) * 360 * DEG;
    ang[k * 4 + 3] = (v.getUint16(o + 14, true) / U16) * 360 * DEG;
    hc[k * 2] = v.getUint16(o + 16, true) / 100 - 5;
    hc[k * 2 + 1] = v.getUint8(o + 18);
  }
  return { n, ae, ang, hc };
}

/** Class ranges of the regions, for highlighting when one is selected. */
const REGION_CLASSES: Record<string, [number, number]> = { "asteroid-belt": [0, 3], "jupiter-trojans": [4, 4], "kuiper-belt": [6, 10] };

export function SmallBodies() {
  const gl = useThree((s) => s.gl);
  const [points, setPoints] = useState<Points | null>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uDays: { value: 0 },
          uScale: { value: DISTANCE_SCALE },
          uPixelRatio: { value: 1 },
          uColorBy: { value: 1 },
          uHighlight: { value: new Vector2(-1, -1) },
          uColors: { value: SMALL_BODY_CLASSES.map((c) => new Color(c.color)) },
          uOpacity: { value: 0 },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    // Higher tiers also load the ~44,000 fainter asteroids.
    const more = graphics().galaxyParticles >= 160_000;
    const files = ["/data/small-bodies-core.bin", ...(more ? ["/data/small-bodies-more.bin"] : [])];
    Promise.all(files.map((f) => fetch(f).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(f))))))
      .then((bufs) => {
        if (cancelled) return;
        const parts = bufs.map(parse);
        const n = parts.reduce((s, p) => s + p.n, 0);
        const cat = (key: "ae" | "ang" | "hc", w: number) => {
          const out = new Float32Array(n * w);
          let at = 0;
          for (const p of parts) {
            out.set(p[key], at);
            at += p[key].length;
          }
          return out;
        };
        const g = new BufferGeometry();
        // A dummy position attribute: the shader computes the real one.
        g.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
        g.setAttribute("aAE", new BufferAttribute(cat("ae", 2), 2));
        g.setAttribute("aAngles", new BufferAttribute(cat("ang", 4), 4));
        g.setAttribute("aHC", new BufferAttribute(cat("hc", 2), 2));
        const p = new Points(g, material);
        p.frustumCulled = false;
        p.raycast = () => {};
        setPoints(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [material]);

  useEffect(
    () => () => {
      points?.geometry.dispose();
    },
    [points],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, delta) => {
    if (!points) return;
    const u = material.uniforms;
    const layers = useSolarStore.getState();
    u.uDays.value = jdFromMs(useTimeStore.getState().timeMs) - SMALL_BODY_EPOCH_JD;
    u.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    u.uColorBy.value = layers.beltColors ? 1 : 0;
    const sel = useSelectionStore.getState().selectedId ?? "";
    const range = REGION_CLASSES[sel] ?? [-1, -1];
    u.uHighlight.value.set(range[0], range[1]);
    const target = layers.asteroids ? 1 : 0;
    u.uOpacity.value += (target - u.uOpacity.value) * Math.min(1, delta * 4);
    points.visible = u.uOpacity.value > 0.01;
  });

  return points ? <primitive object={points} /> : null;
}
