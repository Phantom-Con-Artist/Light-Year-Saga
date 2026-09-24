import * as Astronomy from "astronomy-engine";
import { Matrix4, Vector3 } from "three";

/**
 * Galactic geometry for the interstellar view (units: light-years).
 *
 * Model frame ("galactocentric"): Galactic Centre at the origin, axes aligned
 * with IAU galactic coordinates — +x from the Sun toward the Centre (l = 0°),
 * +y toward l = 90° (direction of Galactic rotation at the Sun), +z toward the
 * North Galactic Pole. The Sun sits at (−R₀, 0, z☉).
 */

/** Sun–Galactic Centre distance, R₀ = 8.18 kpc (GRAVITY Collaboration 2019). */
export const R0_LY = 26_670;
/** Sun's height above the Galactic mid-plane, ≈ 20.8 pc (Bennett & Bovy 2019). */
export const SUN_Z_LY = 68;

export const SUN_GALACTOCENTRIC = new Vector3(-R0_LY, 0, SUN_Z_LY);

const t0 = new Astronomy.AstroTime(0);
const GAL_TO_ECL = Astronomy.CombineRotation(Astronomy.Rotation_GAL_EQJ(), Astronomy.Rotation_EQJ_ECL());

/** Galactic-axis direction → render axes (x, ecl.z, −ecl.y), same mapping as astronomy/scale.ts. */
function galDirToRender(x: number, y: number, z: number): Vector3 {
  const e = Astronomy.RotateVector(GAL_TO_ECL, new Astronomy.Vector(x, y, z, t0));
  return new Vector3(e.x, e.z, -e.y);
}

const AXIS_X = galDirToRender(1, 0, 0);
const AXIS_Y = galDirToRender(0, 1, 0);
const AXIS_Z = galDirToRender(0, 0, 1);

/** Rotation from galactic axes to render axes. */
export const GALACTIC_ROTATION = new Matrix4().makeBasis(AXIS_X, AXIS_Y, AXIS_Z);

/** Galactocentric model coordinates → heliocentric render coordinates (ly). */
export const GALACTOCENTRIC_TO_RENDER = new Matrix4()
  .copy(GALACTIC_ROTATION)
  .multiply(new Matrix4().makeTranslation(-SUN_GALACTOCENTRIC.x, -SUN_GALACTOCENTRIC.y, -SUN_GALACTOCENTRIC.z));

export function galactocentricToRender(p: Vector3): Vector3 {
  return p.clone().applyMatrix4(GALACTOCENTRIC_TO_RENDER);
}

/** Render-space unit vector toward the North Galactic Pole. */
export const NGP_DIRECTION = AXIS_Z.clone();
/** Render-space position of the Galactic Centre (Sgr A*). */
export const GALACTIC_CENTRE = galactocentricToRender(new Vector3(0, 0, 0));
