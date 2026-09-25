import type { Vector3 } from "three";
import type { ExternalSource } from "../../domain/types";
import type { SkyPhoto } from "./photos";

/** Which view level an object is placed in (units: ly or Mly). */
export type CatalogLevel = "interstellar" | "cosmic";

export type CatalogKind =
  | "galaxy"
  | "black-hole"
  | "quasar"
  | "star"
  | "stellar-remnant"
  | "nebula"
  | "cluster"
  | "group"
  | "supercluster"
  | "void"
  | "structure"
  | "exo-system";

export interface StarPhysics {
  radiusSolar: number;
  temperatureK: number;
  massSolar?: number;
  luminositySolar?: number;
  /** Radius is an estimate or disputed — shown in the UI. */
  radiusNote?: string;
}

export interface BlackHolePhysics {
  massSolar: number;
  /** Accretion disk outer edge in Schwarzschild radii (0 = dormant, no disk). */
  diskOuterRs: number;
  jets?: boolean;
}

export type PlanetStyle = "rocky" | "lava" | "ocean" | "ice" | "temperate" | "hot-jupiter" | "gas" | "ice-giant";

export interface ExoPlanet {
  id: string;
  name: string;
  semiMajorAxisAU: number;
  periodDays: number;
  radiusEarth: number;
  massEarth?: number;
  equilibriumTempK?: number;
  style: PlanetStyle;
  colorA: string;
  colorB: string;
  description: string;
  /** Radius inferred from mass (non-transiting planets). */
  radiusEstimated?: boolean;
}

export interface ExoSystem {
  star: StarPhysics;
  planets: ExoPlanet[];
  habitableZoneAU?: [number, number];
}

export type NebulaStyle = "emission" | "planetary" | "remnant" | "dark" | "pillars";

export interface NebulaVisual {
  type: "nebula";
  style: NebulaStyle;
  colorA: string;
  colorB: string;
  /** Aspect (width / height) of the main cloud. */
  aspect?: number;
}

export type GalaxyStyle = "spiral" | "barred" | "elliptical" | "sombrero" | "ring" | "irregular" | "interacting" | "lenticular";

export interface GalaxyVisual {
  type: "galaxy";
  style: GalaxyStyle;
  /** Sky placement for orientation. */
  ra: string;
  dec: string;
  positionAngleDeg: number;
  inclinationDeg: number;
  arms?: number;
  /** Warm = old stellar population, cool = star-forming. */
  tint?: "warm" | "cool" | "neutral";
}

export interface CatalogObject {
  id: string;
  name: string;
  kind: CatalogKind;
  level: CatalogLevel;
  classification: string;
  description: string;
  facts: [label: string, value: string][];
  /** Render-space position in the level's units (ly or Mly). */
  position: Vector3;
  /** Visual diameter in level units (0 = point-like). */
  extent: number;
  /** Comfortable camera distance when focused (level units). */
  framing: number;
  viewDirection?: Vector3;
  star?: StarPhysics;
  blackHole?: BlackHolePhysics;
  system?: ExoSystem;
  visual?: NebulaVisual | GalaxyVisual;
  /** A real telescope photograph, placed from its astrometry. */
  photo?: SkyPhoto;
  /** Label accent colour. */
  accent: string;
  /** Distance from Earth for display (level units already imply ly/Mly). */
  distanceLabel: string;
  visualNote?: string;
  sources: ExternalSource[];
  keywords?: string;
  /** Galaxy groups and clusters: index into the cosmic-web structure list (per-galaxy membership). */
  structureIndex?: number;
  /** Superclusters: index into the cosmic-web supercluster list. */
  superclusterIndex?: number;
}

/** A body the close-up view can render at true scale. */
export function hasCloseUp(o: CatalogObject): boolean {
  return !!(o.star || o.blackHole || o.system);
}
