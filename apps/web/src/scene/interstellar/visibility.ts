import { LY_PER_PC } from "../../data/stars";

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Star visibility as a function of the camera's distance from the Sun.
 * Near the Sun the limit is roughly naked-eye (+6.5). Further out it is
 * boosted (like a longer exposure) so the catalogue stays readable, and the
 * whole field fades once the galaxy model takes over.
 */
export function starVisibility(cameraDistanceLy: number): { limitMag: number; labelMag: number; fade: number } {
  const limitMag = 6.5 + 2.2 * Math.log10(1 + cameraDistanceLy / 150);
  return {
    limitMag,
    labelMag: limitMag - 4.2,
    fade: 1 - smoothstep(12_000, 40_000, cameraDistanceLy),
  };
}

export function apparentMagFromCamera(absMag: number, distanceLy: number): number {
  return absMag + 5 * Math.log10(Math.max(distanceLy / LY_PER_PC, 1e-7)) - 5;
}

/** Galaxy model fades in as the camera leaves the solar neighbourhood. */
export function galaxyOpacity(cameraDistanceLy: number): number {
  return smoothstep(1_500, 9_000, cameraDistanceLy);
}

/** Real (NASA) diffuse Milky Way backdrop is only valid near the Sun. */
export function diffuseSkyOpacity(cameraDistanceLy: number): number {
  return 1 - smoothstep(600, 5_000, cameraDistanceLy);
}
