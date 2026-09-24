import { create } from "zustand";

interface UiState {
  logbookOpen: boolean;
  toggleLogbook: () => void;
  closeLogbook: () => void;
  /** Phone layout: the object list, shown as a sheet. */
  browseOpen: boolean;
  setBrowse: (open: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  logbookOpen: false,
  toggleLogbook: () => set((s) => ({ logbookOpen: !s.logbookOpen })),
  closeLogbook: () => set({ logbookOpen: false }),
  browseOpen: false,
  setBrowse: (open) => set({ browseOpen: open }),
}));
