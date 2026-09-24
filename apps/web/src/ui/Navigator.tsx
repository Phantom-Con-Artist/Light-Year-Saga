import type { ReactNode } from "react";
import { SOLAR_SYSTEM } from "../data/solarSystem";
import type { SpaceObject } from "../domain/types";
import { selectObject, useSelectionStore } from "../state/selectionStore";

function Row({ obj, depth }: { obj: SpaceObject; depth: number }) {
  const selected = useSelectionStore((s) => s.selectedId === obj.id);
  const hover = useSelectionStore((s) => s.hoverObject);
  return (
    <button
      type="button"
      onClick={() => selectObject(obj.id)}
      onMouseEnter={() => hover(obj.id)}
      onMouseLeave={() => hover(null)}
      className={`group relative flex w-full items-center gap-3 py-[7px] pr-3 text-left transition-colors hover:bg-hud/[0.07] ${
        selected ? "bg-hud/[0.11]" : ""
      }`}
      style={{ paddingLeft: 16 + depth * 16 }}
    >
      <span
        className={`absolute top-1 bottom-1 left-0 w-[2px] transition-opacity ${selected ? "opacity-100" : "opacity-0"}`}
        style={{ background: obj.visual.accent, boxShadow: `0 0 10px ${obj.visual.accent}` }}
      />
      {depth > 0 && <span className="-ml-2 h-px w-2 bg-ink-faint" />}
      <span
        className="h-[7px] w-[7px] rotate-45 border transition-colors"
        style={{ borderColor: obj.visual.accent, background: selected ? obj.visual.accent : "transparent" }}
      />
      <span
        className={`flex-1 font-display text-[11px] tracking-[0.2em] uppercase transition-colors ${
          selected ? "text-ink" : "text-ink/75 group-hover:text-ink"
        }`}
      >
        {obj.name}
      </span>
      <span className="font-mono text-[9px] tracking-widest text-ink-faint uppercase">{obj.type}</span>
    </button>
  );
}

/** Hierarchical object list: Sun → planets → moons. */
export function Navigator() {
  const roots = SOLAR_SYSTEM.filter((o) => !o.parentId);
  const childrenOf = (id: string) => SOLAR_SYSTEM.filter((o) => o.parentId === id);

  const renderTree = (obj: SpaceObject, depth: number): ReactNode => (
    <li key={obj.id}>
      <Row obj={obj} depth={depth} />
      {childrenOf(obj.id).length > 0 && (
        <ul>{childrenOf(obj.id).map((c) => renderTree(c, obj.type === "star" ? depth : depth + 1))}</ul>
      )}
    </li>
  );

  return (
    <nav
      aria-label="Solar System objects"
      className="hud-panel animate-fade-in pointer-events-auto fixed top-24 left-5 z-10 hidden w-60 py-4 lg:block"
    >
      <div className="mb-2 flex items-center justify-between px-4">
        <span className="hud-kicker">Navigation</span>
        <span className="font-mono text-[9px] tracking-widest text-hud">{SOLAR_SYSTEM.length} OBJ</span>
      </div>
      <ul>{roots.map((r) => renderTree(r, 0))}</ul>
    </nav>
  );
}
