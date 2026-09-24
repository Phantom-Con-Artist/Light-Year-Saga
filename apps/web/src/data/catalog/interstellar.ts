import { GALACTIC_CENTRE, NGP_DIRECTION, R0_LY } from "../../astronomy/galactic";
import { skyToRender } from "../../astronomy/sky";
import type { CatalogObject } from "./types";
import { doi, exoArchive, simbad } from "./sources";

/**
 * Curated objects placed in the interstellar view (units: light-years,
 * Sun at origin). Values are from the cited catalogues/papers; where the
 * literature disagrees the UI says so.
 */

const fmt = (n: number) => n.toLocaleString("en-US");
const ly = (n: number) => `${fmt(n)} ly`;

/** Oblique view from above the Galactic plane, looking back toward the Sun's side. */
const galaxyView = NGP_DIRECTION.clone()
  .multiplyScalar(0.75)
  .add(GALACTIC_CENTRE.clone().normalize().multiplyScalar(-0.66))
  .normalize();

const GRAVITY_2019 = doi("GRAVITY Collaboration", "Distance to Sgr A* (A&A 625, L10, 2019)", "10.1051/0004-6361/201935656");
const EHT_SGRA = doi("Event Horizon Telescope", "First image of Sgr A* (ApJL 930, L12, 2022)", "10.3847/2041-8213/ac6674");

/* ------------------------------------------------------------------ galaxy */

const galaxy: CatalogObject[] = [
  {
    id: "milky-way",
    name: "Milky Way",
    kind: "galaxy",
    level: "interstellar",
    classification: "Barred spiral galaxy (SBbc)",
    description:
      "Our home galaxy: a barred spiral disk about 100,000 light-years across, holding 100–400 billion stars. The Sun sits in a minor arm, the Orion Spur, roughly halfway out from the centre.",
    facts: [
      ["Diameter (stellar disk)", "~100,000 ly"],
      ["Stars", "100–400 billion"],
      ["Total mass", "~1–1.5 × 10¹² M☉"],
      ["Age", "~13.6 billion yr"],
      ["Sun → centre", ly(R0_LY)],
      ["Sun's orbit period", "~230 million yr"],
    ],
    position: GALACTIC_CENTRE.clone(),
    extent: 100_000,
    framing: 150_000,
    viewDirection: galaxyView,
    accent: "#c9b8ff",
    distanceLabel: "You are inside it",
    visualNote:
      "Shown as a model built from published structure (bar, four major arms, Orion Spur). Individual stars beyond ~3,000 ly are illustrative.",
    sources: [simbad("Galactic Center"), GRAVITY_2019],
  },
  {
    id: "sgr-a-star",
    name: "Sagittarius A*",
    kind: "black-hole",
    level: "interstellar",
    classification: "Supermassive black hole",
    description:
      "The black hole at the heart of the Milky Way. Astronomers weighed it by timing stars that whip around it in years, and the Event Horizon Telescope imaged its shadow in 2022. For its size it is remarkably quiet, feeding on only a thin trickle of gas.",
    facts: [
      ["Mass", "~4.3 million M☉"],
      ["Distance", ly(R0_LY)],
      ["Event horizon", "~24 million km (~0.08 AU)"],
      ["Shadow on the sky", "~52 µas (EHT)"],
    ],
    position: GALACTIC_CENTRE.clone(),
    extent: 0,
    framing: 32_000,
    viewDirection: galaxyView,
    blackHole: { massSolar: 4.3e6, diskOuterRs: 18 },
    accent: "#ffb45a",
    distanceLabel: ly(R0_LY),
    sources: [GRAVITY_2019, EHT_SGRA],
    keywords: "sgr a* sagittarius galactic center",
  },
];

/* ------------------------------------------------------------ black holes */

const blackHoles: CatalogObject[] = [
  {
    id: "gaia-bh1",
    name: "Gaia BH1",
    kind: "black-hole",
    level: "interstellar",
    classification: "Dormant stellar-mass black hole",
    description:
      "The nearest known black hole. It gives off no light at all — Gaia found it only because a Sun-like star is being swung around it every 186 days.",
    facts: [
      ["Mass", "9.6 M☉"],
      ["Distance", "1,560 ly"],
      ["Companion", "Sun-like star, 185.6-day orbit"],
      ["Discovered", "2022 (Gaia DR3)"],
    ],
    position: skyToRender("17h28m41.1s", "-00°34′52″", 1_560),
    extent: 0,
    framing: 3,
    blackHole: { massSolar: 9.6, diskOuterRs: 0 },
    accent: "#ffb45a",
    distanceLabel: "1,560 ly",
    sources: [doi("El-Badry et al.", "A Sun-like star orbiting a black hole (MNRAS 518, 1057, 2023)", "10.1093/mnras/stac3140"), simbad("Gaia BH1")],
  },
  {
    id: "gaia-bh3",
    name: "Gaia BH3",
    kind: "black-hole",
    level: "interstellar",
    classification: "Dormant stellar-mass black hole",
    description:
      "The most massive stellar black hole known in our galaxy — about 33 Suns — found in 2024 from the wobble of an ancient companion star.",
    facts: [
      ["Mass", "~33 M☉"],
      ["Distance", "1,926 ly"],
      ["Companion orbit", "11.6 years"],
      ["Discovered", "2024 (Gaia)"],
    ],
    position: skyToRender("19h39m18.7s", "+14°55′54″", 1_926),
    extent: 0,
    framing: 3,
    blackHole: { massSolar: 32.7, diskOuterRs: 0 },
    accent: "#ffb45a",
    distanceLabel: "1,926 ly",
    sources: [simbad("Gaia BH3")],
  },
  {
    id: "cygnus-x1",
    name: "Cygnus X-1",
    kind: "black-hole",
    level: "interstellar",
    classification: "X-ray binary black hole",
    description:
      "The first object widely accepted as a black hole. It strips gas from a blue supergiant companion into a blazing X-ray disk. Stephen Hawking bet it was not a black hole in 1974 — and happily conceded in 1990.",
    facts: [
      ["Mass", "21.2 M☉"],
      ["Distance", "~7,200 ly"],
      ["Companion", "Blue supergiant, 5.6-day orbit"],
      ["Event horizon", "~125 km across"],
    ],
    position: skyToRender("19h58m21.68s", "+35°12′05.8″", 7_200),
    extent: 0,
    framing: 3,
    blackHole: { massSolar: 21.2, diskOuterRs: 40 },
    accent: "#ffb45a",
    distanceLabel: "~7,200 ly",
    sources: [doi("Miller-Jones et al.", "Cygnus X-1 contains a 21 M☉ black hole (Science 371, 1046, 2021)", "10.1126/science.abb3363"), simbad("Cyg X-1")],
  },
];

/* --------------------------------------------------------- extreme stars */

const stars: CatalogObject[] = [
  {
    id: "stephenson-2-18",
    name: "Stephenson 2-18",
    kind: "star",
    level: "interstellar",
    classification: "Red supergiant (M6)",
    description:
      "One of the largest stars known. Placed where the Sun is, its surface would reach beyond the orbit of Saturn. Its size is uncertain because it is hidden behind thick dust near the Galactic plane.",
    facts: [
      ["Radius", "~2,150 R☉ (uncertain)"],
      ["Distance", "~19,000 ly"],
      ["Luminosity", "~440,000 L☉"],
      ["Cluster", "Stephenson 2 (RSGC2)"],
    ],
    position: skyToRender("18h39m02.37s", "-06°05′10.5″", 19_000),
    extent: 0,
    framing: 4,
    star: { radiusSolar: 2150, temperatureK: 3200, luminositySolar: 440_000, radiusNote: "Estimates vary widely" },
    accent: "#ff7a4d",
    distanceLabel: "~19,000 ly",
    sources: [simbad("Stephenson 2-18")],
  },
  {
    id: "uy-scuti",
    name: "UY Scuti",
    kind: "star",
    level: "interstellar",
    classification: "Red supergiant (M4Ia)",
    description:
      "Long billed as the biggest star known (~1,700 Suns wide). Better Gaia distances in 2023 shrank the estimate to roughly 900 Suns — still big enough to swallow Jupiter's orbit.",
    facts: [
      ["Radius", "~909 R☉ (was ~1,708)"],
      ["Distance", "~9,500 ly"],
      ["Temperature", "~3,550 K"],
    ],
    position: skyToRender("18h27m36.53s", "-12°27′58.9″", 9_500),
    extent: 0,
    framing: 4,
    star: { radiusSolar: 909, temperatureK: 3550, radiusNote: "Revised from 1,708 R☉ (2023)" },
    accent: "#ff7a4d",
    distanceLabel: "~9,500 ly",
    sources: [simbad("UY Sct")],
  },
  {
    id: "vy-cma",
    name: "VY Canis Majoris",
    kind: "star",
    level: "interstellar",
    classification: "Red hypergiant",
    description:
      "A dying hypergiant blowing off its outer layers in huge eruptions, wrapping itself in a nebula of dust. It will likely end in a supernova — or collapse straight into a black hole.",
    facts: [
      ["Radius", "~1,420 R☉"],
      ["Mass", "~17 M☉"],
      ["Distance", "~3,820 ly"],
    ],
    position: skyToRender("07h22m58.33s", "-25°46′03.2″", 3_820),
    extent: 0,
    framing: 4,
    star: { radiusSolar: 1420, temperatureK: 3490, massSolar: 17 },
    accent: "#ff7a4d",
    distanceLabel: "~3,820 ly",
    sources: [simbad("VY CMa")],
  },
  {
    id: "r136a1",
    name: "R136a1",
    kind: "star",
    level: "interstellar",
    classification: "Wolf–Rayet star (WN5h)",
    description:
      "The most massive star known, in the Tarantula Nebula of the Large Magellanic Cloud. It shines several million times brighter than the Sun and is losing mass at a furious rate.",
    facts: [
      ["Mass", "~200 M☉ (revised from ~315)"],
      ["Luminosity", "~4.7 million L☉"],
      ["Temperature", "~46,000 K"],
      ["Distance", "~163,000 ly (LMC)"],
    ],
    position: skyToRender("05h38m42.4s", "-69°06′03″", 163_000),
    extent: 0,
    framing: 5,
    star: { radiusSolar: 42.7, temperatureK: 46_000, massSolar: 196, luminositySolar: 4.7e6 },
    accent: "#9ec8ff",
    distanceLabel: "~163,000 ly",
    sources: [simbad("R136a1")],
  },
  {
    id: "eta-carinae",
    name: "Eta Carinae",
    kind: "star",
    level: "interstellar",
    classification: "Luminous blue variable binary",
    description:
      "In the 1840s this star erupted and briefly became the second-brightest in the sky, throwing off the twin-lobed Homunculus Nebula. It is a prime candidate for the next great supernova in our galaxy.",
    facts: [
      ["Mass (primary)", "~100 M☉"],
      ["Luminosity", "~5 million L☉ (system)"],
      ["Distance", "~7,500 ly"],
      ["Great Eruption", "1837–1856"],
    ],
    position: skyToRender("10h45m03.5s", "-59°41′04″", 7_500),
    extent: 0,
    framing: 5,
    accent: "#9ec8ff",
    distanceLabel: "~7,500 ly",
    sources: [simbad("eta Car")],
  },
  {
    id: "sirius-b",
    name: "Sirius B",
    kind: "stellar-remnant",
    level: "interstellar",
    classification: "White dwarf",
    description:
      "The dead core of a star, orbiting Sirius. It holds about as much mass as the Sun packed into a ball the size of Earth — a teaspoon of it would weigh several tonnes.",
    facts: [
      ["Mass", "1.02 M☉"],
      ["Radius", "~5,800 km (Earth-sized)"],
      ["Surface", "~25,000 K"],
      ["Distance", "8.6 ly"],
    ],
    position: skyToRender("06h45m09.25s", "-16°42′47.3″", 8.6),
    extent: 0,
    framing: 0.4,
    star: { radiusSolar: 0.0084, temperatureK: 25_000, massSolar: 1.02 },
    accent: "#dfeaff",
    distanceLabel: "8.6 ly",
    sources: [simbad("Sirius B")],
  },
  {
    id: "crab-pulsar",
    name: "Crab Pulsar",
    kind: "stellar-remnant",
    level: "interstellar",
    classification: "Neutron star (pulsar)",
    description:
      "The city-sized core left by the supernova of 1054 AD. It spins 30 times every second, sweeping beams of radiation across space like a lighthouse, and powers the whole Crab Nebula.",
    facts: [
      ["Radius", "~10 km"],
      ["Mass", "~1.4 M☉"],
      ["Spin", "30 times per second"],
      ["Distance", "~6,500 ly"],
    ],
    position: skyToRender("05h34m31.94s", "+22°00′52.2″", 6_500),
    extent: 0,
    framing: 2,
    star: { radiusSolar: 10 / 695_700, temperatureK: 1.6e6, massSolar: 1.4 },
    accent: "#bfe3ff",
    distanceLabel: "~6,500 ly",
    sources: [simbad("Crab Pulsar")],
  },
];

/* ---------------------------------------------------------------- nebulae */

const nebula = (
  o: Omit<CatalogObject, "kind" | "level" | "framing" | "accent" | "position"> & {
    ra: string;
    dec: string;
    distanceLy: number;
    accent?: string;
  },
): CatalogObject => ({
  ...o,
  kind: "nebula",
  level: "interstellar",
  position: skyToRender(o.ra, o.dec, o.distanceLy),
  framing: o.extent * 1.7,
  accent: o.accent ?? "#ff8fb4",
});

const nebulae: CatalogObject[] = [
  nebula({
    id: "orion-nebula",
    name: "Orion Nebula",
    classification: "Emission nebula (M42)",
    description:
      "The nearest big star factory, visible to the naked eye as the fuzzy 'star' in Orion's sword. Thousands of young stars are being born inside, lit up by the brilliant Trapezium cluster.",
    facts: [
      ["Distance", "~1,344 ly"],
      ["Size", "~24 ly across"],
      ["Age of stars", "< 1–2 million yr"],
    ],
    ra: "05h35m17.3s",
    dec: "-05°23′28″",
    distanceLy: 1_344,
    extent: 24,
    visual: { type: "nebula", style: "emission", colorA: "#ff6f9c", colorB: "#5fd3ff", aspect: 1.2 },
    distanceLabel: "~1,344 ly",
    sources: [simbad("M42")],
    keywords: "m42",
  }),
  nebula({
    id: "horsehead-nebula",
    name: "Horsehead Nebula",
    classification: "Dark nebula (Barnard 33)",
    description:
      "A cold pillar of dust shaped like a horse's head, silhouetted against glowing red hydrogen. It will erode away in about five million years.",
    facts: [
      ["Distance", "~1,375 ly"],
      ["Height", "~3.5 ly"],
    ],
    ra: "05h40m59s",
    dec: "-02°27′30″",
    distanceLy: 1_375,
    extent: 7,
    visual: { type: "nebula", style: "dark", colorA: "#ff4f6d", colorB: "#2a0f14" },
    distanceLabel: "~1,375 ly",
    accent: "#ff6f7f",
    sources: [simbad("Barnard 33")],
    keywords: "barnard 33 b33",
  }),
  nebula({
    id: "eagle-nebula",
    name: "Eagle Nebula",
    classification: "Emission nebula (M16)",
    description:
      "A vast cloud of gas and dust lit by a young cluster of hot stars. It is home to the famous Pillars of Creation.",
    facts: [
      ["Distance", "~5,700 ly"],
      ["Size", "~70 × 55 ly"],
    ],
    ra: "18h18m48s",
    dec: "-13°49′00″",
    distanceLy: 5_700,
    extent: 70,
    visual: { type: "nebula", style: "emission", colorA: "#f7b267", colorB: "#4fb6a8", aspect: 1.25 },
    distanceLabel: "~5,700 ly",
    accent: "#f7b267",
    sources: [simbad("M16")],
    keywords: "m16",
  }),
  nebula({
    id: "pillars-of-creation",
    name: "Pillars of Creation",
    classification: "Star-forming dust columns (in M16)",
    description:
      "Towering columns of cold gas and dust, each light-years tall, being sculpted by the radiation of nearby young stars. New stars are forming in their tips right now.",
    facts: [
      ["Tallest pillar", "~4 ly"],
      ["Distance", "~5,700 ly"],
      ["Famous images", "Hubble 1995, JWST 2022"],
    ],
    ra: "18h18m51s",
    dec: "-13°50′00″",
    distanceLy: 5_698,
    extent: 9,
    visual: { type: "nebula", style: "pillars", colorA: "#f2c38b", colorB: "#3a2418" },
    distanceLabel: "~5,700 ly",
    accent: "#f2c38b",
    sources: [simbad("M16")],
    keywords: "eagle m16 pillars",
  }),
  nebula({
    id: "lagoon-nebula",
    name: "Lagoon Nebula",
    classification: "Emission nebula (M8)",
    description:
      "A giant interstellar cloud in Sagittarius, crossed by a dark dusty lane — the 'lagoon'. Visible to the naked eye from dark skies.",
    facts: [
      ["Distance", "~4,100 ly"],
      ["Size", "~110 × 50 ly"],
    ],
    ra: "18h03m37s",
    dec: "-24°23′12″",
    distanceLy: 4_100,
    extent: 110,
    visual: { type: "nebula", style: "emission", colorA: "#ff6b8b", colorB: "#8a6bff", aspect: 2.2 },
    distanceLabel: "~4,100 ly",
    sources: [simbad("M8")],
    keywords: "m8",
  }),
  nebula({
    id: "carina-nebula",
    name: "Carina Nebula",
    classification: "Emission nebula (NGC 3372)",
    description:
      "One of the largest and brightest nebulae in the sky, several times the size of Orion. It hosts some of the most massive stars in the galaxy, including Eta Carinae.",
    facts: [
      ["Distance", "~8,500 ly"],
      ["Size", "~460 ly"],
    ],
    ra: "10h45m08.5s",
    dec: "-59°52′04″",
    distanceLy: 8_500,
    extent: 460,
    visual: { type: "nebula", style: "emission", colorA: "#ff8a5c", colorB: "#6fd2ff", aspect: 1.4 },
    distanceLabel: "~8,500 ly",
    accent: "#ff9a6c",
    sources: [simbad("NGC 3372")],
    keywords: "ngc 3372",
  }),
  nebula({
    id: "crab-nebula",
    name: "Crab Nebula",
    classification: "Supernova remnant (M1)",
    description:
      "The expanding debris of a star that exploded in 1054 AD — Chinese astronomers saw it in daylight for 23 days. Its filaments are still flying outward at about 1,500 km/s.",
    facts: [
      ["Distance", "~6,500 ly"],
      ["Size", "~11 ly"],
      ["Supernova seen", "4 July 1054"],
    ],
    ra: "05h34m31.94s",
    dec: "+22°00′52.2″",
    distanceLy: 6_502,
    extent: 11,
    visual: { type: "nebula", style: "remnant", colorA: "#ff7a45", colorB: "#7fb8ff", aspect: 1.35 },
    distanceLabel: "~6,500 ly",
    accent: "#ff9a5c",
    sources: [simbad("M1")],
    keywords: "m1 supernova 1054",
  }),
  nebula({
    id: "ring-nebula",
    name: "Ring Nebula",
    classification: "Planetary nebula (M57)",
    description:
      "The glowing shell of gas thrown off by a dying Sun-like star. Our own Sun will make something like this in about 5 billion years.",
    facts: [
      ["Distance", "~2,570 ly"],
      ["Size", "~1.3 ly"],
    ],
    ra: "18h53m35.08s",
    dec: "+33°01′45.0″",
    distanceLy: 2_570,
    extent: 1.3,
    visual: { type: "nebula", style: "planetary", colorA: "#ff9f5a", colorB: "#58e0d0" },
    distanceLabel: "~2,570 ly",
    accent: "#7fe3d6",
    sources: [simbad("M57")],
    keywords: "m57",
  }),
  nebula({
    id: "helix-nebula",
    name: "Helix Nebula",
    classification: "Planetary nebula (NGC 7293)",
    description:
      "Nicknamed the 'Eye of God', one of the closest planetary nebulae to Earth. Its inner edge is lined with thousands of comet-like gas knots, each larger than our Solar System.",
    facts: [
      ["Distance", "~655 ly"],
      ["Size", "~2.9 ly"],
    ],
    ra: "22h29m38.55s",
    dec: "-20°50′13.6″",
    distanceLy: 655,
    extent: 2.9,
    visual: { type: "nebula", style: "planetary", colorA: "#ff6a4a", colorB: "#4fd0ff" },
    distanceLabel: "~655 ly",
    accent: "#7fd6ff",
    sources: [simbad("NGC 7293")],
    keywords: "ngc 7293 eye of god",
  }),
  nebula({
    id: "tarantula-nebula",
    name: "Tarantula Nebula",
    classification: "Emission nebula (30 Doradus), LMC",
    description:
      "The most active star-forming region in our galactic neighbourhood, in the Large Magellanic Cloud. If it were as close as Orion, it would cast shadows on Earth.",
    facts: [
      ["Distance", "~160,000 ly"],
      ["Size", "~1,000 ly"],
      ["Hosts", "R136 cluster, R136a1"],
    ],
    ra: "05h38m38s",
    dec: "-69°05′42″",
    distanceLy: 160_000,
    extent: 1_000,
    visual: { type: "nebula", style: "emission", colorA: "#ff6fa0", colorB: "#7ad8ff", aspect: 1.2 },
    distanceLabel: "~160,000 ly",
    sources: [simbad("30 Dor")],
    keywords: "30 doradus",
  }),
];

/* ------------------------------------------------------- exoplanet systems */

const system = (
  o: Omit<CatalogObject, "kind" | "level" | "framing" | "accent" | "position" | "extent"> & {
    ra: string;
    dec: string;
    distanceLy: number;
  },
): CatalogObject => ({
  ...o,
  kind: "exo-system",
  level: "interstellar",
  position: skyToRender(o.ra, o.dec, o.distanceLy),
  extent: 0,
  framing: 3,
  accent: "#8fffc1",
});

const exoSystems: CatalogObject[] = [
  system({
    id: "trappist-1",
    name: "TRAPPIST-1",
    classification: "Ultracool red dwarf with 7 rocky planets",
    description:
      "Seven Earth-sized worlds packed around a star barely bigger than Jupiter — all would fit inside Mercury's orbit. Three sit in the zone where liquid water could exist. From one planet, the others would look bigger than our Moon.",
    facts: [
      ["Distance", "40.7 ly"],
      ["Planets", "7 (all rocky)"],
      ["Star", "M8V, 0.12 R☉, 2,566 K"],
    ],
    ra: "23h06m29.28s",
    dec: "-05°02′28.6″",
    distanceLy: 40.66,
    distanceLabel: "40.7 ly",
    system: {
      star: { radiusSolar: 0.1192, temperatureK: 2566, massSolar: 0.0898 },
      habitableZoneAU: [0.024, 0.049],
      planets: [
        { id: "trappist-1b", name: "TRAPPIST-1 b", semiMajorAxisAU: 0.01154, periodDays: 1.51088, radiusEarth: 1.116, massEarth: 1.374, equilibriumTempK: 400, style: "lava", colorA: "#7a4a3a", colorB: "#2a1a16", description: "Scorched and airless, according to JWST's 2023 thermal measurements." },
        { id: "trappist-1c", name: "TRAPPIST-1 c", semiMajorAxisAU: 0.0158, periodDays: 2.4218, radiusEarth: 1.097, massEarth: 1.308, equilibriumTempK: 342, style: "rocky", colorA: "#9a7a62", colorB: "#4a3a30", description: "A bare rock with little or no thick atmosphere (JWST, 2023)." },
        { id: "trappist-1d", name: "TRAPPIST-1 d", semiMajorAxisAU: 0.02227, periodDays: 4.0498, radiusEarth: 0.788, massEarth: 0.388, equilibriumTempK: 288, style: "rocky", colorA: "#b09078", colorB: "#5a4636", description: "On the warm inner edge of the habitable zone." },
        { id: "trappist-1e", name: "TRAPPIST-1 e", semiMajorAxisAU: 0.02925, periodDays: 6.0996, radiusEarth: 0.92, massEarth: 0.692, equilibriumTempK: 251, style: "ocean", colorA: "#2f6fa8", colorB: "#c9d8e6", description: "One of the best candidates anywhere for a habitable world — Earth-sized, rocky and in the habitable zone." },
        { id: "trappist-1f", name: "TRAPPIST-1 f", semiMajorAxisAU: 0.03849, periodDays: 9.20669, radiusEarth: 1.045, massEarth: 1.039, equilibriumTempK: 219, style: "ice", colorA: "#d6e4f0", colorB: "#7aa0c0", description: "Likely an icy world, possibly with a subsurface ocean." },
        { id: "trappist-1g", name: "TRAPPIST-1 g", semiMajorAxisAU: 0.04683, periodDays: 12.35294, radiusEarth: 1.129, massEarth: 1.321, equilibriumTempK: 199, style: "ice", colorA: "#e4eef6", colorB: "#8fb2cc", description: "The largest of the seven; cold, perhaps water-rich." },
        { id: "trappist-1h", name: "TRAPPIST-1 h", semiMajorAxisAU: 0.06189, periodDays: 18.77287, radiusEarth: 0.755, massEarth: 0.326, equilibriumTempK: 173, style: "ice", colorA: "#eef3f8", colorB: "#a8bccb", description: "The outermost and coldest planet of the system." },
      ],
    },
    sources: [exoArchive("TRAPPIST-1")],
  }),
  system({
    id: "proxima-system",
    name: "Proxima Centauri system",
    classification: "Nearest star, with a planet in its habitable zone",
    description:
      "The closest star to the Sun has an Earth-mass planet, Proxima b, in its habitable zone. But Proxima is a violent flare star that may have stripped away any atmosphere.",
    facts: [
      ["Distance", "4.24 ly"],
      ["Planets", "2 confirmed (b, d)"],
      ["Star", "M5.5V flare star, 0.15 R☉"],
    ],
    ra: "14h29m42.95s",
    dec: "-62°40′46.1″",
    distanceLy: 4.2465,
    distanceLabel: "4.24 ly",
    system: {
      star: { radiusSolar: 0.1542, temperatureK: 3042, massSolar: 0.1221 },
      habitableZoneAU: [0.042, 0.082],
      planets: [
        { id: "proxima-d", name: "Proxima d", semiMajorAxisAU: 0.02885, periodDays: 5.122, radiusEarth: 0.81, massEarth: 0.26, style: "rocky", colorA: "#a4876c", colorB: "#4e3d30", radiusEstimated: true, description: "One of the lightest exoplanets ever found by the wobble method — about a quarter of Earth's mass." },
        { id: "proxima-b", name: "Proxima b", semiMajorAxisAU: 0.04857, periodDays: 11.1868, radiusEarth: 1.07, massEarth: 1.07, equilibriumTempK: 234, style: "temperate", colorA: "#6f8a5a", colorB: "#8a6a4e", radiusEstimated: true, description: "The nearest exoplanet to Earth, in its star's habitable zone. Probably tidally locked, with one side in permanent daylight." },
      ],
    },
    sources: [exoArchive("Proxima Cen"), simbad("Proxima Centauri")],
    keywords: "proxima b alpha centauri",
  }),
  system({
    id: "55-cancri",
    name: "55 Cancri",
    classification: "Sun-like star with five planets",
    description:
      "A nearby star with five known planets, including 55 Cancri e — a scorching super-Earth with a year lasting just 18 hours, whose surface is probably a global ocean of lava.",
    facts: [
      ["Distance", "41 ly"],
      ["Planets", "5"],
      ["Star", "G8V, 0.94 R☉"],
    ],
    ra: "08h52m35.8s",
    dec: "+28°19′51″",
    distanceLy: 41.0,
    distanceLabel: "41 ly",
    system: {
      star: { radiusSolar: 0.943, temperatureK: 5196, massSolar: 0.905 },
      planets: [
        { id: "55-cancri-e", name: "55 Cancri e (Janssen)", semiMajorAxisAU: 0.01544, periodDays: 0.7365, radiusEarth: 1.88, massEarth: 7.99, equilibriumTempK: 2000, style: "lava", colorA: "#ff6a2a", colorB: "#2a120a", description: "A lava world with a year of 18 hours. JWST found hints of an atmosphere, possibly bubbling out of its magma ocean." },
        { id: "55-cancri-b", name: "55 Cancri b", semiMajorAxisAU: 0.1134, periodDays: 14.65, radiusEarth: 12.5, massEarth: 264, style: "hot-jupiter", colorA: "#d9a06a", colorB: "#7a4a2a", radiusEstimated: true, description: "A warm gas giant just under Jupiter's mass." },
        { id: "55-cancri-c", name: "55 Cancri c", semiMajorAxisAU: 0.2373, periodDays: 44.4, radiusEarth: 8.0, massEarth: 54, style: "gas", colorA: "#d8c49a", colorB: "#8a7650", radiusEstimated: true, description: "A Saturn-to-Neptune-class gas planet." },
        { id: "55-cancri-f", name: "55 Cancri f", semiMajorAxisAU: 0.7708, periodDays: 260.9, radiusEarth: 7.5, massEarth: 45, style: "gas", colorA: "#cdbf9c", colorB: "#7b6f58", radiusEstimated: true, description: "A gas giant orbiting in the system's habitable zone." },
        { id: "55-cancri-d", name: "55 Cancri d", semiMajorAxisAU: 5.957, periodDays: 4825, radiusEarth: 12.5, massEarth: 992, style: "gas", colorA: "#e0cda8", colorB: "#9a7c58", radiusEstimated: true, description: "A Jupiter-like giant far out — this system has a rough analogue of our own Jupiter." },
      ],
      habitableZoneAU: [0.65, 1.2],
    },
    sources: [exoArchive("55 Cnc")],
    keywords: "janssen copernicus 55 cnc",
  }),
  system({
    id: "hd-189733",
    name: "HD 189733",
    classification: "Star with a deep-blue hot Jupiter",
    description:
      "Home of HD 189733 b, a cobalt-blue gas giant where winds of ~8,700 km/h may whip molten glass sideways through the air. JWST detected hydrogen sulfide — it would smell of rotten eggs.",
    facts: [
      ["Distance", "64.5 ly"],
      ["Planet", "HD 189733 b"],
      ["Star", "K1.5V, 0.81 R☉"],
    ],
    ra: "20h00m43.7s",
    dec: "+22°42′39″",
    distanceLy: 64.5,
    distanceLabel: "64.5 ly",
    system: {
      star: { radiusSolar: 0.805, temperatureK: 5050, massSolar: 0.806 },
      planets: [
        { id: "hd-189733-b", name: "HD 189733 b", semiMajorAxisAU: 0.03142, periodDays: 2.21857, radiusEarth: 12.75, massEarth: 359, equilibriumTempK: 1200, style: "hot-jupiter", colorA: "#2f5fd0", colorB: "#16306e", description: "Its blue colour comes from silicate haze — glass rain driven by supersonic winds." },
      ],
    },
    sources: [exoArchive("HD 189733")],
    keywords: "glass rain blue planet",
  }),
  system({
    id: "wasp-76",
    name: "WASP-76",
    classification: "Star with an iron-rain world",
    description:
      "WASP-76 b is so hot on its dayside that iron vaporises. Winds carry the iron vapour to the cooler night side, where it condenses and falls as iron rain.",
    facts: [
      ["Distance", "~634 ly"],
      ["Planet", "WASP-76 b"],
      ["Star", "F7, 1.76 R☉"],
    ],
    ra: "01h46m31.9s",
    dec: "+02°42′02″",
    distanceLy: 634,
    distanceLabel: "~634 ly",
    system: {
      star: { radiusSolar: 1.756, temperatureK: 6250, massSolar: 1.46 },
      planets: [
        { id: "wasp-76-b", name: "WASP-76 b", semiMajorAxisAU: 0.033, periodDays: 1.80988, radiusEarth: 20.5, massEarth: 292, equilibriumTempK: 2160, style: "hot-jupiter", colorA: "#e0823a", colorB: "#5a2410", description: "Dayside ~2,400 °C. The famous iron-rain planet (ESPRESSO, 2020)." },
      ],
    },
    sources: [exoArchive("WASP-76")],
    keywords: "iron rain",
  }),
  system({
    id: "wasp-12",
    name: "WASP-12",
    classification: "Star devouring its planet",
    description:
      "WASP-12 b orbits so close that its star's gravity is stretching it into an egg shape and stripping its atmosphere. Its orbit is shrinking — in a few million years it will be swallowed.",
    facts: [
      ["Distance", "~1,410 ly"],
      ["Planet", "WASP-12 b"],
      ["Star", "F9V, 1.66 R☉"],
    ],
    ra: "06h30m32.79s",
    dec: "+29°40′20.3″",
    distanceLy: 1_410,
    distanceLabel: "~1,410 ly",
    system: {
      star: { radiusSolar: 1.657, temperatureK: 6360, massSolar: 1.43 },
      planets: [
        { id: "wasp-12-b", name: "WASP-12 b", semiMajorAxisAU: 0.0234, periodDays: 1.0914, radiusEarth: 21.7, massEarth: 467, equilibriumTempK: 2580, style: "hot-jupiter", colorA: "#3a2a24", colorB: "#140c0a", description: "One of the darkest planets known — it reflects less light than fresh asphalt — with a year of just 26 hours." },
      ],
    },
    sources: [exoArchive("WASP-12")],
  }),
  system({
    id: "kelt-9",
    name: "KELT-9",
    classification: "Hot star with the hottest known planet",
    description:
      "KELT-9 b's dayside reaches ~4,300 °C — hotter than many stars. Molecules there are torn into atoms, and the planet is evaporating into a comet-like tail.",
    facts: [
      ["Distance", "~670 ly"],
      ["Planet", "KELT-9 b"],
      ["Star", "B9.5–A0, 10,170 K"],
    ],
    ra: "20h31m26.35s",
    dec: "+39°56′19.8″",
    distanceLy: 670,
    distanceLabel: "~670 ly",
    system: {
      star: { radiusSolar: 2.36, temperatureK: 10_170, massSolar: 2.52 },
      planets: [
        { id: "kelt-9-b", name: "KELT-9 b", semiMajorAxisAU: 0.03462, periodDays: 1.4811, radiusEarth: 21.2, massEarth: 915, equilibriumTempK: 4050, style: "hot-jupiter", colorA: "#ffd0a0", colorB: "#c05a28", description: "The hottest gas giant known, orbiting pole-over-pole around its spinning star." },
      ],
    },
    sources: [exoArchive("KELT-9")],
  }),
  system({
    id: "kepler-186",
    name: "Kepler-186",
    classification: "Red dwarf with the first Earth-sized habitable-zone planet",
    description:
      "In 2014 Kepler-186 f became the first Earth-sized planet found in a habitable zone. On its surface, midday would look like the golden hour just before sunset on Earth.",
    facts: [
      ["Distance", "~579 ly"],
      ["Planets", "5"],
      ["Star", "M1V, 0.52 R☉"],
    ],
    ra: "19h54m36.65s",
    dec: "+43°57′18.0″",
    distanceLy: 579,
    distanceLabel: "~579 ly",
    system: {
      star: { radiusSolar: 0.523, temperatureK: 3755, massSolar: 0.544 },
      habitableZoneAU: [0.25, 0.47],
      planets: [
        { id: "kepler-186-b", name: "Kepler-186 b", semiMajorAxisAU: 0.0378, periodDays: 3.887, radiusEarth: 1.07, style: "lava", colorA: "#8a5a3a", colorB: "#2e1a12", description: "A hot inner rocky planet." },
        { id: "kepler-186-c", name: "Kepler-186 c", semiMajorAxisAU: 0.0574, periodDays: 7.267, radiusEarth: 1.25, style: "rocky", colorA: "#9a7a5e", colorB: "#4a3a2c", description: "Rocky and too hot for liquid water." },
        { id: "kepler-186-d", name: "Kepler-186 d", semiMajorAxisAU: 0.0861, periodDays: 13.34, radiusEarth: 1.4, style: "rocky", colorA: "#a88a6a", colorB: "#56442f", description: "A slightly larger rocky world." },
        { id: "kepler-186-e", name: "Kepler-186 e", semiMajorAxisAU: 0.1216, periodDays: 22.41, radiusEarth: 1.27, style: "rocky", colorA: "#8e7a68", colorB: "#463a30", description: "Still inside the inner edge of the habitable zone." },
        { id: "kepler-186-f", name: "Kepler-186 f", semiMajorAxisAU: 0.432, periodDays: 129.9, radiusEarth: 1.17, equilibriumTempK: 188, style: "temperate", colorA: "#4f7a5a", colorB: "#8a7a58", description: "Earth-sized, in the habitable zone, getting about a third of the light Earth does." },
      ],
    },
    sources: [exoArchive("Kepler-186")],
  }),
];

export const INTERSTELLAR_CATALOG: CatalogObject[] = [...galaxy, ...blackHoles, ...stars, ...nebulae, ...exoSystems];

