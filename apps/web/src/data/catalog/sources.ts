import type { ExternalSource } from "../../domain/types";

/** SIMBAD (CDS) — positions, identifiers and bibliography for any named object. */
export const simbad = (ident: string, label = ident): ExternalSource => ({
  provider: "SIMBAD (CDS)",
  name: label,
  url: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(ident)}`,
  freshness: "STATIC",
});

/** NASA Exoplanet Archive system overview. */
export const exoArchive = (system: string): ExternalSource => ({
  provider: "NASA Exoplanet Archive",
  name: `${system} system overview`,
  url: `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(system)}`,
  freshness: "STATIC",
});

export const doi = (provider: string, name: string, id: string): ExternalSource => ({
  provider,
  name,
  url: `https://doi.org/${id}`,
  freshness: "STATIC",
});

export const TWO_MRS = doi("2MASS Redshift Survey", "Huchra et al. 2012, ApJS 199, 26", "10.1088/0067-0049/199/2/26");
