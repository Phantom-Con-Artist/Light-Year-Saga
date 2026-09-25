import type { ExternalSource, SpaceObject } from "../../domain/types";
import { SATELLITES, SMALL_BODY_COUNTS } from "./elements.gen";
import { SBDB } from "./smallBodies";
import { CELESTRAK } from "./spacecraft";

const n = (x: number) => x.toLocaleString("en-US");
const byClass = SMALL_BODY_COUNTS.byClass;

/** Small-body colour classes, in the order written by scripts/build-solar-system.mjs. */
export const SMALL_BODY_CLASSES: { label: string; color: string }[] = [
  { label: "Main belt", color: "#c9b48a" },
  { label: "Inner belt & Mars-crossers", color: "#e0a07a" },
  { label: "Outer belt", color: "#b8a27e" },
  { label: "Hildas", color: "#f0cf6a" },
  { label: "Jupiter trojans", color: "#8fd18f" },
  { label: "Near-Earth asteroids", color: "#ff6a5c" },
  { label: "Centaurs", color: "#d4a0ff" },
  { label: "Plutinos", color: "#6fb7ff" },
  { label: "Classical Kuiper belt", color: "#8fe0ff" },
  { label: "Scattered disc", color: "#a0a8ff" },
  { label: "Detached", color: "#ff9ad0" },
  { label: "Other", color: "#9a9a9a" },
];

/** Satellite groups, in the order written by the build script. */
export const SATELLITE_GROUPS: { label: string; color: string }[] = [
  { label: "Space stations", color: "#ffd24a" },
  { label: "Starlink", color: "#cfe4ff" },
  { label: "OneWeb", color: "#6fe0d0" },
  { label: "Other low orbit", color: "#ffffff" },
  { label: "Navigation (GPS, Galileo…)", color: "#8fd18f" },
  { label: "Geostationary", color: "#ffb45a" },
  { label: "Highly elliptical", color: "#ff9ad0" },
];

const IBEX: ExternalSource = {
  provider: "NASA",
  name: "Voyager & IBEX heliosphere measurements",
  url: "https://science.nasa.gov/heliophysics/focus-areas/heliosphere/",
  freshness: "STATIC",
};

function region(o: Omit<SpaceObject, "type" | "ephemeris" | "physical" | "visual"> & { accent: string; innerAu: number; outerAu: number }): SpaceObject {
  const { accent, innerAu, outerAu, ...rest } = o;
  return {
    ...rest,
    type: "region",
    physical: { meanRadiusKm: 1 },
    ephemeris: { kind: "fixed-origin" },
    visual: { style: "rocky", colorA: accent, colorB: accent, accent },
    region: { innerAu, outerAu },
  };
}

const s = SATELLITES.counts;

export const REGIONS: SpaceObject[] = [
  region({
    id: "asteroid-belt",
    name: "Asteroid belt",
    classification: "Region · 2.1–3.3 AU",
    accent: "#c9b48a",
    innerAu: 2.1,
    outerAu: 3.3,
    parentId: "sun",
    description:
      "A ring of rocky leftovers between Mars and Jupiter that never formed a planet, stirred up by Jupiter's gravity. It is far emptier than films suggest: the average gap between asteroids larger than 1 km is about a million kilometres, and all of them together weigh 3% of the Moon. Gaps appear where an asteroid's year would be a simple fraction of Jupiter's (the Kirkwood gaps). Every dot here is a real asteroid on its real orbit.",
    facts: [
      ["Shown", `${n(byClass[0] + byClass[1] + byClass[2] + byClass[3])} asteroids (brightest known)`],
      ["Known in total", "Over 1.4 million"],
      ["Total mass", "~2.4 × 10²¹ kg (3% of the Moon)"],
      ["Largest", "Ceres, Vesta, Pallas, Hygiea: half the mass"],
      ["Kirkwood gaps", "2.50 AU (3:1), 2.82 AU (5:2), 2.95 AU (7:3), 3.27 AU (2:1)"],
    ],
    sources: [SBDB],
  }),
  region({
    id: "jupiter-trojans",
    name: "Jupiter trojans",
    classification: "Region · Jupiter's L4 and L5 points",
    accent: "#8fd18f",
    innerAu: 4.8,
    outerAu: 5.6,
    parentId: "sun",
    description:
      "Two swarms of asteroids sharing Jupiter's orbit, 60° ahead (the 'Greek camp', L4) and 60° behind (the 'Trojan camp', L5), held in place by the combined gravity of the Sun and Jupiter. There may be as many as in the main belt. NASA's Lucy mission is touring them from 2027 to 2033.",
    facts: [
      ["Shown", `${n(byClass[4])} trojans`],
      ["Named after", "Heroes of the Trojan War"],
    ],
    sources: [SBDB],
  }),
  region({
    id: "kuiper-belt",
    name: "Kuiper belt",
    classification: "Region · 30–50 AU",
    accent: "#8fe0ff",
    innerAu: 30,
    outerAu: 55,
    parentId: "sun",
    description:
      "A vast, cold disc of icy bodies beyond Neptune: leftovers of planet formation, including Pluto, Haumea, Makemake and Arrokoth. Neptune shapes it: 'plutinos' circle the Sun twice for every three Neptune orbits, while the undisturbed 'cold classicals' sit between 42 and 48 AU. The scattered disc, with Eris, stretches much further on tilted, eccentric orbits and supplies short-period comets.",
    facts: [
      ["Shown", `${n(byClass[6] + byClass[7] + byClass[8] + byClass[9] + byClass[10])} known objects beyond Jupiter`],
      ["Plutinos", `${n(byClass[7])} (3:2 resonance, 39.4 AU)`],
      ["Classical", `${n(byClass[8])}`],
      ["Scattered disc", `${n(byClass[9])}`],
      ["Estimated", "100,000+ bodies over 100 km"],
    ],
    sources: [SBDB],
  }),
  region({
    id: "heliosphere",
    name: "Heliosphere",
    classification: "Region · the Sun's bubble, ~120 AU",
    accent: "#8fb8ff",
    innerAu: 0,
    outerAu: 130,
    parentId: "sun",
    description:
      "The bubble blown by the solar wind, the stream of charged particles flowing off the Sun at 300–800 km/s. As it spreads out its pressure falls with the square of distance, until at the termination shock (~90 AU) it can no longer push back the interstellar gas and suddenly slows and heats up. Beyond, in the heliosheath, it is swept back into a tail. The heliopause, at ~120 AU towards the direction the Sun is moving, is where solar wind gives way to interstellar space. Both Voyagers have crossed it.",
    facts: [
      ["Solar wind", "300–800 km/s, ~5 protons/cm³ at Earth"],
      ["Termination shock", "94 AU (Voyager 1, 2004), 84 AU (Voyager 2, 2007)"],
      ["Heliopause", "121.6 AU (Voyager 1, 2012), 119 AU (Voyager 2, 2018)"],
      ["Interstellar wind", "~26 km/s from Ophiuchus/Scorpius"],
      ["Model shown", "Simplified: a Rankine half-body fitted to the Voyager crossings"],
    ],
    sources: [IBEX],
  }),
  region({
    id: "oort-cloud",
    name: "Oort cloud",
    classification: "Region · 2,000–100,000 AU (theorised)",
    accent: "#a8c8ff",
    innerAu: 2000,
    outerAu: 100_000,
    parentId: "sun",
    description:
      "A giant spherical shell of perhaps a trillion icy bodies, reaching a quarter of the way to the nearest star. No object has been seen in it directly; its existence is inferred from long-period comets that fall in from every direction. The dots here are illustrative, not real objects. Voyager 1 will take about 300 years to reach its inner edge and 30,000 years to cross it.",
    facts: [
      ["Inner edge", "~2,000–5,000 AU"],
      ["Outer edge", "~100,000 AU (1.6 light-years)"],
      ["Proposed by", "Jan Oort, 1950"],
      ["Status", "Inferred, never directly observed"],
    ],
    sources: [{ provider: "NASA", name: "Oort Cloud overview", url: "https://science.nasa.gov/solar-system/oort-cloud/", freshness: "STATIC" }],
  }),
  region({
    id: "earth-satellites",
    name: "Satellites around Earth",
    classification: `${n(SATELLITES.count)} active satellites`,
    accent: "#cfe4ff",
    innerAu: 0,
    outerAu: 0,
    parentId: "earth",
    description: `Every active satellite CelesTrak tracks, on its real orbit (${SATELLITES.fetched}). Heights are exaggerated, as with the moons: the bright shell is low Earth orbit, where Starlink alone now makes up most of all working satellites; navigation satellites (GPS, Galileo, GLONASS, BeiDou) circle at ~20,000 km, and a ring of geostationary satellites hangs at 35,786 km, turning with Earth. Positions drift from reality over weeks, so the swarm is hidden more than a year from the data date.`,
    facts: [
      ["Starlink", n(s[1])],
      ["OneWeb", n(s[2])],
      ["Other low orbit", n(s[3])],
      ["Navigation (MEO)", n(s[4])],
      ["Geostationary", n(s[5])],
      ["Stations", n(s[0])],
    ],
    sources: [CELESTRAK],
  }),
];
