import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CosmicToggle = "colorBySupercluster" | "structureNames" | "modelled" | "markModelled";

/** Universe view: how the galaxy map shows its structures. */
interface CosmicState {
  /** Tint each galaxy by the supercluster it belongs to. */
  colorBySupercluster: boolean;
  /** Labels for groups, clusters and superclusters. */
  structureNames: boolean;
  /** Show the modelled (synthetic) galaxies that fill the universe beyond the surveys. */
  modelled: boolean;
  /** Draw modelled galaxies in a neutral grey-violet so they can't be mistaken for real ones. */
  markModelled: boolean;
  toggle: (key: CosmicToggle) => void;
}

export const useCosmicStore = create<CosmicState>()(
  persist(
    (set) => ({
      colorBySupercluster: true,
      structureNames: true,
      modelled: true,
      markModelled: false,
      toggle: (key) => set((s) => ({ [key]: !s[key] })),
    }),
    { name: "lys.cosmic.v1" },
  ),
);
