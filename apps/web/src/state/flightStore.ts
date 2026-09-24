/**
 * Camera travel intensity (0 = still, 1 = full warp), written by the camera
 * rigs every frame and read by the warp-streak overlay. Kept outside React
 * state on purpose — it changes every frame.
 */
export const flight = {
  speed: 0,
  /** Unit screen-space direction of travel is always "forward" (screen centre). */
};

export function reportFlightSpeed(speed: number) {
  // Smooth so the overlay doesn't flicker.
  flight.speed += (Math.min(1, Math.max(0, speed)) - flight.speed) * 0.15;
}
