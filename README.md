# Light Year Saga

An interactive, sci-fi styled explorer of the Solar System, spacecraft and public space-science data.

> Navigate the 3D universe → select an object → inspect it → explore its real data.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts: `npm run build`, `npm run typecheck`.

## Stack

React 19 · TypeScript · Vite · three.js via react-three-fiber / drei · postprocessing ·
Tailwind CSS v4 · Zustand · Astronomy Engine

## Controls

| Input | Action |
|---|---|
| Drag / scroll / right-drag | Orbit / zoom / pan |
| Click a body, label, or list row | Select it and fly to it |
| `/` | Search |
| `Space` | Play / pause time |
| `[` `]` | Slower / faster |
| `R` | Reverse time |
| `N` | Jump to now, real time |
| `H` | System overview |
| `Esc` | Release selection |

## Layout

```text
apps/web/src/
  domain/      SpaceObject model (IDs, physical, visual, sources)
  data/        Static object catalogue (Sun, 8 planets, Moon)
  astronomy/   Real ephemerides (AU) + visualization scale transform
  scene/       3D scene: bodies, shaders, orbits, camera rig
  state/       Zustand stores: time, selection, camera
  ui/          HUD: top bar, navigator, inspector, chronometer
docs/          Architecture notes (see coordinate-scale-strategy.md)
```

The planning documents are `space_explorer_project_plan.md` and `space_explorer_v1_tech_stack.md`.

## Principles

- The 3D scene never depends on external APIs.
- Real coordinates and render coordinates are kept separate.
- Every value shows where it came from and how fresh it is (LIVE / RECENT / ARCHIVED / STATIC / COMPUTED).
- API keys belong in `.env`, read by the backend only (see `.env.example`), and are never bundled into the web app.
