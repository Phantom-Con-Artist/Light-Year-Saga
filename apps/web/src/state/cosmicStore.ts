import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Universe view: how the galaxy map shows its structures. */
interface CosmicState {
  /** Tint each galaxy by the supercluster it belongs to. */
  colorBySupercluster: boolean;
  /** Labels for groups, clusters and superclusters. */
  structureNames: boolean;
  toggle: (key: "colorBySupercluster" | "structureNames") => void;
}

export const useCosmicStore = create<CosmicState>()(
  persist(
    (set) => ({
      colorBySupercluster: true,
      structureNames: true,
      toggle: (key) => set((s) => ({ [key]: !s[key] })),
    }),
    { name: "lys.cosmic.v1" },
  ),
);
