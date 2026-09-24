import { create } from "zustand";
import { SCALE_LINEUP } from "../data/scaleLineup";

/** Continuous position along the size line-up (0 = smallest). */
interface ScaleState {
  /** Where the camera is heading. */
  target: number;
  /** Rounded index currently in view (for UI). */
  index: number;
  setTarget: (t: number) => void;
  step: (delta: number) => void;
  goToId: (entryId: string) => void;
  setIndex: (i: number) => void;
}

const clamp = (t: number) => Math.min(SCALE_LINEUP.length - 1, Math.max(0, t));

export const useScaleStore = create<ScaleState>()((set, get) => ({
  target: SCALE_LINEUP.findIndex((e) => e.id === "s-earth"),
  index: SCALE_LINEUP.findIndex((e) => e.id === "s-earth"),
  setTarget: (t) => set({ target: clamp(t) }),
  step: (delta) => set({ target: clamp(Math.round(get().target) + delta) }),
  goToId: (entryId) => {
    const i = SCALE_LINEUP.findIndex((e) => e.id === entryId);
    if (i >= 0) set({ target: i });
  },
  setIndex: (index) => {
    if (index !== get().index) set({ index });
  },
}));

/** Smoothed camera position along the line-up; advanced by the scene each frame. */
export const scaleCursor = { t: SCALE_LINEUP.findIndex((e) => e.id === "s-earth") };
