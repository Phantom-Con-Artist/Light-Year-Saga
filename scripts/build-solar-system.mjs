/**
[[[[[[[[[[[[[[[[[[[[[[[[[[["hydra", "undefined", "9", 38.20177]nix", "undefined", "9", 24.85463]charon", "undefined", "undefined", 6.387221]nereid", "undefined", "undefined", 360.13619]triton", "undefined", "undefined", 5.876854]proteus", "undefined", "undefined", 1.122315]oberon", "undefined", "undefined", 13.463239]titania", "undefined", "undefined", 8.705872]umbriel", "undefined", "undefined", 4.144177]ariel", "undefined", "undefined", 2.520379]miranda", "undefined", "undefined", 1.413479]phoebe", "undefined", "undefined", 550.31]iapetus", "undefined", "undefined", 79.3215]hyperion", "undefined", "undefined", 21.276609]titan", "undefined", "undefined", 15.945421]rhea", "undefined", "undefined", 4.518212]dione", "undefined", "undefined", 2.736915]tethys", "undefined", "undefined", 1.887802]enceladus", "undefined", "undefined", 1.370218]mimas", "undefined", "undefined", 0.942422]amalthea", "undefined", "undefined", 0.498179]callisto", "undefined", "undefined", 16.689017]ganymede", "undefined", "undefined", 7.154553]europa", "undefined", "undefined", 3.551181]io", "undefined", "undefined", 1.769138]deimos", "undefined", "undefined", 1.26244]phobos", "undefined", "undefined", 0.31891]* Builds the real-data layers of the Solar System view.
 *
 *   apps/web/public/data/small-bodies-core.bin   brightest/most notable asteroids, all TNOs & centaurs
 *   apps/web/public/data/small-bodies-more.bin   the rest (loaded on higher graphics tiers)
 *   apps/web/public/data/spacecraft.json         JPL Horizons trajectories (Voyagers, Pioneers, New Horizons, …)
 *   apps/web/public/data/satellites.bin          every active Earth satellite (CelesTrak GP data)
 *   apps/web/src/data/solar/elements.gen.ts      named small bodies (JPL SBDB), moon orbits (JPL Horizons),
 *                                                named satellite TLEs, epochs and counts
 *
 * Sources: JPL Small-Body Database (ssd-api.jpl.nasa.gov), JPL Horizons, CelesTrak.
 *
 * Usage: node scripts/build-solar-system.mjs [cacheDir]
 *   With a cacheDir, downloads are saved there and reused on the next run.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "apps/web/public/data");
const GEN = join(ROOT, "apps/web/src/data/solar/elements.gen.ts");
const CACHE = process.argv[2];
if (CACHE) mkdirSync(CACHE, { recursive: true });
mkdirSync(dirname(GEN), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, cacheName) {
  const file = CACHE && cacheName ? join(CACHE, cacheName) : null;
  if (file && existsSync(file)) return readFileSync(file, "utf8");
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "LightYearSaga-build/1.0" } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const text = await res.text();
      if (file) writeFileSync(file, text);
      return text;
    } catch (e) {
      if (attempt >= 3) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
}

const K_GAUSS = 0.9856076686; // deg/day at 1 AU
const wrap360 = (x) => ((x % 360) + 360) % 360;
const wrap180 = (x) => wrap360(x + 180) - 180;
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const r9 = (x) => Math.round(x * 1e9) / 1e9;

/* ---------------------------------------------------------------- small bodies */

/** Colour classes for the point cloud (must match SMALL_BODY_CLASSES in the app). */
const CLASS = {
  MBA: 0,
  INNER: 1, // Hungarias, Mars-crossers, inner belt
  OUTER: 2,
  HILDA: 3,
  TROJAN: 4,
  NEO: 5,
  CENTAUR: 6,
  PLUTINO: 7,
  CLASSICAL: 8,
  SCATTERED: 9,
  DETACHED: 10,
  OTHER: 11,
};

function classify(sbClass, a, e) {
  const q = a * (1 - e);
  switch (sbClass) {
    case "MBA":
      return CLASS.MBA;
    case "IMB":
    case "MCA":
      return CLASS.INNER;
    case "OMB":
      return a > 3.7 && a < 4.2 ? CLASS.HILDA : CLASS.OUTER;
    case "TJN":
      return CLASS.TROJAN;
    case "APO":
    case "ATE":
    case "AMO":
    case "IEO":
      return CLASS.NEO;
    case "CEN":
      return CLASS.CENTAUR;
    case "TNO":
      if (a > 39 && a < 40) return CLASS.PLUTINO;
      if (a > 42 && a < 48.5 && e < 0.25) return CLASS.CLASSICAL;
      if (q > 40 && a > 80) return CLASS.DETACHED;
      return CLASS.SCATTERED;
    default:
      return CLASS.OTHER;
  }
}

async function sbdbQuery(classes, hLimit, tag) {
  const cdata = encodeURIComponent(JSON.stringify({ AND: [`H|LT|${hLimit}`] }));
  const url =
    `https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=a,e,i,om,w,ma,epoch,H,class&sb-kind=a&sb-class=${classes}` +
    `&sb-cdata=${cdata}&full-prec=1`;
  const json = JSON.parse(await get(url, `sbdb-${tag}.json`));
  console.log(`  ${tag}: ${json.count}`);
  return json.data;
}

async function buildSmallBodies() {
  console.log("Small bodies (JPL SBDB)…");
  const rows = [
    ...(await sbdbQuery("MBA", 14.6, "mba")),
    ...(await sbdbQuery("IMB,MCA,OMB,PAA,AST", 15, "belt-other")),
    ...(await sbdbQuery("TJN", 15, "trojans")),
    ...(await sbdbQuery("APO,ATE,AMO,IEO", 21, "neo")),
    ...(await sbdbQuery("CEN,TNO", 99, "outer")),
  ];

  const epochs = new Map();
  for (const r of rows) epochs.set(r[6], (epochs.get(r[6]) ?? 0) + 1);
  const epoch = Number([...epochs.entries()].sort((x, y) => y[1] - x[1])[0][0]);

  const bodies = [];
  for (const [a, e, i, om, w, ma, ep, H, cls] of rows) {
    const A = Number(a);
    const E = Number(e);
    if (!(A > 0) || !(E < 1) || ma === null || H === null) continue;
    const n = K_GAUSS / Math.pow(A, 1.5);
    bodies.push({
      a: A,
      e: E,
      i: Number(i),
      om: wrap360(Number(om)),
      w: wrap360(Number(w)),
      m: wrap360(Number(ma) + n * (epoch - Number(ep))),
      H: Number(H),
      c: classify(cls, A, E),
    });
  }

  // Core file: everything beyond Neptune plus the brightest of each inner family.
  const quota = { [CLASS.TROJAN]: 3000, [CLASS.NEO]: 2500, main: 13000 };
  const byH = [...bodies].sort((x, y) => x.H - y.H);
  const core = [];
  const more = [];
  const used = { [CLASS.TROJAN]: 0, [CLASS.NEO]: 0, main: 0 };
  for (const b of byH) {
    const outer = b.c >= CLASS.CENTAUR && b.c <= CLASS.DETACHED;
    const key = b.c === CLASS.TROJAN || b.c === CLASS.NEO ? b.c : "main";
    if (outer || used[key] < quota[key]) {
      if (!outer) used[key]++;
      core.push(b);
    } else more.push(b);
  }

  const pack = (list) => {
    const buf = Buffer.alloc(list.length * 20);
    list.forEach((b, k) => {
      const o = k * 20;
      buf.writeFloatLE(b.a, o);
      buf.writeFloatLE(b.e, o + 4);
      buf.writeUInt16LE(Math.round((b.i / 180) * 65535), o + 8);
      buf.writeUInt16LE(Math.round((b.om / 360) * 65535) % 65536, o + 10);
      buf.writeUInt16LE(Math.round((b.w / 360) * 65535) % 65536, o + 12);
      buf.writeUInt16LE(Math.round((b.m / 360) * 65535) % 65536, o + 14);
      buf.writeUInt16LE(Math.max(0, Math.round((b.H + 5) * 100)), o + 16);
      buf.writeUInt8(b.c, o + 18);
    });
    return buf;
  };
  writeFileSync(join(PUBLIC, "small-bodies-core.bin"), pack(core));
  writeFileSync(join(PUBLIC, "small-bodies-more.bin"), pack(more));

  const counts = new Array(12).fill(0);
  for (const b of bodies) counts[b.c]++;
  console.log(`  core ${core.length}, more ${more.length}, epoch JD ${epoch}`);
  return { epoch, core: core.length, more: more.length, counts };
}

/* ---------------------------------------------------------------- named bodies */

/** [id, SBDB search string]. Physical and discovery facts come from SBDB too. */
const NAMED = [
  ["ceres", "1"],
  ["eris", "136199"],
  ["haumea", "136108"],
  ["makemake", "136472"],
  ["gonggong", "225088"],
  ["quaoar", "50000"],
  ["orcus", "90482"],
  ["sedna", "90377"],
  ["arrokoth", "486958"],
  ["farfarout", "2018 AG37"],
  ["vesta", "4"],
  ["pallas", "2"],
  ["hygiea", "10"],
  ["psyche", "16"],
  ["eros", "433"],
  ["bennu", "101955"],
  ["ryugu", "162173"],
  ["itokawa", "25143"],
  ["apophis", "99942"],
  ["didymos", "65803"],
  ["kamooalewa", "469219"],
  ["cruithne", "3753"],
  ["patroclus", "617"],
  ["chiron", "2060"],
  ["halley", "1P"],
  ["encke", "2P"],
  ["churyumov-gerasimenko", "67P"],
  ["tempel-1", "9P"],
  ["hartley-2", "103P"],
  ["swift-tuttle", "109P"],
  ["tempel-tuttle", "55P"],
  ["pons-brooks", "12P"],
  ["wild-2", "81P"],
  ["hale-bopp", "C/1995 O1"],
  ["hyakutake", "C/1996 B2"],
  ["neowise", "C/2020 F3"],
  ["tsuchinshan-atlas", "C/2023 A3"],
  ["oumuamua", "1I"],
  ["borisov", "2I"],
  ["atlas-3i", "3I"],
];

const num = (x) => (x === null || x === undefined || x === "" ? undefined : Number(x));

async function buildNamed() {
  console.log("Named bodies (JPL SBDB)…");
  const out = {};
  for (const [id, sstr] of NAMED) {
    const url = `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${encodeURIComponent(sstr)}&full-prec=1&phys-par=1&discovery=1`;
    let json = JSON.parse(await get(url, `sbdb-${id}.json`));
    if (json.list) {
      // Ambiguous (e.g. a periodic comet with several apparitions): take the first listed designation.
      const pick = json.list[0].pdes;
      json = JSON.parse(await get(`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${encodeURIComponent(pick)}&full-prec=1&phys-par=1&discovery=1`, `sbdb-${id}-2.json`));
    }
    if (!json.orbit) {
      console.warn(`  ! ${id}: ${JSON.stringify(json).slice(0, 200)}`);
      continue;
    }
    const el = Object.fromEntries(json.orbit.elements.map((x) => [x.name, num(x.value)]));
    const phys = Object.fromEntries((json.phys_par ?? []).map((x) => [x.name, { value: x.value, units: x.units }]));
    const d = json.discovery ?? {};
    out[id] = {
      designation: json.object.fullname.trim(),
      kind: json.object.kind, // an, au, cn, cu (numbered/unnumbered asteroid/comet)
      orbitClass: json.object.orbit_class?.name,
      epoch: Number(json.orbit.epoch),
      e: r9(el.e),
      q: r9(el.q),
      i: r6(el.i),
      om: r6(el.om),
      w: r6(el.w),
      tp: r6(el.tp),
      ...(el.a !== undefined ? { a: r9(el.a) } : {}),
      ...(el.per !== undefined ? { periodDays: Math.round(el.per * 10) / 10 } : {}),
      phys: {
        diameterKm: num(phys.diameter?.value),
        extent: phys.extent?.value,
        rotationHours: num(phys.rot_per?.value),
        albedo: num(phys.albedo?.value),
        H: num(phys.H?.value),
        gm: num(phys.GM?.value),
        density: num(phys.density?.value),
      },
      discovery: d.date ? { date: d.date, by: d.who, site: d.site ?? d.location } : undefined,
    };
    console.log(`  ${id}: ${out[id].designation} e=${el.e}`);
    await sleep(120);
  }
  return out;
}

/* ---------------------------------------------------------------- moons */

/**
 * [id, Horizons id, Horizons centre, published sidereal period in days].
 * The period only resolves whole turns when fitting the mean-longitude rate;
 * the rate itself comes from Horizons. Nix and Hydra circle the Pluto–Charon
 * barycentre (9), not Pluto.
 */
const MOONS = [
  ["phobos", "401", "499", 0.31891],
  ["deimos", "402", "499", 1.26244],
  ["io", "501", "599", 1.769138],
  ["europa", "502", "599", 3.551181],
  ["ganymede", "503", "599", 7.154553],
  ["callisto", "504", "599", 16.689017],
  ["amalthea", "505", "599", 0.498179],
  ["mimas", "601", "699", 0.942422],
  ["enceladus", "602", "699", 1.370218],
  ["tethys", "603", "699", 1.887802],
  ["dione", "604", "699", 2.736915],
  ["rhea", "605", "699", 4.518212],
  ["titan", "606", "699", 15.945421],
  ["hyperion", "607", "699", 21.276609],
  ["iapetus", "608", "699", 79.3215],
  ["phoebe", "609", "699", 550.31],
  ["miranda", "705", "799", 1.413479],
  ["ariel", "701", "799", 2.520379],
  ["umbriel", "702", "799", 4.144177],
  ["titania", "703", "799", 8.705872],
  ["oberon", "704", "799", 13.463239],
  ["proteus", "808", "899", 1.122315],
  ["triton", "801", "899", 5.876854],
  ["nereid", "802", "899", 360.13619],
  ["charon", "901", "999", 6.387221],
  ["nix", "902", "9", 24.85463],
  ["hydra", "903", "9", 38.20177],
];

/** 2026-01-01, +10 days, +1 year (TDB). */
const T0 = 2461041.5;
const T_LIST = [T0, T0 + 10, T0 + 365];

function horizonsCsv(text) {
  const body = text.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!body) throw new Error(text.slice(0, 600));
  return body
    .trim()
    .split("\n")
    .map((l) => l.split(",").map((s) => s.trim()));
}

async function buildMoons() {
  console.log("Moons (JPL Horizons)…");
  const out = {};
  for (const [id, target, center, period] of MOONS) {
    const url =
      `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='${target}'&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=ELEMENTS` +
      `&CENTER='500@${center}'&TLIST=${T_LIST.map((t) => `'${t}'`).join("%20")}&TLIST_TYPE=JD&REF_PLANE=ECLIPTIC&REF_SYSTEM=J2000` +
      `&CSV_FORMAT=YES&OUT_UNITS='KM-D'`;
    const json = JSON.parse(await get(url, `hz-moon-${id}.json`));
    // JDTDB, Cal, EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR
    const rows = horizonsCsv(json.result).map((c) => ({
      e: +c[2],
      i: +c[4],
      om: +c[5],
      w: +c[6],
      n: +c[8],
      ma: +c[9],
      a: +c[11],
    }));
    const [p, q, y] = rows;
    const dOm = wrap180(q.om - p.om) / 10;
    // For near-circular orbits the osculating periapsis swings about; it barely changes the path.
    const dW = p.e < 0.01 ? 0 : wrap180(q.w - p.w) / 10;
    const L = (r) => r.om + r.w + r.ma;
    const predicted = L(p) + (360 / period) * 365;
    const k = Math.round((predicted - L(y)) / 360);
    const dL = (L(y) + 360 * k - L(p)) / 365;
    out[id] = {
      epoch: T0,
      aKm: Math.round(p.a),
      e: r6(p.e),
      i: r6(p.i),
      om: r6(wrap360(p.om)),
      dOm: r9(dOm),
      w: r6(wrap360(p.w)),
      dW: r9(dW),
      L: r6(wrap360(L(p))),
      dL: r9(dL),
    };
    console.log(`  ${id}: a=${out[id].aKm} km, period ${(360 / dL).toFixed(4)} d`);
    await sleep(150);
  }
  return out;
}

/* ---------------------------------------------------------------- spacecraft */

/**
 * [id, Horizons id, centre, start, stop, step, extra windows]. Heliocentric
 * unless the centre is Earth. Windows add finer samples around planetary
 * flybys, where a monthly track would cut corners.
 */
const CRAFT = [
  ["voyager-1", "-31", "10", "1977-09-06", "2035-01-01", "1 mo", [["1979-02-10", "1979-04-01", "12 h"], ["1980-10-25", "1980-12-05", "12 h"]]],
  ["voyager-2", "-32", "10", "1977-08-21", "2035-01-01", "1 mo", [["1979-06-20", "1979-08-05", "12 h"], ["1981-08-05", "1981-09-15", "12 h"], ["1986-01-05", "1986-02-15", "12 h"], ["1989-08-05", "1989-09-15", "12 h"]]],
  ["pioneer-10", "-23", "10", "1972-03-04", "2035-01-01", "1 mo", [["1973-11-15", "1973-12-25", "12 h"]]],
  ["pioneer-11", "-24", "10", "1973-04-07", "2035-01-01", "1 mo", [["1974-11-15", "1974-12-25", "12 h"], ["1979-08-15", "1979-09-25", "12 h"]]],
  ["new-horizons", "-98", "10", "2006-01-20", "2035-01-01", "1 mo", [["2007-02-10", "2007-03-20", "12 h"]]],
  ["cassini", "-82", "10", "1997-10-16", "2017-09-15", "2 d", []],
  ["juno", "-61", "10", "2011-08-06", "2030-01-01", "2 d", []],
  ["europa-clipper", "-159", "10", "2024-10-15", "2031-01-01", "2 d", []],
  ["parker-solar-probe", "-96", "10", "2018-08-13", "2030-01-01", "2 d", []],
  ["jwst", "-170", "399", "2021-12-26", "2030-01-01", "1 d", []],
];

const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
/** "2027-Jan-01 00:00:00.0000" → ISO date, from Horizons' span messages. */
function parseHzDate(s) {
  const m = s.match(/(\d{4})-([A-Za-z]{3})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], MONTHS[m[2].toUpperCase()], +m[3], +(m[4] ?? 0), +(m[5] ?? 0)));
}

async function vectors(target, center, start, stop, step, tag) {
  const url =
    `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='${target}'&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=VECTORS` +
    `&CENTER='500@${center}'&START_TIME='${start}'&STOP_TIME='${stop}'&STEP_SIZE='${encodeURIComponent(step)}'` +
    `&REF_PLANE=ECLIPTIC&REF_SYSTEM=J2000&VEC_TABLE=2&CSV_FORMAT=YES&OUT_UNITS='AU-D'`;
  const json = JSON.parse(await get(url, `hz2-${tag}.json`));
  return json.result;
}

async function buildSpacecraft() {
  console.log("Spacecraft (JPL Horizons)…");
  const out = {};
  for (const [id, target, center, start, stop, step, windows] of CRAFT) {
    let result = await vectors(target, center, start, stop, step, `${id}-${start}-${stop}`);
    if (!result.includes("$$SOE")) {
      // Out of the ephemeris span: clamp to what Horizons reports and retry.
      const after = result.match(/after\s+A\.D\.\s+([0-9A-Za-z-]+\s[\d:.]+)/i) ?? result.match(/prior to\s+A\.D\.\s+([0-9A-Za-z-]+\s[\d:.]+)/i);
      const end = after && parseHzDate(after[1]);
      if (!end) throw new Error(`${id}: ${result.slice(0, 800)}`);
      const e = new Date(end.getTime() - 86_400_000).toISOString().slice(0, 10);
      const isStart = /prior to/i.test(after[0]);
      const s2 = isStart ? new Date(end.getTime() + 86_400_000).toISOString().slice(0, 10) : start;
      const t2 = isStart ? stop : e;
      console.log(`  ${id}: span clamped to ${s2} … ${t2}`);
      result = await vectors(target, center, s2, t2, step, `${id}-${s2}-${t2}`);
    }
    const rows = horizonsCsv(result);
    for (const [ws, we, wstep] of windows) {
      rows.push(...horizonsCsv(await vectors(target, center, ws, we, wstep, `${id}-${ws}-${we}`)));
      await sleep(150);
    }
    // Days from J2000, position (AU), velocity (AU/day); sorted, duplicates dropped.
    const byT = new Map();
    for (const c of rows) byT.set(Math.round((+c[0] - 2451545) * 1000) / 1000, c);
    const pts = [];
    for (const [t, c] of [...byT.entries()].sort((a, b) => a[0] - b[0])) {
      pts.push(t, r6(+c[2]), r6(+c[3]), r6(+c[4]), r9(+c[5]), r9(+c[6]), r9(+c[7]));
    }
    out[id] = { center: center === "10" ? "sun" : "earth", points: pts };
    console.log(`  ${id}: ${byT.size} samples`);
    await sleep(150);
  }
  // Float32 × 7 per sample; the index (offset/count per craft) goes in the generated TS.
  const total = Object.values(out).reduce((n, v) => n + v.points.length, 0);
  const buf = Buffer.alloc(total * 4);
  const index = {};
  let at = 0;
  for (const [id, v] of Object.entries(out)) {
    index[id] = { center: v.center, offset: at / 7, count: v.points.length / 7, start: v.points[0], end: v.points[v.points.length - 7] };
    for (const x of v.points) buf.writeFloatLE(x, 4 * at++);
  }
  writeFileSync(join(PUBLIC, "spacecraft.bin"), buf);
  return index;
}

/* ---------------------------------------------------------------- satellites */

const RE_KM = 6378.137;
const MU = 398600.4418;
const J2 = 1.08263e-3;
const SAT_SOURCES = [
  "active", "stations", "starlink", "oneweb", "kuiper", "qianfan", "gnss", "geo", "weather", "resource", "science", "geodetic",
  "engineering", "education", "planet", "spire", "iridium-NEXT", "globalstar", "orbcomm", "amateur", "satnogs",
  "x-comm", "other-comm", "sarsat", "dmc", "tdrss", "argos", "intelsat", "ses", "eutelsat", "military", "radar", "cubesat",
];
const SAT_GROUP = { station: 0, starlink: 1, oneweb: 2, leo: 3, meo: 4, geo: 5, heo: 6 };

async function buildSatellites() {
  console.log("Satellites (CelesTrak)…");
  // CelesTrak serves each group once per 2 hours per client, so "active" is
  // assembled from its component groups (merged by catalogue number).
  const byId = new Map();
  let stations = new Set();
  for (const group of SAT_SOURCES) {
    let list;
    try {
      list = JSON.parse(await get(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`, `celestrak-${group}.json`));
    } catch (e) {
      console.warn(`  ! ${group}: ${e.message}`);
      continue;
    }
    if (group === "stations") stations = new Set(list.map((s) => s.NORAD_CAT_ID));
    for (const s of list) byId.set(s.NORAD_CAT_ID, s);
    await sleep(300);
  }
  const all = [...byId.values()];

  const jd = (iso) => Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`) / 86_400_000 + 2440587.5;
  const epoch = Math.max(...all.map((s) => jd(s.EPOCH)));
  const sats = [];
  for (const s of all) {
    const n = s.MEAN_MOTION; // rev/day
    if (!(n > 0)) continue;
    const nRad = (n * 2 * Math.PI) / 86400;
    const aKm = Math.cbrt(MU / (nRad * nRad));
    const e = s.ECCENTRICITY;
    const inc = (s.INCLINATION * Math.PI) / 180;
    const p = (aKm * (1 - e * e)) / RE_KM;
    const nDeg = n * 360; // deg/day
    const dOm = -1.5 * nDeg * J2 * Math.cos(inc) / (p * p);
    const dW = 0.75 * nDeg * J2 * (5 * Math.cos(inc) ** 2 - 1) / (p * p);
    const dt = epoch - jd(s.EPOCH);
    const perigee = aKm * (1 - e) - RE_KM;
    const name = s.OBJECT_NAME;
    const group = stations.has(s.NORAD_CAT_ID)
      ? SAT_GROUP.station
      : /^STARLINK/.test(name)
        ? SAT_GROUP.starlink
        : /^ONEWEB/.test(name)
          ? SAT_GROUP.oneweb
          : e > 0.25
            ? SAT_GROUP.heo
            : aKm > 40_000 && aKm < 44_000
              ? SAT_GROUP.geo
              : perigee > 2000
                ? SAT_GROUP.meo
                : SAT_GROUP.leo;
    sats.push({
      a: aKm / RE_KM,
      e,
      i: s.INCLINATION,
      om: wrap360(s.RA_OF_ASC_NODE + dOm * dt),
      w: wrap360(s.ARG_OF_PERICENTER + dW * dt),
      m: wrap360(s.MEAN_ANOMALY + nDeg * dt),
      g: group,
    });
  }
  const buf = Buffer.alloc(sats.length * 20);
  sats.forEach((b, k) => {
    const o = k * 20;
    buf.writeFloatLE(b.a, o);
    buf.writeFloatLE(b.e, o + 4);
    buf.writeUInt16LE(Math.round((b.i / 180) * 65535), o + 8);
    buf.writeUInt16LE(Math.round((b.om / 360) * 65535) % 65536, o + 10);
    buf.writeUInt16LE(Math.round((b.w / 360) * 65535) % 65536, o + 12);
    buf.writeUInt16LE(Math.round((b.m / 360) * 65535) % 65536, o + 14);
    buf.writeUInt8(b.g, o + 18);
  });
  writeFileSync(join(PUBLIC, "satellites.bin"), buf);
  const counts = new Array(7).fill(0);
  for (const s of sats) counts[s.g]++;
  console.log(`  ${sats.length} satellites, epoch JD ${epoch.toFixed(3)}; groups ${counts.join(" ")}`);

  const tles = {};
  for (const [id, cat] of [
    ["iss", 25544],
    ["tiangong", 48274],
    ["hubble", 20580],
  ]) {
    const text = await get(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${cat}&FORMAT=TLE`, `tle-${cat}.txt`);
    const lines = text.trim().split(/\r?\n/).map((l) => l.trimEnd());
    tles[id] = { norad: cat, line1: lines[1], line2: lines[2] };
  }
  return { epoch: Math.round(epoch * 1e5) / 1e5, count: sats.length, counts, tles, fetched: new Date().toISOString().slice(0, 10) };
}

/* ---------------------------------------------------------------- write */

const small = await buildSmallBodies();
const named = await buildNamed();
const moons = await buildMoons();
const craft = await buildSpacecraft();
const sats = await buildSatellites();

const ts = `// Generated by scripts/build-solar-system.mjs — do not edit.
// Sources: JPL Small-Body Database, JPL Horizons, CelesTrak. Built ${new Date().toISOString().slice(0, 10)}.
/* eslint-disable */

export interface SbdbPhysical {
  diameterKm?: number;
  extent?: string;
  rotationHours?: number;
  albedo?: number;
  H?: number;
  gm?: number;
  density?: number;
}

/** Heliocentric osculating elements, ecliptic J2000 (JPL SBDB). Angles in degrees, times as JD (TDB). */
export interface SbdbBody {
  designation: string;
  kind: string;
  orbitClass?: string;
  epoch: number;
  e: number;
  q: number;
  a?: number;
  i: number;
  om: number;
  w: number;
  tp: number;
  periodDays?: number;
  phys: SbdbPhysical;
  discovery?: { date: string; by?: string; site?: string };
}

/** Planet-centred orbit, ecliptic J2000, with secular rates (deg/day) fitted to JPL Horizons. */
export interface MoonOrbit {
  epoch: number;
  aKm: number;
  e: number;
  i: number;
  om: number;
  dOm: number;
  w: number;
  dW: number;
  /** Mean longitude Ω + ω + M and its rate. */
  L: number;
  dL: number;
}

export const SMALL_BODY_EPOCH_JD = ${small.epoch};
export const SMALL_BODY_COUNTS = { core: ${small.core}, more: ${small.more}, byClass: ${JSON.stringify(small.counts)} };

export const SBDB_BODIES: Record<string, SbdbBody> = ${JSON.stringify(named, null, 1)};

export const MOON_ORBITS: Record<string, MoonOrbit> = ${JSON.stringify(moons, null, 1)};

/**
 * Index into /data/spacecraft.bin (Float32 × 7 per sample: days from J2000,
 * x, y, z in AU, vx, vy, vz in AU/day; ecliptic J2000, centred on the Sun or Earth).
 */
export const SPACECRAFT_TRACKS: Record<string, { center: "sun" | "earth"; offset: number; count: number; start: number; end: number }> = ${JSON.stringify(craft)};

export const SATELLITES = ${JSON.stringify(sats, null, 1)} as const;
`;
writeFileSync(GEN, ts);
console.log(`Wrote ${GEN}`);
