import { create } from "zustand";
import { Vector3 } from "three";

/**
 * Spatial regimes. Each has its own units and scene:
 *   system       — compressed-AU Solar System (astronomy/scale.ts)
 *   interstellar — light-years, Sun at origin: real stars, nebulae, Milky Way model
 *   cosmic       — millions of light-years: galaxies, 2MRS survey, voids, quasars
 *   focus        — true-scale close-up of one star / black hole / planetary system (solar radii)
 *   scale        — size line-up from a neutron star to TON 618
 * The first three share ecliptic J2000 axes, so view direction carries over.
 */
export type ViewLevel = "system" | "interstellar" | "cosmic" | "focus" | "scale";

const FADE_MS = 280;

interface ViewState {
  level: ViewLevel;
  /** Subject of the focus (close-up) view. */
  focusId: string | null;
  /** Level to return to when leaving focus/scale. */
  returnLevel: ViewLevel;
  /** The level we just came from (drives entry animations). */
  fromLevel: ViewLevel | null;
  /** 0 = scene visible, 1 = black. Drives the transition overlay. */
  fade: number;
  transitioning: boolean;
  /** Camera view direction (unit, render axes) to carry into the next level. */
  carryDirection: Vector3 | null;
  /** Camera distance from the Sun in the current level's units. */
  cameraDistance: number;

  goTo: (level: ViewLevel, opts?: { direction?: Vector3; focusId?: string; then?: () => void }) => void;
  setCameraDistance: (d: number) => void;
}

export const useViewStore = create<ViewState>()((set, get) => ({
  level: "system",
  focusId: null,
  returnLevel: "system",
  fromLevel: null,
  fade: 0,
  transitioning: false,
  carryDirection: null,
  cameraDistance: 0,

  goTo: (level, opts) => {
    const s = get();
    if (s.transitioning) return;
    const focusId = opts?.focusId ?? (level === "focus" ? s.focusId : null);
    if (s.level === level && focusId === s.focusId) {
      opts?.then?.();
      return;
    }
    const returnLevel = level === "focus" || level === "scale" ? (s.level === "focus" || s.level === "scale" ? s.returnLevel : s.level) : s.returnLevel;
    set({ transitioning: true, fade: 1, carryDirection: opts?.direction?.clone().normalize() ?? null });
    window.setTimeout(() => {
      set({ level, focusId, returnLevel, fromLevel: s.level, cameraDistance: 0 });
      // Let the new scene mount and place its camera before revealing it.
      window.setTimeout(() => {
        set({ fade: 0, transitioning: false });
        opts?.then?.();
      }, 60);
    }, FADE_MS);
  },
  setCameraDistance: (d) => set({ cameraDistance: d }),
}));

export const FADE_DURATION_MS = FADE_MS;
