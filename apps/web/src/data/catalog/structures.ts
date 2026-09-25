import { Vector3 } from "three";
import type { CatalogObject } from "./types";
import { doi, simbad } from "./sources";
import { GEN_STRUCTURES, GEN_SUPERCLUSTERS, type GenStructure, type GenSupercluster } from "./structures.gen";

/**
 * Galaxy groups, clusters and superclusters found in real survey data (see
 * scripts/build-cosmic-web.mjs). Positions, sizes, member counts and masses
 * come from the catalogues; the text here explains them.
 */

export const TULLY_GROUPS = doi("Tully 2015", "Galaxy groups: a 2MASS catalog (AJ 149, 171)", "10.1088/0004-6256/149/5/171");
export const NEARBY_CATALOG = doi("Karachentsev et al. 2013", "Updated Nearby Galaxy Catalog (AJ 145, 101)", "10.1088/0004-6256/145/4/101");
const LANIAKEA_PAPER = doi("Tully et al. 2014", "The Laniakea supercluster of galaxies (Nature 513, 71)", "10.1038/nature13674");

const TEXT: Record<string, { description: string; simbad?: string; keywords?: string }> = {
  "local-group": {
    description:
      "Our own galaxy group: the Milky Way, Andromeda and Triangulum, with dozens of dwarf galaxies orbiting the two big spirals. It is about 10 million light-years across, and Andromeda and the Milky Way are falling towards each other.",
    keywords: "milky way andromeda m31 m33 dwarf satellites",
  },
  "m81-group": {
    description:
      "The nearest rich group beyond our own, in Ursa Major. M81 and M82 are tearing gas from each other in a close encounter, which lit the starburst in M82.",
    simbad: "M81 Group",
    keywords: "m82 bode cigar",
  },
  "centaurus-a-group": {
    description:
      "Built around Centaurus A, a giant elliptical with a dust lane and radio jets, likely the result of a merger. With the M83 group it forms one of the most massive concentrations near us.",
    simbad: "Cen A Group",
    keywords: "ngc 5128",
  },
  "m83-group": {
    description: "The Southern Pinwheel, M83, and its companions, the southern neighbour of the Centaurus A group.",
    keywords: "southern pinwheel",
  },
  "sculptor-group": {
    description: "A loose, elongated group led by the Sculptor Galaxy (NGC 253), one of the brightest galaxies in the sky and a vigorous starburst.",
  },
  "ic342-group": {
    description:
      "Hidden behind the Milky Way's dust: IC 342 and the Maffei galaxies would be among the brightest in the sky if our galaxy's disk weren't in the way.",
    keywords: "maffei",
  },
  "m94-group": { description: "A loose spray of galaxies in Canes Venatici around M94, stretched along our line of sight." },
  "m106-group": {
    description: "M106 and its companions in Canes Venatici. M106's water masers gave one of the first precise geometric distances to another galaxy.",
  },
  "m101-group": { description: "The Pinwheel Galaxy, M101, a big face-on spiral, with a handful of companions." },
  "leo-i-group": {
    description: "A group in Leo around M96, with the Leo Triplet close by. It holds the Leo Ring, a vast loop of hydrogen gas around two of its galaxies.",
    keywords: "m96 m95 m105",
  },
  "sombrero-group": {
    description: "The Sombrero Galaxy (M104) and its dwarf companions, in the Virgo Southern Extension well in front of the Virgo Cluster.",
    keywords: "m104",
  },

  "virgo-cluster": {
    description:
      "The nearest big galaxy cluster: well over a thousand galaxies bound together, with the giant elliptical M87 at its heart. Its gravity is slowly pulling on the Local Group, and it anchors the Local Supercluster.",
    simbad: "Virgo Cluster",
    keywords: "m87 m84 m86",
  },
  "fornax-cluster": {
    description: "The second-richest cluster within 100 million light-years, compact and dominated by the giant elliptical NGC 1399.",
    simbad: "Fornax Cluster",
    keywords: "ngc 1399",
  },
  "ursa-major-cluster": {
    description: "A loose, spiral-rich cluster with no dominant elliptical: a collection of groups still coming together.",
    keywords: "ursa major",
  },
  "antlia-cluster": {
    description: "A cluster in Antlia with two giant ellipticals at its core, part of the Hydra–Centaurus Supercluster.",
    simbad: "Antlia Cluster",
  },
  "centaurus-cluster": {
    description: "A rich cluster at the heart of the Hydra–Centaurus Supercluster, with the giant elliptical NGC 4696 at its centre.",
    simbad: "ACO 3526",
    keywords: "abell 3526 ngc 4696",
  },
  "hydra-cluster": {
    description: "A rich, fairly relaxed cluster in Hydra, one of the best-studied nearby clusters.",
    simbad: "ACO 1060",
    keywords: "abell 1060",
  },
  "norma-cluster": {
    description:
      "One of the most massive clusters near us, lying close to the Great Attractor, the region Laniakea's galaxies flow towards. It sits behind the Milky Way's disk, so it was only recognised in the 1990s.",
    simbad: "ACO 3627",
    keywords: "abell 3627 great attractor",
  },
  "pavo-ii-cluster": { description: "The main cluster of the Pavo–Indus Supercluster, next to the Great Attractor region." },
  "abell-262": { description: "A cluster on the Perseus–Pisces chain, with a cooling core of hot gas around the elliptical NGC 708.", simbad: "ACO 262" },
  "ngc-383-group": {
    description: "A rich group on the Perseus–Pisces chain around the radio galaxy NGC 383 (3C 31), whose jets span hundreds of thousands of light-years.",
    keywords: "3c 31 pisces",
  },
  "perseus-cluster": {
    description:
      "The brightest cluster in X-rays. Its hot gas carries a sound wave from the central black hole in NGC 1275: a B-flat 57 octaves below middle C. It anchors the Perseus–Pisces Supercluster.",
    simbad: "ACO 426",
    keywords: "abell 426 ngc 1275",
  },
  "abell-3574": { description: "A modest cluster in Centaurus, near the far edge of the Hydra–Centaurus region." },
  "leo-cluster": {
    description:
      "A spiral-rich cluster linked to Coma by a filament of galaxies. Its galaxies are being stripped of gas as they plough through the hot cluster medium.",
    simbad: "ACO 1367",
    keywords: "abell 1367",
  },
  "coma-cluster": {
    description:
      "Over a thousand galaxies, mostly ellipticals. In 1933 Fritz Zwicky noticed they move far too fast to be held by visible matter, the first evidence for dark matter.",
    simbad: "Coma Cluster",
    keywords: "abell 1656 dark matter",
  },
  "abell-496": { description: "A relaxed cluster in Eridanus with a cool, dense core of X-ray-bright gas.", simbad: "ACO 496" },
  "ophiuchus-cluster": {
    description:
      "A massive cluster hidden near the Milky Way's centre. In 2020 X-ray data revealed the scar of the biggest explosion known, from its central black hole.",
    keywords: "biggest explosion",
  },
  "abell-2199": {
    description: "A cluster in Hercules around the giant elliptical NGC 6166, whose radio jets have blown cavities in the hot gas.",
    simbad: "ACO 2199",
    keywords: "ngc 6166",
  },
  "hercules-cluster": {
    description: "A young, spiral-rich cluster still assembling, with many colliding galaxies.",
    simbad: "ACO 2151",
    keywords: "abell 2151",
  },
  "abell-3716": { description: "A pair of merging subclusters in Indus, far out towards the Pavo–Indus region." },
  "abell-3558": {
    description:
      "The central cluster of the Shapley Supercluster, the most massive concentration of galaxies within a billion light-years. The survey here only reaches its brightest members.",
    simbad: "ACO 3558",
    keywords: "shapley",
  },

  "local-supercluster": {
    description:
      "Our home supercluster: the Virgo Cluster and the groups around it, including the Local Group. Here it is found directly from the data, by linking neighbouring galaxy groups. It is itself one lobe of the larger Laniakea.",
    keywords: "virgo supercluster laniakea",
  },
  "perseus-pisces": {
    description:
      "A long chain of clusters, one of the most prominent structures in the nearby universe. It lies just outside Laniakea, on the far side of the Local Void.",
    keywords: "perseus pisces chain",
  },
  "hydra-centaurus": {
    description: "The massive neighbour of our own supercluster, centred on the Centaurus, Hydra and Antlia clusters. It is part of Laniakea.",
    keywords: "laniakea",
  },
  "pavo-indus-norma": {
    description: "The Norma Cluster and the Pavo–Indus clusters, around the Great Attractor near the centre of Laniakea's flow.",
    keywords: "great attractor laniakea",
  },
  "fornax-eridanus": {
    description: "A sheet of groups around the Fornax Cluster and the Eridanus groups. It belongs to Laniakea.",
    keywords: "fornax wall eridanus",
  },
  "coma-supercluster": {
    description: "The Coma and Leo clusters and the groups between them, the first supercluster to be mapped (1978). It forms part of the Great Wall.",
    keywords: "great wall cfa",
  },
  "hercules-supercluster": {
    description: "A chain of clusters in Hercules, including Abell 2151 and Abell 2199, at the far edge of this survey's reach.",
    keywords: "abell 2151 2199",
  },
  "ophiuchus-supercluster": { description: "A supercluster behind the Milky Way's bulge, around the Ophiuchus Cluster." },
};

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
const massLabel = (m: number) => `~${fmt(m / 1e14, m < 1e14 ? 2 : 1)} × 10¹⁴ M☉`;
const distanceLabel = (d: number) => (d < 10 ? `~${fmt(d, 1)} million ly` : `~${fmt(d, 0)} million ly`);

function structureObject(s: GenStructure, index: number): CatalogObject {
  const t = TEXT[s.id];
  const nearby = s.kind === "group";
  const extent = s.radiusMly * 2;
  const facts: [string, string][] = [
    ["Distance", distanceLabel(s.distanceMly)],
    [nearby ? "Known member galaxies" : "Bright member galaxies", fmt(s.members)],
    nearby ? ["Most members within", `${fmt(s.radiusMly, 1)} million ly of its centre`] : ["Size", `~${fmt(extent, extent < 10 ? 1 : 0)} million ly across`],
  ];
  if (s.sigmaKms) facts.push(["Galaxy speeds (dispersion)", `${fmt(s.sigmaKms)} km/s`]);
  if (s.massSolar) facts.push(["Mass (incl. dark matter)", massLabel(s.massSolar)]);
  if (s.velocityKms) facts.push(["Receding at", `${fmt(s.velocityKms)} km/s`]);
  const sup = GEN_SUPERCLUSTERS.find((x) => x.id === s.supercluster);
  if (sup) facts.push(["Part of", sup.name]);
  return {
    id: s.id,
    name: s.name,
    kind: nearby ? "group" : "cluster",
    level: "cosmic",
    classification: nearby ? "Galaxy group" : "Galaxy cluster",
    description: t?.description ?? "",
    visualNote: nearby
      ? "The dots are its member galaxies at their measured distances, from the Updated Nearby Galaxy Catalog. Membership: galaxies gravitationally bound to the group's main galaxy."
      : "The highlighted dots are its member galaxies in the 2MASS Redshift Survey, grouped by Tully (2015). Members share the group's distance, which removes the smearing redshift distances cause inside clusters; their depth within the group isn't measured, so it is spread to match the group's width on the sky.",
    facts,
    position: new Vector3(...s.position),
    extent,
    framing: Math.max(extent * 3.2, 3),
    accent: nearby ? "#9fe0c8" : "#ffd08a",
    distanceLabel: distanceLabel(s.distanceMly),
    sources: [nearby ? NEARBY_CATALOG : TULLY_GROUPS, ...(t?.simbad ? [simbad(t.simbad)] : [])],
    keywords: `${t?.keywords ?? ""} galaxy ${nearby ? "group" : "cluster"}`,
    structureIndex: index,
  };
}

function superclusterObject(s: GenSupercluster, index: number): CatalogObject {
  const t = TEXT[s.id];
  const extent = s.radiusMly * 2;
  const clusters = GEN_STRUCTURES.filter((c) => c.supercluster === s.id && c.kind === "cluster").map((c) => c.name.replace(/ \(.*\)$/, ""));
  const facts: [string, string][] = [
    ["Distance", distanceLabel(s.distanceMly)],
    ["Size", `~${fmt(extent, 0)} million ly across`],
    ["Groups linked", fmt(s.groups)],
    ["Bright galaxies", fmt(s.galaxies)],
  ];
  if (clusters.length) facts.push(["Main clusters", clusters.join(", ")]);
  if (s.laniakea) facts.push(["Part of", "Laniakea"]);
  return {
    id: s.id,
    name: s.name,
    kind: "supercluster",
    level: "cosmic",
    classification: s.id === "fornax-eridanus" ? "Cloud of galaxy groups" : "Supercluster",
    description: t?.description ?? "",
    visualNote:
      "Found from the data: galaxy groups with four or more members were linked whenever they lie within 30 million light-years of each other, and the linked set was named after the known clusters it contains. Superclusters aren't gravitationally bound, so their edges depend on the method.",
    facts,
    position: new Vector3(...s.position),
    extent,
    framing: Math.max(extent * 2.4, 60),
    accent: "#ffb38a",
    distanceLabel: distanceLabel(s.distanceMly),
    sources: [TULLY_GROUPS, ...(s.laniakea ? [LANIAKEA_PAPER] : [])],
    keywords: `${t?.keywords ?? ""} supercluster`,
    superclusterIndex: index,
  };
}

export const STRUCTURE_OBJECTS: CatalogObject[] = [...GEN_STRUCTURES.map(structureObject), ...GEN_SUPERCLUSTERS.map(superclusterObject)];

/** Colour per supercluster when the map is coloured by structure (index = supercluster index). */
export const SUPERCLUSTER_COLORS = ["#ffd08a", "#ff8fb1", "#8fd1ff", "#b7a4ff", "#8ff0c4", "#ffb07a", "#f2f08c", "#9fb6ff", "#ff9d9d"];
