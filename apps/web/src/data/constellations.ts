import { create } from "zustand";
import { Vector3 } from "three";
import { equatorialToRender, equatorialUnit } from "../astronomy/sky";
import { CONSTELLATION_NAMES, type ConstellationName } from "./constellationNames";
import type { StarCatalog } from "./stars";

/**
 * The 88 IAU constellations. Names and label positions are bundled (search
 * needs them); figures and boundaries load with the Sky view.
 */

export const CONSTELLATION_SOURCE = {
  provider: "d3-celestial",
  name: "Stick figures and IAU boundaries (BSD 3-Clause)",
  url: "https://github.com/ofrohn/d3-celestial",
} as const;

export const CONSTELLATION_ACCENT = "#9cc3ff";

type Origin = "ptolemy" | "argo" | "dutch" | "plancius" | "hevelius" | "lacaille" | "tycho";

const ORIGIN_TEXT: Record<Origin, string> = {
  ptolemy: "One of the 48 constellations listed by Ptolemy in the Almagest (2nd century AD), with roots in Babylonian and Greek sky lore.",
  argo: "Once part of Ptolemy's great ship Argo Navis, which Lacaille split into three in the 1750s.",
  dutch:
    "Introduced in the 1590s from observations by the Dutch navigators Pieter Keyser and Frederick de Houtman, among the first Europeans to chart the far southern sky.",
  plancius: "Added by the Dutch cartographer Petrus Plancius around 1600 to fill gaps between the classical figures.",
  hevelius: "Introduced by Johannes Hevelius in 1690 to fill faint gaps between the classical figures.",
  lacaille:
    "Introduced by Nicolas-Louis de Lacaille after mapping the southern sky from the Cape of Good Hope in 1751–52; like most of his figures, it honours an instrument of science or the arts.",
  tycho: "An ancient asterism made a constellation in the 16th century and adopted by Tycho Brahe.",
};

const ORIGINS: Record<string, Origin> = Object.fromEntries(
  [
    [
      "ptolemy",
      "And Aqr Aql Ara Ari Aur Boo Cnc CMa CMi Cap Cas Cen Cep Cet CrA CrB Crv Crt Cyg Del Dra Equ Eri Gem Her Hya Leo Lep Lib Lup Lyr Oph Ori Peg Per PsA Psc Sge Sgr Sco Ser Tau Tri UMa UMi Vir",
    ],
    ["argo", "Car Pup Vel"],
    ["dutch", "Aps Cha Dor Gru Hyi Ind Mus Pav Phe Tuc TrA Vol"],
    ["plancius", "Col Mon Cam Cru"],
    ["hevelius", "CVn Lac LMi Lyn Sct Sex Vul"],
    ["lacaille", "Ant Cae Cir For Hor Men Mic Nor Oct Pic Ret Scl Tel Pyx"],
    ["tycho", "Com"],
  ].flatMap(([origin, ids]) => ids.split(" ").map((id) => [id, origin as Origin])),
);

const ZODIAC = new Set("Ari Tau Gem Cnc Leo Vir Lib Sco Sgr Cap Aqr Psc".split(" "));

/** Where the source only repeats the Latin name. */
const MEANING: Record<string, string> = {
  And: "The Chained Princess",
  Aqr: "The Water Bearer",
  Cas: "The Seated Queen",
  Cep: "The King",
  Cha: "The Chameleon",
  Eri: "The River",
  Her: "The Kneeling Hero",
  Hyi: "The Lesser Water Snake",
  Lyn: "The Lynx",
  Men: "The Table Mountain",
  Oph: "The Serpent Bearer",
  Ori: "The Hunter",
  Peg: "The Winged Horse",
  Per: "The Slayer of Medusa",
  Phe: "The Phoenix",
  Scl: "The Sculptor",
};

/** Short stories and highlights for the best-known figures. */
const STORY: Record<string, string> = {
  Ori: "The Hunter, one of the most recognisable patterns in the sky. Red supergiant Betelgeuse marks his shoulder and blue-white Rigel his knee; the three Belt stars point to Sirius. Below the Belt hangs the Orion Nebula, a stellar nursery 1,340 light-years away visible to the naked eye.",
  UMa: "The Great Bear. Its seven brightest stars form the Big Dipper (the Plough); the two 'pointer' stars at the end of the bowl lead to Polaris. Most of the Dipper's stars travel together through space as the Ursa Major Moving Group.",
  UMi: "The Little Bear, whose tail ends at Polaris — within a degree of the north celestial pole, so it barely moves while the whole sky turns around it.",
  Cas: "Queen Cassiopeia, vain mother of Andromeda, seated on her throne. Her five bright stars form a W (or M) opposite the Big Dipper across the pole.",
  And: "The princess chained to a rock as a sacrifice to the sea monster Cetus, rescued by Perseus. Home of the Andromeda Galaxy, 2.5 million light-years away — the most distant thing most people can see without a telescope.",
  Per: "The hero who beheaded Medusa and saved Andromeda. Algol, the 'Demon Star', marks Medusa's eye: an eclipsing binary that visibly dims every 2.87 days. The Perseid meteors radiate from here each August.",
  Cyg: "The Swan, flying down the Milky Way; also called the Northern Cross. Deneb, its tail, is one of the most luminous stars visible to the naked eye and a corner of the Summer Triangle.",
  Lyr: "The lyre of Orpheus. Vega, its lead star, was the pole star around 12,000 BC and will be again in about 13,700 years.",
  Aql: "The Eagle that carried Zeus's thunderbolts. Altair, one of the nearest bright stars at 17 light-years, spins so fast that it bulges at the equator.",
  Sco: "The Scorpion that killed Orion — which is why the two are never in the sky together. Red supergiant Antares, 'rival of Mars', marks its heart.",
  Sgr: "The Archer, a centaur aiming at Scorpius. The centre of our galaxy lies in this direction, behind the 'Teapot' asterism, so the Milky Way is at its thickest here.",
  Leo: "The Nemean Lion slain by Heracles. A backwards question mark, 'the Sickle', outlines his mane, with Regulus at its base.",
  Tau: "The Bull. Orange Aldebaran is its eye, set against the V of the Hyades cluster; on its shoulder ride the Pleiades, the Seven Sisters.",
  Gem: "The twins Castor and Pollux. Castor is actually a system of six stars; Pollux is an orange giant with a known planet.",
  CMa: "Orion's larger hunting dog, carrying Sirius — the brightest star in the night sky, 8.6 light-years away.",
  CMi: "Orion's smaller dog. Procyon, 11.5 light-years away, is one corner of the Winter Triangle.",
  Cru: "The Southern Cross, the smallest of the 88 constellations. Its long axis points toward the south celestial pole, and it appears on the flags of Australia, New Zealand, Brazil and others.",
  Cen: "The centaur. Alpha Centauri, the nearest star system to the Sun at 4.37 light-years, is its brightest point; Omega Centauri, the largest globular cluster of the Milky Way, lies here too.",
  Car: "The keel of the ship Argo. Canopus, second brightest star in the night sky, has long guided navigators and spacecraft alike.",
  Boo: "The Herdsman, driving the bears around the pole. Arcturus, a red giant 37 light-years away, is the brightest star in the northern celestial hemisphere.",
  Vir: "The Maiden, holding an ear of wheat — the star Spica. Beyond her lies the Virgo Cluster, over a thousand galaxies about 54 million light-years away.",
  Her: "The hero Heracles, kneeling. His 'Keystone' holds M13, the great globular cluster of about 300,000 stars.",
  Peg: "The winged horse. The Great Square of Pegasus is a signpost of autumn skies; the first planet found around a Sun-like star, 51 Pegasi b, orbits here.",
  Dra: "The Dragon coiling between the bears. Thuban, in its tail, was the pole star when the Egyptian pyramids were built.",
  Aur: "The Charioteer. Capella is actually two yellow giant stars in a close orbit.",
  Oph: "The Serpent Bearer, the healer Asclepius. The Sun passes through it in early December, making it an unofficial 13th constellation of the zodiac.",
  Psc: "Two fish tied together by a cord. The Sun is in Pisces at the March equinox — the zero point of right ascension.",
  Aqr: "The Water Bearer, pouring water toward the Southern Fish. Several meteor showers radiate from here.",
  Cap: "The Sea Goat, one of the oldest recorded figures, dating back to Babylonian star catalogues.",
  Ari: "The Ram with the golden fleece sought by Jason and the Argonauts.",
  Cnc: "The Crab, faint but home to the Beehive Cluster (M44), a naked-eye swarm of stars.",
  Lib: "The Scales, the only zodiac figure that is an object rather than a creature. Its stars once formed the Scorpion's claws.",
  Eri: "The River Eridanus, winding from Orion's foot deep into the southern sky to Achernar.",
  Hya: "The Water Snake, the largest constellation, stretching more than a quarter of the way around the sky.",
  Cet: "The sea monster sent to devour Andromeda. Mira, 'the Wonderful', swells and fades over 332 days.",
  Cam: "The Giraffe, a large but faint patch near the north celestial pole.",
  PsA: "The Southern Fish, drinking the water poured by Aquarius. Its lone bright star, Fomalhaut, has a dusty ring imaged by Hubble and Webb.",
  Col: "Noah's dove. Its star Mu Columbae is a runaway, flung out of Orion about 2.5 million years ago.",
  Tuc: "The Toucan, holding the Small Magellanic Cloud and 47 Tucanae, the second-brightest globular cluster.",
  Dor: "The Dolphinfish, which contains most of the Large Magellanic Cloud and the Tarantula Nebula.",
  Mon: "The Unicorn, sitting on the winter Milky Way between Orion and Canis Minor; home of the Rosette Nebula.",
  Crv: "The Crow, sent by Apollo to fetch water, punished for lying and set in the sky beside the cup (Crater).",
  Lep: "The Hare, at Orion's feet, chased by his dogs.",
  Del: "The Dolphin, a small, neat diamond of stars near Altair.",
  Sge: "The Arrow, the third-smallest constellation, near the Summer Triangle.",
  CrB: "The Northern Crown, a half-circle of stars; T Coronae Borealis is a recurrent nova expected to flare.",
  Oct: "The Octant, holding the south celestial pole, which, unlike the north, has no bright pole star.",
};

export interface Constellation extends ConstellationName {
  /** Selection id, e.g. "con-Ori". */
  key: string;
  zodiac: boolean;
  origin: string;
  story?: string;
  /** Render-space unit vector toward the label. */
  direction: Vector3;
}

export const CONSTELLATIONS: Constellation[] = CONSTELLATION_NAMES.map((c) => ({
  ...c,
  meaning: MEANING[c.id] ?? `The ${c.meaning}`,
  key: `con-${c.id}`,
  zodiac: ZODIAC.has(c.id),
  origin: ORIGIN_TEXT[ORIGINS[c.id] ?? "ptolemy"],
  story: STORY[c.id] || undefined,
  direction: skyDirection(c.ra, c.dec),
}));

const BY_KEY = new Map(CONSTELLATIONS.map((c) => [c.key, c]));

export const isConstellationId = (id: string | null | undefined): id is string => !!id && id.startsWith("con-");
export const getConstellation = (key: string | null | undefined) => (key ? BY_KEY.get(key) : undefined);

/** RA/Dec in degrees → render-space unit vector. */
export function skyDirection(raDeg: number, decDeg: number): Vector3 {
  return equatorialToRender(equatorialUnit(raDeg / 15, decDeg));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Month when the constellation is highest at midnight (opposite the Sun). */
export function bestMonth(raDeg: number): string {
  // The Sun sits at RA 12h on ~22 September, so RA 0h culminates at midnight then.
  const day = (265 + (raDeg / 360) * 365.25) % 365.25;
  return MONTHS[Math.min(11, Math.floor(day / 30.44))];
}

/** Latitudes from which the whole figure clears the horizon (approximate, from its centre). */
export function visibleFrom(decDeg: number): string {
  const lat = Math.round(decDeg >= 0 ? decDeg - 90 : decDeg + 90);
  if (Math.abs(decDeg) < 10) return "Everywhere on Earth";
  return decDeg > 0 ? `North of ${Math.abs(lat)}° S` : `South of ${Math.abs(lat)}° N`;
}

export function hemisphereOf(decDeg: number): "Northern" | "Southern" | "Equatorial" {
  return decDeg > 20 ? "Northern" : decDeg < -20 ? "Southern" : "Equatorial";
}

/* ------------------------------------------------------- figures (lazy) */

export interface ConstellationGeometry {
  /** Per constellation id: polylines as flat [ra, dec, …] in degrees. */
  figures: Record<string, number[][]>;
  borders: [string, number[]][];
}

interface GeometryStore {
  geometry: ConstellationGeometry | null;
  load: () => void;
}

let loading: Promise<void> | null = null;

export const useConstellationStore = create<GeometryStore>()((set) => ({
  geometry: null,
  load: () => {
    loading ??= fetch("/data/constellations.json")
      .then((r) => {
        if (!r.ok) throw new Error(`constellations.json: ${r.status}`);
        return r.json() as Promise<ConstellationGeometry>;
      })
      .then((geometry) => set({ geometry }))
      .catch(() => {
        loading = null;
      });
  },
}));

/** Angular radius (degrees) that frames a constellation's figure. */
export function figureExtent(geometry: ConstellationGeometry, id: string): { centre: Vector3; radiusDeg: number } {
  const c = BY_KEY.get(`con-${id}`)!;
  const pts: Vector3[] = [];
  for (const line of geometry.figures[id] ?? []) for (let i = 0; i < line.length; i += 2) pts.push(skyDirection(line[i], line[i + 1]));
  if (pts.length === 0) return { centre: c.direction.clone(), radiusDeg: 15 };
  const centre = pts.reduce((a, p) => a.add(p), new Vector3()).normalize();
  const radiusDeg = Math.max(...pts.map((p) => (centre.angleTo(p) * 180) / Math.PI));
  return { centre, radiusDeg };
}

const starCache = new Map<string, number[]>();

/**
 * Catalogue stars that make up the figure: each figure vertex matched to the
 * brightest HYG star within 0.3°. Returned brightest first.
 */
export function figureStars(geometry: ConstellationGeometry, catalog: StarCatalog, id: string): number[] {
  const cached = starCache.get(id);
  if (cached) return cached;
  const cos = Math.cos((0.3 * Math.PI) / 180);
  const found = new Set<number>();
  const p = catalog.positions;
  const dir = new Vector3();
  for (const line of geometry.figures[id] ?? []) {
    for (let k = 0; k < line.length; k += 2) {
      const v = skyDirection(line[k], line[k + 1]);
      let best = -1;
      let bestMag = Infinity;
      for (let i = 1; i < catalog.count; i++) {
        dir.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
        const d = dir.length();
        if (dir.dot(v) < cos * d) continue;
        const mag = catalog.absMag[i] + 5 * Math.log10(d / 3.261563777) - 5;
        if (mag < bestMag) {
          bestMag = mag;
          best = i;
        }
      }
      if (best >= 0) found.add(best);
    }
  }
  const mag = (i: number) => catalog.absMag[i] + 5 * Math.log10(Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]) / 3.261563777) - 5;
  const list = [...found].sort((a, b) => mag(a) - mag(b));
  starCache.set(id, list);
  return list;
}
