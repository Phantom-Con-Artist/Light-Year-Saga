import type { ReactNode } from "react";
import type { DataFreshness, SpaceObject } from "../domain/types";
import { getObject } from "../data/solarSystem";
import { AU_KM } from "../astronomy/ephemeris";
import { selectObject, useSelectionStore } from "../state/selectionStore";
import { useTelemetry } from "./useTelemetry";
import {
  formatDays,
  formatDuration,
  formatLightTime,
  formatNumber,
  formatScientific,
} from "./format";
import { Icon } from "./Icon";

const FRESHNESS_TONE: Record<DataFreshness, string> = {
  LIVE: "text-hud-green border-hud-green/40",
  RECENT: "text-hud border-hud/40",
  ARCHIVED: "text-hud-violet border-hud-violet/40",
  STATIC: "text-ink-dim border-ink-dim/40",
  COMPUTED: "text-hud-amber border-hud-amber/40",
};

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="hud-kicker">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] tracking-[0.2em] text-ink-faint uppercase">{label}</dt>
      <dd className="mt-1 truncate font-mono text-[13px] text-ink tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
        {unit && <span className="ml-1 text-[10px] text-ink-dim">{unit}</span>}
      </dd>
    </div>
  );
}

function FreshnessTag({ freshness }: { freshness: DataFreshness }) {
  return (
    <span className={`border px-1.5 py-px font-mono text-[9px] tracking-[0.2em] ${FRESHNESS_TONE[freshness]}`}>
      {freshness}
    </span>
  );
}

function Telemetry({ obj }: { obj: SpaceObject }) {
  const t = useTelemetry(obj);
  if (!t) return null;
  const moon = obj.type === "moon";
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
      {t.sunDistanceAu !== undefined && !moon && (
        <Stat label="Sun distance" value={formatNumber(t.sunDistanceAu, 4)} unit="AU" accent={obj.visual.accent} />
      )}
      {t.earthDistanceAu !== undefined &&
        (moon ? (
          <Stat
            label="Earth distance"
            value={formatNumber(t.earthDistanceAu * AU_KM, 0)}
            unit="km"
            accent={obj.visual.accent}
          />
        ) : (
          <Stat label="Earth distance" value={formatNumber(t.earthDistanceAu, 4)} unit="AU" />
        ))}
      {t.lightTimeFromEarthS !== undefined && (
        <Stat label="Light time ← Earth" value={formatLightTime(t.lightTimeFromEarthS)} />
      )}
      {t.orbitalSpeedKmS !== undefined && (
        <Stat
          label={moon ? "Speed vs Earth" : "Orbital speed"}
          value={formatNumber(t.orbitalSpeedKmS, 2)}
          unit="km/s"
        />
      )}
    </dl>
  );
}

function Physical({ obj }: { obj: SpaceObject }) {
  const p = obj.physical;
  const rows: [string, string, string?][] = [["Mean radius", formatNumber(p.meanRadiusKm, 1), "km"]];
  if (p.massKg) rows.push(["Mass", formatScientific(p.massKg), "kg"]);
  if (p.surfaceGravityMs2) rows.push(["Surface gravity", formatNumber(p.surfaceGravityMs2, 1), "m/s²"]);
  if (p.rotationPeriodHours)
    rows.push([
      p.rotationPeriodHours < 0 ? "Rotation (retro)" : "Rotation period",
      formatDuration(p.rotationPeriodHours),
    ]);
  if (p.orbitalPeriodDays) rows.push(["Orbital period", formatDays(p.orbitalPeriodDays)]);
  if (p.axialTiltDeg !== undefined) rows.push(["Axial tilt", formatNumber(p.axialTiltDeg, 2), "°"]);
  if (p.meanTemperatureK)
    rows.push([
      obj.type === "star" ? "Photosphere" : "Mean temp",
      `${formatNumber(p.meanTemperatureK)} K`,
      `${formatNumber(p.meanTemperatureK - 273.15)} °C`,
    ]);

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
      {rows.map(([label, value, unit]) => (
        <Stat key={label} label={label} value={value} unit={unit} />
      ))}
    </dl>
  );
}

const DATA_LINKS = ["Missions", "Observations", "Imagery"];

export function Inspector() {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const obj = getObject(selectedId);
  if (!obj) return null;
  const parent = getObject(obj.parentId);

  return (
    <aside
      key={obj.id}
      aria-label={`${obj.name} inspector`}
      className="hud-panel hud-scroll animate-panel-in pointer-events-auto fixed inset-x-3 bottom-44 z-20 max-h-[38vh] overflow-y-auto md:inset-x-auto md:top-24 md:right-5 md:bottom-auto md:max-h-[calc(100vh-15rem)] md:w-[360px]"
      style={{ ["--accent" as string]: obj.visual.accent }}
    >
      <header className="relative px-5 pt-5 pb-4">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-25"
          style={{ background: `radial-gradient(120% 100% at 0% 0%, ${obj.visual.accent}, transparent 70%)` }}
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="hud-kicker flex items-center gap-2">
              <span className="h-1.5 w-1.5 rotate-45" style={{ background: obj.visual.accent }} />
              {obj.type}
              {parent && <span className="text-ink-faint">· orbits {parent.name}</span>}
            </div>
            <h2
              className="mt-2 font-display text-[26px] leading-none font-bold tracking-[0.14em] uppercase"
              style={{ textShadow: `0 0 24px ${obj.visual.accent}66` }}
            >
              {obj.name}
            </h2>
            <p className="mt-2 font-ui text-[15px] font-medium text-ink-dim">{obj.classification}</p>
          </div>
          <button type="button" className="hud-button !h-8 !min-w-8 !px-0" onClick={() => selectObject(null)} aria-label="Close inspector (Esc)">
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="relative mt-3 flex items-center gap-3">
          <code className="border border-line bg-hud/5 px-2 py-0.5 font-mono text-[10px] tracking-wider text-hud">
            id:{obj.id}
          </code>
          <button type="button" className="hud-kicker flex items-center gap-1.5 hover:text-hud" onClick={() => selectObject(obj.id)}>
            <Icon name="focus" size={12} /> Re-center
          </button>
        </div>
      </header>

      <Section title="Telemetry · sim time" aside={<FreshnessTag freshness="COMPUTED" />}>
        <Telemetry obj={obj} />
      </Section>

      <Section title="Physical profile" aside={<FreshnessTag freshness="STATIC" />}>
        <Physical obj={obj} />
      </Section>

      <Section title="Briefing">
        <p className="font-ui text-[15px] leading-relaxed text-ink/85">{obj.description}</p>
      </Section>

      <Section title="Data links">
        <div className="grid grid-cols-3 gap-2">
          {DATA_LINKS.map((label) => (
            <button key={label} type="button" disabled className="hud-button !h-auto flex-col !gap-1 py-2.5" title="Connects to NASA / MAST in a later sprint">
              <span className="!tracking-[0.12em]">{label.toUpperCase()}</span>
              <span className="text-[8px] tracking-[0.2em] text-hud-amber">OFFLINE</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sources">
        <ul className="space-y-2.5">
          {obj.sources.map((s) => (
            <li key={s.name} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[10px] tracking-[0.18em] text-ink-dim uppercase">{s.provider}</div>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 font-ui text-[14px] text-ink/85 hover:text-hud"
                  >
                    {s.name}
                    <Icon name="external" size={11} />
                  </a>
                ) : (
                  <div className="mt-0.5 font-ui text-[14px] text-ink/85">{s.name}</div>
                )}
              </div>
              <FreshnessTag freshness={s.freshness} />
            </li>
          ))}
        </ul>
      </Section>
    </aside>
  );
}
