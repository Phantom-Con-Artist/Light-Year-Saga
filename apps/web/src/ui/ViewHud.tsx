import { resolveCloseUp, scaleSentence, subjectRadius, formatKm, R_SUN_KM, R_EARTH_IN_RSUN } from "../data/closeUp";
import { SCALE_LINEUP } from "../data/scaleLineup";
import { useViewStore } from "../state/viewStore";
import { useFocusStore } from "../state/focusStore";
import { useScaleStore } from "../state/scaleStore";
import { leaveSpecialView } from "../state/navigation";
import { formatNumber } from "./format";
import { Icon } from "./Icon";
import { useIsMobile, useIsTouch } from "./useMedia";
import { useSelectionStore } from "../state/selectionStore";

function formatDistance(level: "interstellar" | "cosmic", d: number): string {
  if (level === "interstellar") {
    if (d < 0.1) return `${formatNumber(d * 63_241, 0)} AU`;
    if (d < 10) return `${formatNumber(d, 2)} ly`;
    return `${formatNumber(d, 0)} ly`;
  }
  if (d < 1) return `${formatNumber(d * 1e6, 0)} ly`;
  if (d < 1000) return `${formatNumber(d, d < 10 ? 2 : 0)} million ly`;
  return `${formatNumber(d / 1000, 2)} billion ly`;
}

function hint(level: "interstellar" | "cosmic", d: number, touch: boolean): string {
  const [zoomIn, zoomOut] = touch ? ["Spread", "Pinch"] : ["Scroll in", "Scroll out"];
  if (level === "interstellar") {
    if (d < 0.5) return `${zoomIn} on the Sun to return to the Solar System`;
    if (d < 5_000) return `${zoomOut} to see the whole galaxy`;
    if (d < 300_000) return `Keep ${touch ? "pinching" : "scrolling out"} to leave the Milky Way`;
    return `${zoomOut} to enter the Universe view`;
  }
  if (d < 1) return `${zoomIn} on the Milky Way to return to the stars`;
  return "Dots are 43,415 real galaxies (2MASS Redshift Survey)";
}

/** Where the camera is (interstellar / universe views). */
export function DistanceReadout() {
  const level = useViewStore((s) => s.level);
  const d = useViewStore((s) => s.cameraDistance);
  const mobile = useIsMobile();
  const touch = useIsTouch();
  const selected = useSelectionStore((s) => s.selectedId !== null);
  if (level !== "interstellar" && level !== "cosmic") return null;
  if (mobile) {
    if (selected) return null;
    return (
      <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-0.5 px-3 text-center">
        <div className="rounded-full bg-black/45 px-3 py-1 text-[12px] text-ink-dim tabular-nums">
          <span className="font-medium text-ink">{formatDistance(level, d)}</span> from the Sun
        </div>
        <div className="text-[10.5px] text-ink-faint [text-shadow:0_1px_2px_#000]">{hint(level, d, touch)}</div>
      </div>
    );
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center p-3 md:p-4">
      <div className="panel animate-fade-in flex flex-col items-center gap-0.5 px-4 py-2">
        <div className="text-[13px] text-ink-dim tabular-nums">
          <span className="font-medium text-ink">{formatDistance(level, d)}</span> from the Sun
        </div>
        <div className="text-[11px] text-ink-faint">{hint(level, d, touch)}</div>
      </div>
    </div>
  );
}

/** Title card for the true-scale close-up view. */
export function FocusHud() {
  const focusId = useViewStore((s) => s.focusId);
  const enlarge = useFocusStore((s) => s.enlargePlanets);
  const mobile = useIsMobile();
  const subject = resolveCloseUp(focusId);
  if (!subject) return null;
  const r = subjectRadius(subject);
  const km = r * R_SUN_KM;
  const sizeLabel =
    subject.kind === "black-hole"
      ? `Event horizon ${formatKm(km * 2)} across`
      : subject.kind === "system"
        ? `${subject.system.planets.length} planets · star ${formatNumber(r, 2)} × Sun`
        : r < R_EARTH_IN_RSUN * 3
          ? `${formatKm(km * 2)} across · ${formatNumber(r / R_EARTH_IN_RSUN, 2)} × Earth`
          : `${formatNumber(r, r < 10 ? 2 : 0)} × the Sun's radius · ${formatKm(km * 2)} across`;

  if (mobile) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-[3.25rem] z-10 flex justify-center px-2">
        <div className="panel animate-panel-in pointer-events-auto flex w-full items-start gap-2 px-3 py-2">
          <button type="button" className="btn -ml-1 !h-8 !px-2" onClick={leaveSpecialView} aria-label="Back">
            <Icon name="back" size={14} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[15px] font-semibold text-ink">{subject.name}</span>
              <span className="truncate text-[11px] text-ink-faint tabular-nums">{sizeLabel}</span>
            </div>
            <p className="mt-0.5 text-[12px] leading-snug text-ink-dim">{scaleSentence(subject)}</p>
          </div>
          {subject.kind === "system" && (
            <button type="button" className="btn !h-8 !px-2 !text-[12px]" data-on={enlarge} onClick={() => useFocusStore.getState().toggleEnlarge()}>
              {enlarge ? "Enlarged" : "True scale"}
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-10 flex justify-center px-3">
      <div className="panel animate-panel-in pointer-events-auto flex max-w-[560px] flex-col items-center gap-1 px-5 py-3 text-center">
        <div className="label-caps">True-scale close-up</div>
        <div className="text-[18px] font-semibold text-ink">{subject.name}</div>
        <div className="text-[13px] text-ink-dim tabular-nums">{sizeLabel}</div>
        <p className="text-[13px] leading-relaxed text-ink">{scaleSentence(subject)}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <button type="button" className="btn" onClick={leaveSpecialView}>
            <Icon name="back" size={14} /> Back
          </button>
          {subject.kind === "system" && (
            <button type="button" className="btn" data-on={enlarge} onClick={() => useFocusStore.getState().toggleEnlarge()}>
              {enlarge ? "Planets enlarged" : "True-scale planets"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Controls and readout for the size line-up. */
export function ScaleHud() {
  const index = useScaleStore((s) => s.index);
  const entry = SCALE_LINEUP[index];
  const rSun = entry.radiusKm / R_SUN_KM;
  const rEarth = entry.radiusKm / 6371;
  const what = entry.kind === "black-hole" ? "Event horizon radius" : entry.kind === "orbit" ? "Orbital radius" : "Radius";
  const mobile = useIsMobile();
  const touch = useIsTouch();

  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-2 pt-3 md:p-4">
      <div className={`panel animate-fade-in pointer-events-auto flex w-full max-w-[620px] flex-col ${mobile ? "gap-1.5 px-3 py-2.5" : "gap-2 px-5 py-3"}`}>
        <div className="flex items-baseline justify-between gap-3">
          <div className={`${mobile ? "text-[16px]" : "text-[20px]"} font-semibold text-ink`}>{entry.name}</div>
          <div className="text-[12px] text-ink-faint tabular-nums">
            {index + 1} / {SCALE_LINEUP.length}
          </div>
        </div>
        <div className="text-[13px] text-ink-dim tabular-nums">
          {what}: {formatKm(entry.radiusKm)} ·{" "}
          {rSun >= 0.5 ? `${formatNumber(rSun, rSun < 10 ? 2 : 0)} × Sun` : `${formatNumber(rEarth, rEarth < 10 ? 2 : 0)} × Earth`}
        </div>
        <p className={mobile ? "line-clamp-3 text-[12.5px] leading-snug text-ink" : "text-[13.5px] leading-relaxed text-ink"}>{entry.blurb}</p>
        <div className="flex items-center gap-2">
          <button type="button" className="btn" onClick={() => useScaleStore.getState().step(-1)} disabled={index === 0} aria-label="Smaller">
            <Icon name="prev" size={14} />
          </button>
          <input
            type="range"
            min={0}
            max={SCALE_LINEUP.length - 1}
            step={1}
            value={index}
            onChange={(e) => useScaleStore.getState().setTarget(Number(e.target.value))}
            className="scale-slider flex-1"
            aria-label="Position in size line-up"
          />
          <button type="button" className="btn" onClick={() => useScaleStore.getState().step(1)} disabled={index === SCALE_LINEUP.length - 1} aria-label="Bigger">
            <Icon name="next" size={14} />
          </button>
          <button type="button" className="btn" onClick={leaveSpecialView} aria-label="Exit">
            <Icon name="back" size={14} />
            {!mobile && " Exit"}
          </button>
        </div>
        <div className="text-center text-[11px] text-ink-faint">
          {touch ? "Pinch to grow · drag to look around" : "Scroll to grow · drag to look around · ← → to step"}
        </div>
      </div>
    </div>
  );
}
