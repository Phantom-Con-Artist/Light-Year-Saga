import { AU_KM, length, type Vec3 } from "./ephemeris";

/**
 * Visualization transform: real coordinates → render coordinates.
 *
 * A literal-scale Solar System is unusable (Neptune is ~4,500× further from
 * the Sun than Earth's radius is wide), so we compress distances and radii
 * with power laws. Directions are always preserved; only magnitudes change.
 * Real positions are never mutated — see docs/coordinate-scale-strategy.md.
 *
 * Axis mapping (ecliptic → three.js, y-up):
 *   render.x =  ecl.x
 *   render.y =  ecl.z   (ecliptic north is "up")
 *   render.z = -ecl.y
 */

/** Render units per sqrt(AU). Earth sits at 40, Neptune at ~220. */
export const DISTANCE_SCALE = 40;
const DISTANCE_EXPONENT = 0.5;

const RADIUS_SCALE = 0.03;
const RADIUS_EXPONENT = 0.4;

/**
 * Moons and satellites: distance from the parent in parent radii, compressed
 * logarithmically so a whole moon system (Io at 6 radii to Phoebe at 220)
 * stays readable, orbits keep their order, and Saturn's moons clear its rings.
 */
const MOON_BASE = 1.25;
const MOON_LOG = 1.3;

export type RenderTuple = [number, number, number];

export function renderDistance(au: number): number {
  return DISTANCE_SCALE * Math.pow(au, DISTANCE_EXPONENT);
}

export function renderRadius(radiusKm: number): number {
  return RADIUS_SCALE * Math.pow(radiusKm, RADIUS_EXPONENT);
}

function axisMap(v: Vec3, scale: number, out: RenderTuple): RenderTuple {
  out[0] = v.x * scale;
  out[1] = v.z * scale;
  out[2] = -v.y * scale;
  return out;
}

/** Heliocentric position (AU) → scene position. */
export function heliocentricToRender(v: Vec3, out: RenderTuple = [0, 0, 0]): RenderTuple {
  const d = length(v);
  if (d === 0) return axisMap(v, 0, out);
  return axisMap(v, renderDistance(d) / d, out);
}

/** Inverse of renderDistance: scene units → AU. */
export function auFromRender(d: number): number {
  return Math.pow(d / DISTANCE_SCALE, 1 / DISTANCE_EXPONENT);
}

/** Parameters of the local (moon) mapping, for shaders that reproduce it. */
export const LOCAL_MAPPING = { base: MOON_BASE, log: MOON_LOG };

/** Offset of a moon from its parent (AU) → scene offset from the parent. */
export function localToRender(
  offsetAu: Vec3,
  parentRadiusKm: number,
  out: RenderTuple = [0, 0, 0],
): RenderTuple {
  const d = length(offsetAu);
  if (d === 0) return axisMap(offsetAu, 0, out);
  const radii = (d * AU_KM) / parentRadiusKm;
  const rendered = renderRadius(parentRadiusKm) * (MOON_BASE + MOON_LOG * Math.log(Math.max(radii, 1)));
  return axisMap(offsetAu, rendered / d, out);
}
