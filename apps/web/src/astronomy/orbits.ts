import type { SpaceObject } from "../domain/types";
import { geocentricMoon, helio, sampleOrbit, type Vec3 } from "./ephemeris";
import { conicPhase, conicSamples, DAY_MS, jdFromMs, moonPhase, moonSamples } from "./kepler";
import { heliocentricToRender, localToRender, type RenderTuple } from "./scale";
import { trackSamples, trackSpan } from "./trajectories";
import { satellitePeriodMinutes, satellitePosition } from "./satellites";

/**
 * Orbits and trajectories in render space, for drawing. Everything planet-
 * centred uses the same compressed moon mapping as the bodies themselves.
 */

/** Planets whose (enlarged) neighbourhood bends spacecraft paths: [name, id, radius km, sphere of influence AU, a AU]. */
const PLANETS: [string, string, number, number, number][] = [
  ["Venus", "venus", 6051.8, 0.0041, 0.723],
  ["Earth", "earth", 6371, 0.0062, 1],
  ["Mars", "mars", 3389.5, 0.0039, 1.524],
  ["Jupiter", "jupiter", 69911, 0.322, 5.203],
  ["Saturn", "saturn", 58232, 0.365, 9.537],
  ["Uranus", "uranus", 25362, 0.346, 19.19],
  ["Neptune", "neptune", 24622, 0.578, 30.07],
];

const tmpA: RenderTuple = [0, 0, 0];
const tmpB: RenderTuple = [0, 0, 0];
const off: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * Heliocentric position → scene, for spacecraft. Near a planet the offset
 * from it is drawn with the moon mapping, so a craft orbiting Jupiter circles
 * among its moons instead of vanishing inside the enlarged planet; the two
 * mappings blend across the sphere of influence.
 */
export function spacecraftToRender(p: Vec3, date: Date, out: RenderTuple): RenderTuple {
  heliocentricToRender(p, out);
  const r = Math.hypot(p.x, p.y, p.z);
  for (const [body, , radiusKm, soi, a] of PLANETS) {
    if (Math.abs(r - a) > a * 0.1 + soi) continue;
    const pp = helio(body, date);
    off.x = p.x - pp.x;
    off.y = p.y - pp.y;
    off.z = p.z - pp.z;
    const d = Math.hypot(off.x, off.y, off.z);
    if (d >= soi) continue;
    const t = Math.min(1, Math.max(0, (soi - d) / (soi * 0.7)));
    const w = t * t * (3 - 2 * t);
    heliocentricToRender(pp, tmpA);
    localToRender(off, radiusKm, tmpB);
    out[0] += (tmpA[0] + tmpB[0] - out[0]) * w;
    out[1] += (tmpA[1] + tmpB[1] - out[1]) * w;
    out[2] += (tmpA[2] + tmpB[2] - out[2]) * w;
    break;
  }
  return out;
}

export interface OrbitGeometry {
  /** Render-space points (xyz), relative to `relativeTo`'s position when set. */
  positions: Float32Array;
  /** 0…1 along the orbit (time-like), for the fading trail. */
  phases: Float32Array;
  relativeTo: string | null;
  /** Current phase along the orbit, when it can be computed directly. */
  phaseAt?: (ms: number) => number;
}

function pack(points: Vec3[], phases: number[], map: (p: Vec3, i: number, out: RenderTuple) => RenderTuple, relativeTo: string | null, phaseAt?: (ms: number) => number): OrbitGeometry {
  const positions = new Float32Array(points.length * 3);
  const t: RenderTuple = [0, 0, 0];
  points.forEach((p, i) => positions.set(map(p, i, t), i * 3));
  return { positions, phases: Float32Array.from(phases), relativeTo, phaseAt };
}

/** How long a drawn orbit stays valid in simulated time (ms). */
export function orbitBucketMs(obj: SpaceObject): number {
  switch (obj.ephemeris.kind) {
    case "geocentric-moon":
      return 30 * DAY_MS;
    case "moon-orbit":
      return 10 * DAY_MS;
    case "tle":
      return 3600_000;
    case "conic":
    case "trajectory":
      return Number.POSITIVE_INFINITY;
    default:
      return 5 * 365.25 * DAY_MS;
  }
}

/** Orbit geometry at `date`, or null when there is nothing to draw (yet). */
export function orbitGeometry(obj: SpaceObject, date: Date, parentRadiusKm: number): OrbitGeometry | null {
  const eph = obj.ephemeris;
  const local = (p: Vec3, _i: number, out: RenderTuple) => localToRender(p, parentRadiusKm, out);
  const helioMap = (p: Vec3, _i: number, out: RenderTuple) => heliocentricToRender(p, out);
  switch (eph.kind) {
    case "fixed-origin":
      return null;
    case "heliocentric": {
      const pts = sampleOrbit(obj, date, 360);
      return pack(pts, pts.map((_, i) => i / (pts.length - 1)), helioMap, null);
    }
    case "geocentric-moon": {
      const pts = sampleOrbit(obj, date, 120);
      return pack(pts, pts.map((_, i) => i / (pts.length - 1)), local, obj.parentId ?? null);
    }
    case "conic": {
      const s = conicSamples(eph.elements, eph.elements.e > 0.8 ? 720 : 360);
      return pack(s.points, s.phases, helioMap, null, (ms) => conicPhase(eph.elements, jdFromMs(ms)));
    }
    case "moon-orbit": {
      const s = moonSamples(eph.orbit, jdFromMs(date.getTime()), 160);
      return pack(s.points, s.phases, local, obj.parentId ?? null, (ms) => moonPhase(eph.orbit, jdFromMs(ms)));
    }
    case "trajectory": {
      const t = trackSamples(eph.track);
      const span = trackSpan(eph.track);
      if (!t || !span) return null;
      const n = t.jd.length;
      const pts: Vec3[] = [];
      const phases: number[] = [];
      const frac = (jd: number) => (0.98 * (jd - span.startJd)) / (span.endJd - span.startJd);
      for (let k = 0; k < n; k++) {
        pts.push({ x: t.pos[k * 3], y: t.pos[k * 3 + 1], z: t.pos[k * 3 + 2] });
        phases.push(frac(t.jd[k]));
      }
      const earth = obj.parentId === "earth";
      const map = earth ? local : (p: Vec3, i: number, out: RenderTuple) => spacecraftToRender(p, new Date((t.jd[i] - 2440587.5) * DAY_MS), out);
      return pack(pts, phases, map, earth ? "earth" : null, (ms) => Math.min(0.98, Math.max(0, frac(jdFromMs(ms)))));
    }
    case "tle": {
      const minutes = satellitePeriodMinutes(eph.satellite);
      if (!minutes) return null;
      const period = minutes * 60_000;
      const t0 = date.getTime();
      const n = 180;
      const pts: Vec3[] = [];
      for (let k = 0; k <= n; k++) {
        const p = satellitePosition(eph.satellite, t0 + (k / n) * period, { x: 0, y: 0, z: 0 });
        if (!p) return null;
        pts.push(p);
      }
      return pack(pts, pts.map((_, i) => i / n), local, "earth", (ms) => ((((ms - t0) / period) % 1) + 1) % 1);
    }
  }
}

export { geocentricMoon };
