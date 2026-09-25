# Star data licence

`stars.bin` and `stars-meta.json` are derived from the **HYG Database v4.1** by David Nash
(https://github.com/astronexus/HYG-Database). HYG combines the Hipparcos, Yale Bright Star
and Gliese catalogues.

The derived files are distributed under the same licence as the source:
**Creative Commons Attribution-ShareAlike 4.0 International** (https://creativecommons.org/licenses/by-sa/4.0/).

To regenerate them, run `node scripts/build-stars.mjs`.

# Constellation licence

`constellations.json` (stick figures and IAU boundaries) is derived from **d3-celestial** by
Olaf Frohn (https://github.com/ofrohn/d3-celestial), BSD 3-Clause licence:

> Copyright (c) 2015, Olaf Frohn. All rights reserved.
> Redistribution and use in source and binary forms, with or without modification, are permitted
> provided that the following conditions are met: (1) redistributions of source code must retain the
> above copyright notice, this list of conditions and the following disclaimer; (2) redistributions in
> binary form must reproduce the above copyright notice, this list of conditions and the following
> disclaimer in the documentation and/or other materials provided with the distribution; (3) neither
> the name of the copyright holder nor the names of its contributors may be used to endorse or promote
> products derived from this software without specific prior written permission.
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED
> WARRANTIES ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY
> DAMAGES ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE.

To regenerate it, run `node scripts/build-constellations.mjs`.

## Solar System (`small-bodies-*.bin`, `spacecraft.bin`, `satellites.bin`)

Built by `scripts/build-solar-system.mjs`.

- Asteroid, comet and trans-Neptunian orbits, sizes and discovery details: NASA/JPL Small-Body Database (https://ssd.jpl.nasa.gov/tools/sbdb_query.html). US Government work, public domain.
- Moon orbits and spacecraft trajectories: NASA/JPL Horizons (https://ssd.jpl.nasa.gov/horizons/). Public domain.
- Earth satellite orbital elements: CelesTrak (https://celestrak.org), from US Space Force data. Refreshed live in the browser when online.

## Universe (`cosmic-web.bin`, `cosmic-web-meta.json`)

Built by `scripts/build-cosmic-web.mjs` from VizieR:

- Tully 2015, "Galaxy groups: a 2MASS catalog", AJ 149, 171 (2MASS Redshift Survey galaxies, groups and PGC numbers)
- Karachentsev, Makarov & Kaisina 2013, "Updated Nearby Galaxy Catalog", AJ 145, 101 (galaxy names and measured distances)

The modelled galaxies drawn beyond these surveys are not data: they are generated
in the browser from a Voronoi model of the cosmic web (`src/data/cosmic/modelledUniverse.ts`).
