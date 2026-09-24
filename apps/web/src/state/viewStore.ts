import { create } from "zustand";
import { Vector3 } from "three";

/**
 * Spatial regimes. Each has its own units and scene:
 *   system       — compressed-AU Solar System (astronomy/scale.ts)
 *   interstellar — light-years, Sun at origin: real stars + Milky Way model
 * Both share the same render axes (ecliptic J2000), so view direction carries over.
 */
export type ViewLevel = "system" | "interstellar";

const FADE_MS = 280;

interface ViewState {
  level: ViewLevel;
  /** 0 = scene visible, 1 = black. Drives the transition overlay. */
  fade: number;
  transitioning: boolean;
  /** Camera view direction (unit, render axes) to carry into the next level. */
  carryDirection: Vector3 | null;
  /** Camera distance from the Sun in light-years (interstellar level only). */
  cameraDistanceLy: number;

  goTo: (level: ViewLevel, opts?: { direction?: Vector3; then?: () => void }) => void;
  setCameraDistanceLy: (d: number) => void;
}

export const useViewStore = create<ViewState>()((set, get) => ({
  level: "system",
  fade: 0,
  transitioning: false,
  carryDirection: null,
  cameraDistanceLy: 0,

  goTo: (level, opts) => {
    const s = get();
    if (s.transitioning) return;
    if (s.level === level) {
      opts?.then?.();
      return;
    }
    set({ transitioning: true, fade: 1, carryDirection: opts?.direction?.clone().normalize() ?? null });
    window.setTimeout(() => {
      set({ level });
      // Let the new scene mount and place its camera before revealing it.
      window.setTimeout(() => {
        set({ fade: 0, transitioning: false });
        opts?.then?.();
      }, 60);
    }, FADE_MS);
  },
  setCameraDistanceLy: (d) => set({ cameraDistanceLy: d }),
}));

export const FADE_DURATION_MS = FADE_MS;
