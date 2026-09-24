import { useEffect, useMemo, useRef, useState } from "react";
import { SOLAR_SYSTEM } from "../data/solarSystem";
import { selectObject } from "../state/selectionStore";
import { useCameraStore } from "../state/cameraStore";
import { isLive, useTimeStore } from "../state/timeStore";
import { Icon } from "./Icon";

function BrandMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="lys-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fd0ff" />
          <stop offset="1" stopColor="#9b8cff" />
        </linearGradient>
      </defs>
      <ellipse cx="20" cy="20" rx="17" ry="7" fill="none" stroke="url(#lys-g)" strokeWidth="1.2" transform="rotate(-24 20 20)" />
      <circle cx="20" cy="20" r="5" fill="#ffc861" />
      <circle cx="20" cy="20" r="8.5" fill="none" stroke="#ffc861" strokeOpacity="0.25" />
      <circle cx="35" cy="13.5" r="2" fill="#5fd0ff" />
    </svg>
  );
}

function Brand() {
  return (
    <div className="pointer-events-auto flex items-center gap-3 select-none">
      <BrandMark />
      <div className="leading-none">
        <div className="font-display text-[15px] font-bold tracking-[0.32em] text-ink">
          LIGHT YEAR <span className="text-hud">SAGA</span>
        </div>
        <div className="hud-kicker mt-1.5 !text-[9px]">Sol System · Sector 001</div>
      </div>
    </div>
  );
}

function SearchBox() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SOLAR_SYSTEM;
    return SOLAR_SYSTEM.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.id.includes(q) ||
        o.classification.toLowerCase().includes(q) ||
        o.type.includes(q),
    );
  }, [query]);

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
    selectObject(id);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="pointer-events-auto relative w-full max-w-[380px]">
      <div className="hud-panel flex h-10 items-center gap-2.5 px-3.5">
        <Icon name="search" className="shrink-0 text-hud" />
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
          placeholder="Search the system…"
          aria-label="Search objects"
          className="min-w-0 flex-1 bg-transparent font-ui text-[15px] font-medium tracking-wide text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <kbd className="hud-kicker rounded-sm border border-line px-1.5 py-0.5 !text-[9px]">/</kbd>
      </div>

      {open && results.length > 0 && (
        <ul className="hud-panel hud-scroll animate-panel-in absolute inset-x-0 top-12 max-h-80 overflow-y-auto py-2" role="listbox">
          {results.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o.id)}
                onMouseEnter={() => setCursor(i)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                  i === cursor ? "bg-hud/10" : ""
                }`}
              >
                <span className="h-1.5 w-1.5 rotate-45" style={{ background: o.visual.accent }} />
                <span className="flex-1 font-display text-[11px] tracking-[0.2em] uppercase">{o.name}</span>
                <span className="hud-kicker !text-[9px]">{o.classification}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClockBadge() {
  const live = useTimeStore(isLive);
  const paused = useTimeStore((s) => s.paused);
  const label = live ? "LIVE" : paused ? "PAUSED" : "SIMULATED";
  const tone = live ? "text-hud-green" : paused ? "text-hud-amber" : "text-hud-violet";
  return (
    <div className={`hud-panel flex h-10 items-center gap-2 px-4 font-mono text-[10px] tracking-[0.24em] ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${live ? "animate-blink" : ""}`} />
      {label}
    </div>
  );
}

export function TopBar() {
  const flyHome = useCameraStore((s) => s.flyHome);
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-3 p-4 md:flex-nowrap md:p-5">
      <Brand />
      <div className="order-last flex w-full justify-center md:order-none md:w-auto md:flex-1">
        <SearchBox />
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          className="hud-button h-10"
          onClick={() => {
            selectObject(null);
            flyHome();
          }}
          title="System overview (H)"
        >
          <Icon name="home" />
          <span className="hidden sm:inline">OVERVIEW</span>
        </button>
        <ClockBadge />
      </div>
    </header>
  );
}
