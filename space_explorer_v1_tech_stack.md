# Space Explorer v1 — Tech Stack

## Frontend

| Technology | Purpose |
|---|---|
| React | UI and application structure |
| TypeScript | Type-safe application development |
| Vite | Development server and build tooling |
| CesiumJS | 3D space/planetary visualization, camera, entities, trajectories |
| Tailwind CSS | UI styling and layout |
| Zustand | Lightweight application/UI state management |
| Astronomy Engine | Astronomical calculations and time/position utilities |

## Backend — Later

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| TypeScript | Type-safe backend |
| Fastify | Lightweight API server |

The backend will act as a normalization/proxy layer between Space Explorer and external scientific APIs.

## Scientific Data Sources

- NASA APIs
- NASA Image and Video Library
- MAST (Mikulski Archive for Space Telescopes)

These will be integrated after the initial 3D Space Explorer is functional.

## Database

**None initially.**

Static/local data will be used during the first development phase. PostgreSQL can be introduced later if persistent application data becomes necessary.

## v1 Development Priority

1. 3D space scene
2. Sun and planets
3. Moon
4. Orbital paths
5. Camera navigation
6. Zoom / rotate / pan
7. Object selection
8. Stable object IDs
9. Object inspector
10. Simulation time controls

## Architecture Principle

Keep scientific coordinates/data separate from visualization coordinates.

```text
Scientific Model
       ↓
Coordinate / Scale Transform
       ↓
Cesium 3D Scene
       ↓
Object Selection
       ↓
Object Inspector
       ↓
NASA / MAST Data Layer (later)
```

## Initial Stack

**React + TypeScript + Vite + CesiumJS + Tailwind CSS + Zustand + Astronomy Engine**
