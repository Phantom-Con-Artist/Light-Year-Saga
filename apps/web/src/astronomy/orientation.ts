import { Matrix4, Quaternion, Vector3 } from "three";

/**
 * Body orientation from the IAU WGCCRE models: the north pole's RA/Dec and
 * the prime meridian angle W = W0 + Ẇ·d (d = days from J2000). Surface maps
 * put longitude 0 at the centre, so the mesh's +X is the prime meridian and
 * +Y the north pole.
 */

export interface IauRotation {
  poleRa: number;
  poleDec: number;
  w0: number;
  /** Degrees per day; negative = retrograde. */
  wDot: number;
}

const DEG = Math.PI / 180;
const EPS = 23.4392911 * DEG;

/** Equatorial J2000 unit vector → render axes (ecliptic x, ecl.z, −ecl.y). */
export function eqToRender(x: number, y: number, z: number, out = new Vector3()): Vector3 {
  const ey = y * Math.cos(EPS) + z * Math.sin(EPS);
  const ez = -y * Math.sin(EPS) + z * Math.cos(EPS);
  return out.set(x, ez, -ey);
}

export function raDecToRender(raDeg: number, decDeg: number, out = new Vector3()): Vector3 {
  const a = raDeg * DEG;
  const d = decDeg * DEG;
  return eqToRender(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d), out);
}

export interface PoleFrame {
  pole: Vector3;
  /** Ascending node of the body's equator on the ICRF equator (W is measured from here). */
  node: Vector3;
  /** pole × node: 90° east of the node. */
  east: Vector3;
}

export function poleFrame(rot: Pick<IauRotation, "poleRa" | "poleDec">): PoleFrame {
  const pole = raDecToRender(rot.poleRa, rot.poleDec);
  const a = rot.poleRa * DEG;
  const node = eqToRender(-Math.sin(a), Math.cos(a), 0);
  const east = new Vector3().crossVectors(pole, node).normalize();
  return { pole, node, east };
}

/** Prime-meridian angle (degrees) at `days` from J2000. */
export const primeMeridian = (rot: IauRotation, days: number) => rot.w0 + rot.wDot * days;

const m = new Matrix4();
const x = new Vector3();
const z = new Vector3();

/** Mesh orientation: +Y along the pole, +X toward the prime meridian at angle W (degrees). */
export function bodyQuaternion(frame: PoleFrame, wDeg: number, out: Quaternion): Quaternion {
  const w = wDeg * DEG;
  x.copy(frame.node).multiplyScalar(Math.cos(w)).addScaledVector(frame.east, Math.sin(w));
  z.crossVectors(x, frame.pole);
  m.makeBasis(x, frame.pole, z);
  return out.setFromRotationMatrix(m);
}

/** Orientation with +Y along `pole` and +X as close as possible to `toward` (tidally locked moons). */
export function facingQuaternion(pole: Vector3, toward: Vector3, out: Quaternion): Quaternion {
  x.copy(toward).addScaledVector(pole, -toward.dot(pole));
  if (x.lengthSq() < 1e-12) x.set(1, 0, 0);
  x.normalize();
  z.crossVectors(x, pole);
  m.makeBasis(x, pole, z);
  return out.setFromRotationMatrix(m);
}

const y = new Vector3();
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
/** Orientation with +Z along `forward` and +Y as close as possible to `up`. */
export function forwardUpQuaternion(forward: Vector3, up: Vector3, out: Quaternion): Quaternion {
  z.copy(forward).normalize();
  x.crossVectors(up, z);
  if (x.lengthSq() < 1e-12) x.crossVectors(Math.abs(z.x) < 0.9 ? X_AXIS : Y_AXIS, z);
  x.normalize();
  y.crossVectors(z, x);
  m.makeBasis(x, y, z);
  return out.setFromRotationMatrix(m);
}
