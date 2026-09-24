import type { ReactNode } from "react";
import type { DataFreshness, ExternalSource, SpaceObject } from "../domain/types";
import { getCatalogObject, getExoPlanet, physicsForStar, type CatalogObject, type PlanetRef } from "../data/catalog";
import {
  LY_PER_PC,
  STAR_SOURCE,
  apparentMagnitude,
  isStarId,
  luminositySolar,
  starDistanceLy,
  starName,
  useStarStore,
} from "../data/stars";
import { getObject } from "../data/solarSystem";
import { AU_KM } from "../astronomy/ephemeris";
import { selectObject, useSelectionStore } from "../state/selectionStore";
import { canVisitUpClose, focusObject, visitUpClose } from "../state/navigation";
import { useViewStore } from "../state/viewStore";
import { useTelemetry } from "./useTelemetry";
import { formatDays, formatDuration, formatLightTime, formatNumber, formatScientific } from "./format";
import { Icon } from "./Icon";

const FRESHNESS_LABEL: Record<DataFreshness, string> = {
  LIVE: "Live",
  RECENT: "Recent",
  ARCHIVED: "Archived",
  STATIC: "Reference",
  COMPUTED: "Computed",
};

const R_SUN_KM = 695_700;
const R_EARTH_KM = 6371;

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
      <dd className="mt-0.5 text-[14px] leading-snug text-ink tabular-nums">
        {value}
        {unit && <span className="ml-1 text-[12px] text-ink-dim">{unit}</span>}
      </dd>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>;
}

function Sources({ sources, footnote }: { sources: ExternalSource[]; footnote?: string }) {
  return (
    <Section title="Sources">
      <ul className="space-y-1.5">
        {sources.map((s) => (
          <li key={`${s.provider}-${s.name}`} className="flex items-baseline justify-between gap-3 text-[13px]">
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

function Shell({ id, title, subtitle, children, action }: { id: string; title: string; subtitle: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <aside
      key={id}
      aria-label={`${title} details`}
      className="panel thin-scroll animate-panel-in pointer-events-auto fixed inset-x-3 bottom-32 z-20 max-h-[40vh] overflow-y-auto md:inset-x-auto md:top-20 md:right-4 md:bottom-auto md:max-h-[calc(100vh-12rem)] md:w-[330px]"
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
      {action && <div className="px-4 pb-3.5">{action}</div>}
      {children}
    </aside>
  );
}

/** Primary action: open the true-scale close-up. Hidden when already inside it. */
function VisitButton({ id, label = "Visit up close — true scale" }: { id: string; label?: string }) {
  const inFocus = useViewStore((s) => s.level === "focus" && s.focusId === id);
  if (inFocus || !canVisitUpClose(id)) return null;
  return (
    <button type="button" className="visit-button" onClick={() => visitUpClose(id)}>
      <Icon name="focus" size={14} />
      {label}
    </button>
  );
}

/* ---------------------------------------------------------- Solar System */

function Telemetry({ obj }: { obj: SpaceObject }) {
  const t = useTelemetry(obj);
  if (!t) return null;
  const moon = obj.type === "moon";
  return (
    <Grid>
      {t.sunDistanceAu !== undefined && !moon && <Stat label="From Sun" value={formatNumber(t.sunDistanceAu, 3)} unit="AU" />}
      {t.earthDistanceAu !== undefined &&
        (moon ? (
          <Stat label="From Earth" value={formatNumber(t.earthDistanceAu * AU_KM, 0)} unit="km" />
        ) : (
          <Stat label="From Earth" value={formatNumber(t.earthDistanceAu, 3)} unit="AU" />
        ))}
      {t.lightTimeFromEarthS !== undefined && <Stat label="Light time from Earth" value={formatLightTime(t.lightTimeFromEarthS)} />}
      {t.orbitalSpeedKmS !== undefined && (
        <Stat label={moon ? "Speed around Earth" : "Orbital speed"} value={formatNumber(t.orbitalSpeedKmS, 2)} unit="km/s" />
      )}
    </Grid>
  );
}

function Physical({ obj }: { obj: SpaceObject }) {
  const p = obj.physical;
  const rows: [string, string, string?][] = [["Radius", formatNumber(p.meanRadiusKm, 0), "km"]];
  if (obj.type !== "star") rows.push(["Size vs Earth", `${formatNumber(p.meanRadiusKm / R_EARTH_KM, 2)} ×`]);
  if (p.massKg) rows.push(["Mass", formatScientific(p.massKg), "kg"]);
  if (p.surfaceGravityMs2) rows.push(["Gravity", formatNumber(p.surfaceGravityMs2, 1), "m/s²"]);
  if (p.rotationPeriodHours) rows.push([p.rotationPeriodHours < 0 ? "Day (retrograde)" : "Day length", formatDuration(p.rotationPeriodHours)]);
  if (p.orbitalPeriodDays) rows.push(["Year length", formatDays(p.orbitalPeriodDays)]);
  if (p.axialTiltDeg !== undefined) rows.push(["Axial tilt", `${formatNumber(p.axialTiltDeg, 1)}°`]);
  if (p.meanTemperatureK) rows.push([obj.type === "star" ? "Surface temp" : "Mean temp", `${formatNumber(p.meanTemperatureK - 273.15)} °C`]);
  return (
    <Grid>
      {rows.map(([label, value, unit]) => (
        <Stat key={label} label={label} value={value} unit={unit} />
      ))}
    </Grid>
  );
}

const DATA_FOOTNOTE = "Missions, observations and imagery will appear here once NASA/MAST data is connected.";

function BodyInspector({ obj }: { obj: SpaceObject }) {
  const parent = getObject(obj.parentId);
  const level = useViewStore((s) => s.level);
  return (
    <Shell
      id={obj.id}
      title={obj.name}
      subtitle={
        <>
          {obj.classification}
          {parent && ` · orbits ${parent.name}`}
        </>
      }
      action={obj.id === "sun" ? <VisitButton id="sun" label="Compare the Sun — true scale" /> : null}
    >
      {level === "system" && (
        <Section title="Position" note="at simulation time">
          <Telemetry obj={obj} />
        </Section>
      )}
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

/* ---------------------------------------------------------- catalogue */

function sizeLine(radiusSolar: number): string {
  if (radiusSolar < 0.02) return `${formatNumber((radiusSolar * R_SUN_KM) / R_EARTH_KM, 2)} × Earth`;
  return `${formatNumber(radiusSolar, radiusSolar < 10 ? 2 : 0)} × Sun`;
}

function CatalogInspector({ obj }: { obj: CatalogObject }) {
  const bh = obj.blackHole;
  const rsKm = bh ? 2.953 * bh.massSolar : 0;
  return (
    <Shell
      id={obj.id}
      title={obj.name}
      subtitle={`${obj.classification} · ${obj.distanceLabel}`}
      action={<VisitButton id={obj.id} label={obj.system ? "Visit the system — true scale" : undefined} />}
    >
      <Section title="Facts">
        <Grid>
          {obj.facts.map(([label, value]) => (
            <Stat key={label} label={label} value={value} />
          ))}
          {obj.star && <Stat label="Size" value={sizeLine(obj.star.radiusSolar)} />}
          {bh && <Stat label="Event horizon radius" value={rsKm < 1e6 ? `${formatNumber(rsKm, 0)} km` : `${formatNumber(rsKm / AU_KM, rsKm / AU_KM < 10 ? 2 : 0)} AU`} />}
        </Grid>
        {obj.star?.radiusNote && <p className="mt-2.5 text-[12px] text-ink-faint">{obj.star.radiusNote}</p>}
      </Section>
      {obj.system && (
        <Section title="Planets">
          <ul className="space-y-1">
            {obj.system.planets.map((p) => (
              <li key={p.id}>
                <button type="button" className="flex w-full items-baseline justify-between gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/[0.06]" onClick={() => focusObject(p.id)}>
                  <span className="text-[14px] text-ink">{p.name}</span>
                  <span className="text-[12px] text-ink-faint tabular-nums">{formatNumber(p.radiusEarth, 2)} R⊕ · {formatNumber(p.periodDays, p.periodDays < 10 ? 2 : 0)} d</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="About">
        <p className="text-[14px] leading-relaxed text-ink-dim">{obj.description}</p>
        {obj.visualNote && <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">{obj.visualNote}</p>}
        {obj.photo && (
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
            {obj.kind === "nebula"
              ? "A real photograph, placed at its true position and size and oriented as seen from Earth."
              : "Seen from Earth’s direction this is a real photograph at its true position, size and orientation; from other angles an illustrated 3D disk takes over."}
          </p>
        )}
        {(obj.kind === "galaxy" || obj.kind === "nebula") && !obj.visualNote && !obj.photo && (
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
            Position, size and orientation are real; its appearance is an illustration based on its type.
          </p>
        )}
      </Section>
      {obj.photo && (
        <Section title="Photograph">
          <p className="text-[13px] text-ink-dim">{obj.photo.telescope}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">Credit: {obj.photo.credit} · CC BY 4.0</p>
        </Section>
      )}
      <Sources sources={obj.photo ? [...obj.sources, obj.photo.release] : obj.sources} />
    </Shell>
  );
}

function PlanetInspector({ refr }: { refr: PlanetRef }) {
  const { planet: p, system } = refr;
  return (
    <Shell id={p.id} title={p.name} subtitle={`Exoplanet · orbits ${system.name.replace(" system", "")} · ${system.distanceLabel}`}>
      <Section title="World">
        <Grid>
          <Stat label="Radius" value={`${formatNumber(p.radiusEarth, 2)} × Earth${p.radiusEstimated ? " (est.)" : ""}`} />
          {p.massEarth !== undefined && <Stat label="Mass" value={`${formatNumber(p.massEarth, p.massEarth < 10 ? 2 : 0)} × Earth`} />}
          <Stat label="Year length" value={p.periodDays < 2 ? `${formatNumber(p.periodDays * 24, 1)} hours` : formatDays(p.periodDays)} />
          <Stat label="Orbit" value={`${formatNumber(p.semiMajorAxisAU, 4)} AU`} />
          {p.equilibriumTempK !== undefined && <Stat label="Temperature (equilibrium)" value={`${formatNumber(p.equilibriumTempK - 273)} °C`} />}
        </Grid>
      </Section>
      <Section title="About">
        <p className="text-[14px] leading-relaxed text-ink-dim">{p.description}</p>
        <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">Orbit size and period are measured; surface appearance is an illustration.</p>
      </Section>
      <Sources sources={system.sources} />
    </Shell>
  );
}

/* ---------------------------------------------------------- HYG stars */

function formatLuminosity(l: number): string {
  if (l >= 1000) return `${formatNumber(l, 0)} L☉`;
  if (l >= 1) return `${formatNumber(l, 1)} L☉`;
  return `${l.toPrecision(2)} L☉`;
}

const SPECTRAL_CLASS: Record<string, string> = { O: "Blue", B: "Blue-white", A: "White", F: "Yellow-white", G: "Yellow", K: "Orange", M: "Red" };

function describeSpectrum(spect: string): string {
  const letter = spect.trim().match(/[OBAFGKM]/)?.[0];
  if (!letter) return spect || "Star";
  const lum = spect.match(/(Ia|Ib|III|II|IV|V)/)?.[0];
  const size = lum ? { Ia: "supergiant", Ib: "supergiant", II: "bright giant", III: "giant", IV: "subgiant", V: "main-sequence" }[lum] : "";
  return `${SPECTRAL_CLASS[letter]}${size ? ` ${size}` : ""} · ${spect}`;
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
  const phys = physicsForStar(catalog, i, m.proper[i]);
  const ids = [m.proper[i] && m.designation[i], m.hip[i] ? `HIP ${m.hip[i]}` : "", m.hd[i] ? `HD ${m.hd[i]}` : "", m.gliese[i]].filter(Boolean);
  const lightYear = new Date().getUTCFullYear() - Math.round(dLy);

  return (
    <Shell id={id} title={name} subtitle={describeSpectrum(m.spect[i])} action={<VisitButton id={id} />}>
      <Section title="Position">
        <Grid>
          <Stat label="From Sun" value={formatNumber(dLy, dLy < 100 ? 2 : 0)} unit="ly" />
          <Stat label="From Sun" value={formatNumber(dLy / LY_PER_PC, dLy < 100 ? 2 : 0)} unit="pc" />
        </Grid>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
          {lightYear > 0
            ? `The light we see tonight left this star around ${lightYear < 1000 ? `AD ${lightYear}` : lightYear}.`
            : `The light we see tonight left this star about ${formatNumber(dLy, 0)} years ago.`}
        </p>
      </Section>
      <Section title="Star">
        <Grid>
          <Stat label="Size" value={sizeLine(phys.radiusSolar)} />
          <Stat label="Surface temp" value={`${formatNumber(Math.round(phys.temperatureK / 50) * 50)} K`} />
          <Stat label="Luminosity" value={formatLuminosity(phys.luminositySolar ?? luminositySolar(absMag))} />
          {phys.massSolar !== undefined && <Stat label="Mass" value={`${formatNumber(phys.massSolar, 2)} M☉`} />}
          <Stat label="Apparent mag (Earth)" value={formatNumber(appMag, 2)} />
          <Stat label="Absolute mag" value={formatNumber(absMag, 2)} />
        </Grid>
        <p className="mt-3 text-[12px] text-ink-faint">
          {phys.radiusNote ? `${phys.radiusNote}. ` : ""}
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
  const c = getCatalogObject(selectedId);
  if (c) return <CatalogInspector key={c.id} obj={c} />;
  const planet = getExoPlanet(selectedId);
  if (planet) return <PlanetInspector key={selectedId} refr={planet} />;
  if (isStarId(selectedId)) return <StarInspector key={selectedId} id={selectedId} />;
  return null;
}

