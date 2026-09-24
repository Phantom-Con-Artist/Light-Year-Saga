import type { ExternalSource, SpaceObject } from "../domain/types";

const FACT_SHEET: ExternalSource = {
  provider: "NASA",
  name: "NSSDCA Planetary Fact Sheet",
  url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
  freshness: "STATIC",
};

const EPHEMERIS: ExternalSource = {
  provider: "Astronomy Engine",
  name: "VSOP87 / lunar theory (computed client-side)",
  url: "https://github.com/cosinekitty/astronomy",
  freshness: "COMPUTED",
};

const sources = [FACT_SHEET, EPHEMERIS];

export const SOLAR_SYSTEM: SpaceObject[] = [
  {
    id: "sun",
    name: "Sun",
    type: "star",
    classification: "G2V main-sequence star",
    description:
      "The star at the centre of the Solar System, holding 99.86% of its mass. Its fusion core converts about 4 million tonnes of matter into energy every second.",
    physical: {
      meanRadiusKm: 695_700,
      massKg: 1.989e30,
      surfaceGravityMs2: 274,
      rotationPeriodHours: 609.12,
      axialTiltDeg: 7.25,
      meanTemperatureK: 5772,
    },
    ephemeris: { kind: "fixed-origin" },
    visual: { style: "star", colorA: "#fff4d6", colorB: "#ff9a2e", accent: "#ffc861" },
    sources,
  },
  {
    id: "mercury",
    name: "Mercury",
    type: "planet",
    classification: "Terrestrial planet",
    parentId: "sun",
    description:
      "The smallest planet and closest to the Sun. A heavily cratered world with almost no atmosphere and temperature swings of over 600 °C.",
    physical: {
      meanRadiusKm: 2439.7,
      massKg: 3.301e23,
      surfaceGravityMs2: 3.7,
      rotationPeriodHours: 1407.6,
      orbitalPeriodDays: 88.0,
      axialTiltDeg: 0.03,
      meanTemperatureK: 440,
    },
    ephemeris: { kind: "heliocentric", body: "Mercury" },
    visual: { style: "rocky", colorA: "#8c8680", colorB: "#4a4541", accent: "#b8b0a8" },
    sources,
  },
  {
    id: "venus",
    name: "Venus",
    type: "planet",
    classification: "Terrestrial planet",
    parentId: "sun",
    description:
      "Shrouded in sulphuric-acid clouds over a crushing CO₂ atmosphere, Venus is the hottest planet and rotates backwards, slower than it orbits.",
    physical: {
      meanRadiusKm: 6051.8,
      massKg: 4.867e24,
      surfaceGravityMs2: 8.9,
      rotationPeriodHours: -5832.5,
      orbitalPeriodDays: 224.7,
      axialTiltDeg: 177.4,
      meanTemperatureK: 737,
    },
    ephemeris: { kind: "heliocentric", body: "Venus" },
    visual: {
      style: "cloudy",
      colorA: "#e8cf9a",
      colorB: "#b08850",
      atmosphere: "#ffd89a",
      accent: "#f0cf8a",
    },
    sources,
  },
  {
    id: "earth",
    name: "Earth",
    type: "planet",
    classification: "Terrestrial planet",
    parentId: "sun",
    description:
      "Our home world — the only known body harbouring life, with liquid surface oceans, plate tectonics and a protective magnetic field.",
    physical: {
      meanRadiusKm: 6371.0,
      massKg: 5.972e24,
      surfaceGravityMs2: 9.8,
      rotationPeriodHours: 23.9345,
      orbitalPeriodDays: 365.2,
      axialTiltDeg: 23.44,
      meanTemperatureK: 288,
    },
    ephemeris: { kind: "heliocentric", body: "Earth" },
    visual: {
      style: "terran",
      colorA: "#1f6fb8",
      colorB: "#3f8f4a",
      atmosphere: "#5fb4ff",
      accent: "#5fd0ff",
    },
    sources,
  },
  {
    id: "moon",
    name: "Moon",
    type: "moon",
    classification: "Natural satellite",
    parentId: "earth",
    description:
      "Earth's only natural satellite, tidally locked so the same hemisphere always faces us. Twelve humans walked its surface between 1969 and 1972.",
    physical: {
      meanRadiusKm: 1737.4,
      massKg: 7.342e22,
      surfaceGravityMs2: 1.6,
      rotationPeriodHours: 655.7,
      orbitalPeriodDays: 27.3,
      axialTiltDeg: 6.68,
      meanTemperatureK: 250,
    },
    ephemeris: { kind: "geocentric-moon" },
    visual: { style: "rocky", colorA: "#b5b2ad", colorB: "#5d5a56", accent: "#d8d4ce" },
    sources,
  },
  {
    id: "mars",
    name: "Mars",
    type: "planet",
    classification: "Terrestrial planet",
    parentId: "sun",
    description:
      "The red planet: iron-oxide deserts, the tallest volcano in the Solar System (Olympus Mons) and ancient river valleys hinting at a wetter past.",
    physical: {
      meanRadiusKm: 3389.5,
      massKg: 6.417e23,
      surfaceGravityMs2: 3.7,
      rotationPeriodHours: 24.6229,
      orbitalPeriodDays: 687.0,
      axialTiltDeg: 25.19,
      meanTemperatureK: 210,
    },
    ephemeris: { kind: "heliocentric", body: "Mars" },
    visual: {
      style: "rocky",
      colorA: "#c1552e",
      colorB: "#6e2a17",
      atmosphere: "#ff8a5c",
      accent: "#ff7a4d",
    },
    sources,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    type: "planet",
    classification: "Gas giant",
    parentId: "sun",
    description:
      "The largest planet — more than twice the mass of all the others combined. Its Great Red Spot is a storm wider than Earth that has raged for centuries.",
    physical: {
      meanRadiusKm: 69_911,
      massKg: 1.898e27,
      surfaceGravityMs2: 23.1,
      rotationPeriodHours: 9.925,
      orbitalPeriodDays: 4331,
      axialTiltDeg: 3.13,
      meanTemperatureK: 165,
    },
    ephemeris: { kind: "heliocentric", body: "Jupiter" },
    visual: {
      style: "banded",
      colorA: "#d9b98f",
      colorB: "#9a6a44",
      atmosphere: "#e8c9a0",
      accent: "#ffb877",
    },
    sources,
  },
  {
    id: "saturn",
    name: "Saturn",
    type: "planet",
    classification: "Gas giant",
    parentId: "sun",
    description:
      "The ringed jewel of the Solar System. Its rings are mostly water ice, spanning ~280,000 km yet typically only about 10 m thick.",
    physical: {
      meanRadiusKm: 58_232,
      massKg: 5.683e26,
      surfaceGravityMs2: 9.0,
      rotationPeriodHours: 10.656,
      orbitalPeriodDays: 10_747,
      axialTiltDeg: 26.73,
      meanTemperatureK: 134,
    },
    ephemeris: { kind: "heliocentric", body: "Saturn" },
    visual: {
      style: "banded",
      colorA: "#e6d3a3",
      colorB: "#b39058",
      atmosphere: "#f2dfae",
      rings: { innerRadii: 1.24, outerRadii: 2.27, color: "#d9c79c" },
      accent: "#ffe08a",
    },
    sources,
  },
  {
    id: "uranus",
    name: "Uranus",
    type: "planet",
    classification: "Ice giant",
    parentId: "sun",
    description:
      "An ice giant tipped on its side, rolling around the Sun with an axial tilt of about 98°. Methane in its atmosphere gives its cyan hue.",
    physical: {
      meanRadiusKm: 25_362,
      massKg: 8.681e25,
      surfaceGravityMs2: 8.7,
      rotationPeriodHours: -17.24,
      orbitalPeriodDays: 30_589,
      axialTiltDeg: 97.77,
      meanTemperatureK: 76,
    },
    ephemeris: { kind: "heliocentric", body: "Uranus" },
    visual: {
      style: "ice",
      colorA: "#a6e4ea",
      colorB: "#6fb8c4",
      atmosphere: "#b8f4ff",
      accent: "#7af0ff",
    },
    sources,
  },
  {
    id: "neptune",
    name: "Neptune",
    type: "planet",
    classification: "Ice giant",
    parentId: "sun",
    description:
      "The outermost planet, with the fastest winds in the Solar System — over 2,000 km/h. It was the first planet found by mathematical prediction.",
    physical: {
      meanRadiusKm: 24_622,
      massKg: 1.024e26,
      surfaceGravityMs2: 11.0,
      rotationPeriodHours: 16.11,
      orbitalPeriodDays: 59_800,
      axialTiltDeg: 28.32,
      meanTemperatureK: 72,
    },
    ephemeris: { kind: "heliocentric", body: "Neptune" },
    visual: {
      style: "ice",
      colorA: "#3d5fd9",
      colorB: "#233a8f",
      atmosphere: "#6f8cff",
      accent: "#7d9bff",
    },
    sources,
  },
];

export const OBJECTS_BY_ID: ReadonlyMap<string, SpaceObject> = new Map(
  SOLAR_SYSTEM.map((o) => [o.id, o]),
);

export function getObject(id: string | null | undefined): SpaceObject | undefined {
  return id ? OBJECTS_BY_ID.get(id) : undefined;
}
