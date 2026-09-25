import { propagate as sgp4, twoline2satrec, type SatRec } from "satellite.js";
import { SATELLITES } from "../data/solar/elements.gen";
import { AU_KM, type Vec3 } from "./ephemeris";
import { jdFromMs, solveKepler } from "./kepler";

/**
 * Named Earth satellites (ISS, Tiangong, Hubble) from CelesTrak two-line
 * elements, propagated with SGP4. The build ships a TLE set; on load a fresh
 * one is fetched from CelesTrak (at most every 2 hours, as CelesTrak asks).
 * SGP4 is only trustworthy for a few weeks around the TLE epoch, so beyond
 * that the orbit is kept (mean elements + J2 precession) but the position
 * along it is flagged as approximate.
 */

export type SatelliteId = keyof typeof SATELLITES.tles;

interface Entry {
  satrec: SatRec;
  line1: string;
  line2: string;
  epochJd: number;
  live: boolean;
}

const EPS = (23.4392911 * Math.PI) / 180;
const RE_KM = 6378.137;
const J2 = 1.08263e-3;
const SGP4_TRUST_DAYS = 21;

const entries = new Map<string, Entry>();

function install(id: string, line1: string, line2: string, live: boolean) {
  try {
    const satrec = twoline2satrec(line1, line2);
    if (satrec.error) return;
    entries.set(id, { satrec, line1, line2, epochJd: satrec.jdsatepoch, live });
  } catch {
    /* keep the previous set */
  }
}

for (const [id, t] of Object.entries(SATELLITES.tles)) install(id, t.line1, t.line2, false);

const CACHE_KEY = "lys.tle.v1";
const REFRESH_MS = 2 * 3600_000;
let refreshing = false;

/** Fetch current TLEs from CelesTrak (CORS-enabled), falling back to the bundled set. */
export function refreshTles(): void {
  if (refreshing) return;
  refreshing = true;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as { at: number; tles: Record<string, [string, string]> } | null;
    if (cached) {
      for (const [id, [l1, l2]] of Object.entries(cached.tles)) install(id, l1, l2, true);
      if (Date.now() - cached.at < REFRESH_MS) return;
    }
  } catch {
    /* storage unavailable */
  }
  const ids = Object.entries(SATELLITES.tles);
  Promise.all(
    ids.map(([id, t]) =>
      fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${t.norad}&FORMAT=TLE`)
        .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
        .then((text) => {
          const lines = text.trim().split(/\r?\n/).map((l) => l.trimEnd());
          if (lines.length < 3 || !lines[1].startsWith("1 ")) throw new Error("bad TLE");
          install(id, lines[1], lines[2], true);
          return [id, [lines[1], lines[2]]] as const;
        })
        .catch(() => null),
    ),
  ).then((got) => {
    const tles = Object.fromEntries(got.filter((g) => g !== null));
    if (Object.keys(tles).length === 0) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), tles }));
    } catch {
      /* ignore */
    }
  });
}

/** TEME/equatorial (km) → ecliptic AU. */
function toEcliptic(x: number, y: number, z: number, out: Vec3): Vec3 {
  out.x = x / AU_KM;
  out.y = (y * Math.cos(EPS) + z * Math.sin(EPS)) / AU_KM;
  out.z = (-y * Math.sin(EPS) + z * Math.cos(EPS)) / AU_KM;
  return out;
}

/** Mean elements + J2 secular drift, for dates far from the TLE epoch. */
function meanElementPosition(s: SatRec, jd: number, out: Vec3): Vec3 {
  const nRadDay = s.no * 1440;
  const aKm = Math.cbrt(398600.4418 / Math.pow(nRadDay / 86400, 2));
  const e = s.ecco;
  const p = (aKm * (1 - e * e)) / RE_KM;
  const dt = jd - s.jdsatepoch;
  const ci = Math.cos(s.inclo);
  const node = s.nodeo - 1.5 * nRadDay * J2 * ci * dt / (p * p);
  const argp = s.argpo + 0.75 * nRadDay * J2 * (5 * ci * ci - 1) * dt / (p * p);
  const E = solveKepler(s.mo + nRadDay * dt, e);
  const xp = aKm * (Math.cos(E) - e);
  const yp = aKm * Math.sqrt(1 - e * e) * Math.sin(E);
  const cO = Math.cos(node);
  const sO = Math.sin(node);
  const cw = Math.cos(argp);
  const sw = Math.sin(argp);
  const si = Math.sin(s.inclo);
  const x = (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp;
  const y = (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp;
  const z = sw * si * xp + cw * si * yp;
  return toEcliptic(x, y, z, out);
}

/** Position relative to Earth's centre (AU, ecliptic). */
export function satellitePosition(id: string, ms: number, out: Vec3): Vec3 | null {
  const e = entries.get(id);
  if (!e) return null;
  const jd = jdFromMs(ms);
  if (Math.abs(jd - e.epochJd) <= SGP4_TRUST_DAYS) {
    const pv = sgp4(e.satrec, new Date(ms));
    if (pv && typeof pv.position === "object") return toEcliptic(pv.position.x, pv.position.y, pv.position.z, out);
  }
  return meanElementPosition(e.satrec, jd, out);
}

export function satellitePeriodMinutes(id: string): number | null {
  const e = entries.get(id);
  return e ? (2 * Math.PI) / e.satrec.no : null;
}

/** How trustworthy the position is at a given time. */
export function satelliteStatus(id: string, ms: number): { epochMs: number; live: boolean; precise: boolean } | null {
  const e = entries.get(id);
  if (!e) return null;
  const epochMs = (e.epochJd - 2440587.5) * 86_400_000;
  return { epochMs, live: e.live, precise: Math.abs(jdFromMs(ms) - e.epochJd) <= SGP4_TRUST_DAYS };
}
