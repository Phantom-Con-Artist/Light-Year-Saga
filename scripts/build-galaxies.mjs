/**
 * Builds the real-galaxy point cloud for the Universe view.
 *
 *   node scripts/build-galaxies.mjs [path/to/2mrs.tsv]
 *
 * Source: 2MASS Redshift Survey (Huchra et al. 2012, ApJS 199, 26), via
 * VizieR J/ApJS/199/26/table3 (columns RAJ2000, DEJ2000, cz, type, Ktmag).
 *
 * Distances: comoving distance from redshift (flat ΛCDM, Planck 2018).
 * Galaxies with cz < 500 km/s are skipped — their motion is dominated by
 * local peculiar velocities, so redshift is a poor distance indicator there
 * (the nearby showpiece galaxies are placed individually in the app instead).
 *
 * Output: apps/web/public/data/galaxies-2mrs.bin
 *   Float32 × 5 per galaxy: x, y, z (Mly, render axes), morphology T-type, Ks mag
 */
import fs from "node:fs";
import path from "node:path";
import * as Astronomy from "astronomy-engine";

const URL =
  "https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=J/ApJS/199/26/table3&-out.max=unlimited&-out=RAJ2000,DEJ2000,cz,type,Ktmag";
const OUT = path.resolve("apps/web/public/data/galaxies-2mrs.bin");
const MIN_CZ = 500;

const H0 = 67.4, OM = 0.315, OL = 0.685, C = 299_792.458, MLY_PER_MPC = 3.261563777;
const E = (z) => Math.sqrt(OM * (1 + z) ** 3 + OL);
function comovingMly(z) {
  const n = 200;
  const h = z / n;
  let s = 1 / E(0) + 1 / E(z);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) / E(i * h);
  return ((C / H0) * (s * h) / 3) * MLY_PER_MPC;
}

async function load(file) {
  if (file && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  console.log("Downloading 2MRS from VizieR…");
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`VizieR: ${res.status}`);
  return res.text();
}

const text = await load(process.argv[2]);
const rows = text.split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
// Header, units and dashes lines come first.
const header = rows[0].split("\t").map((s) => s.trim());
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const data = rows.slice(3);

const EQJ_TO_ECL = Astronomy.Rotation_EQJ_ECL();
const t0 = new Astronomy.AstroTime(0);
const out = [];
let skipped = 0;

for (const line of data) {
  const f = line.split("\t");
  const ra = Number(f[col.RAJ2000]);
  const dec = Number(f[col.DEJ2000]);
  const cz = Number(f[col.cz]);
  const k = Number(f[col.Ktmag]);
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(cz) || cz < MIN_CZ) {
    skipped++;
    continue;
  }
  const t = parseInt(f[col.type], 10);
  const d = comovingMly(cz / C);
  const r = (ra * Math.PI) / 180;
  const de = (dec * Math.PI) / 180;
  const eq = new Astronomy.Vector(Math.cos(de) * Math.cos(r), Math.cos(de) * Math.sin(r), Math.sin(de), t0);
  const e = Astronomy.RotateVector(EQJ_TO_ECL, eq);
  out.push(e.x * d, e.z * d, -e.y * d, Number.isFinite(t) ? t : 3, Number.isFinite(k) ? k : 11);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(new Float32Array(out).buffer));
const n = out.length / 5;
let maxD = 0;
for (let i = 0; i < n; i++) maxD = Math.max(maxD, Math.hypot(out[i * 5], out[i * 5 + 1], out[i * 5 + 2]));
console.log(`galaxies: ${n} (skipped ${skipped}), farthest ${Math.round(maxD)} Mly, ${(n * 20 / 1e6).toFixed(2)} MB`);
