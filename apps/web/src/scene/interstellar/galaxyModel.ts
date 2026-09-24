/**
 * Procedural Milky Way built from published structure. Model frame is
 * galactocentric (see astronomy/galactic.ts), units light-years.
 *
 * - Bar: half-length ~16,000 ly, near end toward l ≈ +27° (Wegg et al. 2015)
 * - Four logarithmic arms, pitch ≈ 12.5° (Vallée 2017; Reid et al. 2019):
 *   Scutum–Centaurus, Sagittarius–Carina, Perseus, Norma–Outer
 * - Orion Spur: the local arm segment the Sun sits in
 * - Exponential disk (scale length ~9,500 ly) truncated near 50,000 ly
 *
 * Arm radii below are where each arm crosses the Sun's azimuth (θ = π).
 */
import { R0_LY } from "../../astronomy/galactic";

export const GALAXY_EXTENT_LY = 120_000;
export const PITCH_TAN = Math.tan((12.5 * Math.PI) / 180);
export const BAR_ANGLE = Math.PI - (27 * Math.PI) / 180;

export interface Arm {
  name: string;
  /** Radius (ly) where the arm crosses the Sun's azimuth. */
  radiusAtSun: number;
  strength: number;
}

const QUARTER_TURN = Math.exp(PITCH_TAN * (Math.PI / 2));
const SGR = 21_500;

export const ARMS: Arm[] = [
  { name: "Scutum–Centaurus Arm", radiusAtSun: SGR / QUARTER_TURN, strength: 1.0 },
  { name: "Sagittarius–Carina Arm", radiusAtSun: SGR, strength: 0.7 },
  { name: "Perseus Arm", radiusAtSun: SGR * QUARTER_TURN, strength: 1.0 },
  { name: "Norma–Outer Arm", radiusAtSun: SGR * QUARTER_TURN * QUARTER_TURN, strength: 0.6 },
];

export const ORION_SPUR = { name: "Orion Spur", radiusAtSun: R0_LY + 600, strength: 0.45, halfSpan: 0.4 };

/** Azimuth (radians) of an arm at radius r — continuous, may exceed 2π. */
export function armAngleAt(arm: { radiusAtSun: number }, r: number): number {
  return Math.PI + Math.log(r / arm.radiusAtSun) / PITCH_TAN;
}

/* ---------------- GLSL: face-on bake ---------------- */

export const galaxyBakeFragment = /* glsl */ `
uniform float uExtent;
uniform float uTanP;
uniform float uBarAngle;
uniform vec4 uArmR;     // radius at Sun's azimuth, per arm
uniform vec4 uArmS;     // strength, per arm
uniform vec3 uSpur;     // radiusAtSun, strength, halfSpan
varying vec2 vUv;

const float PI = 3.14159265359;

float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise2(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
float fbm2(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { v += a * vnoise2(p); p = p * 2.02 + 7.3; a *= 0.5; }
  return v;
}

// Signed radial offset (ly) from the nearest winding of a log-spiral arm.
float armOffset(float r, float th, float rAtSun) {
  float L = log(r);
  float L0 = log(rAtSun);
  float n = floor(((L - L0) / uTanP - (th - PI)) / (2.0 * PI) + 0.5);
  float La = L0 + uTanP * (th - PI + 2.0 * PI * n);
  return r - exp(La);
}

void main() {
  vec2 p = (vUv - 0.5) * uExtent;
  float r = max(length(p), 1.0);
  float th = atan(p.y, p.x);
  if (th < 0.0) th += 2.0 * PI;

  float clump = fbm2(p / 2600.0);
  float fine = fbm2(p / 700.0);

  // Old stellar disk.
  float disk = exp(-r / 9500.0) * smoothstep(52000.0, 34000.0, r);

  // Bar + bulge.
  float c = cos(-uBarAngle), s = sin(-uBarAngle);
  vec2 pb = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  float bar = exp(-pow(abs(pb.x) / 13000.0, 2.6) - pow(abs(pb.y) / 3600.0, 2.0));
  float bulge = exp(-r / 1900.0);

  // Spiral arms, dust lanes (inner/concave edge) and star-forming knots.
  float armMask = smoothstep(9000.0, 15000.0, r) * smoothstep(56000.0, 42000.0, r);
  float width = 1100.0 + 0.035 * r;
  float arms = 0.0;
  float dust = 0.0;
  for (int k = 0; k < 4; k++) {
    float d = armOffset(r, th, uArmR[k]);
    arms += uArmS[k] * exp(-pow(d / width, 2.0));
    dust += uArmS[k] * exp(-pow((d + width * 0.75) / (width * 0.45), 2.0));
  }
  // Orion Spur: a short, weaker segment through the Sun's neighbourhood.
  float spurD = armOffset(r, th, uSpur.x);
  float spurSpan = smoothstep(uSpur.z, uSpur.z * 0.5, abs(th - PI - 0.05));
  arms += uSpur.y * exp(-pow(spurD / 900.0, 2.0)) * spurSpan;

  arms *= armMask * (0.35 + 1.1 * clump);
  dust *= armMask * (0.4 + 0.9 * fine);

  // HII regions: pink knots sitting on arm crests.
  vec2 cell = floor(p / 1400.0);
  float rnd = hash2(cell);
  vec2 centre = (cell + vec2(hash2(cell + 3.1), hash2(cell + 7.7))) * 1400.0;
  float hii = step(0.86, rnd) * exp(-dot(p - centre, p - centre) / (260.0 * 260.0)) * smoothstep(0.35, 0.8, arms);

  vec3 oldCol = vec3(1.0, 0.86, 0.68);
  vec3 youngCol = vec3(0.62, 0.75, 1.0);
  vec3 hiiCol = vec3(1.0, 0.38, 0.58);
  vec3 coreCol = vec3(1.0, 0.8, 0.52);

  vec3 col = oldCol * disk * 0.55
           + coreCol * (bulge * 1.4 + bar * 0.9)
           + youngCol * arms * (0.35 + exp(-r / 26000.0)) * 0.8
           + hiiCol * hii * 1.6;
  col *= 1.0 - 0.62 * clamp(dust, 0.0, 1.0);
  col *= 0.8 + 0.4 * fine;

  // Stored at ~1/3 scale so the brightest core fits 8-bit; the display shader restores it.
  gl_FragColor = vec4(col * 0.34, 1.0);
}
`;

/* ---------------- JS sampler for 3D sparkle points ---------------- */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SparkleCloud {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
}

/**
 * Scatter illustrative star clouds through the model. Points within
 * `excludeRadius` of the Sun are skipped — that volume is covered by the
 * real catalogue stars.
 */
export function generateSparkle(sun: { x: number; y: number; z: number }, excludeRadius: number): SparkleCloud {
  const rand = mulberry32(20260924);
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const pos: number[] = [];
  const col: number[] = [];
  const size: number[] = [];

  const push = (x: number, y: number, z: number, rgb: [number, number, number], s: number) => {
    if (Math.hypot(x - sun.x, y - sun.y, z - sun.z) < excludeRadius) return;
    pos.push(x, y, z);
    col.push(...rgb);
    size.push(s);
  };

  const young: [number, number, number] = [0.66, 0.78, 1.0];
  const hii: [number, number, number] = [1.0, 0.45, 0.62];
  const old: [number, number, number] = [1.0, 0.85, 0.66];
  const core: [number, number, number] = [1.0, 0.78, 0.5];

  // Arms.
  const totalStrength = ARMS.reduce((a, b) => a + b.strength, 0);
  for (let n = 0; n < 9500; n++) {
    let pick = rand() * totalStrength;
    const arm = ARMS.find((a) => (pick -= a.strength) <= 0) ?? ARMS[0];
    let r = 0;
    do r = 12_000 + -Math.log(Math.max(rand(), 1e-9)) * 14_000;
    while (r > 55_000);
    const th = armAngleAt(arm, r);
    const width = 1100 + 0.035 * r;
    const rr = r + gauss() * width * 0.8;
    const x = Math.cos(th) * rr;
    const y = Math.sin(th) * rr;
    const isHii = rand() < 0.07;
    push(x, y, gauss() * 260, isHii ? hii : young, isHii ? 1.6 : 0.6 + rand() * 0.9);
  }

  // Orion Spur.
  for (let n = 0; n < 700; n++) {
    const th = Math.PI + 0.05 + (rand() * 2 - 1) * ORION_SPUR.halfSpan;
    const r = ORION_SPUR.radiusAtSun * Math.exp(PITCH_TAN * (th - Math.PI)) + gauss() * 700;
    push(Math.cos(th) * r, Math.sin(th) * r, gauss() * 250, young, 0.5 + rand() * 0.6);
  }

  // Bar + bulge.
  const c = Math.cos(BAR_ANGLE);
  const s = Math.sin(BAR_ANGLE);
  for (let n = 0; n < 4200; n++) {
    let x: number, y: number, z: number;
    if (rand() < 0.55) {
      const a = (rand() * 2 - 1) * 14_000;
      const b = gauss() * 2600;
      x = c * a - s * b;
      y = s * a + c * b;
      z = gauss() * 1200;
    } else {
      const rad = -Math.log(Math.max(rand(), 1e-9)) * 2600;
      const t = rand() * Math.PI * 2;
      const u = rand() * 2 - 1;
      x = rad * Math.sqrt(1 - u * u) * Math.cos(t);
      y = rad * Math.sqrt(1 - u * u) * Math.sin(t);
      z = rad * u * 0.6;
    }
    push(x, y, z, core, 0.6 + rand() * 0.8);
  }

  // Old disk field.
  for (let n = 0; n < 5000; n++) {
    const r = -Math.log(Math.max(rand(), 1e-9)) * 11_000;
    if (r > 52_000) continue;
    const t = rand() * Math.PI * 2;
    push(Math.cos(t) * r, Math.sin(t) * r, gauss() * 450, old, 0.4 + rand() * 0.6);
  }

  return { positions: new Float32Array(pos), colors: new Float32Array(col), sizes: new Float32Array(size) };
}
