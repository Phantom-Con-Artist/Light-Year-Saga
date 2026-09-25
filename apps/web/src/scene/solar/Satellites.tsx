import { useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial } from "three";
import { SATELLITES } from "../../data/solar/elements.gen";
import { SATELLITE_GROUPS } from "../../data/solar/regions";
import { LOCAL_MAPPING } from "../../astronomy/scale";
import { jdFromMs } from "../../astronomy/kepler";
import { useTimeStore } from "../../state/timeStore";
import { useSolarStore } from "../../state/solarStore";
import { useSelectionStore } from "../../state/selectionStore";
import { getRenderPosition, getRenderRadius } from "../renderRegistry";

/**
 * Every active Earth satellite (CelesTrak), on the GPU: Kepler's equation plus
 * the secular drift from Earth's equatorial bulge (J2), which swings each
 * orbit's plane around over weeks. Heights use the same compressed mapping as
 * the moons.
 */

const vertex = /* glsl */ `
attribute vec2 aAE;       // a (Earth radii), e
attribute vec4 aAngles;   // i, node, peri, M0 (radians)
attribute float aGroup;
uniform float uDays;
uniform float uEarthR;    // Earth's render radius
uniform vec3 uEarth;      // Earth's render position
uniform float uBase;
uniform float uLog;
uniform float uPixelRatio;
uniform float uOpacity;
uniform vec3 uColors[${SATELLITE_GROUPS.length}];
varying vec3 vColor;
varying float vAlpha;

const float J2 = 1.08263e-3;
const float EPS = 0.40909280;  // obliquity of the ecliptic

void main() {
  float a = aAE.x, e = aAE.y;
  // Mean motion (rad/day) from a in Earth radii: sqrt(mu / (a Re)^3).
  float n = 107.0880 / (a * sqrt(a));
  float p = a * (1.0 - e * e);
  float ci = cos(aAngles.x), si = sin(aAngles.x);
  float node = aAngles.y - 1.5 * n * J2 * ci / (p * p) * uDays;
  float peri = aAngles.z + 0.75 * n * J2 * (5.0 * ci * ci - 1.0) / (p * p) * uDays;
  float M = mod(aAngles.w + n * uDays, 6.28318530718);
  float E = M;
  for (int k = 0; k < 5; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  float xp = a * (cos(E) - e);
  float yp = a * sqrt(1.0 - e * e) * sin(E);
  float cO = cos(node), sO = sin(node), cw = cos(peri), sw = sin(peri);
  vec3 q = vec3(
    (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
    (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
    sw * si * xp + cw * si * yp);
  // Equatorial → ecliptic → render axes.
  vec3 ecl = vec3(q.x, q.y * cos(EPS) + q.z * sin(EPS), -q.y * sin(EPS) + q.z * cos(EPS));
  float r = length(ecl);
  float mapped = uEarthR * (uBase + uLog * log(max(r, 1.0)));
  vec3 world = uEarth + vec3(ecl.x, ecl.z, -ecl.y) * (mapped / r);

  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  // Fade with distance so the swarm reads as a haze from afar and as dots up close.
  float dist = -mv.z;
  gl_PointSize = clamp(40.0 / dist, 1.0, 2.4) * uPixelRatio;
  vColor = uColors[int(aGroup + 0.5)];
  vAlpha = uOpacity * clamp(30.0 / dist, 0.25, 0.9);
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(c)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

/** Hidden this far (days) from the data date: launches and re-entries would make it fiction. */
const VALID_DAYS = 365;

export function Satellites() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const [points, setPoints] = useState<Points | null>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uDays: { value: 0 },
          uEarthR: { value: getRenderRadius("earth") },
          uEarth: { value: getRenderPosition("earth").clone() },
          uBase: { value: LOCAL_MAPPING.base },
          uLog: { value: LOCAL_MAPPING.log },
          uPixelRatio: { value: 1 },
          uOpacity: { value: 0 },
          uColors: { value: SATELLITE_GROUPS.map((g) => new Color(g.color)) },
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
    fetch("/data/satellites.bin")
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("satellites.bin"))))
      .then((buf) => {
        if (cancelled) return;
        const v = new DataView(buf);
        const n = buf.byteLength / 20;
        const ae = new Float32Array(n * 2);
        const ang = new Float32Array(n * 4);
        const grp = new Float32Array(n);
        const D = Math.PI / 180;
        for (let k = 0; k < n; k++) {
          const o = k * 20;
          ae[k * 2] = v.getFloat32(o, true);
          ae[k * 2 + 1] = v.getFloat32(o + 4, true);
          ang[k * 4] = (v.getUint16(o + 8, true) / 65535) * 180 * D;
          ang[k * 4 + 1] = (v.getUint16(o + 10, true) / 65535) * 360 * D;
          ang[k * 4 + 2] = (v.getUint16(o + 12, true) / 65535) * 360 * D;
          ang[k * 4 + 3] = (v.getUint16(o + 14, true) / 65535) * 360 * D;
          grp[k] = v.getUint8(o + 18);
        }
        const g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
        g.setAttribute("aAE", new BufferAttribute(ae, 2));
        g.setAttribute("aAngles", new BufferAttribute(ang, 4));
        g.setAttribute("aGroup", new BufferAttribute(grp, 1));
        const p = new Points(g, material);
        p.frustumCulled = false;
        p.raycast = () => {};
        p.renderOrder = 1;
        setPoints(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [material]);
  useEffect(() => () => points?.geometry.dispose(), [points]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, delta) => {
    if (!points) return;
    const u = material.uniforms;
    const days = jdFromMs(useTimeStore.getState().timeMs) - SATELLITES.epoch;
    const earth = getRenderPosition("earth");
    u.uDays.value = days;
    u.uEarth.value.copy(earth);
    u.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    const selected = useSelectionStore.getState().selectedId === "earth-satellites";
    // Only worth drawing near Earth, and only while the data is current.
    const near = camera.position.distanceTo(earth) < 60;
    const target = (useSolarStore.getState().satellites || selected) && near && Math.abs(days) < VALID_DAYS ? 1 : 0;
    u.uOpacity.value += (target - u.uOpacity.value) * Math.min(1, delta * 3);
    points.visible = u.uOpacity.value > 0.01;
  });

  return points ? <primitive object={points} /> : null;
}
