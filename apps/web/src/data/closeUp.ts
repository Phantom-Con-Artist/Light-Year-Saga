import { getCatalogObject, KNOWN_STARS, physicsForStar, type BlackHolePhysics, type ExoSystem, type StarPhysics } from "./catalog";
import { starName, useStarStore } from "./stars";

/** What the true-scale close-up view renders. Units: solar radii (R☉). */
export type CloseUpSubject =
  | { kind: "star"; id: string; name: string; star: StarPhysics }
  | { kind: "black-hole"; id: string; name: string; blackHole: BlackHolePhysics }
  | { kind: "system"; id: string; name: string; system: ExoSystem };

export function resolveCloseUp(id: string | null): CloseUpSubject | null {
  if (!id) return null;
  if (id === "sun") return { kind: "star", id, name: "Sun", star: KNOWN_STARS.Sun };
  const c = getCatalogObject(id);
  if (c?.system) return { kind: "system", id, name: c.name, system: c.system };
  if (c?.blackHole) return { kind: "black-hole", id, name: c.id === "m87" ? "M87*" : c.name, blackHole: c.blackHole };
  if (c?.star) return { kind: "star", id, name: c.name, star: c.star };
  const catalog = useStarStore.getState().catalog;
  const i = catalog?.indexById.get(id);
  if (catalog && i !== undefined) {
    const name = starName(catalog, i);
    return { kind: "star", id, name, star: physicsForStar(catalog, i, name) };
  }
  return null;
}

export const R_SUN_KM = 695_700;
export const AU_KM = 149_597_870.7;
export const AU_IN_RSUN = AU_KM / R_SUN_KM;
export const R_EARTH_IN_RSUN = 6371 / R_SUN_KM;

export const REFERENCE_ORBITS = [
  { name: "Mercury", au: 0.387 },
  { name: "Venus", au: 0.723 },
  { name: "Earth", au: 1 },
  { name: "Mars", au: 1.524 },
  { name: "Jupiter", au: 5.203 },
  { name: "Saturn", au: 9.537 },
  { name: "Neptune", au: 30.07 },
];

export const REFERENCE_BODIES = [
  { name: "Earth", radius: R_EARTH_IN_RSUN, temperatureK: 0 },
  { name: "Jupiter", radius: 69_911 / R_SUN_KM, temperatureK: 0 },
  { name: "Sun", radius: 1, temperatureK: 5772 },
];

/** Radius used for "how big is it": star radius, or event horizon for black holes. */
export function subjectRadius(s: CloseUpSubject): number {
  if (s.kind === "star") return s.star.radiusSolar;
  if (s.kind === "black-hole") return (2.953 * s.blackHole.massSolar) / R_SUN_KM;
  return s.system.star.radiusSolar;
}

export function formatKm(km: number): string {
  if (km < 1000) return `${Math.round(km)} km`;
  if (km < 1e6) return `${Math.round(km).toLocaleString("en-US")} km`;
  if (km < 1e9) return `${(km / 1e6).toFixed(km < 1e7 ? 2 : 0)} million km`;
  return `${(km / 1e9).toFixed(2)} billion km`;
}

/** A plain-language comparison to things we know, for the close-up HUD. */
export function scaleSentence(s: CloseUpSubject): string {
  const r = subjectRadius(s);
  const km = r * R_SUN_KM;
  if (s.kind === "system") {
    const outer = Math.max(...s.system.planets.map((p) => p.semiMajorAxisAU));
    if (outer < 0.387) return `The whole planetary system would fit inside Mercury's orbit (${outer.toFixed(3)} AU vs 0.387 AU).`;
    return `Its planets span ${outer.toFixed(2)} AU — Earth orbits the Sun at 1 AU.`;
  }
  const noun = s.kind === "black-hole" ? "Its event horizon" : "Its surface";
  if (r < R_EARTH_IN_RSUN * 0.05) return `${noun} is only ~${formatKm(km * 2)} across — about the size of a city.`;
  if (r < 0.5) {
    const earths = r / R_EARTH_IN_RSUN;
    return earths < 2 ? `Roughly the size of Earth (${earths.toFixed(2)} × Earth's radius).` : `${earths.toFixed(0)} times wider than Earth, ${(r).toFixed(2)} × the Sun.`;
  }
  const engulfed = REFERENCE_ORBITS.filter((o) => o.au * AU_IN_RSUN < r);
  if (engulfed.length) {
    const last = engulfed[engulfed.length - 1];
    return `Placed where the Sun is, ${noun.toLowerCase()} would reach beyond the orbit of ${last.name}.`;
  }
  const mercury = REFERENCE_ORBITS[0].au * AU_IN_RSUN;
  if (r > mercury * 0.15) return `${noun} would reach ${Math.round((r / mercury) * 100)}% of the way to Mercury's orbit.`;
  return `${r.toFixed(r < 10 ? 2 : 0)} times the Sun's radius — ${Math.round(r * r * r).toLocaleString("en-US")} Suns would fit inside by volume.`;
}
