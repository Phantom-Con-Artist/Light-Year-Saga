import { useEffect, useMemo, useRef, useState } from "react";
import { useStarStore } from "../data/stars";
import { selectObject } from "../state/selectionStore";
import { focusObject } from "../state/navigation";
import { useViewStore, type ViewLevel } from "../state/viewStore";
import { buildSearchIndex, search } from "./searchIndex";
import { useCameraStore } from "../state/cameraStore";
import { isLive, useTimeStore } from "../state/timeStore";
import { Icon } from "./Icon";

function Brand() {
  return (
    <div className="pointer-events-auto flex items-center gap-2.5 select-none">
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute h-5 w-5 rounded-full border border-white/25" />
        <span className="h-2 w-2 rounded-full bg-[#ffc861]" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">Light Year Saga</span>
    </div>
  );
}

function SearchBox() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const catalog = useStarStore((s) => s.catalog);
  const index = useMemo(() => buildSearchIndex(catalog), [catalog]);
  const results = useMemo(() => search(index, catalog, query), [index, catalog, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== input.current) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (id: string) => {
    focusObject(id);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="pointer-events-auto relative w-full max-w-[340px]">
      <div className="panel flex h-9 items-center gap-2 px-3">
        <Icon name="search" size={15} className="shrink-0 text-ink-faint" />
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, results.length - 1));
            else if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
            else if (e.key === "Enter" && results[cursor]) choose(results[cursor].id);
            else if (e.key === "Escape") input.current?.blur();
            else return;
            e.preventDefault();
            e.stopPropagation();
          }}
          placeholder="Search planets, stars…"
          aria-label="Search objects"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <kbd className="rounded border border-line px-1.5 text-[11px] text-ink-faint">/</kbd>
      </div>

      {open && results.length > 0 && (
        <ul className="panel thin-scroll animate-panel-in absolute inset-x-0 top-11 max-h-80 overflow-y-auto p-1" role="listbox">
          {results.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o.id)}
                onMouseEnter={() => setCursor(i)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left ${
                  i === cursor ? "bg-white/[0.07]" : ""
                }`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: o.accent }} />
                <span className="flex-1 truncate text-[14px] text-ink">{o.name}</span>
                <span className="shrink-0 text-[12px] text-ink-faint">{o.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const LEVELS: { level: ViewLevel; label: string }[] = [
  { level: "system", label: "Solar System" },
  { level: "interstellar", label: "Stars & Galaxy" },
];

function LevelSwitch() {
  const level = useViewStore((s) => s.level);
  return (
    <div className="panel flex h-9 items-center p-0.5" role="tablist" aria-label="Scale">
      {LEVELS.map((l) => (
        <button
          key={l.level}
          type="button"
          role="tab"
          aria-selected={level === l.level}
          className="btn !h-7 !px-2.5"
          data-on={level === l.level}
          onClick={() => {
            selectObject(null);
            useViewStore.getState().goTo(l.level);
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function ClockBadge() {
  const live = useTimeStore(isLive);
  const paused = useTimeStore((s) => s.paused);
  const label = live ? "Live" : paused ? "Paused" : "Simulated";
  const tone = live ? "bg-live" : paused ? "bg-warn" : "bg-accent";
  return (
    <div className="panel flex h-9 items-center gap-2 px-3 text-[13px] text-ink-dim">
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      {label}
    </div>
  );
}

export function TopBar() {
  const flyHome = useCameraStore((s) => s.flyHome);
  const level = useViewStore((s) => s.level);
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-3 p-4 md:flex-nowrap">
      <Brand />
      <div className="order-last flex w-full justify-center md:order-none md:w-auto md:flex-1">
        <SearchBox />
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <LevelSwitch />
        <button
          type="button"
          className="panel btn !h-9"
          onClick={() => {
            selectObject(null);
            flyHome();
          }}
          title="System overview (H)"
        >
          <Icon name="home" size={15} />
          <span className="hidden sm:inline">Overview</span>
        </button>
        {level === "system" && <ClockBadge />}
      </div>
    </header>
  );
}
