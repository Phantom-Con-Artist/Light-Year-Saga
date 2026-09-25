import type { ConicElements, MoonOrbitElements } from "../astronomy/kepler";
import type { IauRotation } from "../astronomy/orientation";

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
  | "telescope"
  /** A zone rather than a body: asteroid belt, Kuiper belt, heliosphere… */
  | "region";

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
  /** Astronomy Engine planet / Pluto model. */
  | { kind: "heliocentric"; body: string }
  | { kind: "geocentric-moon" }
  /** Heliocentric two-body conic from JPL SBDB elements. */
  | { kind: "conic"; elements: ConicElements }
  /** Planet-centred orbit fitted to JPL Horizons (relative to parentId). */
  | { kind: "moon-orbit"; orbit: MoonOrbitElements }
  /** Spacecraft trajectory from JPL Horizons (/data/spacecraft.bin). */
  | { kind: "trajectory"; track: string }
  /** Earth satellite from a CelesTrak TLE, propagated with SGP4. */
  | { kind: "tle"; satellite: string };

export interface PhysicalProperties {
  /** Moons: always turn the same face to the parent (default true for moons). */
  tidallyLocked?: boolean;
  /** IAU rotation model; without it bodies spin about ecliptic north. */
  rotation?: IauRotation;
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

export type SpacecraftModel = "iss" | "tiangong" | "hubble" | "jwst" | "voyager" | "pioneer" | "new-horizons" | "cassini" | "juno" | "clipper" | "parker";

export type SurfaceStyle = "star" | "rocky" | "cloudy" | "terran" | "banded" | "ice";

export interface VisualDefinition {
  style: SurfaceStyle;
  /** Primary / secondary surface colours used by the procedural shader. */
  colorA: string;
  colorB: string;
  /** Atmosphere / rim glow colour. Omit for airless bodies. */
  atmosphere?: string;
  rings?: { innerRadii: number; outerRadii: number; color: string };
  /** Ellipsoid axes relative to the mean radius (x, polar y, z), for elongated bodies. */
  shape?: [number, number, number];
  /** Built from primitives instead of a sphere. */
  model?: SpacecraftModel;
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
  /** Extra fact rows for the inspector. */
  facts?: [string, string][];
  /** Dates (ISO) between which the object exists in the simulation (launch, re-entry…). */
  active?: { from?: string; to?: string };
  /** Moments worth jumping the clock to. */
  moments?: { label: string; date: string }[];
  /** Zone extent, for regions. */
  region?: { innerAu: number; outerAu: number };
  /** Came from outside the Solar System. */
  interstellar?: boolean;
}
