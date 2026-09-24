/**
 * Core object model. The 3D scene only needs identity + visual + ephemeris
 * binding; everything scientific lives in `physical` and `sources` so it can
 * later be replaced/augmented by the API resolver without touching the scene.
 */

export type SpaceObjectType =
  | "star"
  | "planet"
  | "dwarf-planet"
  | "moon"
  | "asteroid"
  | "comet"
  | "satellite"
  | "spacecraft"
  | "space-station"
  | "telescope";

/** How fresh a piece of data is. Never label archival/static data as live. */
export type DataFreshness = "LIVE" | "RECENT" | "ARCHIVED" | "STATIC" | "COMPUTED";

export interface ExternalSource {
  provider: string;
  name: string;
  url?: string;
  freshness: DataFreshness;
}

/** Binds an object to an ephemeris model — how to compute its real position. */
export type EphemerisBinding =
  | { kind: "fixed-origin" }
  | { kind: "heliocentric"; body: string }
  | { kind: "geocentric-moon" };

export interface PhysicalProperties {
  meanRadiusKm: number;
  massKg?: number;
  surfaceGravityMs2?: number;
  /** Sidereal rotation period; negative = retrograde. */
  rotationPeriodHours?: number;
  /** Sidereal orbital period around parent. */
  orbitalPeriodDays?: number;
  axialTiltDeg?: number;
  meanTemperatureK?: number;
}

export type SurfaceStyle = "star" | "rocky" | "cloudy" | "terran" | "banded" | "ice";

export interface VisualDefinition {
  style: SurfaceStyle;
  /** Primary / secondary surface colours used by the procedural shader. */
  colorA: string;
  colorB: string;
  /** Atmosphere / rim glow colour. Omit for airless bodies. */
  atmosphere?: string;
  rings?: { innerRadii: number; outerRadii: number; color: string };
  /** HUD accent for labels / orbit lines. */
  accent: string;
}

export interface SpaceObject {
  id: string;
  name: string;
  type: SpaceObjectType;
  classification: string;
  parentId?: string;
  description: string;
  physical: PhysicalProperties;
  ephemeris: EphemerisBinding;
  visual: VisualDefinition;
  sources: ExternalSource[];
}
