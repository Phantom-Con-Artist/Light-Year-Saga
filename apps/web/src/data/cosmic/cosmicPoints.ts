import { create } from "zustand";
import { Vector3 } from "three";
import { GEN_STRUCTURES, GEN_SUPERCLUSTERS } from "../catalog/structures.gen";
import type { ModelledUniverse } from "./modelledUniverse";
import { renderToRaDec } from "../../astronomy/sky";

/**
 * Point-cloud galaxies in the Universe view, each individually selectable
 * without its own scene object:
 *
 * - real:     43,700 catalogued galaxies (2MRS via Tully 2015, plus the nearby
 *             Karachentsev catalogue). Selection id "gal-<row>".
 * - modelled: the synthetic universe around them (modelledUniverse.ts).
 *             Selection id "syn-<row>". Not real objects, and labelled so.
 */

export interface RealGalaxies {
  count: number;
  positions: Float32Array;
  /** Morphological T-type (de Vaucouleurs): ≤ −4 elliptical … 10 irregular. */
  type: Float32Array;
  structure: Float32Array;
  supercluster: Float32Array;
}

interface GalaxyMeta {
  pgc: number[];
  names: string[];
}

interface CosmicPointsState {
  real: RealGalaxies | null;
  meta: GalaxyMeta | null;
  modelled: ModelledUniverse | null;
  modelledBudget: number;
}

export const useCosmicPoints = create<CosmicPointsState>()(() => ({ real: null, meta: null, modelled: null, modelledBudget: 0 }));

let realLoading: Promise<void> | null = null;
export function loadRealGalaxies(): void {
  realLoading ??= fetch("/data/cosmic-web.bin")
    .then((r) => {
      if (!r.ok) throw new Error(`cosmic-web.bin: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      const raw = new Float32Array(buf);
      const n = raw.length / 6;
      const positions = new Float32Array(n * 3);
      const type = new Float32Array(n);
      const structure = new Float32Array(n);
      const supercluster = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        positions[i * 3] = raw[i * 6];
        positions[i * 3 + 1] = raw[i * 6 + 1];
        positions[i * 3 + 2] = raw[i * 6 + 2];
        type[i] = raw[i * 6 + 3];
        structure[i] = raw[i * 6 + 4];
        supercluster[i] = raw[i * 6 + 5];
      }
      useCosmicPoints.setState({ real: { count: n, positions, type, structure, supercluster } });
    })
    .catch(() => {
      realLoading = null;
    });
}

let metaLoading: Promise<void> | null = null;
/** Names and PGC numbers (~280 kB): fetched the first time a galaxy is inspected. */
export function loadGalaxyMeta(): void {
  metaLoading ??= fetch("/data/cosmic-web-meta.json")
    .then((r) => (r.ok ? (r.json() as Promise<GalaxyMeta>) : Promise.reject(new Error(String(r.status)))))
    .then((meta) => useCosmicPoints.setState({ meta }))
    .catch(() => {
      metaLoading = null;
    });
}

let worker: Worker | null = null;
/** Generate (in a worker) the modelled universe for a point budget; a new budget replaces the old one. */
export function ensureModelledUniverse(count: number): void {
  if (useCosmicPoints.getState().modelledBudget === count) return;
  useCosmicPoints.setState({ modelledBudget: count });
  worker?.terminate();
  worker = new Worker(new URL("./modelled.worker.ts", import.meta.url), { type: "module" });
  const w = worker;
  w.onmessage = (e: MessageEvent<ModelledUniverse>) => {
    if (worker !== w) return;
    useCosmicPoints.setState({ modelled: e.data });
    w.terminate();
    worker = null;
  };
  w.postMessage({ count });
}

/* ---------------------------------------------------------------- ids */

const REAL = /^gal-(\d+)$/;
const MODELLED = /^syn-(\d+)$/;
export const realGalaxyId = (i: number) => `gal-${i}`;
export const modelledGalaxyId = (i: number) => `syn-${i}`;
export const isPointGalaxyId = (id: string | null | undefined): id is string => !!id && (REAL.test(id) || MODELLED.test(id));

export function pointGalaxyIndex(id: string): { kind: "real" | "modelled"; index: number } | null {
  const r = REAL.exec(id);
  if (r) return { kind: "real", index: Number(r[1]) };
  const m = MODELLED.exec(id);
  if (m) return { kind: "modelled", index: Number(m[1]) };
  return null;
}

/** Render-space position (Mly) of a point galaxy, if its data is loaded. */
export function pointGalaxyPosition(id: string, out = new Vector3()): Vector3 | null {
  const ref = pointGalaxyIndex(id);
  if (!ref) return null;
  const s = useCosmicPoints.getState();
  const pos = ref.kind === "real" ? s.real?.positions : s.modelled?.positions;
  if (!pos || ref.index * 3 + 2 >= pos.length) return null;
  return out.set(pos[ref.index * 3], pos[ref.index * 3 + 1], pos[ref.index * 3 + 2]);
}

/* ------------------------------------------------------------ describe */

/** "MESSIER031" → "M31", "NGC0253" → "NGC 253", "UGC05364" → "UGC 5364". */
export function prettyGalaxyName(raw: string): string {
  const m = /^MESSIER0*(\d+)$/.exec(raw);
  if (m) return `M${m[1]}`;
  const c = /^([A-Za-z]+)0*(\d.*)$/.exec(raw);
  return c ? `${c[1]} ${c[2]}` : raw;
}

/** De Vaucouleurs T-type → words and a visual style for the close look. */
export function describeTType(t: number): { label: string; style: "elliptical" | "lenticular" | "spiral" | "irregular" } {
  if (t <= -4) return { label: "Elliptical (E)", style: "elliptical" };
  if (t < 0) return { label: "Lenticular (S0)", style: "lenticular" };
  if (t <= 1) return { label: "Early spiral (Sa)", style: "spiral" };
  if (t <= 3) return { label: "Spiral (Sb)", style: "spiral" };
  if (t <= 6) return { label: "Late spiral (Sc–Sd)", style: "spiral" };
  if (t <= 8) return { label: "Magellanic spiral (Sm)", style: "irregular" };
  return { label: "Irregular (Im)", style: "irregular" };
}

export interface PointGalaxyInfo {
  kind: "real" | "modelled";
  index: number;
  name: string;
  typeLabel: string;
  style: "elliptical" | "lenticular" | "spiral" | "irregular" | "starburst";
  position: Vector3;
  distanceMly: number;
  raDeg: number;
  decDeg: number;
  /** Real galaxies: catalogue membership. */
  structure?: { id: string; name: string };
  supercluster?: { id: string; name: string };
  catalogue?: string;
  /** Modelled galaxies: the model's values. */
  environment?: string;
  luminosityLstar?: number;
  diameterLy?: number;
}

const MODELLED_STYLE = ["elliptical", "lenticular", "spiral", "irregular", "starburst"] as const;

export function pointGalaxyInfo(id: string): PointGalaxyInfo | null {
  const ref = pointGalaxyIndex(id);
  const position = ref && pointGalaxyPosition(id);
  if (!ref || !position) return null;
  const s = useCosmicPoints.getState();
  const distanceMly = position.length();
  const { raDeg, decDeg } = renderToRaDec(position);
  if (ref.kind === "real") {
    const real = s.real!;
    const i = ref.index;
    const t = describeTType(real.type[i]);
    const st = real.structure[i];
    const sc = real.supercluster[i];
    const meta = s.meta;
    let name = `Galaxy #${i + 1}`;
    let catalogue: string | undefined;
    if (meta) {
      if (i < meta.pgc.length) {
        name = `PGC ${meta.pgc[i]}`;
        catalogue = "2MASS Redshift Survey (Tully 2015 groups)";
      } else {
        name = prettyGalaxyName(meta.names[i - meta.pgc.length] ?? name);
        catalogue = "Updated Nearby Galaxy Catalog (Karachentsev et al. 2013)";
      }
    }
    return {
      kind: "real",
      index: i,
      name,
      typeLabel: t.label,
      style: t.style,
      position,
      distanceMly,
      raDeg,
      decDeg,
      structure: st >= 0 ? { id: GEN_STRUCTURES[st].id, name: GEN_STRUCTURES[st].name } : undefined,
      supercluster: sc >= 0 ? { id: GEN_SUPERCLUSTERS[sc].id, name: GEN_SUPERCLUSTERS[sc].name } : undefined,
      catalogue,
    };
  }
  const m = s.modelled!;
  const i = ref.index;
  const type = m.props[i * 4];
  return {
    kind: "modelled",
    index: i,
    name: `Modelled galaxy M-${String(i + 1).padStart(6, "0")}`,
    typeLabel: ["Elliptical", "Lenticular", "Spiral", "Irregular", "Starburst"][type],
    style: MODELLED_STYLE[type],
    position,
    distanceMly,
    raDeg,
    decDeg,
    environment: ["Cluster (node of the web)", "Filament", "Wall (sheet)", "Void"][m.props[i * 4 + 1]],
    luminosityLstar: m.luminosity[i],
    diameterLy: m.diameter[i] * 1e6,
  };
}
