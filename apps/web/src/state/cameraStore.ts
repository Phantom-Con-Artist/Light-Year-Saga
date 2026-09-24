import { create } from "zustand";

interface CameraState {
  homeRequest: number;
  flyHome: () => void;
}

export const useCameraStore = create<CameraState>()((set) => ({
  homeRequest: 0,
  flyHome: () => set((s) => ({ homeRequest: s.homeRequest + 1 })),
}));
