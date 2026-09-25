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
