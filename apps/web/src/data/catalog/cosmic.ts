import { Vector3 } from "three";
import { GALACTIC_CENTRE } from "../../astronomy/galactic";
import { skyToRender } from "../../astronomy/sky";
import { comovingDistanceMly, lookbackTimeGyr, OBSERVABLE_UNIVERSE_RADIUS_MLY } from "../../astronomy/cosmology";
import type { CatalogObject, GalaxyVisual } from "./types";
import { doi, simbad, TWO_MRS } from "./sources";

/**
 * Objects placed in the Universe view (units: millions of light-years,
 * Sun at origin). Nearby galaxies use redshift-independent distances;
 * quasars use comoving distance from their redshift (Planck 2018 cosmology).
 */

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });

function galaxy(
  o: Omit<CatalogObject, "kind" | "level" | "position" | "framing" | "accent" | "visual" | "extent" | "distanceLabel"> & {
    ra: string;
    dec: string;
    distanceMly: number;
    diameterLy: number;
    style: GalaxyVisual["style"];
    pa: number;
    inc: number;
    arms?: number;
    tint?: GalaxyVisual["tint"];
    accent?: string;
  },
): CatalogObject {
  const extent = o.diameterLy / 1e6;
  return {
    ...o,
    kind: "galaxy",
    level: "cosmic",
    position: skyToRender(o.ra, o.dec, o.distanceMly),
    extent,
    framing: extent * 2.2,
    accent: o.accent ?? "#c9b8ff",
    distanceLabel: o.distanceMly >= 1000 ? `${fmt(o.distanceMly / 1000, 2)} billion ly` : `${fmt(o.distanceMly, o.distanceMly < 1 ? 2 : 1)} million ly`,
    visual: { type: "galaxy", style: o.style, ra: o.ra, dec: o.dec, positionAngleDeg: o.pa, inclinationDeg: o.inc, arms: o.arms, tint: o.tint },
  };
}

const MW_DIAMETER_MLY = 0.1;

const localGroup: CatalogObject[] = [
  {
    id: "milky-way-cosmic",
    name: "Milky Way",
    kind: "galaxy",
    level: "cosmic",
    classification: "Our galaxy",
    description: "Home. From out here, our entire galaxy is a single spiral among hundreds of billions.",
    facts: [
      ["Diameter", "~100,000 ly"],
      ["Group", "Local Group (~80 galaxies)"],
      ["Supercluster", "Laniakea"],
    ],
    position: GALACTIC_CENTRE.clone().multiplyScalar(1e-6),
    extent: MW_DIAMETER_MLY,
    framing: 0.3,
    accent: "#c9b8ff",
    distanceLabel: "You are here",
    sources: [simbad("Galactic Center")],
    keywords: "home galaxy",
  },
  galaxy({
    id: "lmc",
    name: "Large Magellanic Cloud",
    classification: "Satellite galaxy (Magellanic spiral)",
    description:
      "The Milky Way's biggest satellite galaxy, easily seen from the southern hemisphere. It holds the Tarantula Nebula and was the site of Supernova 1987A, the closest supernova seen in modern times.",
    facts: [
      ["Distance", "~163,000 ly"],
      ["Diameter", "~32,000 ly"],
      ["Stars", "~30 billion"],
    ],
    ra: "05h23m34.5s",
    dec: "-69°45′22″",
    distanceMly: 0.163,
    diameterLy: 32_200,
    style: "irregular",
    pa: 170,
    inc: 35,
    tint: "cool",
    sources: [simbad("LMC")],
    keywords: "magellanic",
  }),
  galaxy({
    id: "smc",
    name: "Small Magellanic Cloud",
    classification: "Satellite dwarf irregular galaxy",
    description: "A smaller companion of the LMC, being torn apart by the gravity of both the LMC and the Milky Way.",
    facts: [
      ["Distance", "~200,000 ly"],
      ["Diameter", "~19,000 ly"],
    ],
    ra: "00h52m44.8s",
    dec: "-72°49′43″",
    distanceMly: 0.2,
    diameterLy: 18_900,
    style: "irregular",
    pa: 45,
    inc: 40,
    tint: "cool",
    sources: [simbad("SMC")],
    keywords: "magellanic",
  }),
  galaxy({
    id: "andromeda",
    name: "Andromeda Galaxy",
    classification: "Spiral galaxy (M31)",
    description:
      "The nearest large galaxy and the farthest thing most people can see with the naked eye. It is heading toward us at 110 km/s. A collision was long thought certain in ~4.5 billion years; a 2025 study puts the odds nearer 50/50 within 10 billion years.",
    facts: [
      ["Distance", "~2.5 million ly"],
      ["Diameter", "~152,000 ly"],
      ["Stars", "~1 trillion"],
      ["Approach speed", "110 km/s"],
    ],
    ra: "00h42m44.3s",
    dec: "+41°16′09″",
    distanceMly: 2.5,
    diameterLy: 152_000,
    style: "spiral",
    pa: 38,
    inc: 77,
    arms: 2,
    tint: "warm",
    sources: [simbad("M31")],
    keywords: "m31",
  }),
  galaxy({
    id: "triangulum",
    name: "Triangulum Galaxy",
    classification: "Spiral galaxy (M33)",
    description: "The third-largest member of the Local Group — a loose, star-forming spiral about 60,000 light-years across.",
    facts: [
      ["Distance", "~2.73 million ly"],
      ["Diameter", "~61,000 ly"],
    ],
    ra: "01h33m50.9s",
    dec: "+30°39′37″",
    distanceMly: 2.73,
    diameterLy: 61_100,
    style: "spiral",
    pa: 23,
    inc: 55,
    arms: 2,
    tint: "cool",
    sources: [simbad("M33")],
    keywords: "m33",
  }),
];

const galaxies: CatalogObject[] = [
  galaxy({
    id: "m81",
    name: "Bode's Galaxy",
    classification: "Grand-design spiral (M81)",
    description: "A bright, beautifully symmetric spiral whose gravity has stirred its neighbour, the Cigar Galaxy, into a frenzy of star formation.",
    facts: [["Distance", "~11.8 million ly"], ["Diameter", "~90,000 ly"]],
    ra: "09h55m33.2s",
    dec: "+69°03′55″",
    distanceMly: 11.8,
    diameterLy: 90_000,
    style: "spiral",
    pa: 157,
    inc: 59,
    arms: 2,
    tint: "warm",
    sources: [simbad("M81")],
    keywords: "m81",
  }),
  galaxy({
    id: "m82",
    name: "Cigar Galaxy",
    classification: "Starburst galaxy (M82)",
    description: "Forming stars ten times faster than the Milky Way. Winds from its supernovae blast plumes of hot gas out of both sides of the disk.",
    facts: [["Distance", "~12 million ly"], ["Diameter", "~37,000 ly"]],
    ra: "09h55m52.7s",
    dec: "+69°40′46″",
    distanceMly: 12,
    diameterLy: 37_000,
    style: "irregular",
    pa: 65,
    inc: 80,
    tint: "neutral",
    sources: [simbad("M82")],
    keywords: "m82 starburst",
  }),
  galaxy({
    id: "centaurus-a",
    name: "Centaurus A",
    classification: "Peculiar elliptical galaxy (NGC 5128)",
    description: "A giant elliptical galaxy that swallowed a spiral — its dust lane is the leftover. Its central black hole fires radio jets over a million light-years long.",
    facts: [["Distance", "~12 million ly"], ["Central black hole", "~55 million M☉"], ["Radio lobes", "~1 million ly"]],
    ra: "13h25m27.6s",
    dec: "-43°01′09″",
    distanceMly: 12.4,
    diameterLy: 60_000,
    style: "sombrero",
    pa: 115,
    inc: 72,
    tint: "warm",
    sources: [simbad("Centaurus A")],
    keywords: "ngc 5128 cen a",
  }),
  galaxy({
    id: "pinwheel",
    name: "Pinwheel Galaxy",
    classification: "Face-on spiral (M101)",
    description: "A huge, lopsided face-on spiral almost twice the Milky Way's width, studded with bright star-forming regions.",
    facts: [["Distance", "~21 million ly"], ["Diameter", "~170,000 ly"]],
    ra: "14h03m12.6s",
    dec: "+54°20′56″",
    distanceMly: 20.9,
    diameterLy: 170_000,
    style: "spiral",
    pa: 30,
    inc: 16,
    arms: 4,
    tint: "cool",
    sources: [simbad("M101")],
    keywords: "m101",
  }),
  galaxy({
    id: "whirlpool",
    name: "Whirlpool Galaxy",
    classification: "Interacting grand-design spiral (M51)",
    description: "The first galaxy recognised as a spiral (Lord Rosse, 1845). Its companion NGC 5195 is tugging on one of its arms.",
    facts: [["Distance", "~31 million ly"], ["Diameter", "~76,000 ly"], ["Companion", "NGC 5195"]],
    ra: "13h29m52.7s",
    dec: "+47°11′43″",
    distanceMly: 31,
    diameterLy: 76_000,
    style: "spiral",
    pa: 163,
    inc: 22,
    arms: 2,
    tint: "cool",
    sources: [simbad("M51")],
    keywords: "m51",
  }),
  galaxy({
    id: "sombrero",
    name: "Sombrero Galaxy",
    classification: "Spiral/lenticular galaxy (M104)",
    description: "A brilliant bulge ringed by a dark lane of dust, seen almost edge-on — like a hat. It hosts a billion-solar-mass black hole.",
    facts: [["Distance", "~31 million ly"], ["Diameter", "~49,000 ly"], ["Central black hole", "~1 billion M☉"]],
    ra: "12h39m59.4s",
    dec: "-11°37′23″",
    distanceMly: 31,
    diameterLy: 49_000,
    style: "sombrero",
    pa: 90,
    inc: 84,
    tint: "warm",
    sources: [simbad("M104")],
    keywords: "m104",
  }),
  galaxy({
    id: "m87",
    name: "Messier 87",
    classification: "Supergiant elliptical galaxy",
    description:
      "The giant at the heart of the Virgo Cluster, with trillions of stars and a jet of particles shooting out at near light speed. Its black hole, M87*, was the first ever imaged (2019).",
    facts: [["Distance", "~53.5 million ly"], ["Black hole M87*", "6.5 billion M☉"], ["Jet length", "~5,000 ly"], ["Globular clusters", "~12,000"]],
    ra: "12h30m49.4s",
    dec: "+12°23′28″",
    distanceMly: 53.5,
    diameterLy: 132_000,
    style: "elliptical",
    pa: 0,
    inc: 0,
    tint: "warm",
    blackHole: { massSolar: 6.5e9, diskOuterRs: 24, jets: true },
    sources: [doi("Event Horizon Telescope", "First M87 EHT results (ApJL 875, L1, 2019)", "10.3847/2041-8213/ab0ec7"), simbad("M87")],
    keywords: "m87* virgo a",
  }),
  galaxy({
    id: "ngc-1300",
    name: "NGC 1300",
    classification: "Barred spiral galaxy",
    description: "A textbook barred spiral: a straight bar of stars through the centre, with arms trailing from each end — much like our own galaxy.",
    facts: [["Distance", "~61 million ly"], ["Diameter", "~110,000 ly"]],
    ra: "03h19m41.1s",
    dec: "-19°24′41″",
    distanceMly: 61,
    diameterLy: 110_000,
    style: "barred",
    pa: 106,
    inc: 50,
    arms: 2,
    tint: "neutral",
    sources: [simbad("NGC 1300")],
  }),
  galaxy({
    id: "antennae",
    name: "Antennae Galaxies",
    classification: "Colliding galaxies (NGC 4038/4039)",
    description: "Two galaxies in mid-collision, flinging out long tails of stars. The crash is triggering billions of new stars. This is a preview of what may happen to the Milky Way and Andromeda.",
    facts: [["Distance", "~45–65 million ly (disputed)"], ["Tidal tails", "~500,000 ly span"]],
    ra: "12h01m53.0s",
    dec: "-18°52′10″",
    distanceMly: 45,
    diameterLy: 120_000,
    style: "interacting",
    pa: 0,
    inc: 30,
    tint: "cool",
    sources: [simbad("NGC 4038")],
    keywords: "ngc 4038 4039 collision",
  }),
  galaxy({
    id: "cartwheel",
    name: "Cartwheel Galaxy",
    classification: "Ring galaxy",
    description: "A smaller galaxy punched straight through it about 400 million years ago, sending a ring of star formation rippling outward like a stone dropped in a pond.",
    facts: [["Distance", "~500 million ly"], ["Diameter", "~150,000 ly"]],
    ra: "00h37m41.1s",
    dec: "-33°42′59″",
    distanceMly: 500,
    diameterLy: 150_000,
    style: "ring",
    pa: 170,
    inc: 40,
    tint: "cool",
    sources: [simbad("Cartwheel Galaxy")],
  }),
  galaxy({
    id: "hoags-object",
    name: "Hoag's Object",
    classification: "Ring galaxy",
    description: "A near-perfect ring of young blue stars around a golden core, with a gap between them that astronomers still cannot fully explain.",
    facts: [["Distance", "~600 million ly"], ["Diameter", "~100,000 ly"]],
    ra: "15h17m14.4s",
    dec: "+21°35′08″",
    distanceMly: 600,
    diameterLy: 100_000,
    style: "ring",
    pa: 0,
    inc: 5,
    tint: "cool",
    sources: [simbad("Hoag's Object")],
  }),
  galaxy({
    id: "ic-1101",
    name: "IC 1101",
    classification: "Supergiant elliptical (cD) galaxy",
    description: "One of the largest galaxies known, at the centre of the Abell 2029 cluster. Its faint outer halo stretches across millions of light-years.",
    facts: [["Distance", "~1.05 billion ly"], ["Diameter", "~2–4 million ly (diffuse halo, disputed)"]],
    ra: "15h10m56.1s",
    dec: "+05°44′41″",
    distanceMly: 1045,
    diameterLy: 2_000_000,
    style: "elliptical",
    pa: 25,
    inc: 45,
    tint: "warm",
    sources: [simbad("IC 1101")],
  }),
];

const clustersAndVoids: CatalogObject[] = [
  {
    id: "virgo-cluster",
    name: "Virgo Cluster",
    kind: "cluster",
    level: "cosmic",
    classification: "Galaxy cluster",
    description: "The nearest big galaxy cluster: well over a thousand galaxies bound together, with M87 at its heart. Its gravity is slowly pulling on the Local Group.",
    facts: [["Distance", "~54 million ly"], ["Galaxies", "~1,300–2,000"], ["Diameter", "~15 million ly"]],
    position: skyToRender("12h27m00s", "+12°43′00″", 54),
    extent: 15,
    framing: 45,
    accent: "#ffd08a",
    distanceLabel: "~54 million ly",
    sources: [simbad("Virgo Cluster")],
  },
  {
    id: "coma-cluster",
    name: "Coma Cluster",
    kind: "cluster",
    level: "cosmic",
    classification: "Rich galaxy cluster (Abell 1656)",
    description: "Over a thousand galaxies, mostly ellipticals. In 1933 Fritz Zwicky noticed they move far too fast to be held by visible matter — the first evidence for dark matter.",
    facts: [["Distance", "~321 million ly"], ["Galaxies", "> 1,000"], ["Diameter", "~20 million ly"]],
    position: skyToRender("12h59m48.7s", "+27°58′50″", 321),
    extent: 20,
    framing: 60,
    accent: "#ffd08a",
    distanceLabel: "~321 million ly",
    sources: [simbad("Coma Cluster")],
    keywords: "abell 1656 dark matter",
  },
  {
    id: "great-attractor",
    name: "Great Attractor",
    kind: "structure",
    level: "cosmic",
    classification: "Gravitational focus of Laniakea",
    description:
      "A region pulling our galaxy and thousands of others toward it at ~600 km/s. It lies behind the Milky Way's disk, so we see it only dimly — near the Norma Cluster. It sits near the centre of Laniakea, our home supercluster (~520 million ly across, ~100,000 galaxies).",
    facts: [["Distance", "~220 million ly"], ["Nearby cluster", "Norma (Abell 3627)"], ["Supercluster", "Laniakea, ~520 million ly"]],
    position: skyToRender("16h15m03s", "-60°54′26″", 220),
    extent: 30,
    framing: 160,
    accent: "#ffd08a",
    distanceLabel: "~220 million ly",
    sources: [simbad("ACO 3627", "Norma Cluster (Abell 3627)")],
    keywords: "laniakea norma supercluster",
  },
  {
    id: "bootes-void",
    name: "Boötes Void",
    kind: "void",
    level: "cosmic",
    classification: "Supervoid",
    description:
      "One of the emptiest places known: a bubble ~330 million light-years wide where thousands of galaxies would be expected but only about 60 have been found. If the Milky Way were at its centre, we wouldn't have known other galaxies existed until the 1960s.",
    facts: [["Distance", "~700 million ly"], ["Diameter", "~330 million ly"], ["Galaxies found", "~60"], ["Discovered", "1981"]],
    position: skyToRender("14h50m00s", "+46°00′00″", 700),
    extent: 330,
    framing: 700,
    accent: "#7c8cff",
    distanceLabel: "~700 million ly",
    sources: [doi("Kirshner et al.", "A million cubic megaparsec void in Boötes (ApJL 248, L57, 1981)", "10.1086/183623")],
    keywords: "great nothing",
  },
];

function quasar(
  o: Omit<CatalogObject, "kind" | "level" | "position" | "framing" | "accent" | "extent" | "distanceLabel" | "facts"> & {
    ra: string;
    dec: string;
    z: number;
    facts: [string, string][];
  },
): CatalogObject {
  const d = comovingDistanceMly(o.z);
  const lookback = lookbackTimeGyr(o.z);
  return {
    ...o,
    kind: "quasar",
    level: "cosmic",
    position: skyToRender(o.ra, o.dec, d),
    extent: 0,
    framing: Math.max(40, d * 0.02),
    accent: "#9fd8ff",
    distanceLabel: `light left ${fmt(lookback, 1)} billion yr ago`,
    facts: [
      ...o.facts,
      ["Redshift (z)", String(o.z)],
      ["Light-travel time", `${fmt(lookback, 1)} billion yr`],
      ["Distance today (comoving)", `${fmt(d / 1000, 1)} billion ly`],
    ],
  };
}

const quasars: CatalogObject[] = [
  quasar({
    id: "3c-273",
    name: "3C 273",
    classification: "Quasar",
    description: "The first quasar ever identified (Maarten Schmidt, 1963) and the brightest in our sky — visible in a backyard telescope despite being billions of light-years away. Its jet stretches ~200,000 light-years.",
    facts: [["Black hole", "~890 million M☉"], ["Luminosity", "~4 trillion L☉"]],
    ra: "12h29m06.7s",
    dec: "+02°03′09″",
    z: 0.158,
    blackHole: { massSolar: 8.9e8, diskOuterRs: 30, jets: true },
    sources: [simbad("3C 273")],
  }),
  quasar({
    id: "ton-618",
    name: "TON 618",
    classification: "Hyperluminous quasar",
    description:
      "Home to one of the most massive black holes ever measured — tens of billions of Suns. Its event horizon is wider than our entire Solar System out to Neptune many times over, and the gas swirling into it outshines its whole galaxy by thousands of times.",
    facts: [["Black hole", "~40 billion M☉ (some estimates ~66 billion)"], ["Event horizon diameter", "~1,600 AU"], ["Luminosity", "~100 trillion L☉"]],
    ra: "12h28m24.9s",
    dec: "+31°28′38″",
    z: 2.219,
    blackHole: { massSolar: 4.07e10, diskOuterRs: 22, jets: true },
    sources: [doi("Shemmer et al.", "Black hole masses of high-z quasars (ApJ 614, 547, 2004)", "10.1086/423607"), simbad("TON 618")],
    keywords: "ton618 biggest black hole",
  }),
];

const edge: CatalogObject[] = [
  {
    id: "observable-universe",
    name: "Observable Universe",
    kind: "structure",
    level: "cosmic",
    classification: "The limit of what we can ever see",
    description:
      "Light has had 13.8 billion years to reach us, but space has kept expanding, so the farthest regions we can see are now ~46.5 billion light-years away. Beyond this edge the universe likely continues — we just cannot see it.",
    facts: [["Radius (comoving)", "~46.5 billion ly"], ["Age of universe", "13.8 billion yr"], ["Galaxies inside", "~2 trillion (est.)"]],
    position: new Vector3(0, 0, 0),
    extent: OBSERVABLE_UNIVERSE_RADIUS_MLY * 2,
    framing: OBSERVABLE_UNIVERSE_RADIUS_MLY * 2.6,
    accent: "#ff9ec7",
    distanceLabel: "Centred on us",
    sources: [simbad("CMB", "Cosmic microwave background")],
    keywords: "edge cmb",
  },
];

export const COSMIC_CATALOG: CatalogObject[] = [...localGroup, ...galaxies, ...clustersAndVoids, ...quasars, ...edge];

export const SURVEY_SOURCE = TWO_MRS;
