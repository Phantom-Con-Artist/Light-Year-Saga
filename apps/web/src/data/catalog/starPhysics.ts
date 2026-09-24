import type { StarPhysics } from "./types";
import { luminositySolar, temperatureFromBV, type StarCatalog } from "../stars";

/**
 * Measured physical data for well-known catalogue stars, keyed by their HYG
 * proper name. Anything not listed gets an estimate (see `physicsForStar`).
 */
export const KNOWN_STARS: Record<string, StarPhysics> = {
  Sun: { radiusSolar: 1, temperatureK: 5772, massSolar: 1, luminositySolar: 1 },
  Sirius: { radiusSolar: 1.711, temperatureK: 9940, massSolar: 2.063, luminositySolar: 25.4 },
  Canopus: { radiusSolar: 71, temperatureK: 7400, massSolar: 9, luminositySolar: 10_700 },
  "Rigil Kentaurus": { radiusSolar: 1.2175, temperatureK: 5790, massSolar: 1.0788, luminositySolar: 1.52 },
  Toliman: { radiusSolar: 0.8591, temperatureK: 5260, massSolar: 0.9092, luminositySolar: 0.5 },
  "Proxima Centauri": { radiusSolar: 0.1542, temperatureK: 3042, massSolar: 0.1221, luminositySolar: 0.0017 },
  "Barnard's Star": { radiusSolar: 0.187, temperatureK: 3195, massSolar: 0.162, luminositySolar: 0.0035 },
  Arcturus: { radiusSolar: 25.4, temperatureK: 4286, massSolar: 1.08, luminositySolar: 170 },
  Vega: { radiusSolar: 2.73, temperatureK: 9600, massSolar: 2.14, luminositySolar: 40 },
  Capella: { radiusSolar: 11.98, temperatureK: 4970, massSolar: 2.57, luminositySolar: 79 },
  Rigel: { radiusSolar: 78.9, temperatureK: 12_100, massSolar: 21, luminositySolar: 120_000 },
  Procyon: { radiusSolar: 2.048, temperatureK: 6530, massSolar: 1.499, luminositySolar: 6.9 },
  Betelgeuse: { radiusSolar: 764, temperatureK: 3600, massSolar: 18, luminositySolar: 126_000, radiusNote: "Estimates range ~640–1,020 R☉" },
  Achernar: { radiusSolar: 7.3, temperatureK: 15_000, massSolar: 6.7, luminositySolar: 3_150, radiusNote: "Polar radius; equator is ~50% wider (fast spin)" },
  Altair: { radiusSolar: 1.79, temperatureK: 7700, massSolar: 1.86, luminositySolar: 10.6 },
  Aldebaran: { radiusSolar: 44.1, temperatureK: 3900, massSolar: 1.16, luminositySolar: 439 },
  Antares: { radiusSolar: 680, temperatureK: 3660, massSolar: 13, luminositySolar: 75_900 },
  Spica: { radiusSolar: 7.47, temperatureK: 25_300, massSolar: 11.4, luminositySolar: 20_500 },
  Pollux: { radiusSolar: 9.06, temperatureK: 4586, massSolar: 1.91, luminositySolar: 32.7 },
  Deneb: { radiusSolar: 203, temperatureK: 8525, massSolar: 19, luminositySolar: 196_000 },
  Polaris: { radiusSolar: 37.5, temperatureK: 6015, massSolar: 5.4, luminositySolar: 1_260 },
  Regulus: { radiusSolar: 4.35, temperatureK: 12_460, massSolar: 3.8, luminositySolar: 316 },
  Fomalhaut: { radiusSolar: 1.84, temperatureK: 8590, massSolar: 1.92, luminositySolar: 16.6 },
  Mira: { radiusSolar: 332, temperatureK: 3100, massSolar: 1.2, luminositySolar: 9_360, radiusNote: "Pulsates; radius varies" },
};

/**
 * Physics for any catalogue star: measured values when known, otherwise an
 * estimate from the Stefan–Boltzmann law using luminosity (from absolute V
 * magnitude, no bolometric correction) and temperature (from B−V).
 */
export function physicsForStar(catalog: StarCatalog, index: number, name: string): StarPhysics {
  const known = KNOWN_STARS[name];
  if (known) return known;
  const temperatureK = temperatureFromBV(catalog.colorIndex[index]);
  const L = luminositySolar(catalog.absMag[index]);
  const radiusSolar = Math.sqrt(L) * (5772 / temperatureK) ** 2;
  return { radiusSolar, temperatureK, luminositySolar: L, radiusNote: "Estimated from brightness and colour" };
}
