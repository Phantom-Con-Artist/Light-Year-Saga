import { INTERSTELLAR_CATALOG } from "./interstellar";
import { COSMIC_CATALOG } from "./cosmic";
import type { CatalogObject, ExoPlanet } from "./types";
import { PHOTOS, photoSize } from "./photos";

export * from "./types";
export type { SkyPhoto } from "./photos";
export { photoSize } from "./photos";
export { KNOWN_STARS, physicsForStar } from "./starPhysics";
export { SURVEY_SOURCE } from "./cosmic";

/**
 * Objects with a real photograph arrive looking from Earth's direction, so the
 * first view matches the telescope's, framed to the photo.
 */
function withPhoto(o: CatalogObject): CatalogObject {
  const photo = PHOTOS[o.id];
  if (!photo) return o;
  const [w, h] = photoSize(photo, o.position.length());
  return {
    ...o,
    photo,
    viewDirection: o.position.clone().normalize().negate(),
    framing: Math.max(1.3 * h, 1.1 * w),
  };
}

export const CATALOG: CatalogObject[] = [...INTERSTELLAR_CATALOG, ...COSMIC_CATALOG].map(withPhoto);

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
