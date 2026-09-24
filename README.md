# Light Year Saga

An interactive explorer of the Solar System, the stars, the Milky Way and the wider universe, built on real data and designed to reward exploration.

> Navigate → select → inspect → explore its real data. Or board a voyage and let ARIA fly you.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts: `npm run build`, `npm run typecheck`.

## Stack

React 19 · TypeScript · Vite · three.js via react-three-fiber / drei · Tailwind CSS v4 ·
Zustand · Astronomy Engine

## Views

| View | Units | Contents |
|---|---|---|
| **Solar System** | compressed AU | Sun, planets and Moon at their real positions (Astronomy Engine), with a time machine |
| **Stars & Galaxy** | light-years, Sun at origin | 42,247 real stars (HYG v4.1), 10 nebulae, black holes, extreme stars and 8 exoplanet systems at real RA/Dec/distance, inside a Milky Way model |
| **Universe** | millions of light-years | The Local Group, 16 famous galaxies at their real positions, sizes and tilts; 43,415 real galaxies from 2MRS; the Virgo and Coma clusters; the Great Attractor; the Boötes Void; quasars out to TON 618; the observable-universe boundary |
| **Close-up** | solar radii | Any star, black hole or planetary system at true scale, with the Sun and planetary orbits drawn for comparison |
| **Size** | kilometres (floating origin) | 30 objects from a 10 km neutron star to TON 618's 1,600 AU event horizon |

The first three views share ecliptic J2000 axes. Scrolling out past Neptune enters the star view, and scrolling out past the galaxy enters the Universe view; scrolling back in reverses each step.

## Voyages and the logbook

- **Voyages:** 8 guided missions, narrated by the ship AI ARIA inside a cockpit, with warp travel between destinations.
- **Logbook:** everything you inspect is logged, with ranks from Stargazer to Cosmic Cartographer and mission badges. It is saved in the browser's localStorage.
- **Music:** the soundtrack plays while exploring, and the spaceship ambience layers in inside the cockpit. Both come from `assets/ambiance/` and are copied to `apps/web/public/audio/`. The top bar has a mute toggle.

## Controls

| Input | Action |
|---|---|
| Drag / scroll / right-drag | Orbit / zoom / pan |
| Click anything | Select it and fly to it |
| "Visit up close" in the inspector | True-scale close-up |
| `/` | Search (planets, 418 named stars, `HIP 12345`, nebulae, galaxies, exoplanets) |
| `Space` `[` `]` `R` `N` | Time: pause, slower, faster, reverse, now |
| `H` | Overview for the current view |
| `←` `→` | Step through the Size line-up |
| `Enter` / `Esc` | In a voyage: continue / exit |

## Layout

```text
apps/web/src/
  domain/              SpaceObject model
  data/                Solar System, HYG stars, catalog/ (curated objects), missions, size line-up
  astronomy/           Ephemerides, scale transform, galactic frame, sky coords, cosmology
  scene/               Solar System scene + shared shaders/labels
  scene/interstellar/  Star field, nebulae, Milky Way model
  scene/cosmic/        Universe view
  scene/focus/         True-scale close-ups
  scene/scale/         Size line-up
  scene/common/        Flight rig, picking, galaxy disks, star/black-hole/planet bodies
  state/               Stores: view, selection, time, missions, discoveries, audio
  ui/                  HUD, inspectors, logbook, cockpit
scripts/               build-stars.mjs (HYG), build-galaxies.mjs (2MRS), build-sky.mjs (NASA EXR)
docs/                  coordinate-scale-strategy.md
```

The planning documents are `space_explorer_project_plan.md` and `space_explorer_v1_tech_stack.md`.

## Real vs. illustrated

- **Real:** positions, distances, sizes, masses, temperatures, orbital periods, galaxy orientations, the 2MRS and HYG catalogues, and redshift distances (Planck 2018 cosmology).
- **Illustrated:** surface textures of planets and stars, the appearance of nebulae and galaxies (generated from their type), and the Milky Way's structure beyond ~3,000 ly (a model built from published structure). Exoplanet orbital *phases* are illustrative; their periods and sizes are real. The UI labels every illustrated item.

## Performance

Designed for integrated graphics. Surfaces and galaxy/nebula textures are baked once at startup. Labels and picking run in screen space, there is no post-processing, and resolution adapts to frame rate. Measured on an AMD Radeon iGPU at 1440×900 with vsync off: 250–790 fps across all views.

## Data sources & licences

| Data | Source | Licence |
|---|---|---|
| Star map / diffuse Milky Way | NASA/GSFC SVS Deep Star Maps 2020 | Public domain (credit NASA) |
| Stars | HYG Database v4.1 | CC BY-SA 4.0 (see `apps/web/public/data/LICENSE.md`) |
| Galaxies | 2MASS Redshift Survey (Huchra et al. 2012) via VizieR | Free for research/education |
| Exoplanets | NASA Exoplanet Archive | Public |
| Object positions | SIMBAD (CDS) | Linked per object |
| Planet facts | NASA NSSDCA Planetary Fact Sheet | Public domain |
| Key measurements | GRAVITY 2019, EHT 2019/2022, Miller-Jones 2021, El-Badry 2023, Shemmer 2004, Kirshner 1981 | Cited in-app |

## Principles

- The 3D scene never depends on external APIs.
- Real coordinates and render coordinates are kept separate.
- Every value shows where it came from and how fresh it is.
- API keys belong in `.env`, read by the backend only, and are never bundled into the web app.
