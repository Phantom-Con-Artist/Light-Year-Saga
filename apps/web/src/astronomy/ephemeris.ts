import * as Astronomy from "astronomy-engine";
import type { SpaceObject } from "../domain/types";
import { conicPosition, jdFromMs, moonPosition } from "./kepler";
import { trajectoryPosition, trackSpan } from "./trajectories";
import { satellitePosition } from "./satellites";

/**
 * Real (scientific) positions. Everything here is in astronomical units,
 * heliocentric, J2000 mean ecliptic frame (x → vernal equinox, z → ecliptic
 * north). Nothing in this file knows about rendering scale.
 */

export const AU_KM = 149_597_870.7;
export const LIGHT_SPEED_KM_S = 299_792.458;
const MOON_SIDEREAL_DAYS = 27.321661;
const DAY_MS = 86_400_000;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const EQJ_TO_ECL = Astronomy.Rotation_EQJ_ECL();

function toEcliptic(v: Astronomy.Vector): Vec3 {
  const r = Astronomy.RotateVector(EQJ_TO_ECL, v);
  return { x: r.x, y: r.y, z: r.z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function helio(body: string, date: Date): Vec3 {
  return toEcliptic(Astronomy.HelioVector(body as Astronomy.Body, date));
}

/** Moon position relative to Earth, AU, ecliptic. */
export function geocentricMoon(date: Date): Vec3 {
  return toEcliptic(Astronomy.GeoMoon(date));
}

/**
 * The body whose position `relativePosition` is measured from: null for the
 * Sun (heliocentric), otherwise a planet id (moons, Earth satellites, JWST).
 */
export function frameCenter(obj: SpaceObject): string | null {
  const eph = obj.ephemeris;
  switch (eph.kind) {
    case "geocentric-moon":
    case "moon-orbit":
    case "tle":
      return obj.parentId ?? null;
    case "trajectory":
      return obj.parentId === "earth" ? "earth" : null;
    case "fixed-origin":
      return obj.type === "region" && obj.parentId && obj.parentId !== "sun" ? obj.parentId : null;
    default:
      return null;
  }
}

/** Position relative to `frameCenter(obj)` in AU, or null when unknown at this time (e.g. before launch). */
export function relativePosition(obj: SpaceObject, date: Date, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 | null {
  const eph = obj.ephemeris;
  switch (eph.kind) {
    case "fixed-origin":
      out.x = out.y = out.z = 0;
      return out;
    case "heliocentric":
      return Object.assign(out, helio(eph.body, date));
    case "geocentric-moon":
      return Object.assign(out, geocentricMoon(date));
    case "conic":
      return conicPosition(eph.elements, jdFromMs(date.getTime()), out);
    case "moon-orbit":
      return moonPosition(eph.orbit, jdFromMs(date.getTime()), out);
    case "trajectory":
      return trajectoryPosition(eph.track, jdFromMs(date.getTime()), out);
    case "tle":
      return satellitePosition(eph.satellite, date.getTime(), out);
  }
}

/** Is the object part of the Solar System at this moment (launched, not yet re-entered…)? */
export function existsAt(obj: SpaceObject, ms: number): boolean {
  if (obj.active?.from && ms < Date.parse(obj.active.from)) return false;
  if (obj.active?.to && ms > Date.parse(obj.active.to)) return false;
  if (obj.ephemeris.kind === "trajectory") {
    const span = trackSpan(obj.ephemeris.track);
    const jd = jdFromMs(ms);
    return !!span && jd >= span.startJd && jd <= span.endJd;
  }
  return true;
}

/** Heliocentric ecliptic position of any catalogued object, in AU (the Sun's position if unknown). */
export function heliocentricPosition(obj: SpaceObject, date: Date): Vec3 {
  const rel = relativePosition(obj, date) ?? { x: 0, y: 0, z: 0 };
  const center = frameCenter(obj);
  if (!center) return rel;
  const parent = CENTER_LOOKUP.get(center);
  return parent ? add(heliocentricPosition(parent, date), rel) : rel;
}

/** Set by data/solarSystem.ts to avoid an import cycle. */
const CENTER_LOOKUP = new Map<string, SpaceObject>();
export function registerCenters(objects: SpaceObject[]): void {
  for (const o of objects) CENTER_LOOKUP.set(o.id, o);
}

/**
 * Sample one full orbit around the object's parent, starting at `date`.
 * Heliocentric bodies return heliocentric points; moons return points
 * relative to their parent.
 */
export function sampleOrbit(obj: SpaceObject, date: Date, samples = 360): Vec3[] {
  const eph = obj.ephemeris;
  if (eph.kind !== "heliocentric" && eph.kind !== "geocentric-moon") return [];

  const periodDays =
    eph.kind === "geocentric-moon" ? MOON_SIDEREAL_DAYS : obj.physical.orbitalPeriodDays ?? 365.25;
  const stepMs = (periodDays * DAY_MS) / samples;
  const t0 = date.getTime();

  const points: Vec3[] = [];
  for (let i = 0; i <= samples; i++) {
    const d = new Date(t0 + i * stepMs);
    points.push(eph.kind === "geocentric-moon" ? geocentricMoon(d) : helio(eph.body, d));
  }
  // Close the loop exactly so tiny precession doesn't leave a gap.
  points[samples] = points[0];
  return points;
}
