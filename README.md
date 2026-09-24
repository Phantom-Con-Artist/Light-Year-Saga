# Light Year Saga

An interactive explorer of the Solar System, the stars around it, the Milky Way, and public space-science data.

> Navigate the 3D universe → select an object → inspect it → explore its real data.

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
| **Stars & Galaxy** | light-years, Sun at origin | 42,247 real stars from HYG v4.1 (Hipparcos/Yale/Gliese) out to ~1,500 pc, inside a Milky Way model built from published structure. Each star's brightness is its real apparent magnitude from the camera's position |

Both views share the ecliptic J2000 axes, so the view direction carries across the switch.

## Controls

| Input | Action |
|---|---|
| Drag / scroll / right-drag | Orbit / zoom / pan |
| Click a body, star, label, or list row | Select it and fly to it |
| Scroll out past Neptune / scroll in on the Sun | Move between the Solar System and Stars & Galaxy views |
| `/` | Search (planets, 418 named stars, `HIP 12345`) |
| `Space` | Play / pause time |
| `[` `]` | Slower / faster |
| `R` | Reverse time |
| `N` | Jump to now, real time |
| `H` | Overview for the current view |
| `Esc` | Release selection |

## Layout

```text
apps/web/src/
  domain/              SpaceObject model (IDs, physical, visual, sources)
  data/                Catalogues: Solar System, stars (HYG loader), deep-sky objects
  astronomy/           Real ephemerides (AU), visualization scale transform, galactic frame
  scene/               Solar System scene: bodies, shaders, orbits, camera rig, labels
  scene/interstellar/  Star field, star labels/picking, Milky Way model, camera rig
  state/               Zustand stores: time, selection, camera, view level, navigation
  ui/                  Top bar, navigator, inspectors, chronometer, search
docs/                  Architecture notes (see coordinate-scale-strategy.md)
scripts/               Data builds: build-stars.mjs (HYG → binary), build-sky.mjs (NASA EXR → JPG)
```

The planning documents are `space_explorer_project_plan.md` and `space_explorer_v1_tech_stack.md`.

## Rendering notes

- **Planet and Sun surfaces** are procedural. They're baked once into textures at startup (`scene/bake.ts`), so the per-frame shaders only do a texture lookup and lighting.
- **Sky:** NASA/GSFC SVS [Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851), oriented by true RA/Dec. The Solar System view uses the star map; near the Sun, the star view uses the star-free diffuse map under the real 3D stars. The 8K version only loads on high-resolution displays.
- **Post-processing:** none. Resolution drops automatically if the frame rate falls.
- **Labels** are plain DOM elements positioned each frame (`scene/ScreenLabel.tsx`, `StarOverlay.tsx`) rather than one React root per label. Star picking is done in screen space instead of by raycasting.
- **Milky Way model** (`scene/interstellar/galaxyModel.ts`): baked once into a face-on texture, drawn as 5 thin layers, plus ~19k star-cloud points. It has a bar at ~27°, four log-spiral arms with 12.5° pitch, and the Orion Spur, with the Sun at R₀ = 8.18 kpc. It's a model, and the UI says so.

## Data sources & licences

| Data | Source | Licence |
|---|---|---|
| Star map / diffuse Milky Way | NASA/GSFC SVS Deep Star Maps 2020 | Public domain (credit NASA) |
| Stars | HYG Database v4.1 | CC BY-SA 4.0 (see `apps/web/public/data/LICENSE.md`) |
| Planet facts | NASA NSSDCA Planetary Fact Sheet | Public domain |
| R₀, Sgr A* | GRAVITY Collaboration 2019; EHT 2022 | Cited in-app |

## Principles

- The 3D scene never depends on external APIs.
- Real coordinates and render coordinates are kept separate.
- Every value shows where it came from and how fresh it is (LIVE / RECENT / ARCHIVED / STATIC / COMPUTED).
- API keys belong in `.env`, read by the backend only (see `.env.example`), and are never bundled into the web app.
