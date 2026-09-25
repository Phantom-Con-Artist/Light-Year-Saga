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

/* ---------------- JS sampler for the 3D point cloud ---------------- */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RGB = [number, number, number];

export interface PointLayer {
  positions: Float32Array;
  colors: Float32Array;
  /** Stars: brightness factor. Dust and gas: sprite radius in ly. */
  sizes: Float32Array;
  /** Dust and gas: opacity. Stars: 1. */
  alphas: Float32Array;
}

export interface GalaxyCloud {
  stars: PointLayer;
  dust: PointLayer;
  gas: PointLayer;
}

class LayerBuilder {
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  n = 0;
  constructor(private capacity: number) {
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
  }
  push(x: number, y: number, z: number, rgb: RGB, size: number, alpha = 1) {
    if (this.n >= this.capacity) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3);
    this.col.set(rgb, i * 3);
    this.size[i] = size;
    this.alpha[i] = alpha;
  }
  build(): PointLayer {
    const n = this.n;
    return { positions: this.pos.subarray(0, n * 3), colors: this.col.subarray(0, n * 3), sizes: this.size.subarray(0, n), alphas: this.alpha.subarray(0, n) };
  }
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Illustrative 3D Milky Way built on the published structure above: a point
 * cloud of stars (arms, bar/bulge, old disk, halo, globular clusters), dark
 * dust lanes along the inner edges of the arms, and glowing gas where stars
 * form. Points within `excludeRadius` of the Sun are skipped — that volume is
 * covered by the real catalogue stars.
 */
export function generateGalaxyCloud(
  starCount: number,
  opts: { dust: boolean; gas: boolean },
  sun: { x: number; y: number; z: number },
  excludeRadius: number,
): GalaxyCloud {
  const rand = mulberry32(20260925);
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const expo = (scale: number) => -Math.log(Math.max(rand(), 1e-9)) * scale;
  const nearSun = (x: number, y: number, z: number) => Math.hypot(x - sun.x, y - sun.y, z - sun.z) < excludeRadius;

  const stars = new LayerBuilder(starCount);
  const dustCount = opts.dust ? Math.min(9000, Math.round(starCount * 0.05)) : 0;
  const gasCount = opts.gas ? Math.min(5000, Math.round(starCount * 0.02)) : 0;
  const dust = new LayerBuilder(dustCount);
  const gas = new LayerBuilder(gasCount);

  const blue: RGB = [0.62, 0.75, 1.0];
  const white: RGB = [0.95, 0.96, 1.0];
  const yellow: RGB = [1.0, 0.88, 0.7];
  const orange: RGB = [1.0, 0.72, 0.48];
  const red: RGB = [1.0, 0.52, 0.38];
  const hii: RGB = [1.0, 0.36, 0.52];
  const reflection: RGB = [0.42, 0.58, 1.0];
  const haze: RGB = [1.0, 0.78, 0.52];
  const dustTint: RGB = [0.5, 0.4, 0.32];

  /** Brightness: most stars faint, a few luminous giants that sparkle. */
  const brightness = (giantChance: number) => (rand() < giantChance ? 2.5 + rand() * 3 : 0.35 * Math.exp(gauss() * 0.55));
  const star = (x: number, y: number, z: number, rgb: RGB, b: number) => {
    if (!nearSun(x, y, z)) stars.push(x, y, z, rgb, b);
  };

  // Where the budget goes.
  const nArms = Math.round(starCount * 0.44);
  const nSpur = Math.round(starCount * 0.03);
  const nBulge = Math.round(starCount * 0.2);
  const nDisk = Math.round(starCount * 0.26);
  const nHalo = Math.round(starCount * 0.025);
  const nGlobular = starCount - nArms - nSpur - nBulge - nDisk - nHalo;

  const totalStrength = ARMS.reduce((a, b) => a + b.strength, 0);
  const pickArm = () => {
    let pick = rand() * totalStrength;
    return ARMS.find((a) => (pick -= a.strength) <= 0) ?? ARMS[0];
  };
  const armRadius = () => {
    let r = 0;
    do r = 11_000 + expo(14_000);
    while (r > 56_000);
    return r;
  };

  // Spiral arms: young, blue-white stars; the occasional red supergiant.
  for (let n = 0; n < nArms; n++) {
    const arm = pickArm();
    const r = armRadius();
    const width = 1100 + 0.035 * r;
    const rr = r + gauss() * width * 0.75;
    const th = armAngleAt(arm, r) + gauss() * 0.02;
    const t = rand();
    const rgb = t < 0.03 ? red : t < 0.55 ? mix(blue, white, rand()) : mix(white, yellow, rand());
    star(Math.cos(th) * rr, Math.sin(th) * rr, gauss() * (180 + r * 0.004), rgb, brightness(0.02));
  }

  // Orion Spur.
  for (let n = 0; n < nSpur; n++) {
    const th = Math.PI + 0.05 + (rand() * 2 - 1) * ORION_SPUR.halfSpan;
    const r = ORION_SPUR.radiusAtSun * Math.exp(PITCH_TAN * (th - Math.PI)) + gauss() * 650;
    star(Math.cos(th) * r, Math.sin(th) * r, gauss() * 220, mix(blue, white, rand()), brightness(0.015));
  }

  // Bar + bulge: old, warm, densely packed.
  const c = Math.cos(BAR_ANGLE);
  const s = Math.sin(BAR_ANGLE);
  for (let n = 0; n < nBulge; n++) {
    let x: number, y: number, z: number;
    if (rand() < 0.5) {
      const a = gauss() * 7_000;
      const b = gauss() * 2_200;
      x = c * a - s * b;
      y = s * a + c * b;
      z = gauss() * 1_100;
    } else {
      const rad = expo(2_300);
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      x = rad * Math.sqrt(1 - u * u) * Math.cos(phi);
      y = rad * Math.sqrt(1 - u * u) * Math.sin(phi);
      z = rad * u * 0.65;
    }
    // Packed so densely that full-strength points would merge into a flat white blob.
    star(x, y, z, mix(yellow, orange, rand()), brightness(0.004) * 0.55);
  }

  // Old thin and thick disk.
  for (let n = 0; n < nDisk; n++) {
    const r = expo(10_500);
    if (r > 54_000) continue;
    const phi = rand() * Math.PI * 2;
    const thick = rand() < 0.15;
    star(Math.cos(phi) * r, Math.sin(phi) * r, gauss() * (thick ? 1_800 : 450), mix(yellow, white, rand() * 0.6), brightness(0.006));
  }

  // Stellar halo: sparse and ancient.
  for (let n = 0; n < nHalo; n++) {
    const rad = 4_000 + expo(22_000);
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    star(rad * Math.sqrt(1 - u * u) * Math.cos(phi), rad * Math.sqrt(1 - u * u) * Math.sin(phi), rad * u * 0.8, mix(orange, yellow, rand()), brightness(0));
  }

  // ~150 globular clusters in the halo (the Milky Way has about 160), each a tight ball of old stars.
  const clusters = 150;
  const members = Math.max(1, Math.round(nGlobular / clusters));
  for (let k = 0; k < clusters; k++) {
    const rad = 2_000 + expo(14_000);
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const cx = rad * Math.sqrt(1 - u * u) * Math.cos(phi);
    const cy = rad * Math.sqrt(1 - u * u) * Math.sin(phi);
    const cz = rad * u * 0.85;
    const core = 40 + rand() * 90;
    for (let m = 0; m < members; m++) {
      const scale = core * (rand() < 0.7 ? 1 : 3);
      star(cx + gauss() * scale, cy + gauss() * scale, cz + gauss() * scale, mix(yellow, white, rand() * 0.5), 0.5 + rand() * 0.6);
    }
  }

  // Dust lanes: along the inner (concave) edge of each arm and very thin, plus the dusty inner ring.
  for (let n = 0; n < dustCount; n++) {
    let x: number, y: number, z: number, size: number;
    if (rand() < 0.82) {
      const r = armRadius();
      const width = 1100 + 0.035 * r;
      const rr = r - width * 0.75 + gauss() * width * 0.35;
      const th = armAngleAt(pickArm(), r);
      x = Math.cos(th) * rr;
      y = Math.sin(th) * rr;
      z = gauss() * 110;
      size = 450 + rand() * 900;
    } else {
      const r = 5_000 + rand() * 9_000;
      const phi = rand() * Math.PI * 2;
      x = Math.cos(phi) * r;
      y = Math.sin(phi) * r;
      z = gauss() * 90;
      size = 600 + rand() * 900;
    }
    if (!nearSun(x, y, z)) dust.push(x, y, z, dustTint, size, 0.15 + rand() * 0.3);
  }

  // Glowing gas: pink star-forming regions and blue reflection clouds on the arm crests, warm haze over the bulge.
  for (let n = 0; n < gasCount; n++) {
    const t = rand();
    if (t < 0.06) {
      const rad = expo(2_600);
      const phi = rand() * Math.PI * 2;
      gas.push(Math.cos(phi) * rad, Math.sin(phi) * rad, gauss() * 700, haze, 2_000 + rand() * 3_500, 0.02 + rand() * 0.02);
      continue;
    }
    const r = armRadius();
    const width = 1100 + 0.035 * r;
    const rr = r + gauss() * width * 0.5;
    const th = armAngleAt(pickArm(), r);
    const x = Math.cos(th) * rr;
    const y = Math.sin(th) * rr;
    const z = gauss() * 140;
    if (nearSun(x, y, z)) continue;
    const pink = t < 0.7;
    gas.push(x, y, z, pink ? hii : reflection, pink ? 250 + rand() * 650 : 400 + rand() * 900, pink ? 0.04 + rand() * 0.06 : 0.025 + rand() * 0.035);
  }

  return { stars: stars.build(), dust: dust.build(), gas: gas.build() };
}
