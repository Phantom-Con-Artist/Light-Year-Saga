import * as Astronomy from "astronomy-engine";
import type { SpaceObject } from "../domain/types";

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

function helio(body: string, date: Date): Vec3 {
  return toEcliptic(Astronomy.HelioVector(body as Astronomy.Body, date));
}

/** Moon position relative to Earth, AU, ecliptic. */
export function geocentricMoon(date: Date): Vec3 {
  return toEcliptic(Astronomy.GeoMoon(date));
}

/** Heliocentric ecliptic position of any catalogued object, in AU. */
export function heliocentricPosition(obj: SpaceObject, date: Date): Vec3 {
  const eph = obj.ephemeris;
  switch (eph.kind) {
    case "fixed-origin":
      return { x: 0, y: 0, z: 0 };
    case "heliocentric":
      return helio(eph.body, date);
    case "geocentric-moon":
      return add(helio("Earth", date), geocentricMoon(date));
  }
}

/**
 * Sample one full orbit around the object's parent, starting at `date`.
 * Heliocentric bodies return heliocentric points; moons return points
 * relative to their parent.
 */
export function sampleOrbit(obj: SpaceObject, date: Date, samples = 360): Vec3[] {
  const eph = obj.ephemeris;
  if (eph.kind === "fixed-origin") return [];

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
