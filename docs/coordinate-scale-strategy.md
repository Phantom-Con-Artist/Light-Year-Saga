# Coordinate & Scale Strategy

Light Year Saga keeps **real positions** and **render positions** strictly separate.

```text
Astronomy Engine  →  real position (AU, heliocentric, J2000 ecliptic)
                           │   apps/web/src/astronomy/ephemeris.ts
                           ▼
                    visualization transform
                           │   apps/web/src/astronomy/scale.ts
                           ▼
                    render position (scene units, three.js y-up)
```

Everything shown to the user as a number (distances, light time, speeds) comes from
the real position, never the render position.

## Frames

| Frame | Used for | Units |
|---|---|---|
| Heliocentric J2000 mean ecliptic | Sun, planets | AU |
| Geocentric J2000 mean ecliptic | Moon (offset from Earth) | AU |
| Render (three.js) | the scene only | scene units |

Axis mapping into the scene: `render = (ecl.x, ecl.z, -ecl.y)`. The ecliptic plane is
the scene's XZ plane and ecliptic north points up (+Y). The mapping is a proper rotation,
so orbits keep their real direction of travel.

## Distance compression

A true-scale Solar System is unusable, so the transform compresses magnitudes and
**always preserves direction**:

| Quantity | Formula | Example |
|---|---|---|
| Heliocentric distance | `40 · √(AU)` | Earth → 40, Neptune → ~220 |
| Body radius | `0.03 · km^0.4` | Earth → ~1.0, Jupiter → ~2.6, Sun → ~6.5 |
| Moon offset from parent | `R_parent · (1.5 + 0.35 · √(d / r_parent))` | Moon → ~4.2 from Earth |

The ecliptic grid in the scene draws rings at **true** distances of 1, 5, 10, 20 and 30 AU,
so the compression stays visible to the user.

## Visual-only liberties

These affect appearance only and never feed displayed data:

- **Spin** is capped at about 0.9 rad per real second, so fast-forwarding doesn't strobe.
- **Axial tilt** is applied about a fixed scene axis. It isn't the true pole orientation (RA/Dec of the pole).
- **Surfaces** are procedural shaders, not imagery.

## Sky background

The star map is equatorial plate carrée: RA 0h at the image centre, RA increasing to the left, north at the top.
The sky shader rotates each scene direction from ecliptic to equatorial coordinates using the J2000
obliquity (23.4393°), then looks up RA/Dec. The Milky Way and the stars therefore appear where they really are
relative to the planets. The orientation was checked against the galactic centre, Crux/Carina, Polaris
and the Magellanic Clouds.

## Interstellar regime

- **Units** are light-years. The Sun is at the origin, and the axes are the same ecliptic J2000 render axes as the Solar System view.
- **Stars** are HYG equatorial xyz (pc), rotated EQJ→ECL with Astronomy Engine at build time and converted to ly.
  They are not compressed: distances are true.
- **Star brightness** is computed per frame in the vertex shader as `m = M + 5·log10(d_pc) − 5`, using the camera's
  real position. The visibility limit starts at +6.5 near the Sun and is raised gradually with distance, like a
  longer exposure.
- **The galaxy** is modelled in galactocentric coordinates (IAU galactic axes, Sun at (−R₀, 0, z☉), R₀ = 26,670 ly).
  Galactic→render is built from Astronomy Engine's GAL→EQJ→ECL rotations. The GC direction was checked at
  RA 17h45.6m, Dec −28.9°.
- **Hand-off:** real stars cover ~3,200 ly around the Sun, and the model's star clouds stay out of that sphere.
  NASA's diffuse sky is only correct as seen from near the Sun, so it fades out between 600 and 5,000 ly. The galaxy
  model fades in over 1,500–9,000 ly.
- **Depth** is not used in this regime: everything is additive with depth testing off. That lets near/far span 1e-4
  to 3e6 ly without precision problems.

## Later regimes (not yet built)

- **Earth orbit** (Sprint 2): TLE/OMM → SGP4 (satellite.js) → geocentric position → a
  local compression like the Moon's.
- **Local Group / Local Universe:** Mly units, with galaxies at their real RA/Dec and distance (UNGC, 2MRS /
  Cosmicflows-4). This would be a further level above the interstellar one.
