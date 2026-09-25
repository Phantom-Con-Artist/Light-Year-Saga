import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Layer toggles and look requests for the Sky (constellation) view. */

export interface SkyLayers {
  figures: boolean;
  names: boolean;
  starNames: boolean;
  borders: boolean;
  grid: boolean;
  /** The real (NASA) sky photo behind the stars: shows the Milky Way band. */
  milkyWay: boolean;
}

export interface LookRequest {
  raDeg: number;
  decDeg: number;
  fovDeg?: number;
  /** Bumped per request so repeating one re-flies. */
  n: number;
}

interface SkyState extends SkyLayers {
  toggle: (layer: keyof SkyLayers) => void;
  /** Current vertical field of view (degrees), for the HUD. */
  fov: number;
  setFov: (fov: number) => void;
  look: LookRequest | null;
  lookAt: (raDeg: number, decDeg: number, fovDeg?: number) => void;
  /** Zoom about the current view centre (factor < 1 zooms in). */
  zoom: { factor: number; n: number } | null;
  zoomBy: (factor: number) => void;
}

export const useSkyStore = create<SkyState>()(
  persist(
    (set) => ({
      figures: true,
      names: true,
      starNames: true,
      borders: false,
      grid: false,
      milkyWay: true,
      toggle: (layer) => set((s) => ({ [layer]: !s[layer] })),
      fov: 70,
      setFov: (fov) => set({ fov }),
      look: null,
      lookAt: (raDeg, decDeg, fovDeg) => set((s) => ({ look: { raDeg, decDeg, fovDeg, n: (s.look?.n ?? 0) + 1 } })),
      zoom: null,
      zoomBy: (factor) => set((s) => ({ zoom: { factor, n: (s.zoom?.n ?? 0) + 1 } })),
    }),
    {
      name: "lys.sky.v1",
      partialize: (s) => ({ figures: s.figures, names: s.names, starNames: s.starNames, borders: s.borders, grid: s.grid, milkyWay: s.milkyWay }),
    },
  ),
);
