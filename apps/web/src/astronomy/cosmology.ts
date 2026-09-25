/**
 * Flat ΛCDM distances (Planck 2018: H₀ = 67.4, Ωm = 0.315, ΩΛ = 0.685).
 * Used to place redshift-only objects (quasars, survey galaxies) in 3D.
 */
const H0 = 67.4; // km/s/Mpc
const OMEGA_M = 0.315;
const OMEGA_L = 0.685;
const C_KMS = 299_792.458;
const MLY_PER_MPC = 3.261563777;
/** Hubble time in Gyr. */
const HUBBLE_TIME_GYR = 977.79222 / H0;

const E = (z: number) => Math.sqrt(OMEGA_M * (1 + z) ** 3 + OMEGA_L);

function integrate(f: (z: number) => number, a: number, b: number, steps = 2000): number {
  const h = (b - a) / steps;
  let s = f(a) + f(b);
  for (let i = 1; i < steps; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

/** Comoving distance (Mly): where the object is "now" — used for 3D placement. */
export function comovingDistanceMly(z: number): number {
  const mpc = (C_KMS / H0) * integrate((x) => 1 / E(x), 0, z);
  return mpc * MLY_PER_MPC;
}

/** Light-travel time (Gyr): how long ago the light we see left it. */
export function lookbackTimeGyr(z: number): number {
  return HUBBLE_TIME_GYR * integrate((x) => 1 / ((1 + x) * E(x)), 0, z);
}

/** Radius of the observable universe (comoving particle horizon), Mly. */
export const OBSERVABLE_UNIVERSE_RADIUS_MLY = 46_500;

/** Redshift at a comoving distance (Mly), by bisection. */
export function redshiftFromComovingMly(dMly: number): number {
  let lo = 0;
  let hi = 30;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const d = (C_KMS / H0) * integrate((x) => 1 / E(x), 0, mid, 200) * MLY_PER_MPC;
    if (d < dMly) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
