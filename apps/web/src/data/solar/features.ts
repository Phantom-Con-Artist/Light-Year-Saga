/**
 * Named surface features. Latitudes planetocentric, longitudes east (0–360 or
 * ±180), matching the surface maps (longitude 0 at the map centre). Heights
 * are relief above the surrounding terrain unless noted.
 */

export type FeatureKind = "mountain" | "volcano" | "canyon" | "crater" | "basin" | "plain" | "landing" | "geyser" | "cliff" | "sea";

export interface SurfaceFeature {
  id: string;
  name: string;
  bodyId: string;
  lat: number;
  lon: number;
  kind: FeatureKind;
  /** Height (positive) or depth (negative) in km, for the peaks chart. */
  heightKm?: number;
  /** Width / length, km. */
  sizeKm?: number;
  description: string;
}

export const FEATURE_KIND_LABEL: Record<FeatureKind, string> = {
  mountain: "Mountain",
  volcano: "Volcano",
  canyon: "Canyon",
  crater: "Crater",
  basin: "Impact basin",
  plain: "Plain",
  landing: "Landing site",
  geyser: "Geysers",
  cliff: "Cliff",
  sea: "Sea",
};

export const FEATURES: SurfaceFeature[] = [
  /* Earth */
  { id: "feature-everest", name: "Mount Everest", bodyId: "earth", lat: 27.988, lon: 86.925, kind: "mountain", heightKm: 8.849, description: "The highest point above sea level: 8,849 m. The Himalaya are still rising a few millimetres a year as India pushes into Asia." },
  { id: "feature-mauna-kea", name: "Mauna Kea", bodyId: "earth", lat: 19.821, lon: -155.468, kind: "volcano", heightKm: 10.2, description: "Measured from its base on the ocean floor, this Hawaiian volcano is about 10.2 km tall, over a kilometre taller than Everest. Its summit hosts some of the world's great telescopes." },
  { id: "feature-challenger-deep", name: "Challenger Deep", bodyId: "earth", lat: 11.373, lon: 142.592, kind: "canyon", heightKm: -10.9, description: "The deepest known point in the ocean, at the bottom of the Mariana Trench: about 10,935 m down, with a pressure over 1,000 times that at the surface." },
  { id: "feature-chimborazo", name: "Chimborazo", bodyId: "earth", lat: -1.469, lon: -78.817, kind: "volcano", heightKm: 6.263, description: "Earth bulges at the equator, so this Ecuadorian volcano's summit is the point farthest from Earth's centre: 2 km farther out than Everest's." },

  /* Moon */
  { id: "feature-tranquility-base", name: "Tranquility Base", bodyId: "moon", lat: 0.674, lon: 23.473, kind: "landing", description: "Where Apollo 11's Eagle landed on 20 July 1969. Neil Armstrong and Buzz Aldrin were the first humans on another world." },
  { id: "feature-mons-huygens", name: "Mons Huygens", bodyId: "moon", lat: 19.92, lon: -2.86, kind: "mountain", heightKm: 5.5, description: "The Moon's tallest mountain, in the Montes Apenninus: the rim of the giant Imbrium impact basin." },
  { id: "feature-tycho", name: "Tycho", bodyId: "moon", lat: -43.31, lon: -11.36, kind: "crater", sizeKm: 85, description: "A young (108-million-year-old) crater whose bright rays of ejecta stretch across the near side, visible with the naked eye at full Moon." },
  { id: "feature-shackleton", name: "Shackleton crater", bodyId: "moon", lat: -89.9, lon: 0, kind: "crater", sizeKm: 21, description: "At the lunar south pole. Its floor never sees sunlight and may hold water ice, which makes the rim a prime target for Artemis landings." },

  /* Mercury, Venus */
  { id: "feature-caloris", name: "Caloris Planitia", bodyId: "mercury", lat: 30.5, lon: 170.2, kind: "basin", sizeKm: 1550, description: "One of the largest impact basins in the Solar System. The shock of the impact focused on the opposite side of Mercury and broke up the terrain there." },
  { id: "feature-maxwell-montes", name: "Maxwell Montes", bodyId: "venus", lat: 65.2, lon: 3.3, kind: "mountain", heightKm: 11, description: "Venus's highest mountains, about 11 km above the average surface. Its peaks are coated in a 'metal frost', probably lead or bismuth compounds condensed from the hot atmosphere." },

  /* Mars */
  { id: "feature-olympus-mons", name: "Olympus Mons", bodyId: "mars", lat: 18.65, lon: 226.2, kind: "volcano", heightKm: 21.9, sizeKm: 600, description: "The tallest volcano and one of the tallest mountains in the Solar System: about 22 km above the Martian datum and 600 km wide, the size of France. Its slopes are so gentle that at the summit you could not see its edge." },
  { id: "feature-valles-marineris", name: "Valles Marineris", bodyId: "mars", lat: -13.9, lon: 300.8, kind: "canyon", heightKm: -7, sizeKm: 4000, description: "A system of canyons 4,000 km long and up to 7 km deep: it would stretch across the United States. It is a crack in the crust, torn open as the Tharsis volcanoes rose." },
  { id: "feature-hellas", name: "Hellas Planitia", bodyId: "mars", lat: -42.4, lon: 70.5, kind: "basin", heightKm: -7.2, sizeKm: 2300, description: "A giant impact basin: its floor is the lowest point on Mars, where air pressure is high enough for liquid water to briefly exist." },
  { id: "feature-gale", name: "Gale crater (Curiosity)", bodyId: "mars", lat: -5.4, lon: 137.8, kind: "landing", description: "Curiosity has been exploring this ancient lake bed and climbing Mount Sharp, a 5 km layered mound in its centre, since 2012." },
  { id: "feature-jezero", name: "Jezero crater (Perseverance)", bodyId: "mars", lat: 18.38, lon: 77.58, kind: "landing", description: "An ancient river delta where Perseverance is collecting rock samples for a future return to Earth. The Ingenuity helicopter made the first powered flight on another planet here in 2021." },

  /* Asteroids & dwarf planets */
  { id: "feature-rheasilvia", name: "Rheasilvia central peak", bodyId: "vesta", lat: -75, lon: 301, kind: "mountain", heightKm: 22, sizeKm: 505, description: "The central peak of Vesta's south-polar impact basin rises about 22 km, rivalling Olympus Mons, on an asteroid only 525 km across." },
  { id: "feature-ahuna-mons", name: "Ahuna Mons", bodyId: "ceres", lat: -10.48, lon: 316.2, kind: "volcano", heightKm: 4, description: "A lonely 4 km cryovolcano on Ceres, built from salty mud and ice, probably within the last 200 million years." },
  { id: "feature-occator", name: "Occator crater", bodyId: "ceres", lat: 19.82, lon: 239.33, kind: "crater", sizeKm: 92, description: "Home of Ceres's famous bright spots: sodium-carbonate salts left behind as briny water rose from below and evaporated." },
  { id: "feature-sputnik-planitia", name: "Sputnik Planitia", bodyId: "pluto", lat: 20, lon: 180, kind: "plain", sizeKm: 1000, description: "The left half of Pluto's 'heart': a 1,000 km glacier of nitrogen ice that churns slowly in convection cells, so its surface is less than 10 million years old." },
  { id: "feature-wright-mons", name: "Wright Mons", bodyId: "pluto", lat: -21.7, lon: 173, kind: "volcano", heightKm: 4, sizeKm: 150, description: "A probable ice volcano, 4 km high with a deep central pit, one of the largest cryovolcanoes known." },

  /* Moons of the giants */
  { id: "feature-loki", name: "Loki Patera", bodyId: "io", lat: 13, lon: 51.2, kind: "volcano", sizeKm: 200, description: "The most powerful volcano in the Solar System: a 200 km lava lake whose crust founders and overturns every few hundred days." },
  { id: "feature-conamara", name: "Conamara Chaos", bodyId: "europa", lat: 9.7, lon: 86.7, kind: "plain", sizeKm: 80, description: "A jumble of ice rafts that broke apart, drifted and re-froze: a sign that warmer ice or water lies close beneath." },
  { id: "feature-valhalla", name: "Valhalla", bodyId: "callisto", lat: 14.7, lon: 304, kind: "basin", sizeKm: 3800, description: "A multi-ring impact basin 3,800 km across, the largest in the Solar System, with rings rippling out like a frozen pond." },
  { id: "feature-kraken-mare", name: "Kraken Mare", bodyId: "titan", lat: 68, lon: 50, kind: "sea", sizeKm: 1170, description: "Titan's largest sea: liquid methane and ethane, bigger than the Caspian Sea, at −180 °C." },
  { id: "feature-huygens-landing", name: "Huygens landing site", bodyId: "titan", lat: -10.3, lon: 167.7, kind: "landing", description: "ESA's Huygens probe landed here on 14 January 2005 — the most distant landing ever — on a plain of ice pebbles, and sent data for 72 minutes." },
  { id: "feature-tiger-stripes", name: "Tiger stripes", bodyId: "enceladus", lat: -85, lon: 180, kind: "geyser", sizeKm: 130, description: "Four warm fractures at the south pole that spray water vapour and ice grains from the ocean below into space." },
  { id: "feature-iapetus-ridge", name: "Equatorial ridge", bodyId: "iapetus", lat: 0, lon: 180, kind: "mountain", heightKm: 20, sizeKm: 1300, description: "A ridge up to 20 km high running along a third of Iapetus's equator. It may be the remains of a collapsed ring or moon." },
  { id: "feature-herschel", name: "Herschel crater", bodyId: "mimas", lat: 1.4, lon: -112.2, kind: "crater", sizeKm: 139, description: "The impact nearly shattered Mimas; the crater's walls are 5 km high and its central peak almost as tall as Everest." },
  { id: "feature-verona-rupes", name: "Verona Rupes", bodyId: "miranda", lat: -18.3, lon: 347.8, kind: "cliff", heightKm: 10, description: "The tallest known cliff in the Solar System, perhaps 10 km high. In Miranda's weak gravity a fall from the top would last about 12 minutes." },
];

export const FEATURES_BY_ID = new Map(FEATURES.map((f) => [f.id, f]));
export const getFeature = (id: string | null | undefined) => (id ? FEATURES_BY_ID.get(id) : undefined);
export const featuresOf = (bodyId: string) => FEATURES.filter((f) => f.bodyId === bodyId);
