import type { Vec3 } from "./ephemeris";

/**
 * Two-body orbits. Heliocentric conics (asteroids, comets, interstellar
 * objects) from JPL SBDB elements, planet-centred moon orbits fitted to JPL
 * Horizons, and universal-variable propagation for spacecraft state vectors.
 * Units: AU, days, degrees in the element sets; ecliptic J2000 frame.
 */

export const DAY_MS = 86_400_000;
export const jdFromMs = (ms: number) => ms / DAY_MS + 2440587.5;
export const msFromJd = (jd: number) => (jd - 2440587.5) * DAY_MS;

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
/** Gaussian gravitational constant: √(GM☉) in AU^1.5 / day. */
export const K_GAUSS = 0.01720209895;
export const MU_SUN = K_GAUSS * K_GAUSS;

/** Perihelion-based conic elements (JPL SBDB): works for ellipses, parabolas and hyperbolas. */
export interface ConicElements {
  /** Perihelion distance, AU. */
  q: number;
  e: number;
  i: number;
  om: number;
  w: number;
  /** Time of perihelion, JD (TDB). */
  tp: number;
}

/** Planet-centred orbit with secular rates (deg/day), see scripts/build-solar-system.mjs. */
export interface MoonOrbitElements {
  epoch: number;
  aKm: number;
  e: number;
  i: number;
  om: number;
  dOm: number;
  w: number;
  dW: number;
  L: number;
  dL: number;
}

const wrapPi = (x: number) => x - TAU * Math.floor((x + Math.PI) / TAU);

/** Solve M = E − e sin E. */
export function solveKepler(M: number, e: number): number {
  M = wrapPi(M);
  let E = e < 0.8 ? M : M + 0.85 * e * Math.sign(Math.sin(M) || 1);
  for (let k = 0; k < 40; k++) {
    const f = E - e * Math.sin(E) - M;
    const d = f / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** Solve M = e sinh H − H. */
function solveHyperbolic(M: number, e: number): number {
  let H = Math.sign(M) * Math.log((2 * Math.abs(M)) / e + 1.8);
  for (let k = 0; k < 60; k++) {
    const f = e * Math.sinh(H) - H - M;
    const d = f / (e * Math.cosh(H) - 1);
    H -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return H;
}

/** Perifocal (x toward perihelion, y along motion) → ecliptic. */
function orient(x: number, y: number, iDeg: number, omDeg: number, wDeg: number, out: Vec3): Vec3 {
  const cO = Math.cos(omDeg * DEG);
  const sO = Math.sin(omDeg * DEG);
  const ci = Math.cos(iDeg * DEG);
  const si = Math.sin(iDeg * DEG);
  const cw = Math.cos(wDeg * DEG);
  const sw = Math.sin(wDeg * DEG);
  out.x = (cO * cw - sO * sw * ci) * x + (-cO * sw - sO * cw * ci) * y;
  out.y = (sO * cw + cO * sw * ci) * x + (-sO * sw + cO * cw * ci) * y;
  out.z = sw * si * x + cw * si * y;
  return out;
}

const NEAR_PARABOLIC = 1e-3;

export const isOpen = (el: ConicElements) => el.e > 1 - NEAR_PARABOLIC;

/** Period in days (elliptic orbits only). */
export function conicPeriodDays(el: ConicElements): number | null {
  if (isOpen(el)) return null;
  const a = el.q / (1 - el.e);
  return TAU / (K_GAUSS / Math.pow(a, 1.5));
}

/** Perifocal position at `dt` days from perihelion. */
function perifocal(el: ConicElements, dt: number): [number, number] {
  const { q, e } = el;
  if (e < 1 - NEAR_PARABOLIC) {
    const a = q / (1 - e);
    const E = solveKepler((K_GAUSS / Math.pow(a, 1.5)) * dt, e);
    return [a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)];
  }
  if (e > 1 + NEAR_PARABOLIC) {
    const a = q / (e - 1);
    const H = solveHyperbolic((K_GAUSS / Math.pow(a, 1.5)) * dt, e);
    return [a * (e - Math.cosh(H)), a * Math.sqrt(e * e - 1) * Math.sinh(H)];
  }
  // Near-parabolic: Barker's equation, s = tan(ν/2).
  const W = ((3 * K_GAUSS) / Math.sqrt(2 * q * q * q)) * dt;
  const y = Math.cbrt(W / 2 + Math.sqrt((W * W) / 4 + 1));
  const s = y - 1 / y;
  return [q * (1 - s * s), 2 * q * s];
}

/** Heliocentric ecliptic position (AU) at a Julian date. */
export function conicPosition(el: ConicElements, jd: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const [x, y] = perifocal(el, jd - el.tp);
  return orient(x, y, el.i, el.om, el.w, out);
}

/** Orbit phase 0…1 (mean anomaly / 2π) for closed orbits; time-based for open ones. */
export function conicPhase(el: ConicElements, jd: number): number {
  const period = conicPeriodDays(el);
  if (period) return (((jd - el.tp) / period) % 1 + 1) % 1;
  const span = openSpanDays(el);
  return Math.min(0.98, Math.max(0, 0.49 + (0.49 * (jd - el.tp)) / span));
}

/** Days from perihelion to reach the edge of the drawn arc of an open orbit. */
function openSpanDays(el: ConicElements): number {
  // Out to 60 AU or twice the perihelion, whichever is further.
  const rMax = Math.max(60, el.q * 2);
  let lo = 0;
  let hi = 1e3;
  while (Math.hypot(...perifocal(el, hi)) < rMax && hi < 1e8) hi *= 2;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (Math.hypot(...perifocal(el, mid)) < rMax) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Points around the orbit with their phases. Closed orbits are sampled evenly
 * in eccentric anomaly so long thin comet orbits stay smooth at perihelion.
 */
export function conicSamples(el: ConicElements, n = 360): { points: Vec3[]; phases: number[]; closed: boolean } {
  const points: Vec3[] = [];
  const phases: number[] = [];
  if (!isOpen(el)) {
    const a = el.q / (1 - el.e);
    const b = a * Math.sqrt(1 - el.e * el.e);
    for (let k = 0; k <= n; k++) {
      const E = (k / n) * TAU;
      points.push(orient(a * (Math.cos(E) - el.e), b * Math.sin(E), el.i, el.om, el.w, { x: 0, y: 0, z: 0 }));
      phases.push((E - el.e * Math.sin(E)) / TAU);
    }
    return { points, phases, closed: true };
  }
  const span = openSpanDays(el);
  for (let k = 0; k <= n; k++) {
    // Denser near perihelion: t ∝ u³.
    const u = (k / n) * 2 - 1;
    const t = span * u * u * u;
    const [x, y] = perifocal(el, t);
    points.push(orient(x, y, el.i, el.om, el.w, { x: 0, y: 0, z: 0 }));
    phases.push(0.49 + (0.49 * t) / span);
  }
  return { points, phases, closed: false };
}

/* ------------------------------------------------------------------ moons */

const AU_KM = 149_597_870.7;

function moonAngles(o: MoonOrbitElements, jd: number) {
  const dt = jd - o.epoch;
  const om = o.om + o.dOm * dt;
  const w = o.w + o.dW * dt;
  const M = (o.L + o.dL * dt - om - w) * DEG;
  return { om, w, M };
}

/** Moon position relative to its planet, AU, ecliptic. */
export function moonPosition(o: MoonOrbitElements, jd: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const { om, w, M } = moonAngles(o, jd);
  const a = o.aKm / AU_KM;
  const E = solveKepler(M, o.e);
  return orient(a * (Math.cos(E) - o.e), a * Math.sqrt(1 - o.e * o.e) * Math.sin(E), o.i, om, w, out);
}

export function moonPhase(o: MoonOrbitElements, jd: number): number {
  const { M } = moonAngles(o, jd);
  return ((M / TAU) % 1 + 1) % 1;
}

export function moonSamples(o: MoonOrbitElements, jd: number, n = 180): { points: Vec3[]; phases: number[]; closed: boolean } {
  const { om, w } = moonAngles(o, jd);
  const a = o.aKm / AU_KM;
  const b = a * Math.sqrt(1 - o.e * o.e);
  const points: Vec3[] = [];
  const phases: number[] = [];
  for (let k = 0; k <= n; k++) {
    const E = (k / n) * TAU;
    points.push(orient(a * (Math.cos(E) - o.e), b * Math.sin(E), o.i, om, w, { x: 0, y: 0, z: 0 }));
    phases.push((E - o.e * Math.sin(E)) / TAU);
  }
  return { points, phases, closed: true };
}

/* ------------------------------------------------------ state propagation */

function stumpffC(z: number): number {
  if (z > 1e-6) return (1 - Math.cos(Math.sqrt(z))) / z;
  if (z < -1e-6) return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
  return 0.5 - z / 24;
}
function stumpffS(z: number): number {
  if (z > 1e-6) {
    const s = Math.sqrt(z);
    return (s - Math.sin(s)) / (s * s * s);
  }
  if (z < -1e-6) {
    const s = Math.sqrt(-z);
    return (Math.sinh(s) - s) / (s * s * s);
  }
  return 1 / 6 - z / 120;
}

/**
 * Propagate a state vector by `dt` days under gravity `mu` (AU³/day²), any
 * conic (universal variables). Returns the new position only.
 */
export function propagate(
  px: number,
  py: number,
  pz: number,
  vx: number,
  vy: number,
  vz: number,
  dt: number,
  mu: number,
  out: Vec3,
): Vec3 {
  const r0 = Math.hypot(px, py, pz);
  const v2 = vx * vx + vy * vy + vz * vz;
  const rv = (px * vx + py * vy + pz * vz) / Math.sqrt(mu);
  const alpha = 2 / r0 - v2 / mu;
  const sq = Math.sqrt(mu);
  let x = (sq * dt) / r0;
  for (let k = 0; k < 50; k++) {
    const z = alpha * x * x;
    const C = stumpffC(z);
    const S = stumpffS(z);
    const F = rv * x * x * C + (1 - alpha * r0) * x * x * x * S + r0 * x - sq * dt;
    const dF = rv * x * (1 - z * S) + (1 - alpha * r0) * x * x * C + r0;
    const d = F / dF;
    x -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  const z = alpha * x * x;
  const f = 1 - ((x * x) / r0) * stumpffC(z);
  const g = dt - ((x * x * x) / sq) * stumpffS(z);
  out.x = f * px + g * vx;
  out.y = f * py + g * vy;
  out.z = f * pz + g * vz;
  return out;
}
