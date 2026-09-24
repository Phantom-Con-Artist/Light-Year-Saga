import { Vector3 } from "three";
import type { ExternalSource } from "../domain/types";
import { GALACTIC_CENTRE, NGP_DIRECTION, R0_LY } from "../astronomy/galactic";

/**
 * Objects beyond individual stars. `position` is in interstellar render
 * space (light-years, Sun at origin).
 */
export interface DeepSkyObject {
  id: string;
  name: string;
  type: "galaxy" | "black-hole";
  classification: string;
  description: string;
  facts: [label: string, value: string][];
  position: Vector3;
  /** Comfortable camera distance when focused (ly). */
  framingLy: number;
  /** Preferred view direction when focused (unit, render axes). */
  viewDirection?: Vector3;
  /** Whether the visual is a model rather than a measurement. */
  visualNote?: string;
  sources: ExternalSource[];
}

const NASA_MW: ExternalSource = {
  provider: "NASA",
  name: "Milky Way Galaxy overview",
  url: "https://science.nasa.gov/resource/the-milky-way-galaxy/",
  freshness: "STATIC",
};

const GRAVITY_2019: ExternalSource = {
  provider: "GRAVITY Collaboration",
  name: "Distance to Sgr A* (A&A 625, L10, 2019)",
  url: "https://doi.org/10.1051/0004-6361/201935656",
  freshness: "STATIC",
};

const EHT_2022: ExternalSource = {
  provider: "Event Horizon Telescope",
  name: "First image of Sgr A* (ApJL 930, L12, 2022)",
  url: "https://doi.org/10.3847/2041-8213/ac6674",
  freshness: "STATIC",
};

/** Oblique view from above the Galactic plane, looking back toward the Sun's side. */
const galaxyView = NGP_DIRECTION.clone()
  .multiplyScalar(0.75)
  .add(GALACTIC_CENTRE.clone().normalize().multiplyScalar(-0.66))
  .normalize();

export const DEEP_SKY: DeepSkyObject[] = [
  {
    id: "milky-way",
    name: "Milky Way",
    type: "galaxy",
    classification: "Barred spiral galaxy (SBbc)",
    description:
      "Our home galaxy: a barred spiral disk about 100,000 light-years across, holding 100–400 billion stars. The Sun sits in a minor arm, the Orion Spur, roughly halfway out from the centre.",
    facts: [
      ["Diameter (stellar disk)", "~100,000 ly"],
      ["Stars", "100–400 billion"],
      ["Total mass", "~1–1.5 × 10¹² M☉"],
      ["Age", "~13.6 billion yr"],
      ["Sun → centre", `${R0_LY.toLocaleString("en-US")} ly`],
      ["Sun's orbit period", "~230 million yr"],
    ],
    position: GALACTIC_CENTRE.clone(),
    framingLy: 150_000,
    viewDirection: galaxyView,
    visualNote: "Shown as a model built from published structure (bar, four major arms, Orion Spur). Individual stars beyond ~3,000 ly are illustrative.",
    sources: [NASA_MW, GRAVITY_2019],
  },
  {
    id: "sgr-a-star",
    name: "Sagittarius A*",
    type: "black-hole",
    classification: "Supermassive black hole",
    description:
      "The black hole at the centre of the Milky Way. Its mass was pinned down by tracking stars orbiting it, and the Event Horizon Telescope imaged its shadow in 2022.",
    facts: [
      ["Mass", "~4.3 million M☉"],
      ["Distance", `${R0_LY.toLocaleString("en-US")} ly`],
      ["Shadow diameter", "~52 µas (EHT)"],
    ],
    position: GALACTIC_CENTRE.clone(),
    framingLy: 14_000,
    sources: [GRAVITY_2019, EHT_2022],
  },
];

export const DEEP_SKY_BY_ID: ReadonlyMap<string, DeepSkyObject> = new Map(DEEP_SKY.map((o) => [o.id, o]));

export function getDeepSky(id: string | null | undefined): DeepSkyObject | undefined {
  return id ? DEEP_SKY_BY_ID.get(id) : undefined;
}
