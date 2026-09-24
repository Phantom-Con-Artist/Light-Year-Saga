import { SOLAR_SYSTEM } from "../data/solarSystem";
import { DEEP_SKY } from "../data/deepSky";
import { starDistanceLy, starId, starName, type StarCatalog } from "../data/stars";
import { formatNumber } from "./format";

export interface SearchEntry {
  id: string;
  name: string;
  detail: string;
  accent: string;
  /** Extra lowercase text to match against (designations, catalogue numbers). */
  keywords: string;
}

const STAR_ACCENT = "#fff1c9";

export function buildSearchIndex(catalog: StarCatalog | null): SearchEntry[] {
  const entries: SearchEntry[] = [
    ...SOLAR_SYSTEM.map((o) => ({
      id: o.id,
      name: o.name,
      detail: o.classification,
      accent: o.visual.accent,
      keywords: `${o.id} ${o.type} ${o.classification}`.toLowerCase(),
    })),
    ...DEEP_SKY.map((o) => ({
      id: o.id,
      name: o.name,
      detail: o.classification,
      accent: "#c9b8ff",
      keywords: `${o.id} ${o.type} ${o.classification}`.toLowerCase(),
    })),
  ];
  if (catalog) {
    for (const i of catalog.named) {
      if (catalog.meta.hyg[i] === 0) continue; // the Sun is already listed
      const m = catalog.meta;
      entries.push({
        id: starId(catalog, i),
        name: starName(catalog, i),
        detail: `Star · ${formatNumber(starDistanceLy(catalog, i), starDistanceLy(catalog, i) < 100 ? 1 : 0)} ly`,
        accent: STAR_ACCENT,
        keywords: `${m.designation[i]} ${m.hip[i] ? `hip ${m.hip[i]}` : ""} ${m.spect[i]} star`.toLowerCase(),
      });
    }
  }
  return entries;
}

/** Ranked search; also resolves "HIP 12345" to any catalogue star, named or not. */
export function search(entries: SearchEntry[], catalog: StarCatalog | null, query: string, limit = 12): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.slice(0, SOLAR_SYSTEM.length + 2);

  const hip = q.match(/^hip\s*(\d+)$/);
  if (hip && catalog) {
    const n = Number(hip[1]);
    const i = catalog.meta.hip.indexOf(n);
    if (i >= 0) {
      return [
        {
          id: starId(catalog, i),
          name: starName(catalog, i),
          detail: `HIP ${n} · ${formatNumber(starDistanceLy(catalog, i), 0)} ly`,
          accent: STAR_ACCENT,
          keywords: "",
        },
      ];
    }
  }

  const scored: [number, SearchEntry][] = [];
  for (const e of entries) {
    const name = e.name.toLowerCase();
    const score = name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : e.keywords.includes(q) ? 3 : -1;
    if (score >= 0) scored.push([score, e]);
  }
  return scored
    .sort((a, b) => a[0] - b[0])
    .slice(0, limit)
    .map(([, e]) => e);
}
