import { RATE_STEPS, useTimeStore } from "../state/timeStore";
import { formatUtc } from "./format";
import { Icon } from "./Icon";

function ClockReadout() {
  const timeMs = useTimeStore((s) => s.timeMs);
  const { date, time } = formatUtc(timeMs);
  return (
    <div className="flex items-baseline gap-3 font-mono tabular-nums">
      <span className="text-[13px] tracking-[0.12em] text-ink-dim">{date}</span>
      <span className="text-[22px] leading-none tracking-[0.08em] text-ink" style={{ textShadow: "0 0 18px rgb(95 208 255 / 0.35)" }}>
        {time}
      </span>
      <span className="text-[10px] tracking-[0.2em] text-hud">UTC</span>
    </div>
  );
}

export function TimeControls() {
  const paused = useTimeStore((s) => s.paused);
  const rateIndex = useTimeStore((s) => s.rateIndex);
  const direction = useTimeStore((s) => s.direction);
  const { togglePause, faster, slower, toggleDirection, resetToNow } = useTimeStore.getState();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center p-3 md:p-5">
      <div className="hud-panel animate-fade-in pointer-events-auto flex flex-col items-center gap-3 px-5 pt-3.5 pb-4 md:px-7">
        <div className="flex w-full items-center justify-between gap-6">
          <span className="hud-kicker">Chronometer</span>
          <span className={`font-mono text-[10px] tracking-[0.22em] ${direction < 0 ? "text-hud-amber" : "text-hud"}`}>
            {direction < 0 ? "◀ " : ""}
            {RATE_STEPS[rateIndex].label}
            {direction > 0 ? " ▶" : ""}
          </span>
        </div>
        <ClockReadout />
        <div className="flex items-center gap-1.5">
          <button type="button" className="hud-button" data-on={direction < 0} onClick={toggleDirection} title="Reverse time (R)">
            <Icon name="reverse" />
          </button>
          <button type="button" className="hud-button" onClick={slower} disabled={rateIndex === 0} title="Slower ( [ )">
            <Icon name="slower" />
          </button>
          <button type="button" className="hud-button !min-w-12" data-on={!paused} onClick={togglePause} title="Play / pause (Space)">
            <Icon name={paused ? "play" : "pause"} />
          </button>
          <button type="button" className="hud-button" onClick={faster} disabled={rateIndex === RATE_STEPS.length - 1} title="Faster ( ] )">
            <Icon name="faster" />
          </button>
          <button type="button" className="hud-button" onClick={resetToNow} title="Jump to now, real time (N)">
            <Icon name="now" />
            NOW
          </button>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {RATE_STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-[3px] w-5 transition-colors ${i <= rateIndex ? (direction < 0 ? "bg-hud-amber" : "bg-hud") : "bg-ink-faint/40"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
