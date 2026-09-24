import { useMemo, type ReactNode } from "react";
import { SOLAR_SYSTEM } from "../data/solarSystem";
import { DEEP_SKY } from "../data/deepSky";
import { starDistanceLy, starId, starName, useStarStore, type StarCatalog } from "../data/stars";
import type { SpaceObject } from "../domain/types";
import { useSelectionStore } from "../state/selectionStore";
import { focusObject } from "../state/navigation";
import { useViewStore } from "../state/viewStore";
import { formatNumber } from "./format";

interface RowItem {
  id: string;
  name: string;
  accent: string;
  detail?: string;
}

function Row({ item, depth = 0 }: { item: RowItem; depth?: number }) {
  const selected = useSelectionStore((s) => s.selectedId === item.id);
  const hover = useSelectionStore((s) => s.hoverObject);
  return (
    <button
      type="button"
      onClick={() => focusObject(item.id)}
      onMouseEnter={() => hover(item.id)}
      onMouseLeave={() => hover(null)}
      className={`flex w-full items-center gap-2.5 rounded-md py-1.5 pr-2 text-left transition-colors hover:bg-white/[0.06] ${
        selected ? "bg-white/[0.09] text-ink" : "text-ink-dim hover:text-ink"
      }`}
      style={{ paddingLeft: 10 + depth * 16 }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.accent }} />
      <span className="flex-1 truncate text-[14px]">{item.name}</span>
      {item.detail && <span className="shrink-0 text-[11px] text-ink-faint tabular-nums">{item.detail}</span>}
    </button>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <div className="label-caps px-2.5 pt-2 pb-1 first:pt-1.5">{children}</div>;
}

const toItem = (o: SpaceObject): RowItem => ({ id: o.id, name: o.name, accent: o.visual.accent });

function SolarSystemList() {
  const roots = SOLAR_SYSTEM.filter((o) => !o.parentId);
  const childrenOf = (id: string) => SOLAR_SYSTEM.filter((o) => o.parentId === id);

  const renderTree = (obj: SpaceObject, depth: number): ReactNode => (
    <li key={obj.id}>
      <Row item={toItem(obj)} depth={depth} />
      {childrenOf(obj.id).length > 0 && (
        <ul>{childrenOf(obj.id).map((c) => renderTree(c, obj.type === "star" ? depth : depth + 1))}</ul>
      )}
    </li>
  );

  return (
    <>
      <Heading>Solar System</Heading>
      <ul>{roots.map((r) => renderTree(r, 0))}</ul>
    </>
  );
}

const STAR_ACCENT = "#fff1c9";

function starItem(catalog: StarCatalog, i: number): RowItem {
  const d = starDistanceLy(catalog, i);
  return {
    id: starId(catalog, i),
    name: starName(catalog, i),
    accent: STAR_ACCENT,
    detail: `${formatNumber(d, d < 100 ? 1 : 0)} ly`,
  };
}

function InterstellarList() {
  const catalog = useStarStore((s) => s.catalog);

  const { nearest, brightest } = useMemo(() => {
    if (!catalog) return { nearest: [], brightest: [] };
    const all = Array.from({ length: catalog.count }, (_, i) => i).filter((i) => catalog.meta.hyg[i] !== 0);
    const nearest = all
      .filter((i) => catalog.meta.proper[i])
      .sort((a, b) => starDistanceLy(catalog, a) - starDistanceLy(catalog, b))
      .slice(0, 7)
      .map((i) => starItem(catalog, i));
    // Catalogue is sorted brightest-first as seen from Earth.
    const brightest = catalog.named
      .filter((i) => catalog.meta.hyg[i] !== 0)
      .slice(0, 10)
      .map((i) => starItem(catalog, i));
    return { nearest, brightest };
  }, [catalog]);

  return (
    <>
      <Heading>Galaxy</Heading>
      <ul>
        {DEEP_SKY.map((o) => (
          <li key={o.id}>
            <Row item={{ id: o.id, name: o.name, accent: "#c9b8ff" }} />
          </li>
        ))}
        <li>
          <Row item={{ id: "sun", name: "Sun", accent: "#ffc861", detail: "home" }} />
        </li>
      </ul>
      {catalog ? (
        <>
          <Heading>Nearest stars</Heading>
          <ul>
            {nearest.map((it) => (
              <li key={it.id}>
                <Row item={it} />
              </li>
            ))}
          </ul>
          <Heading>Brightest in our sky</Heading>
          <ul>
            {brightest.map((it) => (
              <li key={it.id}>
                <Row item={it} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="px-2.5 py-2 text-[12px] text-ink-faint">Loading star catalogue…</p>
      )}
    </>
  );
}

/** Object list for the current view level. */
export function Navigator() {
  const level = useViewStore((s) => s.level);
  return (
    <nav
      aria-label="Objects"
      className="panel thin-scroll animate-fade-in pointer-events-auto fixed top-20 left-4 z-10 hidden max-h-[calc(100vh-10rem)] w-56 overflow-y-auto p-1.5 lg:block"
    >
      {level === "system" ? <SolarSystemList /> : <InterstellarList />}
    </nav>
  );
}
