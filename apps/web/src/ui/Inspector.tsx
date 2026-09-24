import type { ReactNode } from "react";
import type { DataFreshness, ExternalSource, SpaceObject } from "../domain/types";
import { getDeepSky, type DeepSkyObject } from "../data/deepSky";
import {
  LY_PER_PC,
  STAR_SOURCE,
  apparentMagnitude,
  isStarId,
  luminositySolar,
  starDistanceLy,
  starName,
  temperatureFromBV,
  useStarStore,
} from "../data/stars";
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

const FRESHNESS_LABEL: Record<DataFreshness, string> = {
  LIVE: "Live",
  RECENT: "Recent",
  ARCHIVED: "Archived",
  STATIC: "Reference",
  COMPUTED: "Computed",
};

function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="border-t border-line px-4 py-3.5">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h3 className="label-caps">{title}</h3>
        {note && <span className="text-[11px] text-ink-faint">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 truncate text-[14px] text-ink tabular-nums">
        {value}
        {unit && <span className="ml-1 text-[12px] text-ink-dim">{unit}</span>}
      </dd>
    </div>
  );
}

function Telemetry({ obj }: { obj: SpaceObject }) {
  const t = useTelemetry(obj);
  if (!t) return null;
  const moon = obj.type === "moon";
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {t.sunDistanceAu !== undefined && !moon && (
        <Stat label="From Sun" value={formatNumber(t.sunDistanceAu, 3)} unit="AU" />
      )}
      {t.earthDistanceAu !== undefined &&
        (moon ? (
          <Stat label="From Earth" value={formatNumber(t.earthDistanceAu * AU_KM, 0)} unit="km" />
        ) : (
          <Stat label="From Earth" value={formatNumber(t.earthDistanceAu, 3)} unit="AU" />
        ))}
      {t.lightTimeFromEarthS !== undefined && (
        <Stat label="Light time from Earth" value={formatLightTime(t.lightTimeFromEarthS)} />
      )}
      {t.orbitalSpeedKmS !== undefined && (
        <Stat label={moon ? "Speed around Earth" : "Orbital speed"} value={formatNumber(t.orbitalSpeedKmS, 2)} unit="km/s" />
      )}
    </dl>
  );
}

function Physical({ obj }: { obj: SpaceObject }) {
  const p = obj.physical;
  const rows: [string, string, string?][] = [["Radius", formatNumber(p.meanRadiusKm, 0), "km"]];
  if (p.massKg) rows.push(["Mass", formatScientific(p.massKg), "kg"]);
  if (p.surfaceGravityMs2) rows.push(["Gravity", formatNumber(p.surfaceGravityMs2, 1), "m/s²"]);
  if (p.rotationPeriodHours)
    rows.push([
      p.rotationPeriodHours < 0 ? "Day (retrograde)" : "Day length",
      formatDuration(p.rotationPeriodHours),
    ]);
  if (p.orbitalPeriodDays) rows.push(["Year length", formatDays(p.orbitalPeriodDays)]);
  if (p.axialTiltDeg !== undefined) rows.push(["Axial tilt", `${formatNumber(p.axialTiltDeg, 1)}°`]);
  if (p.meanTemperatureK)
    rows.push([
      obj.type === "star" ? "Surface temp" : "Mean temp",
      `${formatNumber(p.meanTemperatureK - 273.15)} °C`,
    ]);

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {rows.map(([label, value, unit]) => (
        <Stat key={label} label={label} value={value} unit={unit} />
      ))}
    </dl>
  );
}

function Sources({ sources, footnote }: { sources: ExternalSource[]; footnote?: string }) {
  return (
    <Section title="Sources">
      <ul className="space-y-1.5">
        {sources.map((s) => (
          <li key={s.name} className="flex items-baseline justify-between gap-3 text-[13px]">
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 truncate text-ink-dim hover:text-ink">
                {s.provider} — {s.name}
                <Icon name="external" size={11} className="shrink-0" />
              </a>
            ) : (
              <span className="truncate text-ink-dim">
                {s.provider} — {s.name}
              </span>
            )}
            <span className="shrink-0 text-[11px] text-ink-faint">{FRESHNESS_LABEL[s.freshness]}</span>
          </li>
        ))}
      </ul>
      {footnote && <p className="mt-3 text-[12px] text-ink-faint">{footnote}</p>}
    </Section>
  );
}

function Shell({ id, title, subtitle, children }: { id: string; title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <aside
      key={id}
      aria-label={`${title} details`}
      className="panel thin-scroll animate-panel-in pointer-events-auto fixed inset-x-3 bottom-32 z-20 max-h-[40vh] overflow-y-auto md:inset-x-auto md:top-20 md:right-4 md:bottom-auto md:max-h-[calc(100vh-12rem)] md:w-[320px]"
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3.5">
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold tracking-tight text-ink">{title}</h2>
          <p className="mt-0.5 text-[13px] text-ink-dim">{subtitle}</p>
        </div>
        <button type="button" className="btn -mt-1 -mr-1.5" onClick={() => selectObject(null)} aria-label="Close (Esc)">
          <Icon name="close" size={14} />
        </button>
      </header>
      {children}
    </aside>
  );
}

const DATA_FOOTNOTE = "Missions, observations and imagery will appear here once NASA/MAST data is connected.";

function BodyInspector({ obj }: { obj: SpaceObject }) {
  const parent = getObject(obj.parentId);
  return (
    <Shell id={obj.id} title={obj.name} subtitle={<>{obj.classification}{parent && ` · orbits ${parent.name}`}</>}>
      <Section title="Position" note="at simulation time">
        <Telemetry obj={obj} />
      </Section>
      <Section title="Physical">
        <Physical obj={obj} />
      </Section>
      <Section title="About">
        <p className="text-[14px] leading-relaxed text-ink-dim">{obj.description}</p>
      </Section>
      <Sources sources={obj.sources} footnote={DATA_FOOTNOTE} />
    </Shell>
  );
}

function DeepSkyInspector({ obj }: { obj: DeepSkyObject }) {
  return (
    <Shell id={obj.id} title={obj.name} subtitle={obj.classification}>
      <Section title="Facts">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {obj.facts.map(([label, value]) => (
            <Stat key={label} label={label} value={value} />
          ))}
        </dl>
      </Section>
      <Section title="About">
        <p className="text-[14px] leading-relaxed text-ink-dim">{obj.description}</p>
        {obj.visualNote && <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">{obj.visualNote}</p>}
      </Section>
      <Sources sources={obj.sources} />
    </Shell>
  );
}

const SPECTRAL_CLASS: Record<string, string> = {
  O: "Blue",
  B: "Blue-white",
  A: "White",
  F: "Yellow-white",
  G: "Yellow",
  K: "Orange",
  M: "Red",
};

function describeSpectrum(spect: string): string {
  const letter = spect.trim().match(/[OBAFGKM]/)?.[0];
  if (!letter) return spect || "Unknown";
  const lum = spect.match(/(Ia|Ib|III|II|IV|V)/)?.[0];
  const size = lum
    ? { Ia: "supergiant", Ib: "supergiant", II: "bright giant", III: "giant", IV: "subgiant", V: "main-sequence" }[lum]
    : "";
  return `${SPECTRAL_CLASS[letter]}${size ? ` ${size}` : ""} · ${spect}`;
}

function formatLuminosity(l: number): string {
  if (l >= 1000) return `${formatNumber(l, 0)} L☉`;
  if (l >= 1) return `${formatNumber(l, 1)} L☉`;
  return `${l.toPrecision(2)} L☉`;
}

function StarInspector({ id }: { id: string }) {
  const catalog = useStarStore((s) => s.catalog);
  const i = catalog?.indexById.get(id);
  if (!catalog || i === undefined) return null;
  const m = catalog.meta;
  const name = starName(catalog, i);
  const dLy = starDistanceLy(catalog, i);
  const absMag = catalog.absMag[i];
  const appMag = apparentMagnitude(absMag, dLy);
  const tempK = temperatureFromBV(catalog.colorIndex[i]);
  const ids = [
    m.proper[i] && m.designation[i],
    m.hip[i] ? `HIP ${m.hip[i]}` : "",
    m.hd[i] ? `HD ${m.hd[i]}` : "",
    m.gliese[i],
  ].filter(Boolean);
  const lightYear = new Date().getUTCFullYear() - Math.round(dLy);

  return (
    <Shell id={id} title={name} subtitle={describeSpectrum(m.spect[i])}>
      <Section title="Position">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label="From Sun" value={formatNumber(dLy, dLy < 100 ? 2 : 0)} unit="ly" />
          <Stat label="From Sun" value={formatNumber(dLy / LY_PER_PC, dLy < 100 ? 2 : 0)} unit="pc" />
        </dl>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
          {lightYear > 0
            ? `The light we see tonight left this star around ${lightYear < 1000 ? `AD ${lightYear}` : lightYear}.`
            : `The light we see tonight left this star about ${formatNumber(dLy, 0)} years ago.`}
        </p>
      </Section>
      <Section title="Brightness">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label="Apparent mag (Earth)" value={formatNumber(appMag, 2)} />
          <Stat label="Absolute mag" value={formatNumber(absMag, 2)} />
          <Stat label="Luminosity" value={formatLuminosity(luminositySolar(absMag))} />
          <Stat label="Surface temp (≈ from B−V)" value={`${formatNumber(Math.round(tempK / 50) * 50)} K`} />
        </dl>
        <p className="mt-3 text-[12px] text-ink-faint">
          {appMag <= 6 ? "Visible to the naked eye from a dark site." : appMag <= 9 ? "Needs binoculars." : "Needs a telescope."}
        </p>
      </Section>
      {ids.length > 0 && (
        <Section title="Catalogue IDs">
          <p className="text-[13px] text-ink-dim">{ids.join(" · ")}</p>
        </Section>
      )}
      <Sources sources={[{ ...STAR_SOURCE, freshness: "STATIC" }]} />
    </Shell>
  );
}

export function Inspector() {
  const selectedId = useSelectionStore((s) => s.selectedId);
  if (!selectedId) return null;
  const body = getObject(selectedId);
  if (body) return <BodyInspector key={body.id} obj={body} />;
  const deep = getDeepSky(selectedId);
  if (deep) return <DeepSkyInspector key={deep.id} obj={deep} />;
  if (isStarId(selectedId)) return <StarInspector key={selectedId} id={selectedId} />;
  return null;
}
