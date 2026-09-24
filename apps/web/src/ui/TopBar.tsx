import { useEffect, useMemo, useRef, useState } from "react";
import { useStarStore } from "../data/stars";
import { selectObject } from "../state/selectionStore";
import { focusObject } from "../state/navigation";
import { useViewStore, type ViewLevel } from "../state/viewStore";
import { buildSearchIndex, search } from "./searchIndex";
import { useCameraStore } from "../state/cameraStore";
import { isLive, useTimeStore } from "../state/timeStore";
import { useMissionStore } from "../state/missionStore";
import { TOTAL_DISCOVERABLE, useDiscoveryStore } from "../state/discoveryStore";
import { useUiStore } from "../state/uiStore";
import { useAudioStore } from "../audio/audioStore";
import { Icon } from "./Icon";
import { useIsMobile } from "./useMedia";

function Brand() {
  return (
    <div className="pointer-events-auto flex items-center gap-2.5 select-none">
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute h-5 w-5 rounded-full border border-white/25" />
        <span className="h-2 w-2 rounded-full bg-[#ffc861]" />
      </span>
      <span className="hidden text-[15px] font-semibold tracking-tight text-ink sm:inline">Light Year Saga</span>
    </div>
  );
}

function SearchBox({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void }) {
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
    onClose?.();
  };

  // Phone: the search bar is opened on demand, so focus it straight away.
  useEffect(() => {
    if (mobile) input.current?.focus();
  }, [mobile]);

  return (
    <div className={`pointer-events-auto relative w-full ${mobile ? "" : "max-w-[320px]"}`}>
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
          enterKeyHint="search"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, results.length - 1));
            else if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
            else if (e.key === "Enter" && results[cursor]) choose(results[cursor].id);
            else if (e.key === "Escape") {
              input.current?.blur();
              onClose?.();
            }
            else return;
            e.preventDefault();
            e.stopPropagation();
          }}
          placeholder="Search planets, stars, galaxies…"
          aria-label="Search objects"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        {mobile ? (
          <button type="button" className="btn -mr-2 !h-8 !px-2" onClick={onClose} aria-label="Close search">
            <Icon name="close" size={14} />
          </button>
        ) : (
          <kbd className="rounded border border-line px-1.5 text-[11px] text-ink-faint">/</kbd>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className={`panel thin-scroll animate-panel-in absolute inset-x-0 top-11 overflow-y-auto p-1 ${mobile ? "max-h-[60dvh]" : "max-h-96"}`} role="listbox">
          {results.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o.id)}
                onMouseEnter={() => setCursor(i)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 text-left ${mobile ? "py-2.5" : "py-1.5"} ${i === cursor ? "bg-white/[0.07]" : ""}`}
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

const LEVELS: { level: ViewLevel; label: string; short: string; tiny: string }[] = [
  { level: "system", label: "Solar System", short: "Solar", tiny: "Solar" },
  { level: "interstellar", label: "Stars & Galaxy", short: "Stars", tiny: "Stars" },
  { level: "cosmic", label: "Universe", short: "Universe", tiny: "Cosmos" },
];

function LevelSwitch({ compact = false }: { compact?: boolean }) {
  const tab = `btn !h-7 ${compact ? "!px-2 !text-[13px]" : "!px-2.5"}`;
  const level = useViewStore((s) => s.level);
  return (
    <div className="panel flex h-9 items-center p-0.5" role="tablist" aria-label="Scale">
      {LEVELS.map((l) => (
        <button
          key={l.level}
          type="button"
          role="tab"
          aria-selected={level === l.level}
          className={tab}
          data-on={level === l.level}
          onClick={() => {
            selectObject(null);
            useViewStore.getState().goTo(l.level);
          }}
        >
          {compact ? (
            l.tiny
          ) : (
            <>
              <span className="hidden xl:inline">{l.label}</span>
              <span className="xl:hidden">{l.short}</span>
            </>
          )}
        </button>
      ))}
      <button
        type="button"
        role="tab"
        aria-selected={level === "scale"}
        className={tab}
        data-on={level === "scale"}
        title="Size comparison: from a neutron star to TON 618"
        onClick={() => {
          selectObject(null);
          useViewStore.getState().goTo("scale");
        }}
      >
        Size
      </button>
    </div>
  );
}

function ClockBadge() {
  const live = useTimeStore(isLive);
  const paused = useTimeStore((s) => s.paused);
  const label = live ? "Live" : paused ? "Paused" : "Simulated";
  const tone = live ? "bg-live" : paused ? "bg-warn" : "bg-accent";
  return (
    <div className="panel hidden h-9 items-center gap-2 px-3 text-[13px] text-ink-dim 2xl:flex">
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      {label}
    </div>
  );
}

function LogbookButton() {
  const count = useDiscoveryStore((s) => Object.keys(s.found).length);
  return (
    <button type="button" className="panel btn !h-9" onClick={() => useUiStore.getState().toggleLogbook()} title="Your logbook of discoveries">
      <Icon name="book" size={15} />
      <span className="tabular-nums">
        {count}
        <span className="text-ink-faint">/{TOTAL_DISCOVERABLE}</span>
      </span>
    </button>
  );
}

function SoundButton() {
  const muted = useAudioStore((s) => s.muted);
  return (
    <button
      type="button"
      className="panel btn !h-9 !px-2.5"
      onClick={() => useAudioStore.getState().toggleMute()}
      title={muted ? "Unmute music" : "Mute music"}
      aria-label={muted ? "Unmute" : "Mute"}
    >
      <Icon name={muted ? "soundOff" : "sound"} size={15} />
    </button>
  );
}

/** Phone: one slim row — voyages, levels, search, and everything else behind a menu. */
function MobileTopBar() {
  const [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState(false);
  const flyHome = useCameraStore((s) => s.flyHome);
  const level = useViewStore((s) => s.level);
  const count = useDiscoveryStore((s) => Object.keys(s.found).length);
  const muted = useAudioStore((s) => s.muted);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  const item = "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[15px] text-ink active:bg-white/[0.08]";
  const run = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };

  return (
    <header className="safe-top pointer-events-none fixed inset-x-0 top-0 z-20 px-2 pt-2">
      {searching ? (
        <SearchBox mobile onClose={() => setSearching(false)} />
      ) : (
        <div className="flex items-center justify-between gap-1.5">
          <button type="button" className="voyage-button pointer-events-auto !h-9 !px-2.5" onClick={() => useMissionStore.getState().openPicker()} aria-label="Voyages">
            <Icon name="rocket" size={16} />
          </button>
          <div className="pointer-events-auto">
            <LevelSwitch compact />
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button type="button" className="panel btn !h-9 !px-2.5" onClick={() => setSearching(true)} aria-label="Search">
              <Icon name="search" size={16} />
            </button>
            <div className="relative">
              <button
                type="button"
                className="panel btn !h-9 !px-2.5"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setMenu((m) => !m)}
                aria-label="Menu"
                aria-expanded={menu}
              >
                <Icon name="menu" size={16} />
              </button>
              {menu && (
                <div className="panel animate-panel-in absolute top-11 right-0 w-56 p-1" onPointerDown={(e) => e.stopPropagation()}>
                  {level !== "scale" && (
                    <button
                      type="button"
                      className={item}
                      onClick={run(() => {
                        selectObject(null);
                        flyHome();
                      })}
                    >
                      <Icon name="home" size={16} /> Overview
                    </button>
                  )}
                  <button type="button" className={item} onClick={run(() => useUiStore.getState().setBrowse(true))}>
                    <Icon name="list" size={16} /> Browse objects
                  </button>
                  <button type="button" className={item} onClick={run(() => useUiStore.getState().toggleLogbook())}>
                    <Icon name="book" size={16} /> Logbook
                    <span className="ml-auto text-[13px] text-ink-faint tabular-nums">
                      {count}/{TOTAL_DISCOVERABLE}
                    </span>
                  </button>
                  <button type="button" className={item} onClick={() => useAudioStore.getState().toggleMute()}>
                    <Icon name={muted ? "soundOff" : "sound"} size={16} /> {muted ? "Music off" : "Music on"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function TopBar() {
  const mobile = useIsMobile();
  return mobile ? <MobileTopBar /> : <DesktopTopBar />;
}

function DesktopTopBar() {
  const flyHome = useCameraStore((s) => s.flyHome);
  const level = useViewStore((s) => s.level);
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-2 p-4 lg:flex-nowrap">
      <Brand />
      <div className="order-last flex w-full justify-center lg:order-none lg:w-auto lg:flex-1">
        <SearchBox />
      </div>
      <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
        <button type="button" className="voyage-button" onClick={() => useMissionStore.getState().openPicker()} title="Guided voyages">
          <Icon name="rocket" size={15} />
          Voyages
        </button>
        <LevelSwitch />
        {level !== "scale" && (
          <button
            type="button"
            className="panel btn !h-9 !px-2.5"
            onClick={() => {
              selectObject(null);
              flyHome();
            }}
            title="Overview (H)"
            aria-label="Overview"
          >
            <Icon name="home" size={15} />
          </button>
        )}
        <LogbookButton />
        <SoundButton />
        {(level === "system" || level === "focus") && <ClockBadge />}
      </div>
    </header>
  );
}
