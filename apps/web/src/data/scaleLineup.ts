import type { ExoPlanet } from "./catalog";

/**
 * The size line-up, smallest to largest. Radii in km: physical radius for
 * planets/stars, event-horizon (Schwarzschild) radius for black holes,
 * orbital radius for the Solar System entry.
 */
export interface ScaleEntry {
  id: string;
  name: string;
  radiusKm: number;
  kind: "planet" | "star" | "black-hole" | "orbit";
  /** Object to open in the inspector / credit as a discovery. */
  linkId?: string;
  /** HYG proper name to resolve to a catalogue star id at runtime. */
  hygName?: string;
  temperatureK?: number;
  planet?: Pick<ExoPlanet, "id" | "style" | "colorA" | "colorB" | "equilibriumTempK">;
  diskOuterRs?: number;
  jets?: boolean;
  blurb: string;
}

const RS_KM = (massSolar: number) => 2.953 * massSolar;
const R_SUN = 695_700;
const R_EARTH = 6371;
const AU = 149_597_870.7;

const planet = (id: string, style: ExoPlanet["style"], colorA: string, colorB: string, t?: number) => ({ id, style, colorA, colorB, equilibriumTempK: t });

export const SCALE_LINEUP: ScaleEntry[] = [
  { id: "s-crab-pulsar", name: "Crab Pulsar", radiusKm: 10, kind: "star", temperatureK: 40_000, linkId: "crab-pulsar", blurb: "A neutron star: 1.4 Suns of matter crushed into a ball the size of a city, spinning 30 times a second." },
  { id: "s-gaia-bh1", name: "Gaia BH1", radiusKm: RS_KM(9.6), kind: "black-hole", diskOuterRs: 0, linkId: "gaia-bh1", blurb: "The nearest known black hole. Its event horizon is about 57 km across." },
  { id: "s-cygnus-x1", name: "Cygnus X-1", radiusKm: RS_KM(21.2), kind: "black-hole", diskOuterRs: 14, linkId: "cygnus-x1", blurb: "21 Suns of mass inside an event horizon ~125 km wide, feeding on its companion." },
  { id: "s-moon", name: "Moon", radiusKm: 1737.4, kind: "planet", linkId: "moon", planet: planet("moon", "rocky", "#b5b2ad", "#5d5a56"), blurb: "Earth's companion — about a quarter of Earth's width." },
  { id: "s-mercury", name: "Mercury", radiusKm: 2439.7, kind: "planet", linkId: "mercury", planet: planet("mercury", "rocky", "#8c8680", "#4a4541"), blurb: "The smallest planet in our Solar System." },
  { id: "s-sirius-b", name: "Sirius B", radiusKm: 5_800, kind: "star", temperatureK: 25_000, linkId: "sirius-b", blurb: "A white dwarf: the Sun's mass squeezed into something the size of Earth." },
  { id: "s-trappist-1e", name: "TRAPPIST-1 e", radiusKm: 0.92 * R_EARTH, kind: "planet", linkId: "trappist-1e", planet: planet("trappist-1e", "ocean", "#2f6fa8", "#c9d8e6"), blurb: "A potentially habitable exoplanet, 40 light-years away, just smaller than Earth." },
  { id: "s-earth", name: "Earth", radiusKm: R_EARTH, kind: "planet", linkId: "earth", planet: planet("earth", "temperate", "#1f6fb8", "#3f8f4a"), blurb: "Home. Everything you've ever known is on this 12,742 km ball." },
  { id: "s-neptune", name: "Neptune", radiusKm: 24_622, kind: "planet", linkId: "neptune", planet: planet("neptune", "ice-giant", "#3d5fd9", "#233a8f"), blurb: "About four Earths wide." },
  { id: "s-jupiter", name: "Jupiter", radiusKm: 69_911, kind: "planet", linkId: "jupiter", planet: planet("jupiter", "gas", "#d9b98f", "#9a6a44"), blurb: "Eleven Earths would fit across it." },
  { id: "s-trappist-1", name: "TRAPPIST-1", radiusKm: 0.1192 * R_SUN, kind: "star", temperatureK: 2566, linkId: "trappist-1", blurb: "A star only slightly larger than Jupiter — yet it has seven planets." },
  { id: "s-proxima", name: "Proxima Centauri", radiusKm: 0.1542 * R_SUN, kind: "star", temperatureK: 3042, hygName: "Proxima Centauri", blurb: "The nearest star to the Sun: a small red dwarf." },
  { id: "s-wasp-12b", name: "WASP-12 b", radiusKm: 21.7 * R_EARTH, kind: "planet", linkId: "wasp-12-b", planet: planet("wasp-12-b", "hot-jupiter", "#3a2a24", "#140c0a", 2580), blurb: "A bloated hot Jupiter — larger than some stars, puffed up by its star's heat." },
  { id: "s-sun", name: "Sun", radiusKm: R_SUN, kind: "star", temperatureK: 5772, linkId: "sun", blurb: "Our star. 109 Earths across; 1.3 million Earths would fit inside." },
  { id: "s-sirius", name: "Sirius A", radiusKm: 1.711 * R_SUN, kind: "star", temperatureK: 9940, hygName: "Sirius", blurb: "The brightest star in the night sky, 1.7 times the Sun's size." },
  { id: "s-vega", name: "Vega", radiusKm: 2.73 * R_SUN, kind: "star", temperatureK: 9600, hygName: "Vega", blurb: "A fast-spinning white star 25 light-years away." },
  { id: "s-sgr-a", name: "Sagittarius A*", radiusKm: RS_KM(4.3e6), kind: "black-hole", diskOuterRs: 10, linkId: "sgr-a-star", blurb: "4.3 million Suns of mass — yet its event horizon would fit inside Mercury's orbit." },
  { id: "s-arcturus", name: "Arcturus", radiusKm: 25.4 * R_SUN, kind: "star", temperatureK: 4286, hygName: "Arcturus", blurb: "An orange giant — what the Sun will become in ~5 billion years." },
  { id: "s-polaris", name: "Polaris", radiusKm: 37.5 * R_SUN, kind: "star", temperatureK: 6015, hygName: "Polaris", blurb: "The North Star, a yellow supergiant." },
  { id: "s-r136a1", name: "R136a1", radiusKm: 42.7 * R_SUN, kind: "star", temperatureK: 46_000, linkId: "r136a1", blurb: "The most massive star known (~200 Suns) — heavy, but not especially big." },
  { id: "s-aldebaran", name: "Aldebaran", radiusKm: 44.1 * R_SUN, kind: "star", temperatureK: 3900, hygName: "Aldebaran", blurb: "The red eye of Taurus the bull." },
  { id: "s-rigel", name: "Rigel", radiusKm: 78.9 * R_SUN, kind: "star", temperatureK: 12_100, hygName: "Rigel", blurb: "A blue supergiant ~120,000 times as luminous as the Sun." },
  { id: "s-antares", name: "Antares", radiusKm: 680 * R_SUN, kind: "star", temperatureK: 3660, hygName: "Antares", blurb: "The heart of Scorpius. It would engulf Mars." },
  { id: "s-betelgeuse", name: "Betelgeuse", radiusKm: 764 * R_SUN, kind: "star", temperatureK: 3600, hygName: "Betelgeuse", blurb: "Orion's shoulder. Placed at the Sun, it would swallow Mars and reach toward Jupiter." },
  { id: "s-uy-scuti", name: "UY Scuti", radiusKm: 909 * R_SUN, kind: "star", temperatureK: 3550, linkId: "uy-scuti", blurb: "Once thought the largest star (1,708 R☉); now estimated ~909 R☉." },
  { id: "s-vy-cma", name: "VY Canis Majoris", radiusKm: 1420 * R_SUN, kind: "star", temperatureK: 3490, linkId: "vy-cma", blurb: "A hypergiant ~1,420 times the Sun's radius, shedding its outer layers." },
  { id: "s-st2-18", name: "Stephenson 2-18", radiusKm: 2150 * R_SUN, kind: "star", temperatureK: 3200, linkId: "stephenson-2-18", blurb: "Among the largest known stars: it would reach past Saturn's orbit." },
  { id: "s-solar-system", name: "Neptune's orbit", radiusKm: 30.07 * AU, kind: "orbit", linkId: "neptune", blurb: "Our entire planetary system, 60 AU across. The Sun is the speck in the middle." },
  { id: "s-m87", name: "M87*", radiusKm: RS_KM(6.5e9), kind: "black-hole", diskOuterRs: 8, jets: true, linkId: "m87", blurb: "The first black hole ever imaged. Its event horizon is ~250 AU across — four Solar Systems." },
  { id: "s-ton-618", name: "TON 618", radiusKm: RS_KM(4.07e10), kind: "black-hole", diskOuterRs: 6, jets: true, linkId: "ton-618", blurb: "One of the largest black holes known: an event horizon ~1,600 AU across. Our Solar System out to Neptune would fit 27 times across it." },
];
