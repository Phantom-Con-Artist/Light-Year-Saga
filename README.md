# Light Year Saga

[![Deploy Light Year Saga](https://github.com/Phantom-Con-Artist/Light-Year-Saga/actions/workflows/deploy.yml/badge.svg)](https://github.com/Phantom-Con-Artist/Light-Year-Saga/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%20%2F%207.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r186-black?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC%20BY--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)

An interactive 3D explorer of the Solar System, the stars, the Milky Way, and the wider observable universe — built on real astrophysical data, real orbital physics, and designed to reward deep curiosity.

> **Explore:** Navigate → select → inspect → dive into real data. Or board a guided voyage and let ship AI ARIA take the helm.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Deployment Guide](#deployment-guide)
  - [Option A: GitHub Pages (Automated via GitHub Actions)](#option-a-github-pages-automated-via-github-actions)
  - [Option B: Vercel (1-Click Zero-Config)](#option-b-vercel-1-click-zero-config)
  - [Option C: Netlify](#option-c-netlify)
- [Tech Stack](#tech-stack)
- [Cosmic Views & Scale Hierarchy](#cosmic-views--scale-hierarchy)
- [Voyages & The Logbook](#voyages--the-logbook)
- [Interactive Controls](#interactive-controls)
- [Repository Structure](#repository-structure)
- [Real vs. Illustrated Data](#real-vs-illustrated-data)
- [Performance & Graphics](#performance--graphics)
- [Data Sources & Licences](#data-sources--licences)
- [Core Principles & Security](#core-principles--security)

---

## Quick Start

### Prerequisites

- **Node.js**: v20 or higher recommended
- **npm**: v10 or higher

### Local Development

```bash
# Clone the repository
git clone https://github.com/Phantom-Con-Artist/Light-Year-Saga.git
cd Light-Year-Saga

# Install dependencies (monorepo root)
npm install

# Start local dev server
npm run dev
```

Open your browser at `http://localhost:5173`.

### Repository Scripts

| Command | Action |
|---|---|
| `npm run dev` | Launch local Vite development server with HMR |
| `npm run build` | Typecheck and build production distribution in `apps/web/dist` |
| `npm run typecheck` | Run TypeScript typechecking across workspace packages |

---

## Deployment Guide

The repository is configured for immediate deployment using GitHub Actions, Vercel, or Netlify.

### Option A: GitHub Pages (Automated via GitHub Actions)

The repository includes a ready-to-use GitHub Actions workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that builds the project and deploys it to GitHub Pages on every push to `main`.

1. Go to your repository on GitHub: `https://github.com/Phantom-Con-Artist/Light-Year-Saga`
2. Navigate to **Settings** > **Pages** (in the left sidebar).
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. Push a commit to `main`, or navigate to the **Actions** tab, select **Deploy Light Year Saga**, and click **Run workflow**.
5. Once completed, your application is live at your GitHub Pages URL!

> [!TIP]
> If deploying to GitHub Pages under a subpath (e.g. `https://<username>.github.io/<repo-name>/`), you can either bind a custom domain in GitHub Pages settings, or deploy via root hosting platforms like Vercel or Netlify.

### Option B: Vercel (1-Click Zero-Config)

A root [`vercel.json`](vercel.json) is included, configuring the build command and output directory for the monorepo:

1. Go to [vercel.com](https://vercel.com) and click **Add New...** > **Project**.
2. Select your `Light-Year-Saga` GitHub repository.
3. Vercel will automatically detect `vercel.json`:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `apps/web/dist`
4. Click **Deploy**. Any future `git push` to `main` will automatically trigger a production deployment.

### Option C: Netlify

A pre-configured [`netlify.toml`](netlify.toml) is included:

1. Log in to [netlify.com](https://netlify.com) and click **Add new site** > **Import an existing project**.
2. Select **GitHub** and choose `Light-Year-Saga`.
3. Netlify automatically detects `netlify.toml` build settings.
4. Click **Deploy site**.

---

## Tech Stack

- **Core Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Tooling**: [Vite 8](https://vitejs.dev/) + [Tailwind CSS v4](https://tailwindcss.com/)
- **3D Visualization**: [Three.js](https://threejs.org/) + [@react-three/fiber](https://r3f.docs.pmnd.rs/) + [@react-three/drei](https://github.com/pmndrs/drei)
- **Astrodynamics & Ephemerides**: [Astronomy Engine](https://github.com/cosinekitty/astronomy)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Audio & Spatial Ambience**: HTML5 Web Audio + stereo cross-fader

---

## Cosmic Views & Scale Hierarchy

| View | Spatial Coordinate Units | Contents |
|---|---|---|
| **Solar System** | compressed AU | Sun, 8 planets, Pluto, and Moon at real astronomical positions (Astronomy Engine) with real-time or accelerated time scrub. |
| **Stars & Galaxy** | light-years (Sun at origin) | 42,247 real stars (HYG Database v4.1), 10 nebulae, black holes, extreme stars, and 8 exoplanet systems at true RA/Dec/distance within a calibrated Milky Way model. |
| **Universe** | millions of light-years (Mly) | The Local Group, 16 benchmark galaxies at real positions, tilts and sizes; 43,704 real galaxies (2MRS plus the Updated Nearby Galaxy Catalog) grouped into the Local Group, 11 nearby groups, 20 named clusters and 8 superclusters found from the data; Great Attractor; Boötes Void; quasars out to TON 618; observable universe boundary. |
| **Close-up** | solar radii ($R_\odot$) | Star, black hole, or planetary system rendered at true physical scale with reference orbits for size comparison. |
| **Size** | kilometres (floating origin) | 30 comparative cosmic structures from a 10 km neutron star to TON 618's 1,600 AU event horizon. |

*Smooth continuous scaling: scrolling past Neptune transitions to the stellar neighborhood; scrolling beyond the Milky Way enters the Universe cosmic web. Scrolling in reverses the journey.*

---

## Voyages & The Logbook

- **Guided Voyages**: 8 mission narratives led by ship AI **ARIA**, featuring animated cockpit flight and warp travel transitions between destinations.
- **Captain's Logbook**: Dynamic inspection ledger recording celestial discoveries, assigning explorer ranks from *Stargazer* to *Cosmic Cartographer*, with achievement badges saved to browser `localStorage`.
- **Cosmic Soundscape**: Adaptive ambient soundtrack with layered cockpit acoustics (`assets/ambiance/` mirrored to `apps/web/public/audio/`) with responsive mute and volume controls.

---

## Interactive Controls

| Input | Action |
|---|---|
| `Left Click + Drag` / `Scroll` / `Right Click + Drag` | Orbit / Zoom / Pan camera |
| `Click` on any celestial body | Target and initiate auto-pilot flight to object |
| **"Visit up close"** in Inspector | Enter true-scale comparative inspection mode |
| `/` | Omnibar search (planets, named stars, HIP catalog IDs, nebulae, galaxies, exoplanets) |
| `Space` | Pause / resume orbital time simulation |
| `[` / `]` | Decrease / increase simulation speed |
| `R` | Reverse simulation time direction |
| `N` | Reset simulation time to current real-world timestamp |
| `H` | Recenter overview camera for current view level |
| `←` / `→` | Step through comparative celestial bodies in Size Line-up |
| `Enter` / `Esc` | Progress dialogue step or exit guided mission voyage |

---

## Repository Structure

```text
light-year-saga/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD: Automated build, test & GitHub Pages deploy
├── apps/
│   └── web/
│       ├── public/                 # Static assets (data binaries, audio, textures)
│       ├── src/
│       │   ├── astronomy/          # Ephemerides, galactic frames, celestial transforms
│       │   ├── audio/              # Soundscape engine & ambient mixer
│       │   ├── data/               # Celestial catalogs (Solar system, stars, nebulae, missions)
│       │   ├── domain/             # SpaceObject domain models & interfaces
│       │   ├── scene/              # Three.js / R3F scenes, shaders, camera rigs & rendering
│       │   ├── state/              # Zustand application stores
│       │   └── ui/                 # Cockpit HUD, inspectors, search modal, logbook
│       ├── index.html              # Web entry HTML
│       ├── package.json            # @lys/web package definitions
│       └── vite.config.ts          # Vite build & bundler configuration
├── assets/                         # Source ambiance audio & media assets
├── docs/                           # Technical documentation & coordinate scale strategies
├── scripts/                        # Data pipeline scripts (HYG stars, 2MRS galaxies, NASA sky maps)
├── netlify.toml                    # Netlify deployment configuration
├── vercel.json                     # Vercel deployment configuration
├── package.json                    # Workspace root scripts & tooling
└── .gitignore                      # Git ignore rules
```

---

## Real vs. Illustrated Data

- **Real**: Exact orbital positions, ephemerides, celestial distances, diameters, masses, surface temperatures, rotational/orbital periods, galaxy orientations, HYG v4.1 stellar coordinates, 2MRS redshift cosmology (Planck 2018 parameters).
- **Photographed**: Nebulae and galaxies utilize true astronomical photographs (ESA/Hubble, NASA/ESA/CSA James Webb, ESO, NOIRLab) calibrated with source astrometry (field of view, center coordinates, position angle). Planetary bodies utilize high-resolution cartography compiled from NASA planetary exploration missions.
- **Relativistic Simulation**: Black hole event horizons simulate gravitational light bending ($\approx 2 R_s / b$), photon spheres, and Doppler-beamed accretion disk geometries with raytracing.
- **Illustrated Models**: Outer Milky Way spiral structure beyond empirical star-mapping distance ($\approx 3,000\text{ ly}$) is modeled from published scientific structures. Exoplanet surfaces use representative physical classification visualizations.

---

## Performance & Graphics

Built for smooth 60+ FPS performance even on integrated laptop graphics (tested on AMD Radeon iGPU at 250–790 FPS):
- Procedural surfaces and nebula projections are baked into memory once on load.
- Celestial labels and picking queries run in screen-space.
- No heavy post-processing passes; resolution automatically balances high detail with low GPU power consumption.

---

## Data Sources & Licences

| Dataset / Asset | Origin / Credit | Licensing |
|---|---|---|
| **Star Map / Diffuse Milky Way** | NASA/GSFC SVS Deep Star Maps 2020 | Public Domain |
| **Nebula & Galaxy Imagery** | ESA/Hubble, ESA/Webb, ESO, NOIRLab | CC BY 4.0 (see `textures/LICENSE.md`) |
| **Planetary Maps** | Solar System Scope (NASA data) | CC BY 4.0 |
| **Stellar Catalog** | HYG Database v4.1 | CC BY-SA 4.0 |
| **Galaxy Catalog** | 2MASS Redshift Survey (Huchra et al. 2012, VizieR) | Research / Educational Use |
| **Exoplanetary Systems** | NASA Exoplanet Archive | Public Domain |
| **Astrometry & Coordinates** | SIMBAD (CDS Strasbourg) | Per attribution |
| **Planetary Ephemerides** | NASA NSSDCA Planetary Fact Sheets | Public Domain |
| **Key Scientific Measurements** | GRAVITY 2019, EHT 2019/2022, Miller-Jones 2021 | Cited in-app |

---

## Core Principles & Security

- **Air-Gapped Client Runtime**: The 3D scene engine does not depend on live external APIs for core simulation; all stellar catalogs and ephemerides are bundled as optimized binary/JSON structures for zero downtime and instant loading.
- **Credential Safety**: No private API keys or tokens are bundled into the client distribution. Development environment variables belong in `.env` (see `.env.example`).
- **Precision Separation**: Physical celestial coordinates and render coordinates are kept strictly decoupled to prevent floating-point jitter across astronomical distances.
