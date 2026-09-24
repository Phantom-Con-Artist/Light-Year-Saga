import { INTERSTELLAR_CATALOG } from "./interstellar";
import { COSMIC_CATALOG } from "./cosmic";
import type { CatalogObject, ExoPlanet } from "./types";

export * from "./types";
export { KNOWN_STARS, physicsForStar } from "./starPhysics";
export { SURVEY_SOURCE } from "./cosmic";

export const CATALOG: CatalogObject[] = [...INTERSTELLAR_CATALOG, ...COSMIC_CATALOG];

const BY_ID = new Map(CATALOG.map((o) => [o.id, o]));

export function getCatalogObject(id: string | null | undefined): CatalogObject | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export interface PlanetRef {
  system: CatalogObject;
  planet: ExoPlanet;
}

const PLANETS = new Map<string, PlanetRef>();
for (const o of CATALOG) for (const p of o.system?.planets ?? []) PLANETS.set(p.id, { system: o, planet: p });

export function getExoPlanet(id: string | null | undefined): PlanetRef | undefined {
  return id ? PLANETS.get(id) : undefined;
}

export const ALL_EXOPLANETS: PlanetRef[] = [...PLANETS.values()];

export const CATALOG_KIND_LABEL: Record<CatalogObject["kind"], string> = {
  galaxy: "Galaxy",
  "black-hole": "Black hole",
  quasar: "Quasar",
  star: "Star",
  "stellar-remnant": "Stellar remnant",
  nebula: "Nebula",
  cluster: "Galaxy cluster",
  void: "Cosmic void",
  structure: "Structure",
  "exo-system": "Planetary system",
};
