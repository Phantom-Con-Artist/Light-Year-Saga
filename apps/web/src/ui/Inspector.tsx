import { useRef, useState, type ReactNode } from "react";
import { useIsMobile } from "./useMedia";
import type { DataFreshness, ExternalSource, SpaceObject } from "../domain/types";
import { getCatalogObject, getExoPlanet, physicsForStar, type CatalogObject, type PlanetRef } from "../data/catalog";
import { LY_PER_PC, STAR_SOURCE, apparentMagnitude, isStarId, luminositySolar, starDistanceLy, starName, useStarStore } from "../data/stars";
import { getObject } from "../data/solarSystem";
import {
  CONSTELLATION_SOURCE,
  bestMonth,
  figureStars,
  getConstellation,
  hemisphereOf,
  useConstellationStore,
  visibleFrom,
  type Constellation,
} from "../data/constellations";
import { AU_KM } from "../astronomy/ephemeris";
import { selectObject, useSelectionStore } from "../state/selectionStore";
import { canVisitUpClose, focusObject, visitUpClose } from "../state/navigation";
import { useViewStore } from "../state/viewStore";
import { useTelemetry } from "./useTelemetry";
import { useTimeStore } from "../state/timeStore";
import { trackSpan } from "../astronomy/trajectories";
import { satelliteStatus } from "../astronomy/satellites";
import { FEATURES, FEATURE_KIND_LABEL, featuresOf, getFeature, type SurfaceFeature } from "../data/solar/features";
import { SATELLITE_GROUPS, SMALL_BODY_CLASSES } from "../data/solar/regions";
import { SATELLITES, SMALL_BODY_COUNTS } from "../data/solar/elements.gen";
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
  const mobile = useIsMobile();
  if (mobile)
    return (
      <Sheet key={id} title={title} subtitle={subtitle} action={action}>
        {children}
      </Sheet>
    );
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

/**
 * Phone inspector: a bottom sheet that starts as a small peek (title + main
 * action) so the view stays visible. It follows the finger: drag up to
 * expand, drag down to collapse, and drag down again to dismiss.
 */
function Sheet({ title, subtitle, children, action }: { title: string; subtitle: ReactNode; children: ReactNode; action?: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<{ y: number; t: number } | null>(null);
  const body = useRef<HTMLDivElement>(null);

  const onDown = (e: React.PointerEvent) => {
    // Inside the expanded list, a drag scrolls the list unless it is already at the top.
    if (expanded && body.current && body.current.contains(e.target as Node) && body.current.scrollTop > 0) return;
    start.current = { y: e.clientY, t: performance.now() };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dy) > 6 && !(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    setDrag(dy);
  };
  const onUp = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dy = e.clientY - start.current.y;
    const speed = dy / Math.max(performance.now() - start.current.t, 1); // px per ms
    start.current = null;
    setDrag(0);
    const tapped = Math.abs(dy) < 6;
    if (tapped) {
      // A tap on the header toggles; taps elsewhere belong to buttons and links.
      if ((e.target as HTMLElement).closest("[data-sheet-handle]")) setExpanded((x) => !x);
      return;
    }
    if (dy < -40 || speed < -0.5) setExpanded(true);
    else if (dy > 60 || speed > 0.5) {
      if (expanded) setExpanded(false);
      else selectObject(null);
    }
  };

  const lift = expanded ? Math.max(drag, 0) : drag;
  return (
    <aside
      aria-label={`${title} details`}
      className="panel animate-panel-in safe-bottom pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex touch-none flex-col !rounded-b-none"
      style={{
        maxHeight: expanded ? "72dvh" : undefined,
        transform: lift ? `translateY(${Math.max(lift, -120)}px)` : undefined,
        transition: start.current ? "none" : "transform 0.25s ease, max-height 0.25s ease",
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        start.current = null;
        setDrag(0);
      }}
    >
      <div data-sheet-handle className="shrink-0 cursor-grab px-4 pt-2 pb-3">
        <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-white/25" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-semibold tracking-tight text-ink">{title}</h2>
            <p className="mt-0.5 truncate text-[13px] text-ink-dim">{subtitle}</p>
          </div>
          <button type="button" className="btn -mt-0.5 -mr-1.5 !h-8" onClick={() => selectObject(null)} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        </div>
        {!expanded && <p className="mt-1.5 text-[11px] text-ink-faint">Swipe up for details</p>}
      </div>
      {action && <div className="shrink-0 px-4 pb-3">{action}</div>}
      {expanded && (
        <div ref={body} className="thin-scroll min-h-0 flex-1 touch-pan-y overflow-y-auto">
          {children}
        </div>
      )}
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
  if (!t.present) return <NotPresent obj={obj} />;
  const around = t.parent;
  return (
    <Grid>
      {around && <Stat label={`From ${around.name}'s centre`} value={formatNumber(around.distanceKm, 0)} unit="km" />}
      {around && obj.ephemeris.kind === "tle" && <Stat label="Altitude" value={formatNumber(around.altitudeKm, 0)} unit="km" />}
      {t.sunDistanceAu !== undefined && !around && <Stat label="From Sun" value={formatNumber(t.sunDistanceAu, t.sunDistanceAu < 10 ? 3 : 1)} unit="AU" />}
      {t.earthDistanceAu !== undefined &&
        obj.parentId !== "earth" &&
        (t.earthDistanceAu < 0.01 ? (
          <Stat label="From Earth" value={formatNumber(t.earthDistanceAu * AU_KM, 0)} unit="km" />
        ) : (
          <Stat label="From Earth" value={formatNumber(t.earthDistanceAu, t.earthDistanceAu < 10 ? 3 : 1)} unit="AU" />
        ))}
      {t.lightTimeFromEarthS !== undefined && obj.parentId !== "earth" && <Stat label="Light time from Earth" value={formatLightTime(t.lightTimeFromEarthS)} />}
      {t.orbitalSpeedKmS !== undefined && (
        <Stat label={around ? `Speed around ${around.name}` : "Speed around the Sun"} value={formatNumber(t.orbitalSpeedKmS, 2)} unit="km/s" />
      )}
    </Grid>
  );
}

/** Before launch, after the end of a mission, or outside the data's range. */
function NotPresent({ obj }: { obj: SpaceObject }) {
  const ms = useTimeStore((s) => s.timeMs);
  const from = obj.active?.from ?? (obj.ephemeris.kind === "trajectory" ? spanIso(obj.ephemeris.track, "start") : undefined);
  const to = obj.active?.to ?? (obj.ephemeris.kind === "trajectory" ? spanIso(obj.ephemeris.track, "end") : undefined);
  const before = !!from && ms < Date.parse(from);
  const target = before ? from : to;
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[13px] text-ink-dim">{before ? `Not launched yet at this date (from ${from}).` : `Not tracked at this date (data ends ${to}).`}</p>
      {target && (
        <button type="button" className="btn shrink-0" onClick={() => useTimeStore.getState().jumpTo(Date.parse(target) + (before ? 86_400_000 : -86_400_000))}>
          Go there
        </button>
      )}
    </div>
  );
}

function spanIso(track: string, which: "start" | "end"): string | undefined {
  const span = trackSpan(track);
  if (!span) return undefined;
  return new Date(((which === "start" ? span.startJd : span.endJd) - 2440587.5) * 86_400_000).toISOString().slice(0, 10);
}

/** Satellites: how fresh the orbit is. */
function SatelliteStatus({ id }: { id: string }) {
  const ms = useTimeStore((s) => Math.floor(s.timeMs / 60_000) * 60_000);
  const st = satelliteStatus(id, ms);
  if (!st) return null;
  return (
    <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
      Orbit from a CelesTrak element set of {new Date(st.epochMs).toISOString().slice(0, 10)} ({st.live ? "fetched live" : "bundled"}), propagated with SGP4.
      {!st.precise && " This date is far from the element set, so the position along the orbit is approximate; the orbit's shape and tilt stay right."}
    </p>
  );
}

function Moments({ obj }: { obj: SpaceObject }) {
  if (!obj.moments?.length) return null;
  return (
    <Section title="Jump to" note="sets the clock">
      <ul className="-mx-1.5 space-y-0.5">
        {obj.moments.map((m) => (
          <li key={m.label + m.date}>
            <button
              type="button"
              className="flex w-full items-baseline justify-between gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/[0.06]"
              onClick={() => {
                useTimeStore.getState().jumpTo(Date.parse(m.date), obj.type === "comet" ? 4 : 2);
                focusObject(obj.id);
              }}
            >
              <span className="text-[13.5px] text-ink">{m.label}</span>
              <span className="shrink-0 text-[12px] text-ink-faint tabular-nums">{m.date}</span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <Grid>
      {rows.map(([label, value]) => (
        <Stat key={label} label={label} value={value} />
      ))}
    </Grid>
  );
}

function Physical({ obj }: { obj: SpaceObject }) {
  const p = obj.physical;
  const small = p.meanRadiusKm < 5;
  const rows: [string, string, string?][] = [small ? ["Radius", formatNumber(p.meanRadiusKm * 1000, 0), "m"] : ["Radius", formatNumber(p.meanRadiusKm, 0), "km"]];
  if (obj.type !== "star" && !small) rows.push(["Size vs Earth", `${formatNumber(p.meanRadiusKm / R_EARTH_KM, p.meanRadiusKm < 300 ? 3 : 2)} ×`]);
  if (p.tidallyLocked && obj.type === "moon") rows.push(["Rotation", "Tidally locked"]);
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

const CRAFT_TYPES = new Set(["spacecraft", "space-station", "telescope"]);

function BodyInspector({ obj }: { obj: SpaceObject }) {
  const parent = getObject(obj.parentId);
  const level = useViewStore((s) => s.level);
  if (obj.type === "region") return <RegionInspector obj={obj} />;
  const craft = CRAFT_TYPES.has(obj.type);
  const features = featuresOf(obj.id);
  return (
    <Shell
      id={obj.id}
      title={obj.name}
      subtitle={
        <>
          {obj.classification}
          {parent && parent.id !== "sun" && ` · ${craft ? "around" : "orbits"} ${parent.name}`}
        </>
      }
      action={obj.id === "sun" ? <VisitButton id="sun" label="Compare the Sun — true scale" /> : null}
    >
      {level === "system" && (
        <Section title="Position" note="at simulation time">
          <Telemetry obj={obj} />
          {obj.ephemeris.kind === "tle" && <SatelliteStatus id={obj.ephemeris.satellite} />}
        </Section>
      )}
      {!craft && (
        <Section title="Physical">
          <Physical obj={obj} />
        </Section>
      )}
      {obj.facts && obj.facts.length > 0 && (
        <Section title={craft ? "Mission" : "Facts"}>
          <Facts rows={obj.facts} />
        </Section>
      )}
      <Moments obj={obj} />
      {features.length > 0 && (
        <Section title="Surface features">
          <ul className="-mx-1.5 space-y-0.5">
            {features.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/[0.06]"
                  onClick={() => selectObject(f.id)}
                >
                  <span className="text-[13.5px] text-ink">{f.name}</span>
                  <span className="shrink-0 text-[12px] text-ink-faint">{featureDetail(f)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="About">
        <p className="text-[14px] leading-relaxed text-ink-dim">{obj.description}</p>
      </Section>
      <Sources sources={obj.sources} footnote={obj.type === "planet" ? DATA_FOOTNOTE : undefined} />
    </Shell>
  );
}

function featureDetail(f: SurfaceFeature): string {
  if (f.heightKm !== undefined) return `${f.heightKm > 0 ? "" : "−"}${formatNumber(Math.abs(f.heightKm), 1)} km`;
  if (f.sizeKm) return `${formatNumber(f.sizeKm)} km across`;
  return FEATURE_KIND_LABEL[f.kind];
}

/* ---------------------------------------------------------- features & regions */

function FeatureInspector({ f }: { f: SurfaceFeature }) {
  const body = getObject(f.bodyId)!;
  const peaks = FEATURES.filter((x) => (x.heightKm ?? 0) > 0).sort((a, b) => b.heightKm! - a.heightKm!);
  const max = peaks[0]?.heightKm ?? 1;
  const rows: [string, string][] = [
    ["Type", FEATURE_KIND_LABEL[f.kind]],
    ["Location", `${formatNumber(Math.abs(f.lat), 1)}° ${f.lat >= 0 ? "N" : "S"}, ${formatNumber(((f.lon % 360) + 360) % 360, 1)}° E`],
  ];
  if (f.heightKm !== undefined) rows.push([f.heightKm > 0 ? "Height" : "Depth", `${formatNumber(Math.abs(f.heightKm), 2)} km`]);
  if (f.sizeKm) rows.push(["Size", `${formatNumber(f.sizeKm)} km`]);
  if (f.heightKm && f.heightKm > 0 && f.id !== "feature-everest") rows.push(["vs Everest", `${formatNumber(f.heightKm / 8.849, 1)} ×`]);
  return (
    <Shell id={f.id} title={f.name} subtitle={`${FEATURE_KIND_LABEL[f.kind]} on ${body.name}`}>
      <Section title="Facts">
        <Facts rows={rows} />
      </Section>
      <Section title="About">
        <p className="text-[14px] leading-relaxed text-ink-dim">{f.description}</p>
        <button type="button" className="btn mt-3" onClick={() => selectObject(body.id)}>
          About {body.name}
        </button>
      </Section>
      {f.heightKm !== undefined && f.heightKm > 0 && (
        <Section title="Tallest peaks in the Solar System" note="relief, km">
          <ul className="space-y-1.5">
            {peaks.map((p) => (
              <li key={p.id}>
                <button type="button" className="group block w-full text-left" onClick={() => selectObject(p.id)}>
                  <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                    <span className={p.id === f.id ? "text-ink" : "text-ink-dim group-hover:text-ink"}>
                      {p.name} <span className="text-ink-faint">· {getObject(p.bodyId)?.name}</span>
                    </span>
                    <span className="text-ink-faint tabular-nums">{formatNumber(p.heightKm!, 1)}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full" style={{ width: `${(p.heightKm! / max) * 100}%`, background: p.id === f.id ? "#ffc861" : "#8a94a6" }} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Sources sources={body.sources} />
    </Shell>
  );
}

function Legend({ items }: { items: { label: string; color: string; count?: number }[] }) {
  return (
    <ul className="space-y-1">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2 text-[12.5px] text-ink-dim">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: it.color }} />
          <span className="truncate">{it.label}</span>
          {it.count !== undefined && <span className="ml-auto text-ink-faint tabular-nums">{formatNumber(it.count)}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Solar-wind ram pressure falls as 1/r²; the termination shock sits where it meets the interstellar pressure. */
function PressureChart() {
  const W = 290;
  const H = 120;
  const r0 = 0.3;
  const r1 = 300;
  const p0 = 1e-5;
  const p1 = 20;
  const x = (r: number) => (Math.log10(r / r0) / Math.log10(r1 / r0)) * W;
  const y = (p: number) => H - (Math.log10(p / p0) / Math.log10(p1 / p0)) * H;
  // nPa: 5 protons/cm³ at 400 km/s at 1 AU.
  const ram = (r: number) => 1.34 / (r * r);
  const ism = 1.65e-4;
  const pts = [0.3, 1, 3, 10, 30, 90].map((r) => `${x(r).toFixed(1)},${y(ram(r)).toFixed(1)}`).join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label="Solar wind pressure against distance from the Sun">
        <line x1={0} x2={W} y1={y(ism)} y2={y(ism)} stroke="#8fb8ff" strokeDasharray="3 3" strokeWidth={1} />
        <polyline points={pts} fill="none" stroke="#ffc861" strokeWidth={1.5} />
        <line x1={x(90)} x2={x(90)} y1={0} y2={H} stroke="#ffb070" strokeWidth={1} opacity={0.6} />
        <circle cx={x(1)} cy={y(ram(1))} r={2.5} fill="#5fb4ff" />
        <text x={x(1) + 5} y={y(ram(1)) - 4} fill="#9aa3b2" fontSize={9}>
          Earth
        </text>
        <text x={x(90) - 4} y={10} fill="#ffb070" fontSize={9} textAnchor="end">
          termination shock
        </text>
        <text x={4} y={y(ism) - 4} fill="#8fb8ff" fontSize={9}>
          interstellar pressure
        </text>
        {[1, 10, 100].map((r) => (
          <text key={r} x={x(r)} y={H + 12} fill="#6b7383" fontSize={9} textAnchor="middle">
            {r} AU
          </text>
        ))}
      </svg>
      <figcaption className="mt-1 text-[12px] leading-relaxed text-ink-faint">
        The wind's push (ρv²) falls with the square of distance. Near 90 AU it has dropped to the pressure of the interstellar gas, and the wind is shocked down to a crawl.
      </figcaption>
    </figure>
  );
}

function RegionInspector({ obj }: { obj: SpaceObject }) {
  const counts = SMALL_BODY_COUNTS.byClass;
  const classes = (ids: number[]) => ids.map((i) => ({ ...SMALL_BODY_CLASSES[i], count: counts[i] }));
  return (
    <Shell id={obj.id} title={obj.name} subtitle={obj.classification}>
      {obj.facts && (
        <Section title="Facts">
          <Facts rows={obj.facts} />
        </Section>
      )}
      {obj.id === "asteroid-belt" && (
        <Section title="Colour key" note="known objects">
          <Legend items={classes([0, 1, 2, 3, 4, 5])} />
        </Section>
      )}
      {obj.id === "kuiper-belt" && (
        <Section title="Colour key" note="known objects">
          <Legend items={classes([6, 7, 8, 9, 10])} />
        </Section>
      )}
      {obj.id === "earth-satellites" && (
        <Section title="Colour key">
          <Legend items={SATELLITE_GROUPS.map((g, i) => ({ ...g, count: SATELLITES.counts[i] }))} />
        </Section>
      )}
      {obj.id === "heliosphere" && (
        <Section title="Pressure balance">
          <PressureChart />
        </Section>
      )}
      <Section title="About">
        <p className="text-[14px] leading-relaxed text-ink-dim">{obj.description}</p>
      </Section>
      <Sources sources={obj.sources} />
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
          {bh && (
            <Stat
              label="Event horizon radius"
              value={rsKm < 1e6 ? `${formatNumber(rsKm, 0)} km` : `${formatNumber(rsKm / AU_KM, rsKm / AU_KM < 10 ? 2 : 0)} AU`}
            />
          )}
        </Grid>
        {obj.star?.radiusNote && <p className="mt-2.5 text-[12px] text-ink-faint">{obj.star.radiusNote}</p>}
      </Section>
      {obj.system && (
        <Section title="Planets">
          <ul className="space-y-1">
            {obj.system.planets.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/[0.06]"
                  onClick={() => focusObject(p.id)}
                >
                  <span className="text-[14px] text-ink">{p.name}</span>
                  <span className="text-[12px] text-ink-faint tabular-nums">
                    {formatNumber(p.radiusEarth, 2)} R⊕ · {formatNumber(p.periodDays, p.periodDays < 10 ? 2 : 0)} d
                  </span>
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

/* ------------------------------------------------------ constellations */

function ConstellationInspector({ c }: { c: Constellation }) {
  const catalog = useStarStore((s) => s.catalog);
  const geometry = useConstellationStore((s) => s.geometry);
  const stars = catalog && geometry ? figureStars(geometry, catalog, c.id).slice(0, 8) : [];
  const level = useViewStore((s) => s.level);
  const raH = Math.floor(c.ra / 15);
  const raM = Math.round((c.ra / 15 - raH) * 60);

  return (
    <Shell
      id={c.key}
      title={c.name}
      subtitle={`${c.zodiac ? "Zodiac constellation" : "Constellation"} · ${c.meaning}`}
      action={
        level !== "sky" ? (
          <button type="button" className="visit-button" onClick={() => useViewStore.getState().goTo("sky", { then: () => selectObject(c.key) })}>
            <Icon name="constellation" size={15} /> See it in the night sky
          </button>
        ) : undefined
      }
    >
      <Section title="In the sky">
        <Grid>
          <Stat label="Highest at midnight" value={bestMonth(c.ra)} />
          <Stat label="Hemisphere" value={hemisphereOf(c.dec)} />
          <Stat label="Visible from" value={visibleFrom(c.dec)} />
          <Stat label="Position" value={`${raH}h ${String(raM).padStart(2, "0")}m, ${c.dec > 0 ? "+" : ""}${Math.round(c.dec)}°`} />
          <Stat label="Abbreviation" value={c.id} />
          <Stat label="Star names use" value={c.genitive} />
        </Grid>
      </Section>
      {stars.length > 0 && catalog && (
        <Section title="Stars of the figure" note="brightest first">
          <ul className="space-y-0.5">
            {stars.map((i) => {
              const d = starDistanceLy(catalog, i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    className="flex w-full items-baseline justify-between gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/[0.06]"
                    onClick={() => focusObject(`hyg-${catalog.meta.hyg[i]}`)}
                  >
                    <span className="truncate text-[14px] text-ink">{starName(catalog, i)}</span>
                    <span className="shrink-0 text-[12px] text-ink-faint tabular-nums">
                      mag {formatNumber(apparentMagnitude(catalog.absMag[i], d), 1)} · {formatNumber(d, d < 100 ? 1 : 0)} ly
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
            The pattern is only a line of sight: its stars sit at very different distances and would not look like this from anywhere else.
          </p>
        </Section>
      )}
      <Section title="About">
        {c.story && <p className="text-[14px] leading-relaxed text-ink-dim">{c.story}</p>}
        <p className={`${c.story ? "mt-2.5 text-[12px] text-ink-faint" : "text-[14px] text-ink-dim"} leading-relaxed`}>{c.origin}</p>
      </Section>
      <Sources
        sources={[
          { ...CONSTELLATION_SOURCE, freshness: "STATIC" },
          { ...STAR_SOURCE, freshness: "STATIC" },
        ]}
      />
    </Shell>
  );
}

export function Inspector() {
  const selectedId = useSelectionStore((s) => s.selectedId);
  if (!selectedId) return null;
  const body = getObject(selectedId);
  if (body) return <BodyInspector key={body.id} obj={body} />;
  const feature = getFeature(selectedId);
  if (feature) return <FeatureInspector key={feature.id} f={feature} />;
  const c = getCatalogObject(selectedId);
  if (c) return <CatalogInspector key={c.id} obj={c} />;
  const planet = getExoPlanet(selectedId);
  if (planet) return <PlanetInspector key={selectedId} refr={planet} />;
  if (isStarId(selectedId)) return <StarInspector key={selectedId} id={selectedId} />;
  const con = getConstellation(selectedId);
  if (con) return <ConstellationInspector key={con.key} c={con} />;
  return null;
}
