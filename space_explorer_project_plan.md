# Space Explorer — 3D Space Model Project Plan

## 1. Project Vision

Build a web application that acts as an interactive visual explorer of Earth's satellites, spacecraft, planets, moons, stars, deep-space objects, missions, and scientific observations.

The core interaction is:

> **Navigate the 3D universe → select an object → resolve its identity → retrieve live/current metadata and available imagery → inspect the object, mission, observations, and source data.**

The application should separate the **visual/spatial model** from external scientific data providers.

### Core principle

```text
3D Spatial Model
      ↓
Stable Object Identity
      ↓
Data/Source Resolver
      ↓
External APIs / Archives
      ↓
Normalized Application Data
      ↓
Object Inspector / Imagery Viewer
```

The first version should **not require a database**. Persistent storage, caching, user accounts, and saved objects can be added later if the project actually needs them.

---

# 2. Product Scope

## Primary experience

The user opens the application and sees a navigable 3D representation of space.

Possible initial view:

```text
                         ✦
                🛰
                         ✦

                       ☀️
                    /       \
                   /         \
                 🌍           🪐
                /             \
             🛰                 🛰
```

The user can:

- rotate the scene
- zoom in/out
- select celestial objects
- select satellites
- select spacecraft
- inspect object metadata
- inspect orbital information
- view mission information
- search for objects
- browse associated imagery
- inspect observation dates
- open original scientific/archive sources

Later versions can include:

- time simulation
- live satellite positions
- orbital trajectories
- mission timelines
- astronomical observations
- FITS data
- spectral information
- historical imagery
- user accounts
- bookmarks
- notifications

---

# 3. Important Architectural Decision

Do **not** make the 3D model responsible for scientific data.

The 3D scene should know:

```text
Object ID
Object Type
Position
Scale
Visual representation
Interaction state
```

The data layer should know:

```text
Name
Description
Scientific properties
Mission information
External identifiers
Images
Observations
Source URLs
Telemetry
Archive information
```

Example:

```json
{
  "id": "saturn",
  "type": "planet",
  "displayName": "Saturn",
  "position": {},
  "visual": {
    "model": "saturn"
  }
}
```

When selected:

```text
saturn
   ↓
Object Resolver
   ↓
NASA / JPL / other sources
   ↓
Normalized Saturn data
   ↓
Inspector
```

This separation is mandatory if the project is going to grow.

---

# 4. Recommended Technology Stack

## Frontend

### Core

- TypeScript
- Vite
- HTML/CSS
- CesiumJS

### Why CesiumJS?

The project is fundamentally geospatial/spatial rather than a conventional game.

Cesium provides:

- 3D globe
- camera controls
- geographic coordinates
- 3D entities
- time systems
- trajectories
- satellite visualization
- terrain support
- CZML support
- astronomical visualization capabilities

Three.js can still be considered if the project eventually needs a completely custom universe renderer.

## Backend

Recommended:

- Node.js
- TypeScript
- Fastify or Express

Alternative:

- Python + FastAPI

The backend should initially remain thin.

Its main responsibilities:

1. API aggregation
2. source normalization
3. object resolution
4. API key protection where necessary
5. rate limiting
6. optional caching later

## Initial storage

None.

Use static configuration/data files:

```text
/data
    /objects
    /missions
    /sources
```

Move to PostgreSQL/SQLite/etc. only when persistent data becomes necessary.

---

# 5. High-Level Architecture

```text
                         USER
                           │
                           ▼
                  ┌────────────────┐
                  │   WEB CLIENT   │
                  │                │
                  │    CesiumJS    │
                  │       🌍       │
                  └───────┬────────┘
                          │
                  Object Selection
                          │
                          ▼
                  ┌────────────────┐
                  │ OBJECT SERVICE │
                  └───────┬────────┘
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
          NASA API       JPL          MAST
             │            │            │
             └────────────┼────────────┘
                          ▼
                  ┌────────────────┐
                  │ NORMALIZER     │
                  └───────┬────────┘
                          ▼
                  ┌────────────────┐
                  │ OBJECT INSPECTOR│
                  └───────┬────────┘
                          ▼
                  Images / Metadata
```

---

# 6. Project Phases

# Phase 0 — Product Definition

## Objective

Define exactly what the first release is.

Do not attempt to model the entire observable universe.

### MVP object categories

Start with:

```text
Sun
Mercury
Venus
Earth
Moon
Mars
Jupiter
Saturn
Uranus
Neptune
```

Then add a small number of spacecraft:

```text
ISS
Hubble
JWST
Juno
Cassini
New Horizons
Mars Reconnaissance Orbiter
Lunar Reconnaissance Orbiter
```

Then add Earth-observation satellites:

```text
Sentinel-1
Sentinel-2
Sentinel-3
Landsat-8
Landsat-9
```

### Phase 0 deliverables

- Product specification
- Object taxonomy
- Interaction specification
- Initial object list
- Technology decision
- Repository structure

---

# Phase 1 — Repository and Development Environment

## Objective

Create a clean development foundation.

### Repository

```text
space-explorer/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── types/
│   ├── astronomy/
│   ├── object-model/
│   └── data-normalizer/
│
├── data/
│   ├── objects/
│   ├── missions/
│   └── sources/
│
├── docs/
│
├── tests/
│
└── README.md
```

### Tasks

- initialize Git repository
- configure TypeScript
- configure Vite
- create frontend
- create backend
- establish shared TypeScript types
- configure linting
- configure formatting
- establish environment configuration
- establish development scripts

### Gate

The project should run locally with:

```bash
npm run dev
```

and launch both:

```text
Frontend
Backend
```

---

# Phase 2 — Spatial Object Model

## Objective

Define the internal representation of objects.

This is the foundation of the entire application.

## Object categories

```text
CelestialObject
├── Star
├── Planet
├── DwarfPlanet
├── Moon
├── Asteroid
├── Comet
├── Galaxy
├── Nebula
├── StarCluster
└── BlackHole

ArtificialObject
├── Satellite
├── Spacecraft
├── SpaceStation
└── Telescope
```

## Base object

Example:

```typescript
interface SpaceObject {
    id: string;
    name: string;
    type: SpaceObjectType;

    description?: string;

    position?: SpacePosition;

    visual?: VisualDefinition;

    sources?: ExternalSource[];
}
```

## Planet-specific model

```typescript
interface Planet extends SpaceObject {
    type: "planet";

    radiusKm: number;

    parentBody: string;

    orbitalPeriodDays: number;

    rotationPeriodHours?: number;

    atmosphere?: AtmosphereDefinition;
}
```

## Satellite-specific model

```typescript
interface Satellite extends SpaceObject {
    type: "satellite";

    operator?: string;

    mission?: string;

    orbit?: OrbitDefinition;

    status?: string;
}
```

## Spacecraft-specific model

```typescript
interface Spacecraft extends SpaceObject {
    type: "spacecraft";

    mission?: string;

    launchDate?: string;

    destination?: string;

    instruments?: string[];
}
```

### Gate

Every object must have:

```text
Stable ID
Type
Name
Visual representation
Spatial representation
```

No external API should be required for the 3D scene to function.

---

# Phase 3 — Solar System Visualization

## Objective

Create the first actual 3D universe.

### Initial scene

```text
Sun
 ├── Mercury
 ├── Venus
 ├── Earth
 ├── Mars
 ├── Jupiter
 ├── Saturn
 ├── Uranus
 └── Neptune
```

### Tasks

- create Sun
- create planets
- establish parent-child relationships
- create orbital paths
- implement camera controls
- implement zoom
- implement rotation
- implement object selection
- implement object highlighting
- add labels
- add object information placeholder

### Critical problem: scale

A literal physical-scale Solar System is unusable.

Implement a visualization transform:

```text
Real coordinates
       ↓
Visualization scale
       ↓
Rendered coordinates
```

Do not corrupt the underlying astronomical coordinates.

Keep:

```text
realPosition
renderPosition
```

separate.

### Gate

User can:

1. open the application
2. see the Solar System
3. navigate around it
4. select a planet
5. identify that planet by stable ID

---

# Phase 4 — Time System

## Objective

Introduce a shared application clock.

The application should eventually support:

```text
Past ←──────── NOW ────────→ Future
```

### Requirements

Create:

```typescript
interface SimulationTime {
    currentTime: Date;
    playbackRate: number;
    paused: boolean;
}
```

### Controls

```text
▶ Play
⏸ Pause
⏪ Reverse
⏩ Accelerate
1×
10×
100×
1000×
```

### Use cases

- planetary orbital motion
- satellite movement
- spacecraft trajectories
- historical positions

### Gate

Changing application time changes object positions consistently.

---

# Phase 5 — Satellite Visualization

## Objective

Add artificial satellites around Earth.

Start with a small controlled set.

### First satellites

- ISS
- Sentinel-1
- Sentinel-2
- Landsat-8
- Landsat-9
- Hubble
- JWST

### Requirements

Each satellite must have:

```text
ID
Name
Category
Orbit
Current position
Operator
Mission
Status
```

### Orbit representation

Use orbital data such as:

- TLE
- OMM
- other authoritative orbital element formats

The application should propagate orbital elements into positions.

```text
Orbital Elements
       ↓
Orbit Propagator
       ↓
Position at time T
       ↓
Cesium Entity
```

### Gate

Satellite positions can be displayed and updated according to application time.

---

# Phase 6 — Object Selection System

## Objective

Create one universal selection mechanism.

Every selectable object should trigger:

```typescript
selectObject(objectId)
```

The UI should not care whether the object is:

```text
planet
satellite
spacecraft
telescope
moon
asteroid
```

### Selection state

```typescript
interface SelectionState {
    selectedObjectId: string | null;
    selectedObjectType?: string;
}
```

### UI

Selected object opens an inspector.

Example:

```text
┌────────────────────────────┐
│ SATURN                     │
│                            │
│ Planet                     │
│ Gas Giant                  │
│                            │
│ Radius                     │
│ 58,232 km                  │
│                            │
│ [ Missions ]               │
│ [ Observations ]           │
│ [ Images ]                 │
└────────────────────────────┘
```

### Gate

Clicking any supported object opens its inspector.

---

# Phase 7 — External Data Resolver

## Objective

Connect the spatial model to real information.

Create a backend endpoint:

```text
GET /api/objects/:id
```

Example:

```text
/api/objects/saturn
/api/objects/jwst
/api/objects/cassini
```

The backend resolves:

```text
Internal ID
     ↓
External identifiers
     ↓
Relevant APIs
     ↓
Normalized response
```

---

# Phase 8 — NASA Integration

## Objective

Integrate NASA's publicly available APIs/data services.

Start with general metadata and image discovery.

### Example workflow

```text
User selects Saturn
        ↓
Backend identifies "saturn"
        ↓
NASA data source queried
        ↓
Results normalized
        ↓
Frontend receives:
    title
    description
    image
    date
    source
```

### Important rule

Never make the frontend tightly coupled to NASA's response format.

Use:

```text
NASA response
      ↓
NASA adapter
      ↓
Application schema
```

---

# Phase 9 — Deep-Space Imagery

## Objective

Allow objects to expose imagery from scientific archives.

Potential sources include:

- NASA Image and Video Library
- JPL imagery
- MAST
- JWST archives
- Hubble archives
- other mission archives

### Image abstraction

```typescript
interface ObservationImage {
    id: string;

    title: string;

    targetObjectId?: string;

    mission?: string;

    instrument?: string;

    observationDate?: string;

    thumbnailUrl?: string;

    imageUrl?: string;

    dataUrl?: string;

    source: ExternalSource;
}
```

### Example

```text
JWST
 │
 ├── Observation
 │      ├── Date
 │      ├── Instrument
 │      ├── Filters
 │      ├── Coordinates
 │      └── Image
 │
 └── Observation
        ├── Date
        ├── Instrument
        └── Image
```

---

# Phase 10 — Imagery Viewer

## Objective

Create a dedicated image inspection experience.

### Requirements

- large image viewer
- zoom
- pan
- image metadata
- observation date
- mission
- instrument
- source
- original archive link

Later:

- FITS viewer
- wavelength information
- image channels
- contrast adjustment
- histogram
- false-color rendering

### Do not initially build

- full scientific FITS analysis
- advanced spectral analysis
- image processing pipeline

Those belong to a later phase.

---

# Phase 11 — Mission System

## Objective

Connect spacecraft to missions.

Relationship:

```text
Mission
   │
   ├── Spacecraft
   │
   ├── Instruments
   │
   ├── Targets
   │
   ├── Events
   │
   └── Observations
```

Example:

```text
Cassini–Huygens
│
├── Cassini spacecraft
├── Saturn
├── Titan
├── Enceladus
├── ISS instrument
├── VIMS
├── RADAR
└── Mission timeline
```

This is where the project begins becoming a genuine exploration system rather than a 3D model viewer.

---

# Phase 12 — Search

## Objective

Allow users to search the entire object universe.

Search:

```text
Saturn
Cassini
JWST
Andromeda
M87
Sentinel-2
Titan
```

Results should include:

```text
Object
Mission
Spacecraft
Observation
Image
```

### Search flow

```text
Search query
     ↓
Object resolver
     ↓
Local known objects
     ↓
External discovery APIs
     ↓
Results
```

---

# Phase 13 — Object Discovery

## Objective

Allow the user to discover objects not explicitly visible in the initial scene.

Example:

```text
Search: "Carina Nebula"

Result
    ↓
Carina Nebula
    ↓
Camera navigates to approximate sky position
    ↓
Inspector opens
    ↓
Available observations
```

For deep-space objects, use astronomical coordinate systems such as:

- RA
- Dec

rather than pretending every object can be represented as a normal Solar System orbital body.

---

# Phase 14 — Deep-Space Coordinate System

## Objective

Extend the spatial model beyond the Solar System.

The application now needs multiple spatial regimes:

```text
Earth-centered
Solar-system-centered
Galactic / astronomical
```

Do not force everything into one naive coordinate system.

### Object position types

```typescript
type SpacePosition =
    | EarthOrbitPosition
    | SolarSystemPosition
    | CelestialCoordinate
    | DeepSpaceCoordinate;
```

### Example

Satellite:

```text
Earth-centered orbital coordinates
```

Planet:

```text
Solar-system coordinates
```

Galaxy:

```text
RA / Dec
```

This distinction prevents major architectural problems later.

---

# Phase 15 — Live / Near-Real-Time Layer

## Objective

Add current information where actual live data exists.

Important distinction:

```text
LIVE
≠
LATEST AVAILABLE OBSERVATION
```

For each data source, expose status:

```text
LIVE
RECENT
ARCHIVED
STATIC
```

### Example

```text
ISS position
→ live/current orbital position

Sentinel-2 imagery
→ latest available observation

JWST image
→ archival observation

Planet properties
→ static scientific metadata
```

Never label archival imagery as "live."

---

# Phase 16 — Data Normalization Layer

## Objective

Create a common internal representation.

Potential sources:

```text
NASA
JPL
MAST
ESA
USGS
CelesTrak
Other scientific archives
```

Each provider gets its own adapter.

```text
/providers
    /nasa
    /jpl
    /mast
    /esa
    /usgs
```

Each adapter converts provider data into your schema.

```text
Provider API
     ↓
Provider Adapter
     ↓
Normalized Model
     ↓
Application
```

This is one of the most important architectural decisions in the entire project.

---

# Phase 17 — Performance and Caching

## Only introduce persistent caching when necessary.

Initial version:

```text
Frontend
   ↓
Backend
   ↓
External API
```

Later:

```text
Frontend
   ↓
Backend
   ↓
Cache
   ├── Fresh → return
   └── Expired → fetch provider
```

Possible cache:

- Redis
- SQLite
- PostgreSQL
- filesystem cache

Do not add infrastructure simply because "real projects have databases."

Add it when a measurable problem exists.

---

# Phase 18 — UI System

## Main layout

Recommended:

```text
┌───────────────────────────────────────────────┐
│ Search                    Time       Settings │
├───────────────────────────────────────────────┤
│                                               │
│                                               │
│                 3D UNIVERSE                   │
│                                               │
│              🌍        🛰                     │
│                    🪐                         │
│                                               │
│                                               │
├───────────────────────────────────────────────┤
│ Selected Object Inspector                     │
└───────────────────────────────────────────────┘
```

Avoid filling the screen with panels.

The universe should remain the primary visual object.

---

# Phase 19 — Object Inspector

The inspector should be context-aware.

## Planet

```text
SATURN

Type
Planet

Radius
58,232 km

Mass
...

Orbital Period
...

Missions
Cassini
Voyager
Pioneer

Images
[Browse]
```

## Satellite

```text
SENTINEL-2A

Operator
ESA

Orbit
Sun-synchronous

Altitude
...

Velocity
...

Current Position
...

Latest Observation
...

Images
[Browse]
```

## Deep-space object

```text
CARINA NEBULA

Type
Nebula

Coordinates
RA ...
Dec ...

Known Observations
JWST
Hubble
...

Images
[Browse]
```

---

# Phase 20 — Source Transparency

Every externally retrieved piece of information should expose its source.

Example:

```text
Source
NASA

Archive
MAST

Observation ID
...

Retrieved
...

Original data
[Open source]
```

Do not hide scientific provenance.

The application should make it obvious where information originated.

---

# Phase 21 — Error Handling

External APIs will fail.

Plan for:

```text
API unavailable
Rate limited
Image unavailable
Observation unavailable
Unknown object
Invalid identifier
Timeout
Partial metadata
```

The application should gracefully display:

```text
Satellite position available
Mission information unavailable
Imagery temporarily unavailable
```

Do not allow one failed provider to break the entire inspector.

---

# Phase 22 — Testing

## Unit tests

Test:

- coordinate conversion
- orbital calculations
- object resolution
- source adapters
- normalization
- time simulation
- ID resolution

## Integration tests

Test:

```text
Object selection
      ↓
Backend
      ↓
Provider
      ↓
Normalized result
      ↓
Inspector
```

## Visual tests

Test:

- camera navigation
- object selection
- labels
- inspector
- imagery viewer
- responsive layout

---

# 23. Milestones

## Milestone 1 — "A Globe"

Deliver:

- CesiumJS
- Earth
- camera controls
- basic UI

Success criterion:

> I can navigate around Earth.

---

## Milestone 2 — "A Solar System"

Deliver:

- Sun
- planets
- Moon
- orbital paths
- time simulation

Success criterion:

> I can explore the Solar System.

---

## Milestone 3 — "Objects Are Selectable"

Deliver:

- object IDs
- selection system
- inspector

Success criterion:

> Clicking Saturn opens Saturn's information.

---

## Milestone 4 — "Spacecraft"

Deliver:

- ISS
- Hubble
- JWST
- Juno
- Cassini
- New Horizons

Success criterion:

> Spacecraft exist as identifiable objects.

---

## Milestone 5 — "Real Data"

Deliver:

- backend
- NASA integration
- source normalization
- object metadata

Success criterion:

> Selecting an object retrieves real external data.

---

## Milestone 6 — "Images"

Deliver:

- NASA/JPL imagery
- observation model
- image viewer

Success criterion:

> Selecting an object can reveal real imagery.

---

## Milestone 7 — "Scientific Archives"

Deliver:

- MAST
- JWST observations
- Hubble observations
- astronomical coordinates

Success criterion:

> A deep-space object can expose real scientific observations.

---

## Milestone 8 — "Satellite Tracking"

Deliver:

- orbital elements
- satellite propagation
- current positions
- trajectories
- time synchronization

Success criterion:

> Satellites move according to their orbital data.

---

## Milestone 9 — "Mission Explorer"

Deliver:

- missions
- spacecraft
- instruments
- targets
- observations
- timelines

Success criterion:

> A user can explore a mission as a connected scientific entity.

---

## Milestone 10 — "Space Explorer"

Deliver:

- unified object system
- Solar System
- satellites
- spacecraft
- astronomical objects
- observations
- imagery
- mission information
- source provenance
- search

Success criterion:

> A user can discover an object, navigate to it, inspect it, and explore its real scientific data.

---

# 24. Suggested Initial Folder Structure

```text
space-explorer/
│
├── apps/
│   │
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── scene/
│   │   │   ├── inspector/
│   │   │   ├── imagery/
│   │   │   ├── search/
│   │   │   ├── timeline/
│   │   │   └── state/
│   │   │
│   │   └── public/
│   │
│   └── api/
│       └── src/
│           ├── routes/
│           ├── providers/
│           │   ├── nasa/
│           │   ├── jpl/
│           │   ├── mast/
│           │   └── ...
│           │
│           ├── services/
│           ├── normalizers/
│           └── cache/
│
├── packages/
│   ├── types/
│   ├── astronomy/
│   └── object-model/
│
├── data/
│   ├── objects/
│   ├── missions/
│   └── instruments/
│
├── docs/
│   ├── architecture.md
│   ├── object-model.md
│   ├── data-sources.md
│   └── api.md
│
└── README.md
```

---

# 25. Object Identity Strategy

Stable IDs are critical.

Use your own internal IDs:

```text
sun
earth
moon
mars
jupiter
saturn
jwst
hubble
cassini
juno
sentinel-2a
landsat-9
```

Do not use provider IDs as your primary identity.

Instead:

```text
Internal Object
       │
       ├── NASA ID
       ├── JPL ID
       ├── MAST ID
       ├── NORAD ID
       └── Other IDs
```

This lets multiple data providers describe the same real-world object.

---

# 26. Data Source Registry

Create a source registry.

```typescript
interface DataSource {
    id: string;
    name: string;
    provider: string;

    capabilities: (
        | "metadata"
        | "imagery"
        | "telemetry"
        | "observations"
        | "orbital"
    )[];

    attributionRequired: boolean;
}
```

Example:

```text
NASA
JPL
MAST
ESA
USGS
CelesTrak
```

This will make source management explicit instead of burying it throughout the application.

---

# 27. What NOT to Build Initially

Do not start with:

- user accounts
- social features
- database
- recommendation engine
- AI assistant
- procedural galaxy generation
- realistic Milky Way simulation
- FITS scientific processing
- custom rendering engine
- multiplayer
- mobile app
- microservices
- Kubernetes

Those are distractions during the MVP.

The core loop must work first:

```text
SEE
 ↓
SELECT
 ↓
IDENTIFY
 ↓
FETCH
 ↓
INSPECT
 ↓
EXPLORE
```

---

# 28. Recommended Development Order

The safest order is:

```text
1. Project setup
       ↓
2. Cesium scene
       ↓
3. Solar System
       ↓
4. Object identity
       ↓
5. Selection
       ↓
6. Inspector
       ↓
7. Time system
       ↓
8. Satellites
       ↓
9. Backend
       ↓
10. NASA integration
       ↓
11. Image integration
       ↓
12. Mission system
       ↓
13. MAST/JWST
       ↓
14. Search
       ↓
15. Deep-space objects
       ↓
16. Live/near-live data
       ↓
17. Caching
       ↓
18. Advanced scientific tools
```

---

# 29. Definition of Done for MVP

The MVP is complete when a user can:

1. Open the web application.
2. Navigate a 3D Solar System.
3. Select Earth.
4. Select a satellite around Earth.
5. Inspect its metadata.
6. Select a planet.
7. Inspect planetary information.
8. Select a spacecraft.
9. Inspect its mission.
10. Search for an object.
11. Retrieve information from an external scientific source.
12. Browse real space imagery.
13. See the source of the information.
14. Navigate back into the 3D scene.
15. Change simulation time.

The MVP does **not** need a database.

---

# 30. Long-Term Vision

Eventually the application can evolve into:

```text
                    SPACE EXPLORER
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
     EARTH              SOLAR SYSTEM       DEEP SPACE
        │                  │                  │
    Satellites          Planets             Stars
    Weather             Moons               Nebulae
    Earth imaging       Asteroids           Galaxies
    Radar               Spacecraft          Black holes
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    OBSERVATIONS
                           │
                ┌──────────┼──────────┐
                │          │          │
              Images      Data      Missions
                │          │          │
                └──────────┼──────────┘
                           │
                     SOURCE ARCHIVES
```

The final product should feel less like a conventional website and more like a **visual operating system for exploring publicly available space-science data**.

---

# 31. Guiding Engineering Principles

### Principle 1 — Visualization is not data

Keep the 3D model independent from external APIs.

### Principle 2 — One object, many sources

An object may have multiple authoritative data providers.

### Principle 3 — Normalize external APIs

Never expose provider-specific schemas throughout the frontend.

### Principle 4 — Preserve provenance

Users should always know where information came from.

### Principle 5 — Don't fake "live"

Distinguish:

```text
LIVE
RECENT
ARCHIVED
STATIC
```

### Principle 6 — Don't build infrastructure prematurely

No database until persistent state or caching actually requires it.

### Principle 7 — Keep astronomical coordinate systems explicit

Earth orbit, Solar System coordinates, and deep-space celestial coordinates are different problems.

### Principle 8 — Build the exploration loop first

```text
Navigate → Select → Identify → Inspect → Explore
```

Everything else comes afterward.

---

# 32. First Development Sprint

The first sprint should deliberately be small.

### Sprint goal

> **Render a navigable Solar System and select real objects.**

### Tasks

- [ ] Create repository
- [ ] Create Vite + TypeScript frontend
- [ ] Install CesiumJS
- [ ] Render Earth
- [ ] Add Sun
- [ ] Add eight planets
- [ ] Add Moon
- [ ] Add orbital paths
- [ ] Create `SpaceObject` type
- [ ] Assign stable IDs
- [ ] Implement object selection
- [ ] Implement selected-object state
- [ ] Create basic inspector
- [ ] Add time controller
- [ ] Document coordinate/scale strategy

### Sprint completion condition

You should be able to click:

```text
Earth
Mars
Jupiter
Saturn
```

and receive:

```text
Object ID
Name
Type
Basic properties
```

**No external API. No database. No authentication. No image system.**

Get the spatial foundation right first.

---

# 33. Second Sprint

### Goal

> **Turn the model into a real satellite/spacecraft explorer.**

Tasks:

- [ ] Add ISS
- [ ] Add Hubble
- [ ] Add JWST
- [ ] Add Sentinel-1
- [ ] Add Sentinel-2
- [ ] Add Landsat-9
- [ ] Add orbital data
- [ ] Implement orbit propagation
- [ ] Implement satellite trails
- [ ] Add current position
- [ ] Add satellite inspector
- [ ] Create backend
- [ ] Establish API adapter architecture

---

# 34. Third Sprint

### Goal

> **Connect the visual universe to real scientific information.**

Tasks:

- [ ] NASA API adapter
- [ ] JPL data adapter
- [ ] Image result normalization
- [ ] Image gallery
- [ ] Object → imagery relationship
- [ ] Mission metadata
- [ ] Source attribution
- [ ] Error handling
- [ ] API rate limiting

---

# 35. Fourth Sprint

### Goal

> **Make deep-space exploration possible.**

Tasks:

- [ ] Add astronomical coordinates
- [ ] Add deep-space object model
- [ ] Add MAST integration
- [ ] Add JWST observations
- [ ] Add Hubble observations
- [ ] Add deep-space image viewer
- [ ] Add observation metadata
- [ ] Add search
- [ ] Implement camera navigation to celestial targets

---

# 36. Final Architectural Target

```text
                        USER
                          │
                          ▼
                ┌───────────────────┐
                │   SPACE EXPLORER  │
                │      FRONTEND     │
                └─────────┬─────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
             🌍          🔎          🖼
           Spatial      Search       Media
             │           │           │
              └───────────┼───────────┘
                          │
                          ▼
                ┌───────────────────┐
                │ OBJECT RESOLUTION │
                └─────────┬─────────┘
                          │
                ┌─────────┴─────────┐
                │ NORMALIZED MODEL  │
                └─────────┬─────────┘
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
     NASA                JPL                MAST
       │                  │                  │
       ▼                  ▼                  ▼
   Imagery             Missions          Astronomy
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                          ▼
                 SCIENTIFIC SOURCES
```

The core architectural idea is simple:

> **The 3D universe is your interface. The APIs are your information layer.**

Do not let those two become the same thing.

That separation is what will allow the project to grow from a pretty Solar System visualization into a genuinely useful scientific exploration platform.
