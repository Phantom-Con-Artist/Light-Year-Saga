import { create } from "zustand";

interface SelectionState {
  selectedId: string | null;
  hoveredId: string | null;
  /** Bumped on every select call so re-selecting the same object re-flies the camera. */
  focusRequest: number;

  selectObject: (id: string | null) => void;
  hoverObject: (id: string | null) => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedId: null,
  hoveredId: null,
  focusRequest: 0,

  selectObject: (id) => set((s) => ({ selectedId: id, focusRequest: s.focusRequest + 1 })),
  hoverObject: (id) => set({ hoveredId: id }),
}));

/** The single universal entry point for selection, independent of object type. */
export const selectObject = (id: string | null) => useSelectionStore.getState().selectObject(id);
