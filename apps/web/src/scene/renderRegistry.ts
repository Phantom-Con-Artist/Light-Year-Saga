import { Quaternion, Vector3 } from "three";
import { SOLAR_SYSTEM, OBJECTS_BY_ID } from "../data/solarSystem";
import { existsAt, frameCenter, relativePosition, type Vec3 } from "../astronomy/ephemeris";
import { heliocentricToRender, localToRender, renderDistance, renderRadius, type RenderTuple } from "../astronomy/scale";
import { spacecraftToRender } from "../astronomy/orbits";
import { onTrajectoriesLoaded } from "../astronomy/trajectories";

/**
 * Per-frame cache of scene positions, recomputed lazily whenever the
 * simulation time changes. Scene components read from here instead of
 * each calling the ephemeris themselves.
 */

const positions = new Map<string, Vector3>(SOLAR_SYSTEM.map((o) => [o.id, new Vector3()]));
const radii = new Map<string, number>(SOLAR_SYSTEM.map((o) => [o.id, renderRadius(o.physical.meanRadiusKm)]));
const present = new Map<string, boolean>(SOLAR_SYSTEM.map((o) => [o.id, false]));

let syncedTime = Number.NaN;
const tmp: RenderTuple = [0, 0, 0];
const rel: Vec3 = { x: 0, y: 0, z: 0 };

// Spacecraft appear once their trajectories arrive.
onTrajectoriesLoaded(() => {
  syncedTime = Number.NaN;
});

export function syncRenderPositions(timeMs: number): void {
  if (timeMs === syncedTime) return;
  syncedTime = timeMs;
  const date = new Date(timeMs);

  // Parents come before children in the catalogue.
  for (const obj of SOLAR_SYSTEM) {
    const out = positions.get(obj.id)!;
    const center = frameCenter(obj);
    const p = existsAt(obj, timeMs) ? relativePosition(obj, date, rel) : null;
    if (!p) {
      present.set(obj.id, false);
      // Park unknown objects on their centre so nothing reads garbage.
      if (center) out.copy(positions.get(center)!);
      continue;
    }
    present.set(obj.id, true);
    if (center) {
      const parent = OBJECTS_BY_ID.get(center)!;
      localToRender(p, parent.physical.meanRadiusKm, tmp);
      out.set(tmp[0], tmp[1], tmp[2]).add(positions.get(center)!);
    } else if (obj.ephemeris.kind === "trajectory") {
      spacecraftToRender(p, date, tmp);
      out.set(tmp[0], tmp[1], tmp[2]);
    } else {
      heliocentricToRender(p, tmp);
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

/** Does the object exist (and have a known position) at the synced time? */
export function isPresent(id: string): boolean {
  return present.get(id) ?? false;
}

/** Scene-space extent of a region (its outer radius). */
export function regionRenderRadius(id: string): number {
  const obj = OBJECTS_BY_ID.get(id);
  if (!obj?.region) return getRenderRadius(id);
  if (obj.parentId === "earth") return getRenderRadius("earth") * 4;
  return renderDistance(obj.region.outerAu);
}

/** Current surface orientation of each rendered body (mesh +X = longitude 0, +Y = north). */
const orientations = new Map<string, Quaternion>();
export function setBodyOrientation(id: string, q: Quaternion): void {
  let o = orientations.get(id);
  if (!o) orientations.set(id, (o = new Quaternion()));
  o.copy(q);
}
export function getBodyOrientation(id: string): Quaternion | undefined {
  return orientations.get(id);
}
