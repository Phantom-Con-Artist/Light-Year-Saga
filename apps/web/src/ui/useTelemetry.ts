import { useEffect, useState } from "react";
import type { SpaceObject } from "../domain/types";
import { getObject } from "../data/solarSystem";
import {
  AU_KM,
  LIGHT_SPEED_KM_S,
  existsAt,
  frameCenter,
  heliocentricPosition,
  length,
  relativePosition,
  sub,
} from "../astronomy/ephemeris";
import { useTimeStore } from "../state/timeStore";

export interface Telemetry {
  /** False when the object isn't in space at this time (before launch, after re-entry…). */
  present: boolean;
  /** Distance from the Sun, AU (undefined for the Sun itself). */
  sunDistanceAu?: number;
  /** Distance from Earth, AU (undefined for Earth itself). */
  earthDistanceAu?: number;
  /** One-way light time from Earth, seconds. */
  lightTimeFromEarthS?: number;
  /** Speed relative to the body it orbits (the Sun for heliocentric objects), km/s. */
  orbitalSpeedKmS?: number;
  /** For moons and satellites: the planet, its centre distance and the height above its surface. */
  parent?: { name: string; distanceKm: number; altitudeKm: number };
}

const REFRESH_MS = 200;
const VELOCITY_STEP_S = 10;

function compute(obj: SpaceObject, timeMs: number): Telemetry {
  if (!existsAt(obj, timeMs)) return { present: false };
  const date = new Date(timeMs);
  const earth = getObject("earth")!;
  const pos = heliocentricPosition(obj, date);
  const earthPos = heliocentricPosition(earth, date);
  const t: Telemetry = { present: true };

  if (obj.type !== "star") t.sunDistanceAu = length(pos);
  if (obj.id !== "earth") {
    t.earthDistanceAu = length(sub(pos, earthPos));
    t.lightTimeFromEarthS = (t.earthDistanceAu * AU_KM) / LIGHT_SPEED_KM_S;
  }

  if (obj.ephemeris.kind !== "fixed-origin") {
    const now = relativePosition(obj, date);
    const later = relativePosition(obj, new Date(timeMs + VELOCITY_STEP_S * 1000));
    if (now && later) t.orbitalSpeedKmS = (length(sub(later, now)) * AU_KM) / VELOCITY_STEP_S;
    const center = frameCenter(obj);
    const parent = center ? getObject(center) : undefined;
    if (parent && now) {
      const distanceKm = length(now) * AU_KM;
      t.parent = { name: parent.name, distanceKm, altitudeKm: distanceKm - parent.physical.meanRadiusKm };
    }
  }
  return t;
}

/** Live-computed state of an object at the current simulation time. */
export function useTelemetry(obj: SpaceObject | undefined): Telemetry | null {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);

  useEffect(() => {
    if (!obj) {
      setTelemetry(null);
      return;
    }
    const tick = () => setTelemetry(compute(obj, useTimeStore.getState().timeMs));
    tick();
    const id = window.setInterval(tick, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [obj]);

  return telemetry;
}
