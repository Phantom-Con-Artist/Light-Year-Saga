import { create } from "zustand";

/** Playback speeds, in simulated seconds per real second. */
export const RATE_STEPS = [
  { value: 1, label: "Real time" },
  { value: 60, label: "1 min / s" },
  { value: 3_600, label: "1 hour / s" },
  { value: 21_600, label: "6 hours / s" },
  { value: 86_400, label: "1 day / s" },
  { value: 604_800, label: "1 week / s" },
  { value: 2_592_000, label: "30 days / s" },
  { value: 31_557_600, label: "1 year / s" },
] as const;

const DEFAULT_RATE_INDEX = 4;

/** Simulation window. Wide enough to explore, narrow enough for accurate ephemerides. */
export const MIN_TIME_MS = Date.UTC(1700, 0, 1);
export const MAX_TIME_MS = Date.UTC(2300, 0, 1);

interface TimeState {
  timeMs: number;
  rateIndex: number;
  direction: 1 | -1;
  paused: boolean;

  advance: (realSeconds: number) => void;
  togglePause: () => void;
  faster: () => void;
  slower: () => void;
  toggleDirection: () => void;
  resetToNow: () => void;
}

export const useTimeStore = create<TimeState>()((set, get) => ({
  timeMs: Date.now(),
  rateIndex: DEFAULT_RATE_INDEX,
  direction: 1,
  paused: false,

  advance: (realSeconds) => {
    const { paused, rateIndex, direction, timeMs } = get();
    if (paused) return;
    const next = timeMs + realSeconds * 1000 * RATE_STEPS[rateIndex].value * direction;
    const clamped = Math.min(MAX_TIME_MS, Math.max(MIN_TIME_MS, next));
    set({ timeMs: clamped, paused: clamped !== next });
  },
  togglePause: () => set((s) => ({ paused: !s.paused })),
  faster: () => set((s) => ({ rateIndex: Math.min(s.rateIndex + 1, RATE_STEPS.length - 1) })),
  slower: () => set((s) => ({ rateIndex: Math.max(s.rateIndex - 1, 0) })),
  toggleDirection: () => set((s) => ({ direction: s.direction === 1 ? -1 : 1 })),
  resetToNow: () => set({ timeMs: Date.now(), rateIndex: 0, direction: 1, paused: false }),
}));

/** Simulated seconds per real second, signed. */
export function currentRate(s: Pick<TimeState, "rateIndex" | "direction" | "paused">): number {
  return s.paused ? 0 : RATE_STEPS[s.rateIndex].value * s.direction;
}

/** True only when the clock genuinely tracks the present — don't fake "live". */
export function isLive(s: Pick<TimeState, "timeMs" | "rateIndex" | "direction" | "paused">): boolean {
  return !s.paused && s.rateIndex === 0 && s.direction === 1 && Math.abs(s.timeMs - Date.now()) < 5_000;
}
