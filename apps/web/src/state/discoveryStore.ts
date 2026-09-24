import { create } from "zustand";
import { SOLAR_SYSTEM } from "../data/solarSystem";
import { ALL_EXOPLANETS, CATALOG, type CatalogObject } from "../data/catalog";
import { isStarId } from "../data/stars";

/**
 * Exploration rewards: every object you inspect is logged as a discovery.
 * Persisted per browser (localStorage) — a personal logbook, not shared data.
 */

export interface Category {
  id: string;
  label: string;
  ids: string[];
}

const catalogIds = (pred: (o: CatalogObject) => boolean) => CATALOG.filter((o) => o.id !== "milky-way-cosmic" && pred(o)).map((o) => o.id);

export const CATEGORIES: Category[] = [
  { id: "solar", label: "Solar System", ids: SOLAR_SYSTEM.map((o) => o.id) },
  { id: "stars", label: "Extreme stars & remnants", ids: catalogIds((o) => o.kind === "star" || o.kind === "stellar-remnant") },
  { id: "black-holes", label: "Black holes & quasars", ids: catalogIds((o) => o.kind === "black-hole" || o.kind === "quasar") },
  { id: "nebulae", label: "Nebulae", ids: catalogIds((o) => o.kind === "nebula") },
  { id: "worlds", label: "Alien worlds", ids: [...catalogIds((o) => o.kind === "exo-system"), ...ALL_EXOPLANETS.map((p) => p.planet.id)] },
  { id: "galaxies", label: "Galaxies", ids: catalogIds((o) => o.kind === "galaxy") },
  { id: "cosmic", label: "Cosmic structures", ids: catalogIds((o) => o.kind === "cluster" || o.kind === "void" || o.kind === "structure") },
];

const DISCOVERABLE = new Set(CATEGORIES.flatMap((c) => c.ids));
export const TOTAL_DISCOVERABLE = DISCOVERABLE.size;

export const RANKS = [
  { at: 0, title: "Stargazer" },
  { at: 8, title: "Navigator" },
  { at: 20, title: "Voyager" },
  { at: 40, title: "Pathfinder" },
  { at: 65, title: "Cosmic Cartographer" },
];

export function rankFor(count: number) {
  let rank = RANKS[0];
  for (const r of RANKS) if (count >= r.at) rank = r;
  const next = RANKS.find((r) => r.at > count);
  return { rank, next };
}

const KEY = "lys.logbook.v1";

interface Saved {
  found: Record<string, number>;
  stars: Record<string, number>;
  missions: Record<string, number>;
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { found: {}, stars: {}, missions: {}, ...JSON.parse(raw) };
  } catch {
    /* unavailable or corrupt: start fresh */
  }
  return { found: {}, stars: {}, missions: {} };
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: progress lasts for this session only */
  }
}

export interface Toast {
  key: number;
  title: string;
  body: string;
  tone: "discovery" | "rank" | "mission";
}

interface DiscoveryState extends Saved {
  toasts: Toast[];
  /** Log an inspected object. Returns true when it's a first discovery. */
  discover: (id: string) => boolean;
  completeMission: (id: string, title: string) => void;
  dismissToast: (key: number) => void;
  pushToast: (t: Omit<Toast, "key">) => void;
  reset: () => void;
}

let toastKey = 0;

export const useDiscoveryStore = create<DiscoveryState>()((set, get) => ({
  ...load(),
  toasts: [],

  discover: (id) => {
    const s = get();
    if (isStarId(id)) {
      if (s.stars[id]) return false;
      const next = { ...s, stars: { ...s.stars, [id]: Date.now() } };
      set({ stars: next.stars });
      save(next);
      return true;
    }
    if (!DISCOVERABLE.has(id) || s.found[id]) return false;
    const before = Object.keys(s.found).length;
    const found = { ...s.found, [id]: Date.now() };
    set({ found });
    save({ found, stars: s.stars, missions: s.missions });
    const after = before + 1;
    const { rank } = rankFor(after);
    if (rankFor(before).rank !== rank) get().pushToast({ tone: "rank", title: `Rank up: ${rank.title}`, body: `${after} discoveries logged.` });
    return true;
  },

  completeMission: (id, title) => {
    const s = get();
    if (s.missions[id]) return;
    const missions = { ...s.missions, [id]: Date.now() };
    set({ missions });
    save({ found: s.found, stars: s.stars, missions });
    get().pushToast({ tone: "mission", title: "Mission complete", body: title });
  },

  pushToast: (t) => {
    const key = ++toastKey;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, key }] }));
    window.setTimeout(() => get().dismissToast(key), 4200);
  },
  dismissToast: (key) => set((s) => ({ toasts: s.toasts.filter((t) => t.key !== key) })),
  reset: () => {
    const empty = { found: {}, stars: {}, missions: {} };
    save(empty);
    set(empty);
  },
}));

export function isDiscoverable(id: string) {
  return DISCOVERABLE.has(id);
}
