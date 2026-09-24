import { useEffect, useState } from "react";
import type { SpaceObject } from "../domain/types";
import { getObject } from "../data/solarSystem";
import {
  AU_KM,
  LIGHT_SPEED_KM_S,
  geocentricMoon,
  heliocentricPosition,
  length,
  sub,
} from "../astronomy/ephemeris";
import { useTimeStore } from "../state/timeStore";

export interface Telemetry {
  /** Distance from the Sun, AU (undefined for the Sun itself). */
  sunDistanceAu?: number;
  /** Distance from Earth, AU (undefined for Earth itself). */
  earthDistanceAu?: number;
  /** One-way light time from Earth, seconds. */
  lightTimeFromEarthS?: number;
  /** Speed relative to the parent body, km/s. */
  orbitalSpeedKmS?: number;
}

const REFRESH_MS = 200;
const VELOCITY_STEP_S = 60;

function compute(obj: SpaceObject, timeMs: number): Telemetry {
  const date = new Date(timeMs);
  const earth = getObject("earth")!;
  const pos = heliocentricPosition(obj, date);
  const earthPos = heliocentricPosition(earth, date);
  const t: Telemetry = {};

  if (obj.type !== "star") t.sunDistanceAu = length(pos);
  if (obj.id !== "earth") {
    t.earthDistanceAu = length(sub(pos, earthPos));
    t.lightTimeFromEarthS = (t.earthDistanceAu * AU_KM) / LIGHT_SPEED_KM_S;
  }

  if (obj.ephemeris.kind !== "fixed-origin") {
    const later = new Date(timeMs + VELOCITY_STEP_S * 1000);
    const displacement =
      obj.ephemeris.kind === "geocentric-moon"
        ? sub(geocentricMoon(later), geocentricMoon(date))
        : sub(heliocentricPosition(obj, later), pos);
    t.orbitalSpeedKmS = (length(displacement) * AU_KM) / VELOCITY_STEP_S;
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
