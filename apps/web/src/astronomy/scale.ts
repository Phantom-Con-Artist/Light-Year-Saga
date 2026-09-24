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

/** Moons: distance from parent measured in parent radii, then compressed. */
const MOON_BASE = 1.5;
const MOON_SCALE = 0.35;

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

/** Offset of a moon from its parent (AU) → scene offset from the parent. */
export function localToRender(
  offsetAu: Vec3,
  parentRadiusKm: number,
  out: RenderTuple = [0, 0, 0],
): RenderTuple {
  const d = length(offsetAu);
  if (d === 0) return axisMap(offsetAu, 0, out);
  const radii = (d * AU_KM) / parentRadiusKm;
  const rendered = renderRadius(parentRadiusKm) * (MOON_BASE + MOON_SCALE * Math.sqrt(radii));
  return axisMap(offsetAu, rendered / d, out);
}
