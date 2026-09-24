import { useEffect, useRef, useState } from "react";
import { getMission, type MissionStep } from "../../data/missions";
import { getCatalogObject, getExoPlanet, CATALOG_KIND_LABEL } from "../../data/catalog";
import { getObject } from "../../data/solarSystem";
import { SCALE_LINEUP } from "../../data/scaleLineup";
import { useMissionStore } from "../../state/missionStore";
import { useDiscoveryStore } from "../../state/discoveryStore";
import { flight } from "../../state/flightStore";
import { Icon } from "../Icon";

/** Types text out character by character; `done` reports when finished. Bumping `finish` completes it instantly. */
function TypeText({ text, onDone, finish }: { text: string; onDone: (done: boolean) => void; finish: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (finish === 0) return;
    setShown(text.length);
    onDone(true);
  }, [finish]);
  useEffect(() => {
    setShown(0);
    onDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown((prev) => Math.max(prev, i));
      if (i >= text.length) {
        window.clearInterval(id);
        onDone(true);
      }
    }, 22);
    return () => window.clearInterval(id);
  }, [text]);
  return (
    <>
      {text.slice(0, shown)}
      <span className="opacity-0">{text.slice(shown)}</span>
    </>
  );
}

function destinationInfo(step: MissionStep): { kind: string; where: string } {
  const t = step.target;
  if ("scale" in t) {
    const e = SCALE_LINEUP.find((x) => x.id === t.scale);
    return { kind: "Size comparison", where: e ? `${e.name} · to scale` : "" };
  }
  const id = "closeUp" in t ? t.closeUp : "id" in t ? t.id : null;
  const closeUp = "closeUp" in t;
  if (id) {
    const c = getCatalogObject(id);
    if (c) return { kind: `${CATALOG_KIND_LABEL[c.kind]}${closeUp ? " · true-scale close-up" : ""}`, where: c.distanceLabel };
    const p = getExoPlanet(id);
    if (p) return { kind: "Exoplanet", where: p.system.distanceLabel };
    const b = getObject(id);
    if (b) return { kind: b.classification, where: "Solar System" };
  }
  return { kind: "Star", where: "Milky Way" };
}

/** Warp-drive readout, sampled from the camera rig's travel speed. */
function WarpGauge({ accent }: { accent: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = flight.speed;
      if (bar.current) bar.current.style.width = `${Math.round(Math.min(1, s) * 100)}%`;
      if (label.current) label.current.textContent = s > 0.08 ? "Engaged" : "Holding";
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] text-ink-faint">
        <span>Warp drive</span>
        <span ref={label} className="text-ink-dim">
          Holding
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div ref={bar} className="h-full rounded-full transition-[width] duration-150" style={{ background: accent, width: "0%" }} />
      </div>
    </div>
  );
}

/** The ship: canopy frame, mission bar, and a console with comms from ARIA. */
export function Cockpit() {
  const missionId = useMissionStore((s) => s.missionId);
  const stepIndex = useMissionStore((s) => s.step);
  const lineIndex = useMissionStore((s) => s.line);
  const discovered = useDiscoveryStore((s) => Object.keys(s.found).length);
  const [typed, setTyped] = useState(false);
  const [finish, setFinish] = useState(0);
  const typedRef = useRef(false);
  typedRef.current = typed;
  const mission = getMission(missionId);

  /** First press completes the line being typed; the next one moves on. */
  const proceed = () => {
    if (!typedRef.current) setFinish((f) => f + 1);
    else useMissionStore.getState().advance();
  };

  const proceedRef = useRef(proceed);
  proceedRef.current = proceed;

  // Keyboard: Enter/Space continue, Esc leaves the voyage.
  useEffect(() => {
    if (!mission) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopImmediatePropagation();
        proceedRef.current();
      } else if (e.key === "Escape") {
        e.stopImmediatePropagation();
        useMissionStore.getState().exit();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mission]);

  if (!mission) return null;
  const step = mission.steps[stepIndex];
  const line = step.lines[lineIndex];
  const lastLine = lineIndex === step.lines.length - 1;
  const lastStep = stepIndex === mission.steps.length - 1;
  const info = destinationInfo(step);

  return (
    <div className="cockpit" style={{ ["--accent" as string]: mission.accent }}>
      <CanopyFrame />
      <div className="cockpit-reticle" aria-hidden="true" />

      {/* Mission bar */}
      <div className="safe-top pointer-events-auto fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-3 py-2 md:px-5 md:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="cockpit-badge max-md:hidden">VOYAGE</span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-ink">{mission.title}</div>
            <div className="truncate text-[11px] text-ink-faint">
              <span className="md:hidden">
                Stop {stepIndex + 1} of {mission.steps.length} · {step.title}
              </span>
              <span className="max-md:hidden">{mission.tagline}</span>
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 md:flex" aria-label="Progress">
          {mission.steps.map((s, i) => (
            <span
              key={s.title}
              title={s.title}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === stepIndex ? 22 : 8, background: i <= stepIndex ? mission.accent : "rgb(255 255 255 / 0.15)" }}
            />
          ))}
        </div>
        <button type="button" className="btn shrink-0" onClick={() => useMissionStore.getState().exit()} title="Leave voyage (Esc)" aria-label="Exit voyage">
          <Icon name="close" size={14} />
          <span className="max-md:hidden">Exit voyage</span>
        </button>
      </div>

      {/* Console */}
      <div className="safe-bottom pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex justify-center px-2 md:px-3 md:pb-3">
        <div className="cockpit-console grid w-full max-w-[1100px] grid-cols-1 gap-3 md:grid-cols-[1fr_2.2fr_1fr]">
          <section className="cockpit-panel hidden md:block">
            <div className="label-caps">Destination {stepIndex + 1}/{mission.steps.length}</div>
            <div className="mt-1.5 text-[17px] font-semibold text-ink">{step.title}</div>
            <div className="mt-0.5 text-[12px] text-ink-dim">{info.kind}</div>
            <div className="mt-0.5 text-[12px] text-ink-faint">{info.where}</div>
          </section>

          <section className="cockpit-panel">
            <div className="flex items-center gap-3">
              <div className="aria-avatar" aria-hidden="true">
                <span />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-ink">ARIA</div>
                <div className="text-[11px] text-ink-faint">Ship navigator</div>
              </div>
            </div>
            <p className="mt-2 min-h-[3.2em] text-[14px] leading-snug text-ink md:mt-2.5 md:text-[15px] md:leading-relaxed" aria-live="polite">
              <TypeText text={line} onDone={setTyped} finish={finish} />
            </p>
            <div className="mt-2 flex items-center justify-end gap-2">
              {!lastLine && (
                <button type="button" className="btn" onClick={() => useMissionStore.getState().skipStep()}>
                  {lastStep ? "Finish" : "Next destination"} <Icon name="next" size={13} />
                </button>
              )}
              <button type="button" className="cockpit-primary" onClick={proceed} data-ready={typed}>
                {lastLine ? (lastStep ? "Complete voyage" : "Engage — next destination") : "Continue"}
                <Icon name="next" size={14} />
              </button>
            </div>
          </section>

          <section className="cockpit-panel hidden md:flex md:flex-col md:justify-between">
            <WarpGauge accent={mission.accent} />
            <div className="mt-3">
              <div className="text-[11px] text-ink-faint">Logbook</div>
              <div className="text-[15px] font-semibold text-ink tabular-nums">{discovered} discoveries</div>
            </div>
            <div className="mt-2 text-[11px] text-ink-faint">Enter to continue · Esc to exit</div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Hull silhouette around the viewport, drawn in SVG so it scales with the window. */
function CanopyFrame() {
  return (
    <svg className="pointer-events-none fixed inset-0 z-[15] h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1017" />
          <stop offset="1" stopColor="#05070b" />
        </linearGradient>
        <linearGradient id="rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--accent)" }} stopOpacity="0" />
          <stop offset="0.5" style={{ stopColor: "var(--accent)" }} stopOpacity="0.55" />
          <stop offset="1" style={{ stopColor: "var(--accent)" }} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Top canopy band */}
      <path d="M0 0 H1600 V58 Q1200 92 800 92 Q400 92 0 58 Z" fill="url(#hull)" />
      <path d="M0 58 Q400 92 800 92 Q1200 92 1600 58" fill="none" stroke="url(#rim)" strokeWidth="1.5" />
      {/* Pillars and dashboard: desktop only — on a phone every pixel goes to the view. */}
      <g className="max-md:hidden">
      {/* Side pillars */}
      <path d="M0 58 L70 100 L150 720 L0 900 Z" fill="url(#hull)" />
      <path d="M1600 58 L1530 100 L1450 720 L1600 900 Z" fill="url(#hull)" />
      <path d="M70 100 L150 720" stroke="rgb(255 255 255 / 0.06)" strokeWidth="2" />
      <path d="M1530 100 L1450 720" stroke="rgb(255 255 255 / 0.06)" strokeWidth="2" />
      {/* Dashboard */}
      <path d="M0 900 L150 720 Q800 680 1450 720 L1600 900 Z" fill="url(#hull)" />
      <path d="M150 720 Q800 680 1450 720" fill="none" stroke="url(#rim)" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
