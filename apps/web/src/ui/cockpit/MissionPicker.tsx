import { MISSIONS } from "../../data/missions";
import { useMissionStore } from "../../state/missionStore";
import { useDiscoveryStore } from "../../state/discoveryStore";
import { Icon } from "../Icon";

/** Choose a guided voyage. */
export function MissionPicker() {
  const open = useMissionStore((s) => s.pickerOpen);
  const completed = useDiscoveryStore((s) => s.missions);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 p-4 pt-16" onClick={() => useMissionStore.getState().closePicker()}>
      <section className="panel thin-scroll animate-panel-in max-h-[calc(100vh-6rem)] w-full max-w-[860px] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} aria-label="Voyages">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="label-caps">Voyages</div>
            <h2 className="mt-1 text-[22px] font-semibold text-ink">Where to, explorer?</h2>
            <p className="mt-0.5 text-[13px] text-ink-dim">Board the ship and let ARIA guide you. Every stop is a real place — and a discovery for your logbook.</p>
          </div>
          <button type="button" className="btn" onClick={() => useMissionStore.getState().closePicker()} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        </header>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MISSIONS.map((m) => (
            <button key={m.id} type="button" className="mission-card" style={{ ["--accent" as string]: m.accent }} onClick={() => useMissionStore.getState().start(m.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-[16px] font-semibold text-ink">{m.title}</div>
                {completed[m.id] && <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: `${m.accent}26`, color: m.accent }}>✓ Flown</span>}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">{m.tagline}</p>
              <div className="mt-3 flex items-center justify-between text-[12px] text-ink-faint">
                <span>{m.steps.length} destinations</span>
                <span className="flex items-center gap-1" style={{ color: m.accent }}>
                  Launch <Icon name="next" size={12} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
