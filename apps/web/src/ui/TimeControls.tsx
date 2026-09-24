import { RATE_STEPS, useTimeStore } from "../state/timeStore";
import { formatUtc } from "./format";
import { Icon } from "./Icon";
import { useIsMobile } from "./useMedia";
import { useSelectionStore } from "../state/selectionStore";

function ClockReadout() {
  const timeMs = useTimeStore((s) => s.timeMs);
  const { date, time } = formatUtc(timeMs);
  return (
    <div className="flex items-baseline gap-2 tabular-nums">
      <span className="text-[13px] text-ink-dim">{date}</span>
      <span className="text-[15px] font-medium text-ink">{time}</span>
      <span className="text-[11px] text-ink-faint">UTC</span>
    </div>
  );
}

function MobileClock() {
  const timeMs = useTimeStore((s) => s.timeMs);
  const { date, time } = formatUtc(timeMs);
  return (
    <div className="flex flex-col px-1.5 leading-tight tabular-nums">
      <span className="text-[13px] font-medium text-ink">{time.slice(0, 5)}</span>
      <span className="text-[10px] text-ink-faint">{date}</span>
    </div>
  );
}

export function TimeControls() {
  const paused = useTimeStore((s) => s.paused);
  const rateIndex = useTimeStore((s) => s.rateIndex);
  const direction = useTimeStore((s) => s.direction);
  const { togglePause, faster, slower, toggleDirection, resetToNow } = useTimeStore.getState();
  const rateLabel = RATE_STEPS[rateIndex].label;
  const mobile = useIsMobile();
  const selected = useSelectionStore((s) => s.selectedId !== null);

  if (mobile) {
    // The inspector sheet owns the bottom edge while it is open.
    if (selected) return null;
    return (
      <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-2">
        <div className="panel animate-fade-in pointer-events-auto flex items-center gap-0.5 px-1.5 py-1">
          <MobileClock />
          <button type="button" className="btn !h-9 !px-2.5" onClick={slower} disabled={rateIndex === 0} aria-label="Slower">
            <Icon name="slower" size={14} />
          </button>
          <button type="button" className="btn !h-9 !px-2.5" onClick={togglePause} aria-label={paused ? "Play" : "Pause"}>
            <Icon name={paused ? "play" : "pause"} size={14} />
          </button>
          <button type="button" className="btn !h-9 !px-2.5" onClick={faster} disabled={rateIndex === RATE_STEPS.length - 1} aria-label="Faster">
            <Icon name="faster" size={14} />
          </button>
          <span className="min-w-[4.5rem] text-center text-[11px] text-ink-dim tabular-nums">
            {direction < 0 ? "−" : ""}
            {rateLabel}
          </span>
          <button type="button" className="btn !h-9 !px-2.5 !text-[13px]" onClick={resetToNow}>
            Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center p-3 md:p-4">
      <div className="panel animate-fade-in pointer-events-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-3 py-2">
        <ClockReadout />
        <div className="flex items-center gap-0.5">
          <button type="button" className="btn" data-on={direction < 0} onClick={toggleDirection} title="Reverse time (R)">
            <Icon name="reverse" size={15} />
          </button>
          <button type="button" className="btn" onClick={slower} disabled={rateIndex === 0} title="Slower ( [ )">
            <Icon name="slower" size={14} />
          </button>
          <button type="button" className="btn" onClick={togglePause} title="Play / pause (Space)">
            <Icon name={paused ? "play" : "pause"} size={14} />
          </button>
          <button type="button" className="btn" onClick={faster} disabled={rateIndex === RATE_STEPS.length - 1} title="Faster ( ] )">
            <Icon name="faster" size={14} />
          </button>
          <span className="w-28 text-center text-[12px] text-ink-dim tabular-nums">
            {direction < 0 ? "−" : ""}
            {rateLabel}
          </span>
          <button type="button" className="btn" onClick={resetToNow} title="Jump to now, real time (N)">
            Now
          </button>
        </div>
      </div>
    </div>
  );
}
