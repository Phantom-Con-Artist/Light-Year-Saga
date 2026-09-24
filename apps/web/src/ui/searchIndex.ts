import { SOLAR_SYSTEM } from "../data/solarSystem";
import { ALL_EXOPLANETS, CATALOG, CATALOG_KIND_LABEL } from "../data/catalog";
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
    ...CATALOG.filter((o) => o.id !== "milky-way-cosmic").map((o) => ({
      id: o.id,
      name: o.name,
      detail: CATALOG_KIND_LABEL[o.kind],
      accent: o.accent,
      keywords: `${o.id} ${o.kind} ${o.classification} ${o.keywords ?? ""}`.toLowerCase(),
    })),
    ...ALL_EXOPLANETS.map(({ planet, system }) => ({
      id: planet.id,
      name: planet.name,
      detail: `Exoplanet · ${system.name}`,
      accent: "#8fffc1",
      keywords: `${planet.id} exoplanet planet ${planet.style} ${system.name}`.toLowerCase(),
    })),
  ];
  if (catalog) {
    for (const i of catalog.named) {
      if (catalog.meta.hyg[i] === 0) continue; // the Sun is already listed
      const m = catalog.meta;
      const d = starDistanceLy(catalog, i);
      entries.push({
        id: starId(catalog, i),
        name: starName(catalog, i),
        detail: `Star · ${formatNumber(d, d < 100 ? 1 : 0)} ly`,
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
  if (!q) {
    // A taste of everything when the box is empty.
    const picks = ["earth", "saturn", "betelgeuse", "orion-nebula", "pillars-of-creation", "trappist-1", "andromeda", "ton-618", "bootes-void"];
    return picks.map((id) => entries.find((e) => e.id === id || e.name.toLowerCase() === id)).filter((e): e is SearchEntry => !!e);
  }

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
