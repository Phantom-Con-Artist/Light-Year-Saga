import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SpaceObject } from "../domain/types";

/** Layer toggles for the Solar System view. */
export interface SolarLayers {
  moons: boolean;
  dwarfPlanets: boolean;
  /** Named asteroids plus the real asteroid / Kuiper belt point clouds. */
  asteroids: boolean;
  comets: boolean;
  spacecraft: boolean;
  /** Every active Earth satellite. */
  satellites: boolean;
  heliosphere: boolean;
  oort: boolean;
  /** Mountains, craters and landing sites on the bodies. */
  features: boolean;
  orbits: boolean;
  /** Colour the belts by population (Trojans, NEOs, plutinos…). */
  beltColors: boolean;
}

interface SolarState extends SolarLayers {
  toggle: (layer: keyof SolarLayers) => void;
}

export const useSolarStore = create<SolarState>()(
  persist(
    (set) => ({
      moons: true,
      dwarfPlanets: true,
      asteroids: true,
      comets: true,
      spacecraft: true,
      satellites: true,
      heliosphere: true,
      oort: true,
      features: true,
      orbits: true,
      beltColors: true,
      toggle: (layer) => set((s) => ({ [layer]: !s[layer] })),
    }),
    { name: "lys.solar.v1" },
  ),
);

/** The layer that shows or hides an object (planets and the Sun are always shown). */
export function layerOf(obj: SpaceObject): keyof SolarLayers | null {
  switch (obj.type) {
    case "moon":
      return "moons";
    case "dwarf-planet":
      return "dwarfPlanets";
    case "asteroid":
      return "asteroids";
    case "comet":
      return "comets";
    case "spacecraft":
    case "space-station":
    case "telescope":
      return "spacecraft";
    default:
      return null;
  }
}

export function layerOn(obj: SpaceObject, s: SolarLayers = useSolarStore.getState()): boolean {
  const l = layerOf(obj);
  return l ? s[l] : true;
}
