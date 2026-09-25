import { SPACECRAFT_TRACKS } from "../data/solar/elements.gen";
import type { Vec3 } from "./ephemeris";
import { MU_SUN, propagate } from "./kepler";

/**
 * Spacecraft trajectories from JPL Horizons: state vectors (position and
 * velocity) at monthly to 12-hourly steps. Between samples, heliocentric
 * tracks are propagated along two-body arcs from both neighbours and blended,
 * which follows even Parker Solar Probe's hairpin perihelia; Earth-centred
 * tracks (JWST's halo orbit) use cubic Hermite interpolation.
 */

const J2000_JD = 2451545;
const STRIDE = 7;

let data: Float32Array | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function loadTrajectories(): Promise<void> {
  loading ??= fetch("/data/spacecraft.bin")
    .then((r) => {
      if (!r.ok) throw new Error(`spacecraft.bin: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      data = new Float32Array(buf);
      listeners.forEach((l) => l());
    })
    .catch(() => {
      loading = null;
    });
  return loading;
}

export const trajectoriesLoaded = () => data !== null;
export function onTrajectoriesLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function trackSpan(track: string): { startJd: number; endJd: number } | null {
  const t = SPACECRAFT_TRACKS[track];
  return t ? { startJd: t.start + J2000_JD, endJd: t.end + J2000_JD } : null;
}

const a: Vec3 = { x: 0, y: 0, z: 0 };
const b: Vec3 = { x: 0, y: 0, z: 0 };

/** Position (AU, ecliptic) relative to the track's centre, or null outside the span / before loading. */
export function trajectoryPosition(track: string, jd: number, out: Vec3): Vec3 | null {
  const t = SPACECRAFT_TRACKS[track];
  if (!t || !data) return null;
  const day = jd - J2000_JD;
  const base = t.offset * STRIDE;
  const n = t.count;
  const T = (k: number) => data![base + k * STRIDE];
  if (day < T(0) || day > T(n - 1)) return null;

  // Binary search for the sample at or before `day`.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (T(mid) <= day) lo = mid;
    else hi = mid;
  }
  const i = base + lo * STRIDE;
  const j = base + hi * STRIDE;
  const d = data;
  const h = d[j] - d[i];
  if (h <= 0) {
    out.x = d[i + 1];
    out.y = d[i + 2];
    out.z = d[i + 3];
    return out;
  }
  const s = (day - d[i]) / h;

  if (t.center === "sun") {
    propagate(d[i + 1], d[i + 2], d[i + 3], d[i + 4], d[i + 5], d[i + 6], day - d[i], MU_SUN, a);
    propagate(d[j + 1], d[j + 2], d[j + 3], d[j + 4], d[j + 5], d[j + 6], day - d[j], MU_SUN, b);
    const w = s * s * (3 - 2 * s);
    out.x = a.x + (b.x - a.x) * w;
    out.y = a.y + (b.y - a.y) * w;
    out.z = a.z + (b.z - a.z) * w;
    return out;
  }

  // Cubic Hermite.
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  out.x = h00 * d[i + 1] + h10 * h * d[i + 4] + h01 * d[j + 1] + h11 * h * d[j + 4];
  out.y = h00 * d[i + 2] + h10 * h * d[i + 5] + h01 * d[j + 2] + h11 * h * d[j + 5];
  out.z = h00 * d[i + 3] + h10 * h * d[i + 6] + h01 * d[j + 3] + h11 * h * d[j + 6];
  return out;
}

/** Every stored sample of a track: [jd, x, y, z] per point (for drawing the path). */
export function trackSamples(track: string): { jd: Float64Array; pos: Float32Array } | null {
  const t = SPACECRAFT_TRACKS[track];
  if (!t || !data) return null;
  const jd = new Float64Array(t.count);
  const pos = new Float32Array(t.count * 3);
  for (let k = 0; k < t.count; k++) {
    const o = (t.offset + k) * STRIDE;
    jd[k] = data[o] + J2000_JD;
    pos[k * 3] = data[o + 1];
    pos[k * 3 + 1] = data[o + 2];
    pos[k * 3 + 2] = data[o + 3];
  }
  return { jd, pos };
}
