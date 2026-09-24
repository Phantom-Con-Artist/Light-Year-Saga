import { create } from "zustand";

interface UiState {
  logbookOpen: boolean;
  toggleLogbook: () => void;
  closeLogbook: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  logbookOpen: false,
  toggleLogbook: () => set((s) => ({ logbookOpen: !s.logbookOpen })),
  closeLogbook: () => set({ logbookOpen: false }),
}));
