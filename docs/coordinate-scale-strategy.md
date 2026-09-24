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

## Later regimes (not yet built)

- **Earth orbit** (Sprint 2): TLE/OMM → SGP4 (satellite.js) → geocentric position → a
  local compression like the Moon's.
- **Deep space** (Sprint 4): RA/Dec on the celestial sphere. These objects are not given
  fake orbital positions.
