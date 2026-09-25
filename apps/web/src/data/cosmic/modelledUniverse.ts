/**
 * A modelled (synthetic) universe to surround the real galaxy map.
 *
 * Real survey galaxies stop being a complete sample a few hundred million
 * light-years out; beyond that, these points sketch what fills the rest of
 * the observable universe. None of them is a real, catalogued galaxy.
 *
 * Structure: the Voronoi foam model of the cosmic web (Icke & van de
 * Weygaert 1987): space is split into cells around randomly placed nuclei.
 * Cells are voids; galaxies collect on the walls between two cells, the
 * filaments where three meet and the nodes (clusters) where four meet.
 * Galaxy fractions by environment follow N-body classifications (e.g. Cautun
 * et al. 2014): ~12% nodes, ~45% filaments, ~25% walls, ~18% voids.
 *
 * Galaxies: luminosities from a Schechter function (α = −1.1); sizes grow as
 * L^0.35; morphology follows the morphology–density relation (Dressler 1980):
 * ellipticals and lenticulars dominate clusters, blue spirals and irregulars
 * the voids. Colours redden with redshift (Planck 2018 cosmology).
 *
 * Budget: points thin out with distance, and far points stand for brighter
 * galaxies, much as a deep survey sees only the luminous ones far away.
 */

export const MODELLED_INNER_MLY = 250;
/** First galaxies formed a few hundred million years after the Big Bang: ~43 Gly comoving. */
export const MODELLED_OUTER_MLY = 43_000;
/** Mean spacing of Voronoi nuclei: voids are typically 100–200 Mly across. */
export const VORONOI_CELL_MLY = 150;

export const ENVIRONMENTS = ["Cluster (node)", "Filament", "Wall", "Void"] as const;
export const MODELLED_TYPES = ["Elliptical", "Lenticular", "Spiral", "Irregular", "Starburst"] as const;

export interface ModelledUniverse {
  count: number;
  /** xyz per galaxy, render axes, Mly. */
  positions: Float32Array;
  /** Luminosity in units of L* (the Schechter knee, roughly the Milky Way). */
  luminosity: Float32Array;
  /** Stellar-disk diameter, Mly. */
  diameter: Float32Array;
  /** Per galaxy: type, environment, display brightness (0–255), redshift reddening (0–255). */
  props: Uint8Array;
  /** Voronoi nucleus seed, so the same budget always gives the same universe. */
  seed: number;
}

/* ------------------------------------------------------------ randomness */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash of an integer grid cell → [0, 1) values, for nuclei that need no storage. */
function cellHash(x: number, y: number, z: number, k: number): number {
  let h = Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f) ^ Math.imul(k + 1, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ----------------------------------------------------------- cosmology */

// Planck 2018 flat ΛCDM, as astronomy/cosmology.ts.
const H0 = 67.4;
const OM = 0.315;
const OL = 0.685;
const HUBBLE_MLY = (299_792.458 / H0) * 3.261563777;

/** Tabulated comoving distance → redshift. */
function redshiftTable(): (dMly: number) => number {
  const zs: number[] = [0];
  const ds: number[] = [0];
  let d = 0;
  let z = 0;
  const dz = 0.002;
  while (z < 30) {
    const f = (x: number) => 1 / Math.sqrt(OM * (1 + x) ** 3 + OL);
    d += ((f(z) + 4 * f(z + dz / 2) + f(z + dz)) / 6) * dz * HUBBLE_MLY;
    z += dz;
    zs.push(z);
    ds.push(d);
  }
  return (dMly) => {
    let lo = 0;
    let hi = ds.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ds[mid] < dMly) lo = mid;
      else hi = mid;
    }
    const t = (dMly - ds[lo]) / Math.max(ds[hi] - ds[lo], 1e-9);
    return zs[lo] + t * (zs[hi] - zs[lo]);
  };
}

/* ------------------------------------------------------ sampling tables */

/** Inverse-CDF sampler for a tabulated density on [a, b]. */
function tabulated(a: number, b: number, bins: number, density: (x: number) => number) {
  const cdf = new Float64Array(bins + 1);
  for (let i = 0; i < bins; i++) {
    const x = a + ((i + 0.5) / bins) * (b - a);
    cdf[i + 1] = cdf[i] + Math.max(0, density(x));
  }
  const total = cdf[bins];
  for (let i = 0; i <= bins; i++) cdf[i] /= total;
  /** u in [0, 1) → x; `from` restricts the draw to x ≥ from. */
  return (u: number, from = a) => {
    const f0 = from <= a ? 0 : cdf[Math.min(bins, Math.floor(((from - a) / (b - a)) * bins))];
    const target = f0 + u * (1 - f0);
    let lo = 0;
    let hi = bins;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < target) lo = mid;
      else hi = mid;
    }
    const t = (target - cdf[lo]) / Math.max(cdf[hi] - cdf[lo], 1e-12);
    return a + ((lo + t) / bins) * (b - a);
  };
}

/* ------------------------------------------------------------ geometry */

type V3 = [number, number, number];

/** Nearest four Voronoi nuclei around p (jittered grid, one nucleus per cell). */
function nearestNuclei(p: V3, seed: number, out: V3[]): void {
  const S = VORONOI_CELL_MLY;
  const cx = Math.floor(p[0] / S);
  const cy = Math.floor(p[1] / S);
  const cz = Math.floor(p[2] / S);
  const best = [Infinity, Infinity, Infinity, Infinity];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        const x = cx + dx;
        const y = cy + dy;
        const z = cz + dz;
        const n: V3 = [(x + cellHash(x, y, z, seed)) * S, (y + cellHash(x, y, z, seed + 1)) * S, (z + cellHash(x, y, z, seed + 2)) * S];
        const d = (n[0] - p[0]) ** 2 + (n[1] - p[1]) ** 2 + (n[2] - p[2]) ** 2;
        for (let k = 0; k < 4; k++) {
          if (d < best[k]) {
            for (let j = 3; j > k; j--) {
              best[j] = best[j - 1];
              out[j] = out[j - 1];
            }
            best[k] = d;
            out[k] = n;
            break;
          }
        }
      }
}

/** Project p onto the plane equidistant from nuclei a and b (their shared wall). */
function toBisector(p: V3, a: V3, b: V3): void {
  const n: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  n[0] /= len;
  n[1] /= len;
  n[2] /= len;
  const s = (p[0] - (a[0] + b[0]) / 2) * n[0] + (p[1] - (a[1] + b[1]) / 2) * n[1] + (p[2] - (a[2] + b[2]) / 2) * n[2];
  p[0] -= s * n[0];
  p[1] -= s * n[1];
  p[2] -= s * n[2];
}

/* --------------------------------------------------------------- model */

const SCHECHTER_ALPHA = -1.1;
/** Luminosity range sampled, in L*. */
const X_MIN = 0.02;
const X_MAX = 12;
/** Radial thinning: the number per shell flattens beyond this. */
const R_THIN = 2000;

export function modelledBudget(particles: number): number {
  return particles >= 300_000 ? 320_000 : particles >= 160_000 ? 200_000 : particles >= 80_000 ? 110_000 : 50_000;
}

export function buildModelledUniverse(count: number, seed = 20260925): ModelledUniverse {
  const rand = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
  const zOf = redshiftTable();

  // Real survey data owns the nearby universe; the model ramps in behind it.
  const ramp = (r: number) => {
    const t = Math.min(1, Math.max(0, (r - MODELLED_INNER_MLY) / 500));
    return t * t * (3 - 2 * t);
  };
  const sampleR = tabulated(MODELLED_INNER_MLY, MODELLED_OUTER_MLY, 6000, (r) => (r * r * ramp(r)) / (1 + (r / R_THIN) ** 3.4));
  // Schechter: dN/dx ∝ x^α e^−x, sampled in log x so the faint end resolves.
  const lnMin = Math.log(X_MIN);
  const lnMax = Math.log(X_MAX);
  const sampleLnX = tabulated(lnMin, lnMax, 800, (lx) => Math.exp((SCHECHTER_ALPHA + 1) * lx - Math.exp(lx)));

  const positions = new Float32Array(count * 3);
  const luminosity = new Float32Array(count);
  const diameter = new Float32Array(count);
  const props = new Uint8Array(count * 4);
  const nuclei: V3[] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const p: V3 = [0, 0, 0];

  for (let i = 0; i < count; i++) {
    const r = sampleR(rand());
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    p[0] = r * s * Math.cos(phi);
    p[1] = r * u;
    p[2] = r * s * Math.sin(phi);

    const e = rand();
    const env = e < 0.12 ? 0 : e < 0.57 ? 1 : e < 0.82 ? 2 : 3;
    if (env !== 3) {
      nearestNuclei(p, seed, nuclei);
      const [a, b, c, d] = nuclei;
      // Alternating projections converge onto the intersection of the planes.
      const passes = env === 2 ? 1 : env === 1 ? 6 : 10;
      for (let k = 0; k < passes; k++) {
        toBisector(p, a, b);
        if (env <= 1) toBisector(p, a, c);
        if (env === 0) toBisector(p, a, d);
      }
      // Thickness: walls are sheets, filaments tubes, clusters compact balls.
      const w = env === 0 ? 2.5 * Math.abs(gauss()) + 1 : env === 1 ? 5 : 4;
      p[0] += gauss() * w;
      p[1] += gauss() * w;
      p[2] += gauss() * w;
    }

    // Far points stand for brighter galaxies (what a deep survey picks up).
    const rr = Math.hypot(p[0], p[1], p[2]);
    const xFloor = Math.min(3, X_MIN * (1 + rr / R_THIN) ** 1.6);
    let x = Math.exp(sampleLnX(rand(), Math.log(Math.max(xFloor, X_MIN))));

    // Morphology–density relation.
    const early = [0.7, 0.4, 0.28, 0.1][env];
    let type: number;
    if (rand() < early) type = rand() < 0.55 ? 0 : 1;
    else {
      const t = rand();
      type = t < 0.75 ? 2 : t < (env === 3 ? 0.97 : 0.9) ? 3 : 4;
    }
    if (env === 0 && type === 0) x *= 1.6; // bright cluster ellipticals
    if (env === 3) x *= 0.7; // void galaxies are small and faint
    x = Math.min(x, X_MAX * 1.6);

    const size = 0.1 * x ** 0.35 * (type === 0 ? 0.85 : type === 3 ? 0.5 : type === 4 ? 0.7 : 1);
    const z = zOf(rr);
    const bright = Math.min(1, Math.max(0.12, 0.5 + 0.3 * Math.log10(x) + (type === 4 ? 0.2 : 0)));
    const redden = Math.min(1, Math.max(0, (z - 0.1) / 2.5));

    positions[i * 3] = p[0];
    positions[i * 3 + 1] = p[1];
    positions[i * 3 + 2] = p[2];
    luminosity[i] = x;
    diameter[i] = Math.min(0.4, Math.max(0.004, size));
    props[i * 4] = type;
    props[i * 4 + 1] = env;
    props[i * 4 + 2] = Math.round(bright * 255);
    props[i * 4 + 3] = Math.round(redden * 255);
  }
  return { count, positions, luminosity, diameter, props, seed };
}
