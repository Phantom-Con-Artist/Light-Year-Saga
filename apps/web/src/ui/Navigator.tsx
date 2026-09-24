import { useMemo, useState, type ReactNode } from "react";
import { SOLAR_SYSTEM } from "../data/solarSystem";
import { CATALOG, type CatalogObject } from "../data/catalog";
import { starDistanceLy, starId, starName, useStarStore, type StarCatalog } from "../data/stars";
import { resolveCloseUp } from "../data/closeUp";
import { SCALE_LINEUP } from "../data/scaleLineup";
import type { SpaceObject } from "../domain/types";
import { useSelectionStore } from "../state/selectionStore";
import { focusObject } from "../state/navigation";
import { useViewStore } from "../state/viewStore";
import { useScaleStore } from "../state/scaleStore";
import { useDiscoveryStore } from "../state/discoveryStore";
import { formatNumber } from "./format";

interface RowItem {
  id: string;
  name: string;
  accent: string;
  detail?: string;
}

function Row({ item, depth = 0, onClick }: { item: RowItem; depth?: number; onClick?: () => void }) {
  const selected = useSelectionStore((s) => s.selectedId === item.id);
  const found = useDiscoveryStore((s) => !!s.found[item.id] || !!s.stars[item.id]);
  const hover = useSelectionStore((s) => s.hoverObject);
  return (
    <button
      type="button"
      onClick={onClick ?? (() => focusObject(item.id))}
      onMouseEnter={() => hover(item.id)}
      onMouseLeave={() => hover(null)}
      className={`flex w-full items-center gap-2.5 rounded-md py-1.5 pr-2 text-left transition-colors hover:bg-white/[0.06] ${
        selected ? "bg-white/[0.09] text-ink" : "text-ink-dim hover:text-ink"
      }`}
      style={{ paddingLeft: 10 + depth * 16 }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.accent, opacity: found ? 1 : 0.45 }} />
      <span className="flex-1 truncate text-[13.5px]">{item.name}</span>
      {item.detail && <span className="shrink-0 text-[11px] text-ink-faint tabular-nums">{item.detail}</span>}
    </button>
  );
}

function Group({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" className="label-caps flex w-full items-center justify-between px-2.5 pt-2.5 pb-1 hover:text-ink-dim" onClick={() => setOpen(!open)}>
        {title}
        <span className="text-[10px]">{open ? "−" : "+"}</span>
      </button>
      {open && <ul>{children}</ul>}
    </div>
  );
}

const catalogItem = (o: CatalogObject): RowItem => ({ id: o.id, name: o.name, accent: o.accent, detail: o.distanceLabel.replace(" million ly", " Mly").replace(" billion ly", " Gly") });
const items = (pred: (o: CatalogObject) => boolean) => CATALOG.filter(pred).map(catalogItem);

function SolarSystemList() {
  const roots = SOLAR_SYSTEM.filter((o) => !o.parentId);
  const childrenOf = (id: string) => SOLAR_SYSTEM.filter((o) => o.parentId === id);
  const toItem = (o: SpaceObject): RowItem => ({ id: o.id, name: o.name, accent: o.visual.accent });
  const renderTree = (obj: SpaceObject, depth: number): ReactNode => (
    <li key={obj.id}>
      <Row item={toItem(obj)} depth={depth} />
      {childrenOf(obj.id).length > 0 && <ul>{childrenOf(obj.id).map((c) => renderTree(c, obj.type === "star" ? depth : depth + 1))}</ul>}
    </li>
  );
  return <Group title="Solar System">{roots.map((r) => renderTree(r, 0))}</Group>;
}

function starItem(catalog: StarCatalog, i: number): RowItem {
  const d = starDistanceLy(catalog, i);
  return { id: starId(catalog, i), name: starName(catalog, i), accent: "#fff1c9", detail: `${formatNumber(d, d < 100 ? 1 : 0)} ly` };
}

function InterstellarList() {
  const catalog = useStarStore((s) => s.catalog);
  const nearest = useMemo(() => {
    if (!catalog) return [];
    return catalog.named
      .filter((i) => catalog.meta.hyg[i] !== 0)
      .sort((a, b) => starDistanceLy(catalog, a) - starDistanceLy(catalog, b))
      .slice(0, 6)
      .map((i) => starItem(catalog, i));
  }, [catalog]);
  const L = (pred: (o: CatalogObject) => boolean) => items((o) => o.level === "interstellar" && pred(o));

  return (
    <>
      <Group title="Galaxy">
        {[...L((o) => o.id === "milky-way"), { id: "sun", name: "Sun", accent: "#ffc861", detail: "home" }].map((it) => (
          <li key={it.id}>
            <Row item={it} />
          </li>
        ))}
      </Group>
      <Group title="Nebulae">
        {L((o) => o.kind === "nebula").map((it) => (
          <li key={it.id}>
            <Row item={it} />
          </li>
        ))}
      </Group>
      <Group title="Black holes">
        {L((o) => o.kind === "black-hole").map((it) => (
          <li key={it.id}>
            <Row item={it} />
          </li>
        ))}
      </Group>
      <Group title="Extreme stars">
        {L((o) => o.kind === "star" || o.kind === "stellar-remnant").map((it) => (
          <li key={it.id}>
            <Row item={it} />
          </li>
        ))}
      </Group>
      <Group title="Alien worlds">
        {L((o) => o.kind === "exo-system").map((it) => (
          <li key={it.id}>
            <Row item={it} />
          </li>
        ))}
      </Group>
      <Group title="Nearest stars" defaultOpen={false}>
        {nearest.map((it) => (
          <li key={it.id}>
            <Row item={it} />
          </li>
        ))}
      </Group>
    </>
  );
}

function CosmicList() {
  const C = (pred: (o: CatalogObject) => boolean) => items((o) => o.level === "cosmic" && pred(o));
  const groups: [string, RowItem[]][] = [
    ["Local Group", C((o) => ["milky-way-cosmic", "lmc", "smc", "andromeda", "triangulum"].includes(o.id))],
    ["Galaxies", C((o) => o.kind === "galaxy" && !["milky-way-cosmic", "lmc", "smc", "andromeda", "triangulum"].includes(o.id))],
    ["Clusters & voids", C((o) => o.kind === "cluster" || o.kind === "void" || o.id === "great-attractor")],
    ["Quasars & the edge", C((o) => o.kind === "quasar" || o.id === "observable-universe")],
  ];
  return (
    <>
      {groups.map(([title, list]) => (
        <Group key={title} title={title}>
          {list.map((it) => (
            <li key={it.id}>
              <Row item={it} />
            </li>
          ))}
        </Group>
      ))}
    </>
  );
}

function FocusList() {
  const focusId = useViewStore((s) => s.focusId);
  const subject = resolveCloseUp(focusId);
  if (!subject) return null;
  return (
    <Group title="Close-up">
      <li>
        <Row item={{ id: subject.id, name: subject.name, accent: "#ffc861" }} />
      </li>
      {subject.kind === "system" &&
        subject.system.planets.map((p) => (
          <li key={p.id}>
            <Row item={{ id: p.id, name: p.name, accent: "#8fffc1", detail: `${formatNumber(p.radiusEarth, 2)} R⊕` }} depth={1} />
          </li>
        ))}
    </Group>
  );
}

function ScaleList() {
  const index = useScaleStore((s) => s.index);
  return (
    <Group title="Smallest → largest">
      {SCALE_LINEUP.map((e, i) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => useScaleStore.getState().setTarget(i)}
            className={`flex w-full items-center gap-2.5 rounded-md py-1 pr-2 pl-2.5 text-left text-[13px] transition-colors hover:bg-white/[0.06] ${
              i === index ? "bg-white/[0.09] text-ink" : "text-ink-dim"
            }`}
          >
            <span className="w-5 shrink-0 text-right text-[11px] text-ink-faint tabular-nums">{i + 1}</span>
            <span className="truncate">{e.name}</span>
          </button>
        </li>
      ))}
    </Group>
  );
}

/** Object list for the current view level. */
export function Navigator() {
  const level = useViewStore((s) => s.level);
  return (
    <nav aria-label="Objects" className="panel thin-scroll animate-fade-in pointer-events-auto fixed top-20 left-4 z-10 hidden max-h-[calc(100vh-10rem)] w-56 overflow-y-auto p-1.5 lg:block">
      {level === "system" && <SolarSystemList />}
      {level === "interstellar" && <InterstellarList />}
      {level === "cosmic" && <CosmicList />}
      {level === "focus" && <FocusList />}
      {level === "scale" && <ScaleList />}
    </nav>
  );
}
