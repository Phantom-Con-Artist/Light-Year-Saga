import { create } from "zustand";

/**
 * Real stars from the HYG Database v4.1 (Hipparcos, Yale BSC, Gliese),
 * CC BY-SA 4.0 — built by scripts/build-stars.mjs.
 * Positions are heliocentric, in light-years, already in render axes.
 */

export const STAR_SOURCE = {
  provider: "HYG Database v4.1",
  name: "Hipparcos · Yale Bright Star · Gliese (CC BY-SA 4.0)",
  url: "https://github.com/astronexus/HYG-Database",
} as const;

export const LY_PER_PC = 3.261563777;
const SUN_ABS_MAG = 4.83;

interface StarMeta {
  count: number;
  hyg: number[];
  proper: string[];
  designation: string[];
  hip: number[];
  hd: number[];
  gliese: string[];
  spect: string[];
}

export interface StarCatalog {
  count: number;
  /** x, y, z per star (ly). */
  positions: Float32Array;
  absMag: Float32Array;
  colorIndex: Float32Array;
  /** Linear RGB per star, derived from B−V. */
  colors: Float32Array;
  meta: StarMeta;
  indexById: Map<string, number>;
  /** Indices of stars with a proper name, brightest first. */
  named: number[];
}

/** Stable app ID for a catalogue star. HYG id 0 is the Sun. */
export function starId(catalog: StarCatalog, index: number): string {
  const hyg = catalog.meta.hyg[index];
  return hyg === 0 ? "sun" : `hyg-${hyg}`;
}

export const isStarId = (id: string | null | undefined): id is string => !!id && id.startsWith("hyg-");

export function starName(catalog: StarCatalog, i: number): string {
  const m = catalog.meta;
  if (m.hyg[i] === 0) return "Sun";
  if (m.proper[i]) return m.proper[i];
  if (m.designation[i]) return m.designation[i];
  if (m.gliese[i]) return m.gliese[i];
  if (m.hip[i]) return `HIP ${m.hip[i]}`;
  if (m.hd[i]) return `HD ${m.hd[i]}`;
  return `HYG ${m.hyg[i]}`;
}

export function starDistanceLy(catalog: StarCatalog, i: number): number {
  const p = catalog.positions;
  return Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
}

/** Apparent magnitude as seen from the Sun/Earth. */
export function apparentMagnitude(absMag: number, distanceLy: number): number {
  const pc = Math.max(distanceLy / LY_PER_PC, 1e-6);
  return absMag + 5 * Math.log10(pc) - 5;
}

export function luminositySolar(absMag: number): number {
  return Math.pow(10, (SUN_ABS_MAG - absMag) / 2.5);
}

/** Effective temperature from B−V (Ballesteros 2012). */
export function temperatureFromBV(bv: number): number {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/** Approximate blackbody colour (linear RGB, 0–1) for a temperature in K. */
function blackbodyRGB(tempK: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, tempK)) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const toLinear = (c: number) => Math.pow(Math.min(255, Math.max(0, c)) / 255, 2.2);
  return [toLinear(r), toLinear(g), toLinear(b)];
}

async function fetchCatalog(): Promise<StarCatalog> {
  const [bin, meta] = await Promise.all([
    fetch("/data/stars.bin").then((r) => {
      if (!r.ok) throw new Error(`stars.bin: ${r.status}`);
      return r.arrayBuffer();
    }),
    fetch("/data/stars-meta.json").then((r) => {
      if (!r.ok) throw new Error(`stars-meta.json: ${r.status}`);
      return r.json() as Promise<StarMeta>;
    }),
  ]);

  const raw = new Float32Array(bin);
  const count = raw.length / 5;
  const positions = new Float32Array(count * 3);
  const absMag = new Float32Array(count);
  const colorIndex = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = raw[i * 5];
    positions[i * 3 + 1] = raw[i * 5 + 1];
    positions[i * 3 + 2] = raw[i * 5 + 2];
    absMag[i] = raw[i * 5 + 3];
    colorIndex[i] = raw[i * 5 + 4];
    const [r, g, b] = blackbodyRGB(temperatureFromBV(colorIndex[i]));
    // Normalise so hue carries the colour and magnitude carries brightness.
    const max = Math.max(r, g, b);
    colors.set([r / max, g / max, b / max], i * 3);
  }

  const catalog: StarCatalog = {
    count,
    positions,
    absMag,
    colorIndex,
    colors,
    meta,
    indexById: new Map(),
    named: [],
  };
  for (let i = 0; i < count; i++) {
    catalog.indexById.set(starId(catalog, i), i);
    if (meta.proper[i]) catalog.named.push(i);
  }
  return catalog;
}

interface StarStore {
  catalog: StarCatalog | null;
  error: string | null;
  load: () => void;
}

let loading: Promise<void> | null = null;

export const useStarStore = create<StarStore>()((set) => ({
  catalog: null,
  error: null,
  load: () => {
    loading ??= fetchCatalog()
      .then((catalog) => set({ catalog }))
      .catch((e: Error) => set({ error: e.message }));
  },
}));

export function getStarIndex(id: string | null | undefined): number | undefined {
  const catalog = useStarStore.getState().catalog;
  return id && catalog ? catalog.indexById.get(id) : undefined;
}
