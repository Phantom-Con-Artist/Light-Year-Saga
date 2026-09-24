import { useViewStore } from "../state/viewStore";
import { formatNumber } from "./format";

const AU_PER_LY = 63_241.08;

function formatDistance(ly: number): string {
  if (ly < 0.1) return `${formatNumber(ly * AU_PER_LY, 0)} AU`;
  if (ly < 10) return `${formatNumber(ly, 2)} ly`;
  return `${formatNumber(ly, 0)} ly`;
}

function hintFor(ly: number): string {
  if (ly < 0.5) return "Scroll in on the Sun to return to the Solar System";
  if (ly < 5_000) return "Scroll out to see the whole galaxy";
  return "Real stars shown within ~3,000 ly · galaxy structure is a model";
}

/** Interstellar replacement for the time controls: where the camera is. */
export function ScaleReadout() {
  const d = useViewStore((s) => s.cameraDistanceLy);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center p-3 md:p-4">
      <div className="panel animate-fade-in flex flex-col items-center gap-0.5 px-4 py-2">
        <div className="text-[13px] text-ink-dim tabular-nums">
          <span className="font-medium text-ink">{formatDistance(d)}</span> from the Sun
        </div>
        <div className="text-[11px] text-ink-faint">{hintFor(d)}</div>
      </div>
    </div>
  );
}
