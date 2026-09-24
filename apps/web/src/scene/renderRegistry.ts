import { Vector3 } from "three";
import { SOLAR_SYSTEM, OBJECTS_BY_ID } from "../data/solarSystem";
import { geocentricMoon, heliocentricPosition } from "../astronomy/ephemeris";
import { heliocentricToRender, localToRender, renderRadius, type RenderTuple } from "../astronomy/scale";

/**
 * Per-frame cache of scene positions, recomputed lazily whenever the
 * simulation time changes. Scene components read from here instead of
 * each calling the ephemeris themselves.
 */

const positions = new Map<string, Vector3>(SOLAR_SYSTEM.map((o) => [o.id, new Vector3()]));
const radii = new Map<string, number>(
  SOLAR_SYSTEM.map((o) => [o.id, renderRadius(o.physical.meanRadiusKm)]),
);

let syncedTime = Number.NaN;
const tmp: RenderTuple = [0, 0, 0];

export function syncRenderPositions(timeMs: number): void {
  if (timeMs === syncedTime) return;
  syncedTime = timeMs;
  const date = new Date(timeMs);

  // Parents first (catalogue order guarantees Earth precedes the Moon).
  for (const obj of SOLAR_SYSTEM) {
    const out = positions.get(obj.id)!;
    if (obj.ephemeris.kind === "geocentric-moon") {
      const parent = OBJECTS_BY_ID.get(obj.parentId!)!;
      localToRender(geocentricMoon(date), parent.physical.meanRadiusKm, tmp);
      out.set(tmp[0], tmp[1], tmp[2]).add(positions.get(parent.id)!);
    } else {
      heliocentricToRender(heliocentricPosition(obj, date), tmp);
      out.set(tmp[0], tmp[1], tmp[2]);
    }
  }
}

export function getRenderPosition(id: string): Vector3 {
  return positions.get(id)!;
}

export function getRenderRadius(id: string): number {
  return radii.get(id) ?? 1;
}
