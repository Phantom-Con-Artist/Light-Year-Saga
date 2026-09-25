import type { ExternalSource, SpaceObject, SurfaceStyle } from "../../domain/types";
import { MOON_ORBITS } from "./elements.gen";

export const HORIZONS: ExternalSource = {
  provider: "NASA/JPL",
  name: "Horizons system (orbits fitted to its ephemerides)",
  url: "https://ssd.jpl.nasa.gov/horizons/",
  freshness: "COMPUTED",
};
export const SSD_SATS: ExternalSource = {
  provider: "NASA/JPL",
  name: "Planetary satellite physical parameters",
  url: "https://ssd.jpl.nasa.gov/sats/phys_par/",
  freshness: "STATIC",
};

interface MoonSpec {
  name: string;
  parent: string;
  radiusKm: number;
  massKg?: number;
  gravity?: number;
  tempK?: number;
  style: SurfaceStyle;
  colors: [string, string];
  atmosphere?: string;
  shape?: [number, number, number];
  /** Non-synchronous rotators (hours); omit for tidally locked moons. */
  spinHours?: number;
  discovered: string;
  classification?: string;
  description: string;
  facts?: [string, string][];
}

function moon(id: string, s: MoonSpec): SpaceObject {
  const orbit = MOON_ORBITS[id];
  return {
    id,
    name: s.name,
    type: "moon",
    classification: s.classification ?? `Moon of ${s.parent[0].toUpperCase()}${s.parent.slice(1)}`,
    parentId: s.parent,
    description: s.description,
    physical: {
      meanRadiusKm: s.radiusKm,
      massKg: s.massKg,
      surfaceGravityMs2: s.gravity,
      orbitalPeriodDays: 360 / Math.abs(orbit.dL),
      rotationPeriodHours: s.spinHours,
      tidallyLocked: s.spinHours === undefined,
      meanTemperatureK: s.tempK,
    },
    ephemeris: { kind: "moon-orbit", orbit },
    visual: { style: s.style, colorA: s.colors[0], colorB: s.colors[1], atmosphere: s.atmosphere, shape: s.shape, accent: s.colors[0] },
    facts: [["Discovered", s.discovered], ["Distance from planet", `${Math.round(orbit.aKm).toLocaleString("en-US")} km`], ...(s.facts ?? [])],
    sources: [SSD_SATS, HORIZONS],
  };
}

export const MOONS: SpaceObject[] = [
  /* ---------------- Mars */
  moon("phobos", {
    name: "Phobos",
    parent: "mars",
    radiusKm: 11.1,
    massKg: 1.066e16,
    gravity: 0.0057,
    style: "rocky",
    colors: ["#7a6a5c", "#3e342c"],
    shape: [1.22, 0.82, 0.99],
    discovered: "1877, Asaph Hall",
    description:
      "A lumpy, dark moon circling Mars faster than Mars turns, so it rises in the west. Tides are dragging it inward by about 2 m per century: in some 50 million years it will crash into Mars or break up into a ring.",
    facts: [["Largest crater", "Stickney, 9 km"]],
  }),
  moon("deimos", {
    name: "Deimos",
    parent: "mars",
    radiusKm: 6.2,
    massKg: 1.48e15,
    gravity: 0.003,
    style: "rocky",
    colors: ["#9a8a78", "#5a4e42"],
    shape: [1.21, 0.8, 0.98],
    discovered: "1877, Asaph Hall",
    description:
      "Mars's smaller, outer moon: a smooth, dusty potato 12 km across. From Mars it would look like a bright star, and your escape velocity from its surface is only about 20 km/h.",
  }),

  /* ---------------- Jupiter */
  moon("amalthea", {
    name: "Amalthea",
    parent: "jupiter",
    radiusKm: 83.5,
    massKg: 2.08e18,
    style: "rocky",
    colors: ["#b0583a", "#5e2a1a"],
    shape: [1.5, 0.77, 0.87],
    discovered: "1892, E. E. Barnard",
    description:
      "The reddest object in the Solar System, painted by sulphur blasted off Io. It is so porous it may be a loose rubble pile, and it sheds the dust that feeds Jupiter's faint gossamer ring.",
  }),
  moon("io", {
    name: "Io",
    parent: "jupiter",
    radiusKm: 1821.6,
    massKg: 8.932e22,
    gravity: 1.8,
    tempK: 110,
    style: "rocky",
    colors: ["#e8d25a", "#9c6a2c"],
    discovered: "1610, Galileo Galilei",
    description:
      "The most volcanic world known. Jupiter's tides, pumped by orbital resonance with Europa and Ganymede, flex Io's crust by up to 100 m and melt its interior. More than 400 active volcanoes resurface it constantly; lava lakes glow at over 1,200 °C.",
    facts: [["Active volcanoes", "400+"], ["Resonance", "1 : 2 : 4 with Europa and Ganymede"]],
  }),
  moon("europa", {
    name: "Europa",
    parent: "jupiter",
    radiusKm: 1560.8,
    massKg: 4.8e22,
    gravity: 1.31,
    tempK: 102,
    style: "ice",
    colors: ["#e3d6bf", "#8a6a4a"],
    discovered: "1610, Galileo Galilei",
    description:
      "A smooth shell of ice over a global salt-water ocean holding perhaps twice the water of all Earth's oceans. It is one of the best places to look for life beyond Earth, and the target of NASA's Europa Clipper, arriving in 2030.",
    facts: [["Ocean depth", "~60–150 km"], ["Ice shell", "~15–25 km thick"]],
  }),
  moon("ganymede", {
    name: "Ganymede",
    parent: "jupiter",
    radiusKm: 2634.1,
    massKg: 1.482e23,
    gravity: 1.43,
    tempK: 110,
    style: "rocky",
    colors: ["#a89a88", "#5e554b"],
    discovered: "1610, Galileo Galilei",
    classification: "Largest moon in the Solar System",
    description:
      "Bigger than Mercury, and the only moon with its own magnetic field, which draws auroras around it. A salty ocean is thought to lie under 150 km of ice. ESA's JUICE mission will orbit it from 2034.",
  }),
  moon("callisto", {
    name: "Callisto",
    parent: "jupiter",
    radiusKm: 2410.3,
    massKg: 1.076e23,
    gravity: 1.24,
    tempK: 134,
    style: "rocky",
    colors: ["#7b6f62", "#3a332d"],
    discovered: "1610, Galileo Galilei",
    description:
      "The most heavily cratered surface in the Solar System: a record of 4 billion years of impacts, barely changed since. It sits outside Jupiter's worst radiation, so it is often proposed as a base for crewed exploration.",
    facts: [["Largest impact basin", "Valhalla, 3,800 km"]],
  }),

  /* ---------------- Saturn */
  moon("mimas", {
    name: "Mimas",
    parent: "saturn",
    radiusKm: 198.2,
    massKg: 3.75e19,
    gravity: 0.064,
    tempK: 64,
    style: "ice",
    colors: ["#c9c6c0", "#8a8680"],
    discovered: "1789, William Herschel",
    description:
      "The 'Death Star' moon: the crater Herschel is a third of its width. Tiny wobbles in its rotation suggest a young ocean may lie beneath the ice. Its gravity clears the Cassini Division in Saturn's rings.",
    facts: [["Crater Herschel", "130 km wide"]],
  }),
  moon("enceladus", {
    name: "Enceladus",
    parent: "saturn",
    radiusKm: 252.1,
    massKg: 1.08e20,
    gravity: 0.113,
    tempK: 75,
    style: "ice",
    colors: ["#f4f6f8", "#c9d6e0"],
    discovered: "1789, William Herschel",
    description:
      "The most reflective body in the Solar System. Geysers at its south pole spray water from a hidden ocean into space, carrying salts, silica and organic molecules; the spray builds Saturn's E ring. Cassini flew straight through the plumes.",
    facts: [["Plume output", "~200 kg of water per second"]],
  }),
  moon("tethys", {
    name: "Tethys",
    parent: "saturn",
    radiusKm: 531.1,
    massKg: 6.17e20,
    gravity: 0.146,
    tempK: 86,
    style: "ice",
    colors: ["#e4e2dc", "#aaa69e"],
    discovered: "1684, Giovanni Cassini",
    description:
      "Almost pure water ice. A canyon, Ithaca Chasma, runs three-quarters of the way around it, and the huge crater Odysseus covers much of one hemisphere.",
  }),
  moon("dione", {
    name: "Dione",
    parent: "saturn",
    radiusKm: 561.4,
    massKg: 1.095e21,
    gravity: 0.232,
    tempK: 87,
    style: "ice",
    colors: ["#d8d4cc", "#8e8a84"],
    discovered: "1684, Giovanni Cassini",
    description: "Streaked with bright ice cliffs hundreds of metres high on its trailing side. Cassini found a thin trace of oxygen around it and hints of a subsurface ocean.",
  }),
  moon("rhea", {
    name: "Rhea",
    parent: "saturn",
    radiusKm: 763.8,
    massKg: 2.307e21,
    gravity: 0.264,
    tempK: 76,
    style: "ice",
    colors: ["#ccc6bc", "#8a847a"],
    discovered: "1672, Giovanni Cassini",
    description: "Saturn's second-largest moon: a cold, cratered ball of ice and rock with a whisper of an oxygen and carbon-dioxide atmosphere.",
  }),
  moon("titan", {
    name: "Titan",
    parent: "saturn",
    radiusKm: 2574.7,
    massKg: 1.345e23,
    gravity: 1.35,
    tempK: 94,
    style: "cloudy",
    colors: ["#d9a24f", "#9a6a2a"],
    atmosphere: "#e8b060",
    discovered: "1655, Christiaan Huygens",
    classification: "Moon of Saturn with a thick atmosphere",
    description:
      "The only moon with a dense atmosphere (1.5 times Earth's surface pressure) and the only other world with standing liquid on its surface: seas of methane and ethane. The Huygens probe landed here in 2005; NASA's Dragonfly rotorcraft is due in 2034.",
    facts: [["Surface pressure", "1.5 bar"], ["Largest sea", "Kraken Mare, ~400,000 km²"]],
  }),
  moon("hyperion", {
    name: "Hyperion",
    parent: "saturn",
    radiusKm: 135,
    massKg: 5.6e18,
    style: "rocky",
    colors: ["#b8a48c", "#6a5a48"],
    shape: [1.33, 0.76, 0.99],
    spinHours: 13 * 24,
    discovered: "1848, W. C. Bond, G. P. Bond & W. Lassell",
    description:
      "A sponge-like moon, 40% empty space, that tumbles chaotically: its spin is unpredictable from one orbit to the next. It is the largest irregularly shaped moon known.",
  }),
  moon("iapetus", {
    name: "Iapetus",
    parent: "saturn",
    radiusKm: 734.5,
    massKg: 1.806e21,
    gravity: 0.223,
    tempK: 110,
    style: "rocky",
    colors: ["#e6e0d4", "#2a2018"],
    discovered: "1671, Giovanni Cassini",
    description:
      "A two-faced moon: one hemisphere dark as coal, the other bright as snow. A ridge up to 20 km high runs along its equator like a walnut's seam, and its orbit is tilted so it has the best view of Saturn's rings.",
  }),
  moon("phoebe", {
    name: "Phoebe",
    parent: "saturn",
    radiusKm: 106.5,
    massKg: 8.3e18,
    style: "rocky",
    colors: ["#4a443e", "#2a2622"],
    spinHours: 9.27,
    discovered: "1899, William H. Pickering",
    description:
      "A captured outsider orbiting backwards, 13 million km from Saturn. Probably a Kuiper belt object snared long ago, it feeds a huge, faint dust ring that darkens Iapetus.",
  }),

  /* ---------------- Uranus */
  moon("miranda", {
    name: "Miranda",
    parent: "uranus",
    radiusKm: 235.8,
    massKg: 6.4e19,
    gravity: 0.079,
    tempK: 60,
    style: "ice",
    colors: ["#c8c8c4", "#7e7e7a"],
    discovered: "1948, Gerard Kuiper",
    description:
      "A patchwork world of grooved terrain and giant cliffs, as if it had been shattered and re-assembled. Verona Rupes is the tallest known cliff in the Solar System: a fall from the top would last about 12 minutes.",
  }),
  moon("ariel", {
    name: "Ariel",
    parent: "uranus",
    radiusKm: 578.9,
    massKg: 1.25e21,
    gravity: 0.27,
    tempK: 60,
    style: "ice",
    colors: ["#d4d4d0", "#8c8c88"],
    discovered: "1851, William Lassell",
    description: "The brightest and possibly youngest-surfaced of Uranus's big moons, crossed by long rift valleys floored with smooth, once-flowing ice.",
  }),
  moon("umbriel", {
    name: "Umbriel",
    parent: "uranus",
    radiusKm: 584.7,
    massKg: 1.28e21,
    gravity: 0.2,
    tempK: 75,
    style: "rocky",
    colors: ["#6e6c68", "#3c3a38"],
    discovered: "1851, William Lassell",
    description: "The darkest of Uranus's large moons, old and heavily cratered, with a mysterious bright ring (Wunda) on the floor of one crater.",
  }),
  moon("titania", {
    name: "Titania",
    parent: "uranus",
    radiusKm: 788.9,
    massKg: 3.4e21,
    gravity: 0.38,
    tempK: 70,
    style: "ice",
    colors: ["#c6bfb4", "#7c756c"],
    discovered: "1787, William Herschel",
    description: "Uranus's largest moon: canyons and faults hint that its interior once expanded as water froze.",
  }),
  moon("oberon", {
    name: "Oberon",
    parent: "uranus",
    radiusKm: 761.4,
    massKg: 3.08e21,
    gravity: 0.35,
    tempK: 70,
    style: "rocky",
    colors: ["#b0a498", "#6a5e54"],
    discovered: "1787, William Herschel",
    description: "The outermost large moon of Uranus, old and cratered, with a 6 km-high mountain seen on the limb by Voyager 2.",
  }),

  /* ---------------- Neptune */
  moon("proteus", {
    name: "Proteus",
    parent: "neptune",
    radiusKm: 210,
    massKg: 4.4e19,
    style: "rocky",
    colors: ["#5e5a56", "#34322f"],
    shape: [1.1, 0.9, 1.0],
    discovered: "1989, Voyager 2",
    description: "One of the darkest objects known, and about as big as a body can be before its gravity pulls it round.",
  }),
  moon("triton", {
    name: "Triton",
    parent: "neptune",
    radiusKm: 1353.4,
    massKg: 2.14e22,
    gravity: 0.78,
    tempK: 38,
    style: "ice",
    colors: ["#e8d6cc", "#b08c80"],
    discovered: "1846, William Lassell",
    classification: "Captured Kuiper belt object",
    description:
      "The only large moon that orbits backwards, so it must have been captured, probably a dwarf planet from the Kuiper belt. Voyager 2 saw nitrogen geysers erupting 8 km high. Tides are pulling it in: in a few billion years it will be torn apart into a ring.",
    facts: [["Surface", "−235 °C, one of the coldest measured"]],
  }),
  moon("nereid", {
    name: "Nereid",
    parent: "neptune",
    radiusKm: 170,
    massKg: 3.1e19,
    style: "rocky",
    colors: ["#8a8580", "#4a4642"],
    spinHours: 11.6,
    discovered: "1949, Gerard Kuiper",
    description: "Has one of the most eccentric orbits of any moon: its distance from Neptune swings between 1.4 and 9.6 million km.",
  }),

  /* ---------------- Pluto */
  moon("charon", {
    name: "Charon",
    parent: "pluto",
    radiusKm: 606,
    massKg: 1.586e21,
    gravity: 0.29,
    tempK: 53,
    style: "rocky",
    colors: ["#a8a09a", "#5c5652"],
    discovered: "1978, James Christy",
    description:
      "Half Pluto's width, so large the pair orbit a point in the space between them: a double world. Both are tidally locked, so Charon hangs motionless in Pluto's sky. Its red north pole ('Mordor Macula') is stained by gas escaping from Pluto.",
  }),
  moon("nix", {
    name: "Nix",
    parent: "pluto",
    radiusKm: 19,
    style: "ice",
    colors: ["#d0d0d0", "#909090"],
    shape: [1.3, 0.85, 0.9],
    spinHours: 43.9,
    discovered: "2005, Hubble Space Telescope",
    description: "A small icy moon that tumbles chaotically in the shifting gravity of the Pluto–Charon pair.",
  }),
  moon("hydra", {
    name: "Hydra",
    parent: "pluto",
    radiusKm: 19.5,
    style: "ice",
    colors: ["#d8d8d8", "#9a9a9a"],
    shape: [1.3, 0.8, 0.95],
    spinHours: 10.3,
    discovered: "2005, Hubble Space Telescope",
    description: "Pluto's outermost known moon, spinning once every 10 hours — unusually fast — and coated in nearly pure water ice.",
  }),
];
