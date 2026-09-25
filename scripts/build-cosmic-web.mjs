/**
 * Builds the Universe view's galaxy map with real group, cluster and
 * supercluster membership.
 *
 *   node scripts/build-cosmic-web.mjs [dir-with-cached-tsv]
 *
 * Sources (via VizieR):
 * - Tully 2015, "Galaxy groups: a 2MASS catalog" (AJ 149, 171), table 5: every
 *   2MRS galaxy (Ks < 11.75, ~43k) with its group ("nest") and group distance.
 *   Using the group's distance for all its members removes the "fingers of
 *   god" (clusters smeared along the line of sight by their internal motions).
 *   Distances there are in h⁻¹ Mpc; we use H0 = 75 km/s/Mpc (Cosmicflows-4).
 * - Karachentsev et al. 2013, "Updated Nearby Galaxy Catalog" (AJ 145, 101):
 *   ~870 galaxies within ~36 Mly with measured distances (Cepheids, tip of the
 *   red giant branch…) and each galaxy's main gravitational "disturber", which
 *   gives membership of the Local Group and its neighbours.
 *
 * Superclusters are found here, from the data: friends-of-friends linking of
 * groups with 4+ members at 30 Mly, then named after the known clusters they
 * contain. Unnamed linkages are left as plain groups.
 *
 * Output:
 *   apps/web/public/data/cosmic-web.bin   Float32 × 6 per galaxy: x, y, z (Mly, render axes),
 *                                         T-type, structure index (−1 none), supercluster index (−1 none)
 *   apps/web/public/data/cosmic-web-meta.json     per-galaxy identifiers, same order as the .bin:
 *                                         PGC numbers for the 2MRS rows, then UNGC names for the nearby ones
 *   apps/web/src/data/catalog/structures.gen.ts   named structures (bundled: search, list, inspector)
 */
import fs from "node:fs";
import path from "node:path";
import * as Astronomy from "astronomy-engine";

const VIZIER = "https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-out.max=unlimited&-source=";
const TULLY = `${VIZIER}J/AJ/149/171/table5&-out=PGC,_RA.icrs,_DE.icrs,MType,Nest,Nmb,Dist,sigV,R2t,Mvir,Mlum,%3CVcmba%3E`;
const UNGC = `${VIZIER}J/AJ/145/101/catalog&-out=Name,RAJ2000,DEJ2000,TT,Dist,MD,Ti1`;
const MLY_PER_MPC = 3.261563777;
/** Tully's distances are in h⁻¹ Mpc (H0 = 100); rescale to H0 = 75. */
const H_SCALE = 100 / 75;
/** Inside this, the nearby catalogue's measured distances replace redshift distances. */
const NEARBY_MLY = 36;
const LINK_MLY = 30;
/**
 * Clusters whose redshift distance is known to be biased by local motions,
 * placed at their measured distance instead: Virgo (16.5 Mpc, Mei et al. 2007),
 * where our own fall towards it inflates the redshift distance by ~20%.
 */
const MEASURED_MLY = new Map([[100002, 53.8]]);

async function table(url, cache) {
  const file = cache && path.join(cache, path.basename(new URL(url).searchParams.get("-source")).replace(/\//g, "_") + ".tsv");
  let text;
  if (file && fs.existsSync(file)) text = fs.readFileSync(file, "utf8");
  else {
    console.log("Downloading", url.split("-source=")[1].split("&")[0]);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`VizieR ${res.status}`);
    text = await res.text();
    if (file) fs.writeFileSync(file, text);
  }
  const lines = text.split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
  const header = lines[0].split("\t").map((s) => s.trim());
  // Header, units and dashes rows come first.
  return lines.slice(3).map((l) => {
    const f = l.split("\t");
    return Object.fromEntries(header.map((h, i) => [h, (f[i] ?? "").trim()]));
  });
}

const EQJ_TO_ECL = Astronomy.Rotation_EQJ_ECL();
const t0 = new Astronomy.AstroTime(0);
/** RA/Dec (deg) + distance → render axes (x, ecl.z, −ecl.y), as everywhere in the app. */
function toRender(raDeg, decDeg, d) {
  const r = (raDeg * Math.PI) / 180;
  const de = (decDeg * Math.PI) / 180;
  const e = Astronomy.RotateVector(EQJ_TO_ECL, new Astronomy.Vector(Math.cos(de) * Math.cos(r), Math.cos(de) * Math.sin(r), Math.sin(de), t0));
  return [e.x * d, e.z * d, -e.y * d];
}
const sexa = (s, hours) => {
  const [a, b, c] = s.split(/\s+/).map(Number);
  const sign = s.trim().startsWith("-") ? -1 : 1;
  return (Math.abs(a) + b / 60 + (c || 0) / 3600) * sign * (hours ? 15 : 1);
};
const round = (v, k = 2) => Math.round(v * 10 ** k) / 10 ** k;

/* ------------------------------------------------ named clusters (Tully nests) */

// Identified by position and velocity against the Abell/ACO and NED records.
const CLUSTERS = [
  [100002, "virgo-cluster", "Virgo Cluster"],
  [200015, "fornax-cluster", "Fornax Cluster"],
  [100008, "ursa-major-cluster", "Ursa Major Cluster"],
  [100014, "antlia-cluster", "Antlia Cluster"],
  [100003, "centaurus-cluster", "Centaurus Cluster (Abell 3526)"],
  [100006, "hydra-cluster", "Hydra Cluster (Abell 1060)"],
  [200002, "norma-cluster", "Norma Cluster (Abell 3627)"],
  [200004, "pavo-ii-cluster", "Pavo II Cluster"],
  [200003, "abell-262", "Abell 262"],
  [200005, "ngc-383-group", "NGC 383 Group (Pisces)"],
  [200001, "perseus-cluster", "Perseus Cluster (Abell 426)"],
  [100011, "abell-3574", "Abell 3574"],
  [100005, "leo-cluster", "Leo Cluster (Abell 1367)"],
  [100001, "coma-cluster", "Coma Cluster (Abell 1656)"],
  [200007, "abell-496", "Abell 496"],
  [100009, "ophiuchus-cluster", "Ophiuchus Cluster"],
  [100004, "abell-2199", "Abell 2199"],
  [100007, "hercules-cluster", "Hercules Cluster (Abell 2151)"],
  [200009, "abell-3716", "Abell 3716"],
  [100010, "abell-3558", "Abell 3558 (Shapley core)"],
];

// Supercluster names, keyed by a cluster each one is known to contain.
const SUPER_ANCHORS = [
  [100002, "local-supercluster", "Local (Virgo) Supercluster"],
  [200001, "perseus-pisces", "Perseus–Pisces Supercluster"],
  [100003, "hydra-centaurus", "Hydra–Centaurus Supercluster"],
  [100006, "hydra-centaurus", "Hydra–Centaurus Supercluster"],
  [200002, "pavo-indus-norma", "Norma & Pavo–Indus Superclusters"],
  [200004, "pavo-indus-norma", "Norma & Pavo–Indus Superclusters"],
  [200015, "fornax-eridanus", "Fornax–Eridanus Cloud"],
  [100001, "coma-supercluster", "Coma Supercluster"],
  [100005, "coma-supercluster", "Coma Supercluster"],
  [100004, "hercules-supercluster", "Hercules Supercluster"],
  [100007, "hercules-supercluster", "Hercules Supercluster"],
  [100009, "ophiuchus-supercluster", "Ophiuchus Supercluster"],
];
/** Laniakea (Tully et al. 2014) is defined by galaxy motions; these found superclusters lie inside it. */
const LANIAKEA = ["local-supercluster", "hydra-centaurus", "pavo-indus-norma", "fornax-eridanus"];

/* --------------------------------------------- nearby groups (Karachentsev) */

const NEARBY_GROUPS = [
  ["local-group", "Local Group", ["Milky Way", "MESSIER031"]],
  ["m81-group", "M81 Group", ["MESSIER081", "MESSIER082"]],
  ["centaurus-a-group", "Centaurus A Group", ["NGC5128", "NGC4945"]],
  ["m83-group", "M83 Group", ["NGC5236"]],
  ["sculptor-group", "Sculptor Group", ["NGC0253"]],
  ["ic342-group", "IC 342 / Maffei Group", ["IC0342", "Maffei2", "Maffei1"]],
  ["m94-group", "M94 Group (Canes Venatici I)", ["NGC4736"]],
  ["m106-group", "M106 Group", ["NGC4258"]],
  ["m101-group", "M101 Group", ["MESSIER101"]],
  ["leo-i-group", "Leo I Group (M96)", ["NGC3368"]],
  ["sombrero-group", "Sombrero Group", ["NGC4594"]],
];

/* ------------------------------------------------------------------ build */

const cache = process.argv[2];
const [tully, ungc] = [await table(TULLY, cache), await table(UNGC, cache)];

const galaxies = []; // { p: [x,y,z], t, group: key|null }
const structures = []; // clusters + nearby groups, indexed by the galaxy attribute
const groupKeyToStructure = new Map();

// Tully groups: centre (luminosity-agnostic mean direction) and group distance.
const nests = new Map();
for (const r of tully) {
  const dMly = MEASURED_MLY.get(Number(r.Nest)) ?? Number(r.Dist) * H_SCALE * MLY_PER_MPC;
  if (!Number.isFinite(dMly) || dMly < NEARBY_MLY) continue;
  const ra = Number(r["_RA.icrs"]);
  const dec = Number(r["_DE.icrs"]);
  const p = toRender(ra, dec, dMly);
  galaxies.push({ p, t: Number(r.MType), nest: Number(r.Nest), pgc: Number(r.PGC) });
  let n = nests.get(Number(r.Nest));
  if (!n) {
    n = {
      nest: Number(r.Nest),
      n: Number(r.Nmb),
      d: dMly,
      sigma: Number(r.sigV),
      r2t: Number(r.R2t),
      mvir: Number(r.Mvir),
      mlum: Number(r.Mlum),
      v: Number(r["<Vcmba>"]),
      sum: [0, 0, 0],
      k: 0,
      ra: 0,
      dec: 0,
    };
    nests.set(Number(r.Nest), n);
  }
  n.sum[0] += p[0];
  n.sum[1] += p[1];
  n.sum[2] += p[2];
  n.k++;
}
for (const n of nests.values()) n.c = n.sum.map((v) => v / n.k);

// Group members share one distance, which would flatten each group into a thin
// sheet on the sky. Individual depths inside a group aren't measured, so spread
// members along the line of sight by the group's own width across the sky
// (seeded, so the map is the same every build).
let seed = 20260925;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(2 * Math.PI * rand());
const membersOf = new Map();
for (const g of galaxies) {
  if (!membersOf.has(g.nest)) membersOf.set(g.nest, []);
  membersOf.get(g.nest).push(g);
}
for (const n of nests.values()) {
  if (n.k < 2) continue;
  const members = membersOf.get(n.nest);
  const dir = n.c.map((v) => v / Math.hypot(...n.c));
  // RMS distance from the centre across the line of sight.
  const width = Math.sqrt(
    members.reduce((a, g) => {
      const d = [g.p[0] - n.c[0], g.p[1] - n.c[1], g.p[2] - n.c[2]];
      const along = d[0] * dir[0] + d[1] * dir[1] + d[2] * dir[2];
      return a + d[0] ** 2 + d[1] ** 2 + d[2] ** 2 - along ** 2;
    }, 0) /
      members.length /
      2,
  );
  for (const g of members) {
    const len = Math.hypot(...g.p);
    const k = (len + gauss() * width) / len;
    g.p = g.p.map((v) => v * k);
  }
}

// Superclusters: friends-of-friends over groups with 4+ members.
const rich = [...nests.values()].filter((n) => n.n >= 4);
const parent = rich.map((_, i) => i);
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
for (let i = 0; i < rich.length; i++)
  for (let j = i + 1; j < rich.length; j++) {
    const a = rich[i].c;
    const b = rich[j].c;
    if ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 < LINK_MLY * LINK_MLY) parent[find(i)] = find(j);
  }
const nestToRoot = new Map(rich.map((n, i) => [n.nest, find(i)]));
const superById = new Map();
const superByRoot = new Map();
for (const [nest, id, name] of SUPER_ANCHORS) {
  const root = nestToRoot.get(nest);
  if (root === undefined) continue;
  if (!superById.has(id)) superById.set(id, { id, name });
  superByRoot.set(root, superById.get(id));
}
const superclusters = [...superById.values()];
const nestToSuper = new Map();
for (const n of rich) {
  const s = superByRoot.get(nestToRoot.get(n.nest));
  if (s) nestToSuper.set(n.nest, superclusters.indexOf(s));
}

// Named clusters become structures.
for (const [nest, id, name] of CLUSTERS) {
  const n = nests.get(nest);
  if (!n) throw new Error(`Missing nest ${nest}`);
  groupKeyToStructure.set(nest, structures.length);
  structures.push({
    id,
    name,
    kind: "cluster",
    position: n.c.map((v) => round(v)),
    distanceMly: round(Math.hypot(...n.c), 1),
    radiusMly: round(Math.max(n.r2t * H_SCALE * MLY_PER_MPC, 1), 2),
    members: n.n,
    sigmaKms: n.sigma,
    // Masses scale as h⁻¹; catalogue units are 10¹² M☉.
    massSolar: Number(((Number.isFinite(n.mvir) && n.mvir > 0 ? n.mvir : n.mlum) * H_SCALE * 1e12).toPrecision(2)),
    velocityKms: n.v,
    supercluster: nestToSuper.has(nest) ? superclusters[nestToSuper.get(nest)].id : null,
  });
}

// Nearby catalogue: measured distances; membership by chasing each galaxy's main disturber.
const byName = new Map(ungc.map((r) => [r.Name, r]));
const principalOf = new Map(NEARBY_GROUPS.flatMap(([id, , principals]) => principals.map((p) => [p, id])));
function nearbyGroup(r) {
  if (principalOf.has(r.Name)) return principalOf.get(r.Name);
  if (!(Number(r.Ti1) > 0)) return null; // not bound to its main disturber
  let md = r.MD;
  for (let hops = 0; hops < 6 && md; hops++) {
    if (principalOf.has(md)) return principalOf.get(md);
    const next = byName.get(md);
    if (!next) return null;
    md = next.MD;
  }
  return null;
}
const nearbyMembers = new Map(NEARBY_GROUPS.map(([id]) => [id, []]));
for (const r of ungc) {
  const dMly = Number(r.Dist) * MLY_PER_MPC;
  if (!Number.isFinite(dMly) || dMly > NEARBY_MLY || r.Name === "Milky Way") continue;
  const p = toRender(sexa(r.RAJ2000, true), sexa(r.DEJ2000, false), dMly);
  const g = nearbyGroup(r);
  galaxies.push({ p, t: Number(r.TT), nearby: g, name: r.Name });
  if (g) nearbyMembers.get(g).push({ name: r.Name, p });
}
for (const [id, name] of NEARBY_GROUPS) {
  const members = nearbyMembers.get(id);
  // The Milky Way sits at the origin and is not a catalogue row; count it in.
  const pts = id === "local-group" ? [...members.map((m) => m.p), [0, 0, 0]] : members.map((m) => m.p);
  const c = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / pts.length);
  // 80th percentile: one straggler shouldn't set the group's size.
  const spread = pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])).sort((a, b) => a - b);
  const radius = spread[Math.floor((spread.length - 1) * 0.8)];
  groupKeyToStructure.set(id, structures.length);
  structures.push({
    id,
    name,
    kind: "group",
    position: c.map((v) => round(v, 3)),
    distanceMly: round(Math.hypot(...c), 2),
    radiusMly: round(radius, 2),
    members: pts.length,
    supercluster: "local-supercluster",
  });
}

// Supercluster geometry from its member groups.
const superOut = superclusters.map((s, k) => {
  const groups = rich.filter((n) => nestToSuper.get(n.nest) === k);
  const w = groups.reduce((a, n) => a + n.n, 0);
  const c = groups.reduce((a, n) => [a[0] + n.c[0] * n.n, a[1] + n.c[1] * n.n, a[2] + n.c[2] * n.n], [0, 0, 0]).map((v) => v / w);
  const radius = Math.max(...groups.map((n) => Math.hypot(n.c[0] - c[0], n.c[1] - c[1], n.c[2] - c[2])));
  return {
    id: s.id,
    name: s.name,
    position: c.map((v) => round(v)),
    distanceMly: round(Math.hypot(...c), 0),
    radiusMly: round(radius, 0),
    groups: groups.length,
    galaxies: w,
    laniakea: LANIAKEA.includes(s.id),
  };
});
// The Local Group's neighbours belong to the Local Supercluster too.
const localSuper = superOut.findIndex((s) => s.id === "local-supercluster");

// Galaxy attributes.
const floats = new Float32Array(galaxies.length * 6);
galaxies.forEach((g, i) => {
  const key = g.nest ?? g.nearby;
  const structure = key != null && groupKeyToStructure.has(key) ? groupKeyToStructure.get(key) : -1;
  const sup = g.nest != null ? (nestToSuper.get(g.nest) ?? -1) : g.nearby ? localSuper : -1;
  floats.set([g.p[0], g.p[1], g.p[2], Number.isFinite(g.t) ? g.t : 3, structure, sup], i * 6);
});
fs.writeFileSync(path.resolve("apps/web/public/data/cosmic-web.bin"), Buffer.from(floats.buffer));
const pgcRows = galaxies.filter((g) => g.pgc !== undefined);
if (galaxies.slice(0, pgcRows.length).some((g) => g.pgc === undefined)) throw new Error("2MRS rows must come first");
fs.writeFileSync(
  path.resolve("apps/web/public/data/cosmic-web-meta.json"),
  JSON.stringify({ pgc: pgcRows.map((g) => g.pgc), names: galaxies.slice(pgcRows.length).map((g) => g.name) }),
);

fs.writeFileSync(
  path.resolve("apps/web/src/data/catalog/structures.gen.ts"),
  `/* Generated by scripts/build-cosmic-web.mjs from Tully 2015 (AJ 149, 171) and Karachentsev et al. 2013 (AJ 145, 101). Do not edit. */

export interface GenStructure {
  id: string;
  name: string;
  /** "cluster": rich cluster from Tully's 2MRS groups; "group": nearby group with measured distances. */
  kind: "cluster" | "group";
  /** Render axes, millions of light-years. */
  position: [number, number, number];
  distanceMly: number;
  radiusMly: number;
  /** Members in the catalogue (2MRS galaxies brighter than Ks 11.75, or all known nearby galaxies). */
  members: number;
  sigmaKms?: number;
  massSolar?: number;
  velocityKms?: number;
  supercluster: string | null;
}

export interface GenSupercluster {
  id: string;
  name: string;
  position: [number, number, number];
  distanceMly: number;
  radiusMly: number;
  groups: number;
  galaxies: number;
  /** Inside Laniakea, our home basin of attraction (Tully et al. 2014). */
  laniakea: boolean;
}

/** Index in this list = the structure index stored per galaxy in cosmic-web.bin. */
export const GEN_STRUCTURES: GenStructure[] = ${JSON.stringify(structures, null, 2)};

/** Index in this list = the supercluster index stored per galaxy in cosmic-web.bin. */
export const GEN_SUPERCLUSTERS: GenSupercluster[] = ${JSON.stringify(superOut, null, 2)};

export const COSMIC_WEB_GALAXIES = ${galaxies.length};
`,
);

console.log(`galaxies ${galaxies.length} (${galaxies.filter((g) => g.nearby !== undefined).length} nearby with measured distances)`);
console.log(
  `structures ${structures.length}; superclusters: ${superOut.map((s) => `${s.name} (${s.groups} groups, ${s.galaxies} gal, r ${s.radiusMly} Mly)`).join("; ")}`,
);
for (const [id] of NEARBY_GROUPS) console.log(`  ${id}: ${nearbyMembers.get(id).length} members`);
