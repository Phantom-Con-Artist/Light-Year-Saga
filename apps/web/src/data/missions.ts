/**
 * Voyage missions: guided tours narrated by the ship's AI, ARIA.
 * Targets are resolved at runtime (catalogue ids, HYG star names, close-ups,
 * or size line-up entries).
 */

export type MissionTarget =
  | { id: string }
  | { closeUp: string }
  | { star: string; upClose?: boolean }
  | { scale: string };

export interface MissionStep {
  target: MissionTarget;
  title: string;
  lines: string[];
}

export interface Mission {
  id: string;
  title: string;
  tagline: string;
  accent: string;
  steps: MissionStep[];
}

export const MISSIONS: Mission[] = [
  {
    id: "grand-tour",
    title: "Grand Tour",
    tagline: "Every planet of the Solar System, Sun to Neptune",
    accent: "#ffc861",
    steps: [
      { target: { id: "sun" }, title: "The Sun", lines: ["Welcome aboard, explorer. I'm ARIA, your ship's navigator.", "Our first stop is home base: the Sun. It holds 99.86% of all the mass in the Solar System.", "Every second it turns about four million tonnes of matter into light. Let's go see what it lights up."] },
      { target: { id: "mercury" }, title: "Mercury", lines: ["Mercury: the smallest planet, and the fastest — it laps the Sun every 88 days.", "With almost no air to hold heat, its surface swings from about 430 °C by day to −180 °C at night."] },
      { target: { id: "venus" }, title: "Venus", lines: ["Venus is nearly Earth's twin in size, but it's a runaway greenhouse.", "At about 465 °C it is hotter than Mercury, and it spins backwards — a day there is longer than its year."] },
      { target: { id: "earth" }, title: "Earth", lines: ["There it is. The only place we know of where life exists.", "Everything humanity has ever done happened on that blue marble."] },
      { target: { id: "moon" }, title: "The Moon", lines: ["The Moon is tidally locked — it always shows Earth the same face.", "Twelve people have walked on it, all between 1969 and 1972."] },
      { target: { id: "mars" }, title: "Mars", lines: ["Mars, the red planet, rusted by iron oxide.", "It has the tallest volcano in the Solar System, Olympus Mons — nearly three times the height of Everest.", "Dried river valleys show liquid water once flowed here."] },
      { target: { id: "jupiter" }, title: "Jupiter", lines: ["Jupiter is more than twice as massive as all the other planets combined.", "The Great Red Spot is a storm wider than Earth that has raged for centuries."] },
      { target: { id: "saturn" }, title: "Saturn", lines: ["Saturn's rings span about 280,000 km, yet are typically only around ten metres thick.", "They are mostly water ice — chunks from dust grains to house-sized boulders."] },
      { target: { id: "neptune" }, title: "Neptune", lines: ["Neptune, the outermost planet, where winds top 2,000 km/h.", "It was found in 1846 by mathematics before anyone saw it — predicted from Uranus's wobbling orbit.", "Grand Tour complete. Beyond here lie the stars."] },
    ],
  },
  {
    id: "neighbours",
    title: "Nearest Neighbours",
    tagline: "The stars next door, and the closest exoplanet",
    accent: "#9ec8ff",
    steps: [
      { target: { star: "Rigil Kentaurus" }, title: "Alpha Centauri A", lines: ["Setting course for the nearest star system, 4.3 light-years away.", "Alpha Centauri A is almost a twin of the Sun. Its partner, Toliman, orbits it every 80 years."] },
      { target: { id: "proxima-system" }, title: "Proxima Centauri", lines: ["Proxima Centauri is the single nearest star to the Sun: 4.24 light-years.", "It's a small red dwarf — and it has planets."] },
      { target: { id: "proxima-b" }, title: "Proxima b", lines: ["This is Proxima b, the nearest known exoplanet to Earth, in its star's habitable zone.", "It probably always shows one face to its star. Proxima's violent flares may have stripped its air away — we don't know yet."] },
      { target: { star: "Barnard's Star" }, title: "Barnard's Star", lines: ["Barnard's Star moves across our sky faster than any other star — about the Moon's width every 180 years.", "Four small planets were confirmed around it in 2024 and 2025."] },
      { target: { star: "Wolf 359" }, title: "Wolf 359", lines: ["Wolf 359, 7.9 light-years out: one of the faintest stars we know nearby.", "Sci-fi fans might recognise the name — it was the site of a famous Star Trek battle."] },
      { target: { star: "Sirius" }, title: "Sirius", lines: ["Sirius, the brightest star in Earth's night sky, 8.6 light-years away.", "Look closely — it has a secret companion."] },
      { target: { closeUp: "sirius-b" }, title: "Sirius B", lines: ["Sirius B: a white dwarf. The Sun's mass, crushed into something the size of Earth.", "A teaspoon of it would weigh several tonnes. This is roughly what our Sun will become. Mission complete."] },
    ],
  },
  {
    id: "alien-worlds",
    title: "Alien Worlds",
    tagline: "Lava oceans, glass rain and seven Earths",
    accent: "#8fffc1",
    steps: [
      { target: { id: "trappist-1" }, title: "TRAPPIST-1", lines: ["Forty light-years away: TRAPPIST-1, a star barely bigger than Jupiter.", "It has seven rocky planets. All of them would fit inside Mercury's orbit."] },
      { target: { id: "trappist-1e" }, title: "TRAPPIST-1 e", lines: ["TRAPPIST-1 e is Earth-sized and in the habitable zone — one of the best places anywhere to look for water.", "Stand on its surface and the neighbouring planets would hang in the sky, some bigger than our Moon."] },
      { target: { id: "55-cancri-e" }, title: "55 Cancri e", lines: ["55 Cancri e: a super-Earth where a year lasts 18 hours.", "Its dayside is probably a global ocean of lava. JWST saw hints of an atmosphere bubbling out of the magma."] },
      { target: { id: "hd-189733-b" }, title: "HD 189733 b", lines: ["This deep-blue world looks inviting. It isn't.", "Winds of around 8,700 km/h may drive molten glass sideways through its sky — and JWST found hydrogen sulfide. It would smell of rotten eggs."] },
      { target: { id: "wasp-76-b" }, title: "WASP-76 b", lines: ["On WASP-76 b the dayside is hot enough to vaporise iron.", "The iron vapour blows to the night side, cools, and falls as iron rain."] },
      { target: { id: "wasp-12-b" }, title: "WASP-12 b", lines: ["WASP-12 b is being eaten by its star — stretched into an egg shape and losing its atmosphere.", "Its orbit is shrinking; in a few million years it will be swallowed."] },
      { target: { id: "kelt-9-b" }, title: "KELT-9 b", lines: ["KELT-9 b is the hottest gas giant known: around 4,300 °C on the dayside.", "That's hotter than the surfaces of most stars. Molecules there are torn apart into atoms."] },
      { target: { id: "kepler-186-f" }, title: "Kepler-186 f", lines: ["Our last stop: Kepler-186 f, the first Earth-sized planet found in a habitable zone (2014).", "At noon there, the light would feel like golden hour on Earth. Mission complete — the galaxy is full of worlds."] },
    ],
  },
  {
    id: "giants",
    title: "Giants & Monsters",
    tagline: "Feel the scale: stars that would swallow the Solar System",
    accent: "#ff7a4d",
    steps: [
      { target: { scale: "s-sun" }, title: "The Sun, for scale", lines: ["Let's calibrate. This is the Sun — 1.39 million km across, 109 Earths wide.", "Remember this size. It's about to feel very small."] },
      { target: { scale: "s-rigel" }, title: "Rigel", lines: ["Rigel, the blue supergiant in Orion's foot: about 79 times the Sun's radius.", "It pours out roughly 120,000 times more light than the Sun."] },
      { target: { scale: "s-betelgeuse" }, title: "Betelgeuse", lines: ["Betelgeuse. Put it where the Sun is and its surface would swallow Mercury, Venus, Earth and Mars.", "It's nearing the end of its life. When it goes supernova, it will be visible in daylight."] },
      { target: { closeUp: "stephenson-2-18" }, title: "Stephenson 2-18", lines: ["We've jumped to a true-scale close-up of Stephenson 2-18, one of the largest stars known.", "Those dashed rings are our planets' orbits. Its surface would reach past Saturn."] },
      { target: { id: "r136a1" }, title: "R136a1", lines: ["Now a different kind of monster: R136a1, the most massive star known, in the Large Magellanic Cloud.", "Around 200 Suns of mass, shining several million times brighter than the Sun. Size isn't everything — mass is."] },
      { target: { id: "eta-carinae" }, title: "Eta Carinae", lines: ["Eta Carinae erupted in the 1840s and briefly became the second-brightest star in the sky.", "It's a prime candidate for our galaxy's next great supernova. Mission complete."] },
    ],
  },
  {
    id: "nebulae",
    title: "Nurseries & Ruins",
    tagline: "Where stars are born — and how they die",
    accent: "#ff8fb4",
    steps: [
      { target: { id: "orion-nebula" }, title: "Orion Nebula", lines: ["The Orion Nebula: the nearest big star factory, 1,344 light-years away.", "You can see it with your own eyes as the fuzzy 'star' in Orion's sword."] },
      { target: { id: "horsehead-nebula" }, title: "Horsehead Nebula", lines: ["The Horsehead: a cold pillar of dust silhouetted against glowing hydrogen.", "It's slowly being eroded — in about five million years it will be gone."] },
      { target: { id: "pillars-of-creation" }, title: "Pillars of Creation", lines: ["The Pillars of Creation, inside the Eagle Nebula.", "Each column is light-years tall. New stars are forming in their tips right now, while young stars nearby erode them."] },
      { target: { id: "carina-nebula" }, title: "Carina Nebula", lines: ["The Carina Nebula, ~460 light-years across — several times larger than Orion.", "It's home to some of the most massive stars in the galaxy."] },
      { target: { id: "crab-nebula" }, title: "Crab Nebula", lines: ["Now the ruins. The Crab Nebula is the debris of a star that exploded in 1054 AD.", "Astronomers in China recorded it shining in daylight for 23 days."] },
      { target: { closeUp: "crab-pulsar" }, title: "Crab Pulsar", lines: ["At its heart: the Crab Pulsar, a neutron star about 20 km across, spinning 30 times per second.", "It's the city-sized core the supernova left behind."] },
      { target: { id: "ring-nebula" }, title: "Ring Nebula", lines: ["The Ring Nebula: what a Sun-like star leaves behind — a gentle shell, not a violent explosion.", "Our Sun will make something like this in about five billion years."] },
      { target: { id: "helix-nebula" }, title: "Helix Nebula", lines: ["The Helix, the 'Eye of God', 655 light-years away.", "From birth in Orion to death here — that's a star's life story. Mission complete."] },
    ],
  },
  {
    id: "black-holes",
    title: "Into the Dark",
    tagline: "From the nearest black hole to the biggest",
    accent: "#ffb45a",
    steps: [
      { target: { id: "gaia-bh1" }, title: "Gaia BH1", lines: ["Our first black hole: Gaia BH1, the nearest known, 1,560 light-years away.", "It emits no light. We only know it's there because it swings a Sun-like star around every 186 days."] },
      { target: { closeUp: "cygnus-x1" }, title: "Cygnus X-1", lines: ["Cygnus X-1 is feeding. Gas torn from its companion swirls into a disk hot enough to shine in X-rays.", "Notice the disk is brighter on one side — gas racing toward us is boosted by relativity."] },
      { target: { closeUp: "sgr-a-star" }, title: "Sagittarius A*", lines: ["The heart of our galaxy: Sagittarius A*, 4.3 million times the Sun's mass.", "Even so, its event horizon would fit inside Mercury's orbit — look at the ring beside it."] },
      { target: { closeUp: "m87" }, title: "M87*", lines: ["M87*, 53 million light-years away — the first black hole ever photographed (2019).", "6.5 billion Suns. It fires a jet of particles thousands of light-years long."] },
      { target: { closeUp: "ton-618" }, title: "TON 618", lines: ["And the monster: TON 618. Its black hole weighs tens of billions of Suns.", "Its event horizon is wider than our Solar System many times over. The light we see left it about 10.8 billion years ago. Mission complete."] },
    ],
  },
  {
    id: "beyond",
    title: "Beyond the Milky Way",
    tagline: "Galaxies, clusters, a great void — to the edge",
    accent: "#c9b8ff",
    steps: [
      { target: { id: "milky-way" }, title: "The Milky Way", lines: ["Look back: this is our galaxy, 100,000 light-years across.", "The Sun is out in a minor arm, halfway to the edge. Hold on — we're leaving."] },
      { target: { id: "lmc" }, title: "Large Magellanic Cloud", lines: ["The Large Magellanic Cloud, a satellite galaxy 163,000 light-years away.", "In 1987 a star exploded here — the closest supernova seen in modern times."] },
      { target: { id: "andromeda" }, title: "Andromeda", lines: ["Andromeda: our big neighbour, 2.5 million light-years away, with about a trillion stars.", "It's heading toward us. A merger was long thought certain; newer studies put the odds nearer 50/50 in the next 10 billion years."] },
      { target: { id: "whirlpool" }, title: "Whirlpool Galaxy", lines: ["The Whirlpool, M51 — the first galaxy recognised as a spiral, in 1845.", "Its small companion is tugging on one of its arms."] },
      { target: { id: "sombrero" }, title: "Sombrero Galaxy", lines: ["The Sombrero: a brilliant bulge ringed by dark dust, seen almost edge-on."] },
      { target: { id: "virgo-cluster" }, title: "Virgo Cluster", lines: ["The Virgo Cluster: over a thousand galaxies bound together, with M87 at its heart.", "Those faint dots all around us? Tens of thousands of real galaxies from the 2MASS survey."] },
      { target: { id: "bootes-void" }, title: "Boötes Void", lines: ["The Boötes Void — one of the emptiest places known, ~330 million light-years across.", "Thousands of galaxies should be here. Only about sixty have been found."] },
      { target: { id: "ton-618" }, title: "TON 618", lines: ["Far beyond: TON 618, a quasar whose light has travelled for 10.8 billion years to reach us.", "We're seeing it as it was before the Sun even existed."] },
      { target: { id: "observable-universe" }, title: "The edge", lines: ["This is the edge of what we can ever see: about 46.5 billion light-years in every direction.", "The universe almost certainly goes on beyond it. We just can't see that far. Mission complete, explorer."] },
    ],
  },
  {
    id: "scale",
    title: "The Scale of Everything",
    tagline: "From a city-sized star to a black hole bigger than the Solar System",
    accent: "#ff9ec7",
    steps: [
      { target: { scale: "s-crab-pulsar" }, title: "Neutron star", lines: ["We start small: a neutron star, about 20 km across — the size of a city.", "It has more mass than the Sun."] },
      { target: { scale: "s-earth" }, title: "Earth", lines: ["Earth: 12,742 km across. Big, to us."] },
      { target: { scale: "s-jupiter" }, title: "Jupiter", lines: ["Jupiter: eleven Earths wide."] },
      { target: { scale: "s-sun" }, title: "The Sun", lines: ["The Sun: 109 Earths across. A million Earths would fit inside."] },
      { target: { scale: "s-sgr-a" }, title: "Sagittarius A*", lines: ["The Milky Way's central black hole. 4.3 million Suns of mass — in something only ~18 times the Sun's radius."] },
      { target: { scale: "s-betelgeuse" }, title: "Betelgeuse", lines: ["Betelgeuse: roughly 760 Suns wide. The Sun is now a speck."] },
      { target: { scale: "s-st2-18" }, title: "Stephenson 2-18", lines: ["Stephenson 2-18: over 2,000 times the Sun's radius. Light would need almost 9 hours to travel once around it."] },
      { target: { scale: "s-solar-system" }, title: "The Solar System", lines: ["Our whole planetary system out to Neptune. Sixty AU across."] },
      { target: { scale: "s-ton-618" }, title: "TON 618", lines: ["TON 618's event horizon. Our Solar System would fit across it about 27 times.", "From a city-sized star to this — that's the scale of everything. Mission complete."] },
    ],
  },
];

export function getMission(id: string | null | undefined): Mission | undefined {
  return id ? MISSIONS.find((m) => m.id === id) : undefined;
}
