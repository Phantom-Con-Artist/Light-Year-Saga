import type { ExternalSource, SpaceObject, SpacecraftModel } from "../../domain/types";
import { SATELLITES } from "./elements.gen";

const HORIZONS_VECTORS: ExternalSource = {
  provider: "NASA/JPL",
  name: "Horizons spacecraft trajectories",
  url: "https://ssd.jpl.nasa.gov/horizons/",
  freshness: "COMPUTED",
};
export const CELESTRAK: ExternalSource = {
  provider: "CelesTrak",
  name: `Two-line elements (bundled ${SATELLITES.fetched}; refreshed live when online)`,
  url: "https://celestrak.org/NORAD/elements/",
  freshness: "RECENT",
};

interface CraftSpec {
  name: string;
  type: "spacecraft" | "space-station" | "telescope";
  classification: string;
  parentId: string;
  model: SpacecraftModel;
  /** Display size (km): spacecraft are drawn larger than life, like everything else here. */
  sizeKm: number;
  accent: string;
  description: string;
  facts: [string, string][];
  moments?: { label: string; date: string }[];
  active?: { from?: string; to?: string };
  massKg?: number;
}

function craft(id: string, s: CraftSpec, ephemeris: SpaceObject["ephemeris"], sources: ExternalSource[]): SpaceObject {
  return {
    id,
    name: s.name,
    type: s.type,
    classification: s.classification,
    parentId: s.parentId,
    description: s.description,
    physical: { meanRadiusKm: s.sizeKm, massKg: s.massKg },
    ephemeris,
    visual: { style: "rocky", colorA: "#cccccc", colorB: "#777777", accent: s.accent, model: s.model },
    facts: s.facts,
    moments: s.moments,
    active: s.active,
    sources,
  };
}

const probe = (id: string, s: CraftSpec) => craft(id, s, { kind: "trajectory", track: id }, [HORIZONS_VECTORS]);
const orbiter = (id: string, s: CraftSpec) => craft(id, s, { kind: "tle", satellite: id }, [CELESTRAK]);

export const SPACECRAFT: SpaceObject[] = [
  orbiter("iss", {
    name: "International Space Station",
    type: "space-station",
    classification: "Crewed space station · low Earth orbit",
    parentId: "earth",
    model: "iss",
    sizeKm: 0.055,
    accent: "#ffe08a",
    massKg: 450_000,
    active: { from: "1998-11-20", to: "2030-12-31" },
    description:
      "The largest structure humans have built in space: a football-field-sized laboratory, continuously crewed since November 2000. It circles Earth every 92 minutes at about 28,000 km/h, so its crew see 16 sunrises a day. Its solar arrays turn to follow the Sun. It is due to be deorbited around 2030.",
    facts: [
      ["Altitude", "~420 km"],
      ["Speed", "7.66 km/s"],
      ["Span", "109 m (solar array truss)"],
      ["Pressurised volume", "916 m³"],
      ["Crewed since", "2 Nov 2000"],
      ["Partners", "NASA, Roscosmos, ESA, JAXA, CSA"],
    ],
    moments: [
      { label: "First module (Zarya)", date: "1998-11-20" },
      { label: "First crew arrives", date: "2000-11-02" },
    ],
  }),
  orbiter("tiangong", {
    name: "Tiangong",
    type: "space-station",
    classification: "Chinese space station · low Earth orbit",
    parentId: "earth",
    model: "tiangong",
    sizeKm: 0.04,
    accent: "#ff9a7a",
    massKg: 100_000,
    active: { from: "2021-04-29" },
    description:
      "China's permanently crewed 'Heavenly Palace': the Tianhe core module with the Wentian and Mengtian laboratories in a T shape, completed in 2022. It orbits at about 390 km with crews of three.",
    facts: [
      ["Altitude", "~390 km"],
      ["Modules", "Tianhe, Wentian, Mengtian"],
      ["Core launched", "29 Apr 2021"],
    ],
  }),
  orbiter("hubble", {
    name: "Hubble Space Telescope",
    type: "telescope",
    classification: "Space telescope · low Earth orbit",
    parentId: "earth",
    model: "hubble",
    sizeKm: 0.025,
    accent: "#c9d6ff",
    massKg: 11_110,
    active: { from: "1990-04-24" },
    description:
      "Launched in 1990 with a flawed mirror, fixed by astronauts in 1993, and serviced five times by Space Shuttle crews. Its 2.4 m mirror has made more than 1.6 million observations, from the age of the Universe to the atmospheres of exoplanets.",
    facts: [
      ["Mirror", "2.4 m"],
      ["Altitude", "~520 km (slowly sinking)"],
      ["Length", "13.2 m"],
    ],
  }),
  probe("jwst", {
    name: "James Webb Space Telescope",
    type: "telescope",
    classification: "Infrared space telescope · Sun–Earth L2",
    parentId: "earth",
    model: "jwst",
    sizeKm: 0.03,
    accent: "#ffd27a",
    massKg: 6_161,
    description:
      "The largest telescope in space: a 6.5 m gold-coated mirror behind a tennis-court-sized sunshield that keeps it at −233 °C. It loops around the L2 point, 1.5 million km beyond Earth on the night side, and sees the first galaxies, forming stars and exoplanet atmospheres in infrared.",
    facts: [
      ["Mirror", "6.5 m, 18 gold-coated segments"],
      ["Sunshield", "21 × 14 m, 5 layers"],
      ["Distance from Earth", "~1.5 million km"],
      ["Launched", "25 Dec 2021, Ariane 5"],
    ],
    moments: [
      { label: "Launch", date: "2021-12-26" },
      { label: "Arrival at L2", date: "2022-01-24" },
    ],
  }),
  probe("voyager-1", {
    name: "Voyager 1",
    type: "spacecraft",
    classification: "Interstellar probe · farthest human-made object",
    parentId: "sun",
    model: "voyager",
    sizeKm: 0.02,
    accent: "#9fd8ff",
    massKg: 722,
    description:
      "Launched in 1977 to Jupiter and Saturn, it is now the most distant human-made object, travelling at 17 km/s. In 2012 it became the first spacecraft to cross the heliopause into interstellar space. It carries the Golden Record, and still sends data home on a 23-watt radio. Its signals take over 23 hours to reach Earth.",
    facts: [
      ["Launched", "5 Sep 1977"],
      ["Speed", "~17 km/s (3.6 AU per year)"],
      ["Power", "Plutonium RTGs, fading ~4 W/year"],
      ["Crossed heliopause", "25 Aug 2012 at 121.6 AU"],
    ],
    moments: [
      { label: "Jupiter flyby", date: "1979-03-05" },
      { label: "Saturn and Titan", date: "1980-11-12" },
      { label: "'Pale Blue Dot' photo", date: "1990-02-14" },
      { label: "Crosses the termination shock", date: "2004-12-16" },
      { label: "Enters interstellar space", date: "2012-08-25" },
    ],
  }),
  probe("voyager-2", {
    name: "Voyager 2",
    type: "spacecraft",
    classification: "Interstellar probe",
    parentId: "sun",
    model: "voyager",
    sizeKm: 0.02,
    accent: "#9fd8ff",
    massKg: 722,
    description:
      "The only spacecraft to have visited Uranus and Neptune, on a 'Grand Tour' made possible by a planetary alignment that comes once every 175 years. It crossed into interstellar space in 2018, heading south of the ecliptic.",
    facts: [
      ["Launched", "20 Aug 1977"],
      ["Speed", "~15 km/s (3.2 AU per year)"],
      ["Crossed heliopause", "5 Nov 2018 at 119 AU"],
    ],
    moments: [
      { label: "Jupiter flyby", date: "1979-07-09" },
      { label: "Saturn flyby", date: "1981-08-26" },
      { label: "Uranus flyby", date: "1986-01-24" },
      { label: "Neptune flyby", date: "1989-08-25" },
      { label: "Enters interstellar space", date: "2018-11-05" },
    ],
  }),
  probe("pioneer-10", {
    name: "Pioneer 10",
    type: "spacecraft",
    classification: "Interstellar probe (silent)",
    parentId: "sun",
    model: "pioneer",
    sizeKm: 0.015,
    accent: "#b0c4de",
    massKg: 258,
    description:
      "The first spacecraft to cross the asteroid belt and fly past Jupiter (1973). It carries the Pioneer plaque showing humans and our location. Its last signal came in 2003; it is coasting towards Aldebaran, which it would reach in about 2 million years.",
    facts: [
      ["Launched", "3 Mar 1972"],
      ["Last signal", "23 Jan 2003"],
    ],
    moments: [{ label: "Jupiter flyby", date: "1973-12-04" }],
  }),
  probe("pioneer-11", {
    name: "Pioneer 11",
    type: "spacecraft",
    classification: "Interstellar probe (silent)",
    parentId: "sun",
    model: "pioneer",
    sizeKm: 0.015,
    accent: "#b0c4de",
    massKg: 259,
    description: "Flew past Jupiter in 1974 and made the first visit to Saturn in 1979, scouting the route for the Voyagers. Contact was lost in 1995.",
    facts: [
      ["Launched", "6 Apr 1973"],
      ["Last contact", "30 Sep 1995"],
    ],
    moments: [
      { label: "Jupiter flyby", date: "1974-12-03" },
      { label: "First Saturn flyby", date: "1979-09-01" },
    ],
  }),
  probe("new-horizons", {
    name: "New Horizons",
    type: "spacecraft",
    classification: "Kuiper belt probe",
    parentId: "sun",
    model: "new-horizons",
    sizeKm: 0.015,
    accent: "#e9c9a8",
    massKg: 478,
    description:
      "The fastest spacecraft ever launched from Earth (16.3 km/s). It took the first close-up images of Pluto in 2015, then visited Arrokoth in 2019, the most distant object ever explored. It is still returning data from the Kuiper belt.",
    facts: [
      ["Launched", "19 Jan 2006"],
      ["Pluto closest approach", "12,500 km"],
    ],
    moments: [
      { label: "Jupiter gravity assist", date: "2007-02-28" },
      { label: "Pluto flyby", date: "2015-07-14" },
      { label: "Arrokoth flyby", date: "2019-01-01" },
    ],
  }),
  probe("cassini", {
    name: "Cassini",
    type: "spacecraft",
    classification: "Saturn orbiter (1997–2017)",
    parentId: "sun",
    model: "cassini",
    sizeKm: 0.02,
    accent: "#ffe08a",
    massKg: 5_712,
    description:
      "Orbited Saturn for 13 years, dropped ESA's Huygens probe onto Titan, discovered Enceladus's geysers, and ended by diving into Saturn in 2017 so it could never contaminate a moon that might hold life.",
    facts: [
      ["Launched", "15 Oct 1997"],
      ["Orbits of Saturn", "294"],
      ["End of mission", "15 Sep 2017, into Saturn"],
    ],
    moments: [
      { label: "Arrives at Saturn", date: "2004-07-01" },
      { label: "Huygens lands on Titan", date: "2005-01-14" },
      { label: "Grand Finale plunge", date: "2017-09-14" },
    ],
  }),
  probe("juno", {
    name: "Juno",
    type: "spacecraft",
    classification: "Jupiter orbiter",
    parentId: "sun",
    model: "juno",
    sizeKm: 0.02,
    accent: "#ffb877",
    massKg: 3_625,
    description:
      "A solar-powered spacecraft in a long polar orbit of Jupiter since 2016, diving under the radiation belts to map the planet's deep interior, gravity and magnetic field. It found Jupiter's core is 'fuzzy', not solid.",
    facts: [
      ["Launched", "5 Aug 2011"],
      ["Power", "Three 9 m solar wings"],
    ],
    moments: [
      { label: "Earth flyby", date: "2013-10-09" },
      { label: "Jupiter orbit insertion", date: "2016-07-05" },
    ],
  }),
  probe("europa-clipper", {
    name: "Europa Clipper",
    type: "spacecraft",
    classification: "Jupiter / Europa mission",
    parentId: "sun",
    model: "clipper",
    sizeKm: 0.02,
    accent: "#e3d6bf",
    massKg: 6_065,
    description:
      "NASA's largest planetary spacecraft, with solar arrays spanning 30 m. After gravity assists from Mars and Earth it reaches Jupiter in 2030 and will make 49 close flybys of Europa to judge whether its ocean could support life.",
    facts: [["Launched", "14 Oct 2024"]],
    moments: [
      { label: "Mars flyby", date: "2025-03-01" },
      { label: "Earth flyby", date: "2026-12-03" },
      { label: "Jupiter arrival", date: "2030-04-11" },
    ],
  }),
  probe("parker-solar-probe", {
    name: "Parker Solar Probe",
    type: "spacecraft",
    classification: "Solar probe",
    parentId: "sun",
    model: "parker",
    sizeKm: 0.015,
    accent: "#ffc861",
    massKg: 685,
    description:
      "Flies through the Sun's outer atmosphere behind a carbon heat shield that reaches 1,400 °C. Since December 2024 it passes 6.1 million km from the surface at 192 km/s, the closest to the Sun and the fastest of any human-made object.",
    facts: [
      ["Launched", "12 Aug 2018"],
      ["Closest approach", "6.1 million km from the surface"],
      ["Top speed", "192 km/s (690,000 km/h)"],
    ],
    moments: [{ label: "Record perihelion", date: "2024-12-24" }],
  }),
];
