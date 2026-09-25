import type { ExternalSource, SpaceObject, SpaceObjectType, SurfaceStyle } from "../../domain/types";
import type { IauRotation } from "../../astronomy/orientation";
import { conicPeriodDays, msFromJd, type ConicElements } from "../../astronomy/kepler";
import { SBDB_BODIES } from "./elements.gen";

export const SBDB: ExternalSource = {
  provider: "NASA/JPL",
  name: "Small-Body Database (orbit, size, discovery)",
  url: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html",
  freshness: "STATIC",
};
const EPHEMERIS: ExternalSource = {
  provider: "Astronomy Engine",
  name: "Pluto ephemeris (computed client-side)",
  url: "https://github.com/cosinekitty/astronomy",
  freshness: "COMPUTED",
};

interface Spec {
  name: string;
  type: SpaceObjectType;
  classification: string;
  radiusKm: number;
  massKg?: number;
  gravity?: number;
  tempK?: number;
  style: SurfaceStyle;
  colors: [string, string];
  accent?: string;
  shape?: [number, number, number];
  rotation?: IauRotation;
  tilt?: number;
  description: string;
  facts?: [string, string][];
  moments?: { label: string; date: string }[];
  interstellar?: boolean;
}

const fmt = (x: number, d = 0) => x.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });

function periodLabel(days: number): string {
  const years = days / 365.25;
  if (years < 2) return `${fmt(days, 0)} days`;
  if (years < 1000) return `${fmt(years, years < 20 ? 1 : 0)} years`;
  return `~${fmt(Math.round(years / 100) * 100)} years`;
}

const MIN_MS = Date.UTC(1700, 0, 1);
const MAX_MS = Date.UTC(2300, 0, 1);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Perihelion passages inside the simulation window, nearest to today first. */
function perihelia(el: ConicElements, now = Date.now()): { label: string; date: string }[] {
  const period = conicPeriodDays(el);
  const tp = msFromJd(el.tp);
  if (!period) return tp > MIN_MS && tp < MAX_MS ? [{ label: "Closest to the Sun", date: isoDay(tp) }] : [];
  if (period > 365.25 * 600) return tp > MIN_MS && tp < MAX_MS ? [{ label: "Perihelion", date: isoDay(tp) }] : [];
  const P = period * 86_400_000;
  const k = Math.floor((now - tp) / P);
  const last = tp + k * P;
  const next = last + P;
  const out: { label: string; date: string }[] = [];
  if (last > MIN_MS) out.push({ label: "Last perihelion", date: isoDay(last) });
  if (next < MAX_MS) out.push({ label: "Next perihelion", date: isoDay(next) });
  return out;
}

function sbdb(id: string, s: Spec): SpaceObject {
  const b = SBDB_BODIES[id];
  const elements: ConicElements = { q: b.q, e: b.e, i: b.i, om: b.om, w: b.w, tp: b.tp };
  const period = conicPeriodDays(elements);
  const facts: [string, string][] = [["Designation", b.designation]];
  if (b.orbitClass) facts.push(["Orbit class", b.orbitClass.replace(/\*$/, "")]);
  facts.push(["Closest to Sun", `${fmt(b.q, 3)} AU`]);
  if (b.e < 1 && b.a) facts.push(["Farthest from Sun", `${fmt(b.a * (1 + b.e), b.a * (1 + b.e) < 10 ? 2 : 0)} AU`]);
  facts.push(["Eccentricity", fmt(b.e, 3)]);
  facts.push(["Inclination", `${fmt(b.i, 1)}°`]);
  if (b.e > 1) facts.push(["Speed far from the Sun", `${fmt(29.78 * Math.sqrt(-1 / (b.a ?? -1)), 1)} km/s`]);
  if (b.phys.extent) facts.push(["Dimensions", `${b.phys.extent} km`]);
  if (b.phys.albedo) facts.push(["Albedo", `${fmt(b.phys.albedo * 100)}% of light reflected`]);
  if (b.phys.density) facts.push(["Density", `${fmt(b.phys.density, 2)} g/cm³`]);
  if (b.discovery) facts.push(["Discovered", `${b.discovery.date.replace(/-/g, " ")}${b.discovery.by ? `, ${b.discovery.by.replace(/\.$/, "")}` : ""}`]);
  facts.push(...(s.facts ?? []));

  const moments = [...(s.moments ?? [])];
  if (s.type === "comet" || s.interstellar) moments.push(...perihelia(elements));

  return {
    id,
    name: s.name,
    type: s.type,
    classification: s.classification,
    parentId: "sun",
    description: s.description,
    physical: {
      meanRadiusKm: s.radiusKm,
      massKg: s.massKg ?? (b.phys.gm ? (b.phys.gm * 1e9) / 6.674e-11 : undefined),
      surfaceGravityMs2: s.gravity,
      rotationPeriodHours: b.phys.rotationHours ?? undefined,
      orbitalPeriodDays: period ?? undefined,
      axialTiltDeg: s.tilt,
      meanTemperatureK: s.tempK,
      rotation: s.rotation,
    },
    ephemeris: { kind: "conic", elements },
    visual: { style: s.style, colorA: s.colors[0], colorB: s.colors[1], shape: s.shape, accent: s.accent ?? s.colors[0] },
    facts: period ? [["Orbital period", periodLabel(period)], ...facts] : facts,
    moments: moments.length ? moments : undefined,
    interstellar: s.interstellar,
    sources: [SBDB],
  };
}

export const PLUTO: SpaceObject = {
  id: "pluto",
  name: "Pluto",
  type: "dwarf-planet",
  classification: "Dwarf planet · Kuiper belt",
  parentId: "sun",
  description:
    "The ninth planet from 1930 to 2006, now the best-known dwarf planet. New Horizons flew past in 2015 and found a young, active world: a heart-shaped glacier of nitrogen ice (Sputnik Planitia), water-ice mountains as tall as the Rockies, blue hazes and possibly an ocean beneath.",
  physical: {
    meanRadiusKm: 1188.3,
    massKg: 1.303e22,
    surfaceGravityMs2: 0.62,
    rotationPeriodHours: -153.29,
    orbitalPeriodDays: 90_560,
    axialTiltDeg: 122.5,
    meanTemperatureK: 44,
    rotation: { poleRa: 132.993, poleDec: -6.163, w0: 302.695, wDot: -56.3625225 },
  },
  ephemeris: { kind: "heliocentric", body: "Pluto" },
  visual: { style: "ice", colorA: "#e9d2b8", colorB: "#9a6a4c", atmosphere: "#9fc4ff", accent: "#e9c9a8" },
  facts: [
    ["Discovered", "1930 Feb 18, Clyde Tombaugh"],
    ["Distance from Sun", "29.7–49.3 AU"],
    ["Resonance", "Orbits the Sun twice for every 3 of Neptune's orbits"],
    ["Moons", "5 (Charon, Styx, Nix, Kerberos, Hydra)"],
  ],
  moments: [{ label: "New Horizons flyby", date: "2015-07-14" }],
  sources: [EPHEMERIS, { provider: "NASA", name: "New Horizons mission results", url: "https://science.nasa.gov/mission/new-horizons/", freshness: "STATIC" }],
};

export const DWARF_PLANETS: SpaceObject[] = [
  sbdb("ceres", {
    name: "Ceres",
    type: "dwarf-planet",
    classification: "Dwarf planet · asteroid belt",
    radiusKm: 469.7,
    massKg: 9.38e20,
    gravity: 0.28,
    tempK: 168,
    style: "rocky",
    colors: ["#a39e96", "#5a5650"],
    rotation: { poleRa: 291.418, poleDec: 66.764, w0: 170.65, wDot: 952.1532 },
    description:
      "The largest object in the asteroid belt, holding a third of its mass. Dawn orbited it from 2015 to 2018 and found bright salt deposits in Occator crater, left by briny water welling up from below: Ceres may still hold pockets of liquid.",
  }),
  sbdb("eris", {
    name: "Eris",
    type: "dwarf-planet",
    classification: "Dwarf planet · scattered disc",
    radiusKm: 1163,
    massKg: 1.66e22,
    gravity: 0.82,
    tempK: 43,
    style: "ice",
    colors: ["#eeeeec", "#b8b4ae"],
    description:
      "Slightly smaller than Pluto but 27% more massive. Its discovery in 2005 forced astronomers to define 'planet', and Pluto was reclassified. Eris is now about 96 AU from the Sun, near the far end of its 557-year orbit.",
    facts: [["Moon", "Dysnomia"]],
  }),
  sbdb("haumea", {
    name: "Haumea",
    type: "dwarf-planet",
    classification: "Dwarf planet · Kuiper belt",
    radiusKm: 798,
    massKg: 4.0e21,
    gravity: 0.4,
    tempK: 50,
    style: "ice",
    colors: ["#f2f2f0", "#b0aca8"],
    shape: [1.45, 0.64, 1.07],
    description:
      "Spins once every 3.9 hours, one of the fastest rotations of any large body, which stretches it into an egg shape twice as long as it is wide. It has a ring and two moons, and is coated in crystalline water ice.",
    facts: [["Shape", "~2,300 × 1,700 × 1,000 km"]],
  }),
  sbdb("makemake", {
    name: "Makemake",
    type: "dwarf-planet",
    classification: "Dwarf planet · Kuiper belt",
    radiusKm: 715,
    massKg: 3.1e21,
    tempK: 40,
    style: "ice",
    colors: ["#d9a88a", "#8a5a44"],
    description: "A reddish-brown world coated in frozen methane, discovered shortly after Easter 2005 and named after the Rapa Nui creator god.",
  }),
  sbdb("gonggong", {
    name: "Gonggong",
    type: "dwarf-planet",
    classification: "Dwarf planet candidate · scattered disc",
    radiusKm: 615,
    massKg: 1.75e21,
    style: "ice",
    colors: ["#c77a5a", "#6e3a28"],
    description: "One of the reddest large bodies known, probably from methane ice altered by radiation. It has a small moon, Xiangliu.",
  }),
  sbdb("quaoar", {
    name: "Quaoar",
    type: "dwarf-planet",
    classification: "Dwarf planet candidate · Kuiper belt",
    radiusKm: 545,
    massKg: 1.2e21,
    style: "ice",
    colors: ["#b88a74", "#6a4a3c"],
    description: "Has a ring far outside the distance where rings should be able to survive — a puzzle for planetary scientists since its discovery in 2023.",
  }),
  sbdb("orcus", {
    name: "Orcus",
    type: "dwarf-planet",
    classification: "Dwarf planet candidate · plutino",
    radiusKm: 455,
    massKg: 6.3e20,
    style: "ice",
    colors: ["#bcbcbc", "#747474"],
    description: "The 'anti-Pluto': it shares Pluto's 3:2 resonance with Neptune but is always on the opposite side of its orbit. Its moon Vanth is unusually large.",
  }),
  sbdb("sedna", {
    name: "Sedna",
    type: "dwarf-planet",
    classification: "Detached object · inner Oort cloud",
    radiusKm: 500,
    style: "ice",
    colors: ["#d0664a", "#7a2c1c"],
    accent: "#ff8a6a",
    description:
      "Never comes closer than 76 AU and swings out to about 1,000 AU, so it never feels Neptune's pull. Such orbits hint at a passing star in the Sun's birth cluster, or an unseen distant planet ('Planet Nine', still hypothetical). One of the reddest objects known.",
  }),
  sbdb("farfarout", {
    name: "Farfarout",
    type: "dwarf-planet",
    classification: "Trans-Neptunian object",
    radiusKm: 200,
    style: "ice",
    colors: ["#c0a090", "#6a5044"],
    description:
      "The most distant known Solar System object when found in 2018, at about 132 AU. Its orbit takes it out to ~130 AU and in closer than Neptune once every thousand years. Its size is only estimated from its brightness.",
  }),
  PLUTO,
];

export const ASTEROIDS: SpaceObject[] = [
  sbdb("vesta", {
    name: "Vesta",
    type: "asteroid",
    classification: "Asteroid · protoplanet",
    radiusKm: 262.7,
    massKg: 2.59e20,
    gravity: 0.25,
    style: "rocky",
    colors: ["#b8b0a4", "#6a6258"],
    shape: [1.09, 0.85, 1.06],
    rotation: { poleRa: 309.031, poleDec: 42.235, w0: 285.39, wDot: 1617.3329428 },
    description:
      "A surviving protoplanet with a melted, layered interior. A giant impact carved the Rheasilvia basin at its south pole, whose central peak is one of the tallest mountains in the Solar System; fragments reach Earth as HED meteorites. Dawn orbited it in 2011–2012.",
  }),
  sbdb("pallas", {
    name: "Pallas",
    type: "asteroid",
    classification: "Asteroid",
    radiusKm: 256,
    massKg: 2.04e20,
    style: "rocky",
    colors: ["#9a968e", "#58544e"],
    description: "The third-largest asteroid, on a steeply tilted orbit (35°) that has kept spacecraft away. Its heavily cratered surface earned it the nickname 'golf-ball asteroid'.",
  }),
  sbdb("hygiea", {
    name: "Hygiea",
    type: "asteroid",
    classification: "Asteroid",
    radiusKm: 217,
    massKg: 8.7e19,
    style: "rocky",
    colors: ["#5e5a56", "#34322f"],
    description: "Almost perfectly round, making it a candidate dwarf planet: a dark, carbon-rich body that is the largest member of its own collisional family.",
  }),
  sbdb("psyche", {
    name: "Psyche",
    type: "asteroid",
    classification: "Metal-rich asteroid",
    radiusKm: 111,
    massKg: 2.29e19,
    style: "rocky",
    colors: ["#a8a6a2", "#5e5c58"],
    shape: [1.25, 0.84, 1.0],
    description: "Possibly the exposed iron-nickel core of a shattered protoplanet. NASA's Psyche spacecraft, launched in 2023, arrives in 2029.",
  }),
  sbdb("eros", {
    name: "Eros",
    type: "asteroid",
    classification: "Near-Earth asteroid",
    radiusKm: 8.4,
    style: "rocky",
    colors: ["#b09a7c", "#6a5a44"],
    shape: [2.0, 0.66, 0.66],
    description: "A 34 km, peanut-shaped near-Earth asteroid. NEAR Shoemaker orbited it for a year and then landed on it in 2001, the first landing on an asteroid.",
  }),
  sbdb("bennu", {
    name: "Bennu",
    type: "asteroid",
    classification: "Near-Earth asteroid · sample returned",
    radiusKm: 0.245,
    style: "rocky",
    colors: ["#4a4642", "#2a2826"],
    description:
      "A spinning-top rubble pile half a kilometre wide. OSIRIS-REx collected 121 g from its surface in 2020, delivered to Earth in 2023, containing amino acids and brines. It has a 1-in-2,700 chance of hitting Earth in 2182.",
    moments: [{ label: "OSIRIS-REx sample grab", date: "2020-10-20" }],
  }),
  sbdb("ryugu", {
    name: "Ryugu",
    type: "asteroid",
    classification: "Near-Earth asteroid · sample returned",
    radiusKm: 0.448,
    style: "rocky",
    colors: ["#48443f", "#282624"],
    description: "Hayabusa2 fired a copper bullet into Ryugu in 2019 to dig up fresh material and brought 5.4 g home in 2020: some of the most pristine matter from the early Solar System.",
  }),
  sbdb("itokawa", {
    name: "Itokawa",
    type: "asteroid",
    classification: "Near-Earth asteroid · sample returned",
    radiusKm: 0.165,
    style: "rocky",
    colors: ["#a09480", "#5c5446"],
    shape: [1.66, 0.76, 0.8],
    description: "A 535 m 'sea otter' of loose rubble. Japan's Hayabusa brought the first grains from an asteroid back to Earth in 2010.",
  }),
  sbdb("apophis", {
    name: "Apophis",
    type: "asteroid",
    classification: "Near-Earth asteroid",
    radiusKm: 0.17,
    style: "rocky",
    colors: ["#9a8a74", "#5a4e40"],
    shape: [1.3, 0.8, 0.95],
    description:
      "On Friday 13 April 2029 this 340 m asteroid will pass just 32,000 km above Earth, inside the orbits of geostationary satellites and visible to the naked eye. Impact has been ruled out for at least the next century. NASA's OSIRIS-APEX will meet it afterwards.",
    moments: [{ label: "Earth flyby", date: "2029-04-13" }],
  }),
  sbdb("didymos", {
    name: "Didymos",
    type: "asteroid",
    classification: "Near-Earth binary asteroid",
    radiusKm: 0.38,
    style: "rocky",
    colors: ["#8a8278", "#4e4a44"],
    description:
      "In 2022 NASA's DART spacecraft struck its moonlet Dimorphos at 6 km/s and shortened its orbit by 33 minutes: the first test of deflecting an asteroid. ESA's Hera arrives in 2026 to survey the result.",
    moments: [{ label: "DART impact", date: "2022-09-26" }],
  }),
  sbdb("kamooalewa", {
    name: "Kamoʻoalewa",
    type: "asteroid",
    classification: "Quasi-satellite of Earth",
    radiusKm: 0.025,
    style: "rocky",
    colors: ["#a0806a", "#5a4638"],
    description:
      "A small asteroid in a 1:1 dance with Earth, looping around us as we both orbit the Sun. Its spectrum matches lunar rock: it may be a fragment blasted off the Moon. China's Tianwen-2, launched in 2025, will bring back a sample.",
  }),
  sbdb("cruithne", {
    name: "Cruithne",
    type: "asteroid",
    classification: "Earth co-orbital asteroid",
    radiusKm: 2.5,
    style: "rocky",
    colors: ["#9a9084", "#56504a"],
    description: "Sometimes called 'Earth's second moon', it is not one: it orbits the Sun in step with Earth, tracing a horseshoe-shaped path relative to us over 770 years.",
  }),
  sbdb("patroclus", {
    name: "Patroclus",
    type: "asteroid",
    classification: "Jupiter trojan · binary",
    radiusKm: 56,
    style: "rocky",
    colors: ["#6a625c", "#3a3632"],
    accent: "#8fd18f",
    description: "A pair of 110 km bodies orbiting each other in Jupiter's trailing Lagrange point. NASA's Lucy will fly past in 2033, the last stop of its tour of the trojans.",
  }),
  sbdb("chiron", {
    name: "Chiron",
    type: "asteroid",
    classification: "Centaur",
    radiusKm: 108,
    style: "rocky",
    colors: ["#7a746e", "#46423e"],
    accent: "#d4a0ff",
    description: "The first centaur found (1977): an icy body between Saturn and Uranus that sometimes grows a comet-like coma. Centaurs are Kuiper belt objects on their way inward.",
  }),
  sbdb("arrokoth", {
    name: "Arrokoth",
    type: "asteroid",
    classification: "Cold classical Kuiper belt object",
    radiusKm: 9,
    style: "rocky",
    colors: ["#b0604a", "#6a3424"],
    shape: [1.9, 0.52, 1.0],
    description:
      "The most distant object ever visited: New Horizons flew past on 1 January 2019. Two flattened lobes that gently merged 4.5 billion years ago, untouched since — a snapshot of how planets began.",
    moments: [{ label: "New Horizons flyby", date: "2019-01-01" }],
  }),
];

const COMET_COLORS: [string, string] = ["#4a4440", "#26221f"];

export const COMETS: SpaceObject[] = [
  sbdb("halley", {
    name: "Halley's Comet",
    type: "comet",
    classification: "Periodic comet · Halley type",
    radiusKm: 5.5,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    shape: [1.4, 0.75, 0.9],
    description:
      "The most famous comet, seen every 75–76 years and recorded since at least 240 BC. Edmond Halley predicted its 1758 return. In 1986 the Giotto probe flew within 600 km of its dark nucleus. It is now far out beyond Neptune's orbit, and returns in 2061.",
    facts: [["Meteor showers", "Eta Aquariids (May), Orionids (October)"]],
  }),
  sbdb("encke", {
    name: "Encke's Comet",
    type: "comet",
    classification: "Periodic comet · Jupiter family",
    radiusKm: 2.4,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    description: "Returns every 3.3 years, the shortest period of any bright comet. Its debris makes the Taurid meteors.",
  }),
  sbdb("churyumov-gerasimenko", {
    name: "67P/Churyumov–Gerasimenko",
    type: "comet",
    classification: "Periodic comet · Jupiter family",
    radiusKm: 2,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    shape: [1.4, 0.8, 0.9],
    description:
      "The 'rubber duck' comet that ESA's Rosetta orbited for two years (2014–2016). Its lander Philae made the first touchdown on a comet, bouncing twice before settling in a shadowy crack.",
    moments: [{ label: "Philae landing", date: "2014-11-12" }],
  }),
  sbdb("tempel-1", {
    name: "Tempel 1",
    type: "comet",
    classification: "Periodic comet · Jupiter family",
    radiusKm: 3,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    description: "On 4 July 2005 NASA's Deep Impact fired a 370 kg copper impactor into it to see what lies beneath a comet's crust: fine powdery dust and ice.",
    moments: [{ label: "Deep Impact", date: "2005-07-04" }],
  }),
  sbdb("hartley-2", {
    name: "Hartley 2",
    type: "comet",
    classification: "Periodic comet · Jupiter family",
    radiusKm: 0.6,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    shape: [1.8, 0.6, 0.8],
    description: "A small, hyperactive peanut-shaped comet visited by EPOXI in 2010; jets of carbon dioxide carry chunks of ice off its ends.",
  }),
  sbdb("swift-tuttle", {
    name: "Swift–Tuttle",
    type: "comet",
    classification: "Periodic comet · Halley type",
    radiusKm: 13,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    description: "The largest object that regularly passes close to Earth (26 km). Its dust gives us the Perseid meteors every August. Next perihelion: 2126.",
    facts: [["Meteor shower", "Perseids (August)"]],
  }),
  sbdb("tempel-tuttle", {
    name: "Tempel–Tuttle",
    type: "comet",
    classification: "Periodic comet · Halley type",
    radiusKm: 1.8,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    description: "Parent of the Leonid meteors, which become storms of thousands per hour when Earth crosses fresh trails, as in 1833, 1966 and 2001.",
    facts: [["Meteor shower", "Leonids (November)"]],
  }),
  sbdb("pons-brooks", {
    name: "12P/Pons–Brooks",
    type: "comet",
    classification: "Periodic comet · Halley type",
    radiusKm: 15,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    description: "The 'devil comet': outbursts in 2023 threw its coma into a horned shape. It reached perihelion in April 2024, around the total solar eclipse.",
  }),
  sbdb("wild-2", {
    name: "Wild 2",
    type: "comet",
    classification: "Periodic comet · Jupiter family",
    radiusKm: 2,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    description: "NASA's Stardust caught dust from its coma in aerogel in 2004 and returned it in 2006, the first comet sample. It contained glycine, an amino acid.",
  }),
  sbdb("hale-bopp", {
    name: "Hale–Bopp",
    type: "comet",
    classification: "Long-period comet",
    radiusKm: 30,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    description:
      "The Great Comet of 1997: visible to the naked eye for a record 18 months, with a nucleus around 60 km across, far larger than most. Its last visit was about 4,200 years ago; it won't be back for ~2,400 years.",
  }),
  sbdb("hyakutake", {
    name: "Hyakutake",
    type: "comet",
    classification: "Long-period comet",
    radiusKm: 2.1,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    description: "Passed just 0.1 AU from Earth in March 1996, stretching its tail across half the sky. Ulysses later found the tail was 570 million km long, the longest measured.",
  }),
  sbdb("neowise", {
    name: "NEOWISE",
    type: "comet",
    classification: "Long-period comet",
    radiusKm: 2.5,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    description: "The brightest comet seen from the Northern Hemisphere since Hale–Bopp, a naked-eye sight in July 2020 with a split dust and ion tail. Next return in about 6,700 years.",
  }),
  sbdb("tsuchinshan-atlas", {
    name: "Tsuchinshan–ATLAS",
    type: "comet",
    classification: "Long-period comet (nearly parabolic)",
    radiusKm: 2.5,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#9fd8ff",
    description:
      "The bright comet of October 2024, with a rare anti-tail pointing towards the Sun. Its orbit is so close to parabolic it may never return: it probably came from the Oort cloud for the first time.",
  }),
  sbdb("oumuamua", {
    name: "ʻOumuamua",
    type: "asteroid",
    classification: "1I · first interstellar object",
    radiusKm: 0.1,
    style: "rocky",
    colors: ["#a8604a", "#5a3024"],
    accent: "#ff9ad0",
    shape: [3, 0.5, 0.66],
    interstellar: true,
    description:
      "The first object seen passing through the Solar System from another star, in 2017. Reddish, strongly elongated and tumbling, it sped up slightly as it left without showing a coma — probably from gas escaping invisibly. It is heading out towards Pegasus at 26 km/s.",
  }),
  sbdb("borisov", {
    name: "2I/Borisov",
    type: "comet",
    classification: "2I · interstellar comet",
    radiusKm: 0.4,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#ff9ad0",
    interstellar: true,
    description: "The second interstellar visitor (2019) and the first clearly a comet. It was unusually rich in carbon monoxide, suggesting it formed in the cold outskirts of another planetary system.",
  }),
  sbdb("atlas-3i", {
    name: "3I/ATLAS",
    type: "comet",
    classification: "3I · interstellar comet",
    radiusKm: 1,
    style: "rocky",
    colors: COMET_COLORS,
    accent: "#ff9ad0",
    interstellar: true,
    description:
      "The third interstellar visitor, found 1 July 2025 and the fastest yet: about 58 km/s relative to the Sun. It may be over 7 billion years old, older than the Solar System. It passed perihelion inside Mars's orbit in October 2025. Its size is uncertain.",
  }),
];
