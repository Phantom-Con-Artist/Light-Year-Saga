/**
 * Builds the real-star dataset used by the interstellar view.
 *
 *   node scripts/build-stars.mjs [path/to/hygdata_v41.csv]
 *
 * Source: HYG Database v4.1 (Hipparcos, Yale Bright Star, Gliese) by David Nash,
 * https://github.com/astronexus/HYG-Database. License: CC BY-SA 4.0, so the
 * derived files in apps/web/public/data/ carry the same license.
 *
 * Output (apps/web/public/data/):
 *   stars.bin        Float32 × 5 per star: x, y, z (light-years, render axes), absMag, B−V
 *   stars-meta.json  Per-star identifiers (columnar) for the inspector and search
 */
import fs from "node:fs";
import path from "node:path";
import * as Astronomy from "astronomy-engine";

const SOURCE_URL = "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv";
const OUT_DIR = path.resolve("apps/web/public/data");

const LY_PER_PC = 3.261563777;
/** Keep stars visible to the naked eye / binoculars, plus the full solar neighbourhood. */
const MAX_MAG = 8.0;
const NEIGHBOURHOOD_PC = 25;
const MAX_DIST_PC = 1500;

const GREEK = {
  Alp: "α", Bet: "β", Gam: "γ", Del: "δ", Eps: "ε", Zet: "ζ", Eta: "η", The: "θ",
  Iot: "ι", Kap: "κ", Lam: "λ", Mu: "μ", Nu: "ν", Xi: "ξ", Omi: "ο", Pi: "π",
  Rho: "ρ", Sig: "σ", Tau: "τ", Ups: "υ", Phi: "φ", Chi: "χ", Psi: "ψ", Ome: "ω",
};

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function designation(r) {
  if (r.bayer) {
    const m = r.bayer.match(/^([A-Za-z]+)(?:-(\d+))?$/);
    const greek = m && GREEK[m[1]] ? GREEK[m[1]] + (m[2] ? superscript(m[2]) : "") : r.bayer;
    return `${greek} ${r.con}`;
  }
  if (r.flam) return `${r.flam} ${r.con}`;
  return "";
}

function superscript(n) {
  return [...n].map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]).join("");
}

async function loadCsv(file) {
  if (file && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  console.log("Downloading", SOURCE_URL);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.text();
}

const text = await loadCsv(process.argv[2]);
const lines = text.split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(lines[0]);
const col = Object.fromEntries(header.map((h, i) => [h, i]));

// Equatorial J2000 → ecliptic J2000 → render axes (x, ecl.z, −ecl.y), same as astronomy/scale.ts.
const EQJ_TO_ECL = Astronomy.Rotation_EQJ_ECL();

const rows = [];
for (let i = 1; i < lines.length; i++) {
  const f = parseCsvLine(lines[i]);
  const dist = Number(f[col.dist]);
  const mag = Number(f[col.mag]);
  const absmag = Number(f[col.absmag]);
  if (!Number.isFinite(dist) || !Number.isFinite(absmag) || dist >= 100000) continue;
  if (dist > MAX_DIST_PC) continue;
  if (!(mag <= MAX_MAG || dist <= NEIGHBOURHOOD_PC)) continue;

  const eq = new Astronomy.Vector(Number(f[col.x]), Number(f[col.y]), Number(f[col.z]), new Astronomy.AstroTime(0));
  const ecl = Astronomy.RotateVector(EQJ_TO_ECL, eq);
  const ci = f[col.ci] === "" ? 0.65 : Number(f[col.ci]);

  rows.push({
    x: ecl.x * LY_PER_PC,
    y: ecl.z * LY_PER_PC,
    z: -ecl.y * LY_PER_PC,
    absmag,
    ci: Number.isFinite(ci) ? ci : 0.65,
    mag,
    hyg: Number(f[col.id]),
    hip: f[col.hip] ? Number(f[col.hip]) : 0,
    hd: f[col.hd] ? Number(f[col.hd]) : 0,
    gl: f[col.gl].trim(),
    proper: f[col.proper].trim(),
    bayer: f[col.bayer].trim(),
    flam: f[col.flam].trim(),
    con: f[col.con].trim(),
    spect: f[col.spect].trim(),
  });
}

// Brightest (as seen from Earth) first, so partial rendering / label picking favours them.
rows.sort((a, b) => a.mag - b.mag);

const floats = new Float32Array(rows.length * 5);
rows.forEach((r, i) => floats.set([r.x, r.y, r.z, r.absmag, r.ci], i * 5));

const meta = {
  source: "HYG Database v4.1 (Hipparcos, Yale BSC, Gliese) — CC BY-SA 4.0 — github.com/astronexus/HYG-Database",
  count: rows.length,
  hyg: rows.map((r) => r.hyg),
  proper: rows.map((r) => r.proper),
  designation: rows.map(designation),
  hip: rows.map((r) => r.hip),
  hd: rows.map((r) => r.hd),
  gliese: rows.map((r) => r.gl),
  spect: rows.map((r) => r.spect),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "stars.bin"), Buffer.from(floats.buffer));
fs.writeFileSync(path.join(OUT_DIR, "stars-meta.json"), JSON.stringify(meta));

const named = rows.filter((r) => r.proper).length;
const near = rows.filter((r) => Math.hypot(r.x, r.y, r.z) <= NEIGHBOURHOOD_PC * LY_PER_PC).length;
console.log(`stars: ${rows.length} (named ${named}, within ${NEIGHBOURHOOD_PC} pc ${near})`);
console.log(`stars.bin ${(floats.byteLength / 1e6).toFixed(2)} MB, meta ${(fs.statSync(path.join(OUT_DIR, "stars-meta.json")).size / 1e6).toFixed(2)} MB`);
