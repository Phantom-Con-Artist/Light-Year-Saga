import * as Astronomy from "astronomy-engine";
import { Vector3 } from "three";

/**
 * Sky coordinates → render space. RA/Dec are J2000 equatorial; render axes
 * are ecliptic J2000 mapped (x, ecl.z, −ecl.y), identical to every view level.
 */

const t0 = new Astronomy.AstroTime(0);
const EQJ_TO_ECL = Astronomy.Rotation_EQJ_ECL();

/** "05h35m17.3s" or decimal hours → hours. */
export function parseRA(ra: string | number): number {
  if (typeof ra === "number") return ra;
  const m = ra.match(/(\d+)h\s*(\d+)m\s*([\d.]+)?s?/);
  if (!m) throw new Error(`Bad RA: ${ra}`);
  return Number(m[1]) + Number(m[2]) / 60 + Number(m[3] ?? 0) / 3600;
}

/** "−05°23′28″" / "-05d23m28s" or decimal degrees → degrees. */
export function parseDec(dec: string | number): number {
  if (typeof dec === "number") return dec;
  const s = dec.replace("−", "-");
  const m = s.match(/([+-]?)(\d+)[°d]\s*(\d+)?[′'m]?\s*([\d.]+)?/);
  if (!m) throw new Error(`Bad Dec: ${dec}`);
  const v = Number(m[2]) + Number(m[3] ?? 0) / 60 + Number(m[4] ?? 0) / 3600;
  return m[1] === "-" ? -v : v;
}

/** Equatorial unit vector (x → RA 0h, z → north celestial pole). */
export function equatorialUnit(raHours: number, decDeg: number): Vector3 {
  const ra = (raHours * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return new Vector3(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec));
}

/** Equatorial vector → render axes. */
export function equatorialToRender(v: Vector3): Vector3 {
  const e = Astronomy.RotateVector(EQJ_TO_ECL, new Astronomy.Vector(v.x, v.y, v.z, t0));
  return new Vector3(e.x, e.z, -e.y);
}

/** Sky position + distance → render position, in whatever unit `distance` is in. */
export function skyToRender(ra: string | number, dec: string | number, distance: number): Vector3 {
  return equatorialToRender(equatorialUnit(parseRA(ra), parseDec(dec))).multiplyScalar(distance);
}

/**
 * Orientation basis for a disk seen on the sky at (ra, dec) with position angle
 * `paDeg` (major axis, north through east) and inclination `incDeg`
 * (0 = face-on). Returns render-space unit vectors: major axis, minor axis in
 * the disk plane, and the disk normal.
 */
export function diskBasis(ra: string | number, dec: string | number, paDeg: number, incDeg: number) {
  const n = equatorialUnit(parseRA(ra), parseDec(dec));
  const pole = new Vector3(0, 0, 1);
  const east = new Vector3().crossVectors(pole, n).normalize();
  const north = new Vector3().crossVectors(n, east).normalize();
  const pa = (paDeg * Math.PI) / 180;
  const inc = (incDeg * Math.PI) / 180;
  const major = north.clone().multiplyScalar(Math.cos(pa)).addScaledVector(east, Math.sin(pa));
  const skyMinor = new Vector3().crossVectors(n, major).normalize();
  // Tilt the disk away from face-on about the major axis.
  const normal = n.clone().multiplyScalar(-Math.cos(inc)).addScaledVector(skyMinor, Math.sin(inc)).normalize();
  const minor = new Vector3().crossVectors(normal, major).normalize();
  return {
    major: equatorialToRender(major),
    minor: equatorialToRender(minor),
    normal: equatorialToRender(normal),
  };
}

/**
 * Orientation of a photograph on the sky, as seen from Earth. `northDeg` is how
 * far north is rotated counter-clockwise from image-up. Returns render-space
 * unit vectors for image right, image up, and the normal facing Earth.
 */
export function skyPlaneBasis(ra: string | number, dec: string | number, northDeg: number) {
  const n = equatorialUnit(parseRA(ra), parseDec(dec));
  const east = new Vector3().crossVectors(new Vector3(0, 0, 1), n).normalize();
  const north = new Vector3().crossVectors(n, east).normalize();
  // A direction at position angle φ (north through east) is north·cosφ + east·sinφ;
  // image-up sits at φ = −northDeg, image-right 90° further clockwise.
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return north.clone().multiplyScalar(Math.cos(a)).addScaledVector(east, Math.sin(a));
  };
  return {
    right: equatorialToRender(at(-northDeg - 90)),
    up: equatorialToRender(at(-northDeg)),
    normal: equatorialToRender(n.clone().negate()),
  };
}

const EQ_X = equatorialToRender(new Vector3(1, 0, 0));
const EQ_Y = equatorialToRender(new Vector3(0, 1, 0));
const EQ_Z = equatorialToRender(new Vector3(0, 0, 1));

/** Render-space unit vector toward the north celestial pole. */
export const CELESTIAL_NORTH = EQ_Z.clone();

/** Render-space direction → J2000 RA/Dec in degrees (RA 0…360). */
export function renderToRaDec(v: Vector3): { raDeg: number; decDeg: number } {
  const n = v.clone().normalize();
  const x = n.dot(EQ_X);
  const y = n.dot(EQ_Y);
  const z = n.dot(EQ_Z);
  const ra = (Math.atan2(y, x) * 180) / Math.PI;
  return { raDeg: (ra + 360) % 360, decDeg: (Math.asin(Math.max(-1, Math.min(1, z))) * 180) / Math.PI };
}
