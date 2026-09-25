import { SOLAR_SYSTEM } from "../data/solarSystem";
import { getCatalogObject, getExoPlanet } from "../data/catalog";
import { getConstellation } from "../data/constellations";
import { MISSIONS } from "../data/missions";
import { CATEGORIES, RANKS, TOTAL_DISCOVERABLE, rankFor, useDiscoveryStore } from "../state/discoveryStore";
import { useUiStore } from "../state/uiStore";
import { useMissionStore } from "../state/missionStore";
import { focusObject } from "../state/navigation";
import { Icon } from "./Icon";

function nameOf(id: string): string {
  return SOLAR_SYSTEM.find((o) => o.id === id)?.name ?? getCatalogObject(id)?.name ?? getExoPlanet(id)?.planet.name ?? getConstellation(id)?.name ?? id;
}

/** Personal exploration log: discoveries by category, rank, mission badges. */
export function Logbook() {
  const open = useUiStore((s) => s.logbookOpen);
  const found = useDiscoveryStore((s) => s.found);
  const stars = useDiscoveryStore((s) => s.stars);
  const missions = useDiscoveryStore((s) => s.missions);
  if (!open) return null;

  const count = Object.keys(found).length;
  const { rank, next } = rankFor(count);
  const progress = next ? (count - rank.at) / (next.at - rank.at) : 1;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-20" onClick={() => useUiStore.getState().closeLogbook()}>
      <section
        className="panel thin-scroll animate-panel-in max-h-[calc(100vh-7rem)] w-full max-w-[640px] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        aria-label="Logbook"
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div>
            <div className="label-caps">Explorer's logbook</div>
            <h2 className="mt-1 text-[22px] font-semibold text-ink">{rank.title}</h2>
            <p className="mt-0.5 text-[13px] text-ink-dim tabular-nums">
              {count} of {TOTAL_DISCOVERABLE} discoveries · {Object.keys(stars).length} catalogue stars inspected
            </p>
          </div>
          <button type="button" className="btn" onClick={() => useUiStore.getState().closeLogbook()} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        </header>

        <div className="px-5 pb-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] text-ink-faint">
            {next ? `${next.at - count} more to become ${next.title}` : "Highest rank reached. The universe is yours."}
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">Ranks: {RANKS.map((r) => `${r.title} (${r.at})`).join(" · ")}</p>
        </div>

        <div className="border-t border-line px-5 py-4">
          <h3 className="label-caps mb-2.5">Voyages</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MISSIONS.map((m) => {
              const done = !!missions[m.id];
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`rounded-lg border px-2.5 py-2 text-left text-[12px] transition-colors hover:bg-white/[0.05] ${done ? "border-transparent" : "border-line text-ink-faint"}`}
                  style={done ? { background: `${m.accent}22`, color: m.accent } : undefined}
                  onClick={() => {
                    useUiStore.getState().closeLogbook();
                    useMissionStore.getState().start(m.id);
                  }}
                  title={done ? "Completed — fly again" : "Not yet flown"}
                >
                  <div className="font-medium">{m.title}</div>
                  <div className="mt-0.5 text-[11px] opacity-80">{done ? "✓ Completed" : `${m.steps.length} stops`}</div>
                </button>
              );
            })}
          </div>
        </div>

        {CATEGORIES.map((c) => {
          const got = c.ids.filter((id) => found[id]).length;
          return (
            <div key={c.id} className="border-t border-line px-5 py-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="label-caps">{c.label}</h3>
                <span className="text-[12px] text-ink-faint tabular-nums">
                  {got}/{c.ids.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.ids.map((id) =>
                  found[id] ? (
                    <button
                      key={id}
                      type="button"
                      className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[12px] text-ink hover:bg-white/[0.14]"
                      onClick={() => {
                        useUiStore.getState().closeLogbook();
                        focusObject(id);
                      }}
                    >
                      {nameOf(id)}
                    </button>
                  ) : (
                    <span
                      key={id}
                      className="rounded-full border border-dashed border-line px-2.5 py-1 text-[12px] text-ink-faint"
                      title="Undiscovered — go exploring"
                    >
                      ???
                    </span>
                  ),
                )}
              </div>
            </div>
          );
        })}
        <div className="border-t border-line px-5 py-3 text-right">
          <button
            type="button"
            className="text-[11px] text-ink-faint hover:text-ink-dim"
            onClick={() => {
              if (window.confirm("Erase your logbook? This can't be undone.")) useDiscoveryStore.getState().reset();
            }}
          >
            Reset logbook
          </button>
        </div>
      </section>
    </div>
  );
}

/** Small notifications for discoveries, rank-ups and completed missions. */
export function Toasts() {
  const toasts = useDiscoveryStore((s) => s.toasts);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-14 z-50 mx-auto flex w-[min(280px,calc(100vw-1rem))] flex-col gap-2 md:inset-x-auto md:top-20 md:right-[356px] md:mx-0"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div key={t.key} className={`toast toast--${t.tone} animate-panel-in`}>
          <div className="text-[11px] font-medium tracking-wide uppercase opacity-80">
            {t.tone === "discovery" ? "New discovery" : t.tone === "rank" ? "Rank up" : "Voyage"}
          </div>
          <div className="text-[14px] font-semibold">{t.title}</div>
          <div className="text-[12px] opacity-80">{t.body}</div>
        </div>
      ))}
    </div>
  );
}
