import { create } from "zustand";

interface FocusState {
  /** Exaggerate planet sizes in planetary-system close-ups (true scale otherwise). */
  enlargePlanets: boolean;
  toggleEnlarge: () => void;
}

export const useFocusStore = create<FocusState>()((set) => ({
  enlargePlanets: false,
  toggleEnlarge: () => set((s) => ({ enlargePlanets: !s.enlargePlanets })),
}));
