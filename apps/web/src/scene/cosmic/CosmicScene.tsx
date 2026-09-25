import { useCallback, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  Matrix4,
  Vector3,
  type PerspectiveCamera,
} from "three";
import { CATALOG, getCatalogObject, type CatalogObject } from "../../data/catalog";
import { GALACTIC_ROTATION } from "../../astronomy/galactic";
import { selectObject } from "../../state/selectionStore";
import { useViewStore } from "../../state/viewStore";
import { smoothstep } from "../interstellar/visibility";
import { FlightRig, type RigTarget } from "../common/FlightRig";
import { CatalogLayer } from "../common/CatalogLayer";
import { StructureClouds } from "./StructureClouds";
import { useScreenPicking } from "../common/picking";
import { ScreenLabel } from "../ScreenLabel";
import { StructureOutline } from "./CosmicWeb";
import { CosmicWeb, ModelledGalaxies, PointGalaxyLabel, PointGalaxyPicking } from "./PointGalaxies";
import { useCosmicStore } from "../../state/cosmicStore";
import { useGraphicsStore } from "../../state/graphicsStore";
import { GalaxyClouds } from "../common/GalaxyClouds";
import { createProceduralGalaxy, galaxyBudget, updateProceduralGalaxy } from "../interstellar/galaxyPoints";
import { isPointGalaxyId, pointGalaxyInfo, pointGalaxyPosition } from "../../data/cosmic/cosmicPoints";

const ORIGIN = new Vector3();
/** Opening/overview shot: far enough out to see the cosmic web of real galaxies. */
const HOME_MLY = 750;
const LOCAL_GROUP_MLY = 9;
const MIN_MLY = 0.08;
const MAX_MLY = 160_000;

const OBJECTS = CATALOG.filter((o) => o.level === "cosmic");
const GALAXIES = OBJECTS.filter((o) => o.kind === "galaxy" && o.id !== "milky-way-cosmic");
const MARKER_KINDS: CatalogObject["kind"][] = ["galaxy", "quasar"];
const STRUCTURES = OBJECTS.filter((o) => o.structureIndex !== undefined || o.superclusterIndex !== undefined);
const OTHER_OBJECTS = OBJECTS.filter((o) => !STRUCTURES.includes(o));
const structureNames = () => (useCosmicStore.getState().structureNames ? 1 : 0);

const labelRange = (o: CatalogObject) => {
  if (o.id === "observable-universe") return -1; // labelled on its shell instead
  if (o.kind === "quasar") return 40_000;
  // Structures: names appear at the scale where each one reads as a whole.
  if (o.kind === "group") return o.framing * 7;
  if (o.kind === "supercluster") return o.framing * 5;
  if (o.kind === "cluster" && o.structureIndex !== undefined) return o.framing * 14;
  if (o.kind === "void" || o.kind === "structure" || o.kind === "cluster") return o.framing * 25;
  return Math.max(o.extent * 180, 6);
};

/* ------------------------------------------------------------- Milky Way */

/** The Milky Way from outside, as the same GPU point cloud as the Stars & Galaxy view (at 1/10 the budget). */
function MilkyWayPoints() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const mw = getCatalogObject("milky-way-cosmic")!;
  const particles = useGraphicsStore((g) => g.galaxyParticles);
  const galaxy = useMemo(() => {
    const b = galaxyBudget(particles, false, true);
    return createProceduralGalaxy({ stars: Math.round(b.stars / 10), glow: Math.round(b.glow / 2), dust: 0, gas: Math.round(b.gas / 2) }, null);
  }, [particles]);
  useEffect(() => () => galaxy.dispose(), [galaxy]);
  const matrix = useMemo(() => new Matrix4().makeTranslation(mw.position.x, mw.position.y, mw.position.z).multiply(GALACTIC_ROTATION).multiply(new Matrix4().makeScale(1e-6, 1e-6, 1e-6)), [mw]);
  useFrame(({ size, gl, clock }) => {
    const g = useGraphicsStore.getState();
    updateProceduralGalaxy(galaxy, {
      focal: size.height / 2 / Math.tan((camera.fov * Math.PI) / 360),
      pixelRatio: gl.getPixelRatio(),
      opacity: 1,
      exposure: 1,
      time: clock.elapsedTime,
      twinkle: 0,
      starSize: g.starSize,
      starBrightness: g.starBrightness,
      unit: 1e6,
      maxSprite: 48,
      glowGain: 1.3,
    });
  });
  return (
    <group matrixAutoUpdate={false} matrix={matrix}>
      <primitive object={galaxy.glow} />
      <primitive object={galaxy.gas} />
      <primitive object={galaxy.stars} />
    </group>
  );
}

/* -------------------------------------- clusters, voids, quasars, the edge */

function Structures() {
  const camera = useThree((s) => s.camera);
  const edge = getCatalogObject("observable-universe")!;
  const edgeLabelAt = useMemo(() => new Vector3(0, 0.35, 1).normalize().multiplyScalar(edge.extent / 2), [edge]);
  return (
    <>
      <ScreenLabel
        position={edgeLabelAt}
        text="Edge of the observable universe · 46.5 billion ly"
        className="catalog-label"
        accent={edge.accent}
        withDot
        opacity={() => smoothstep(12_000, 40_000, camera.position.length())}
        onClick={() => selectObject(edge.id)}
      />
      <StructureClouds objects={OBJECTS} />
    </>
  );
}

/* ----------------------------------------------------------------- scene */

function Picking() {
  useScreenPicking(selectObject);
  return null;
}

function Rig() {
  const home = useMemo<RigTarget>(() => ({ position: () => ORIGIN, distance: HOME_MLY, minDistance: MIN_MLY }), []);
  const resolve = useCallback((id: string): RigTarget | null => {
    if (isPointGalaxyId(id)) {
      const info = pointGalaxyInfo(id);
      const p = info && pointGalaxyPosition(id);
      if (!info || !p) return null;
      const d = Math.max((info.diameterLy ?? 100_000) / 1e6, 0.03);
      return { position: () => p, distance: d * 3, minDistance: d * 0.2 };
    }
    const c = getCatalogObject(id);
    if (!c || c.level !== "cosmic") return null;
    return { position: () => c.position, distance: c.framing, direction: c.viewDirection, minDistance: Math.min(c.framing * 0.05, MIN_MLY) };
  }, []);

  // Zooming out of the Milky Way lands in the Local Group; tabs/search open on the cosmic web.
  const fromStars = useViewStore.getState().fromLevel === "interstellar";
  const entry = fromStars
    ? { fromDistance: 0.35, target: { position: () => ORIGIN, distance: LOCAL_GROUP_MLY, minDistance: MIN_MLY } }
    : { fromDistance: 6_000, target: home };

  return (
    <FlightRig
      resolve={resolve}
      home={home}
      entry={entry}
      clip={(d) => [Math.max(1e-5, d * 1e-4), 4e5]}
      edgeIn={{
        atEdge: (d, target) => target.lengthSq() < 1e-4 && d <= MIN_MLY * 1.1,
        onTrigger: (dir) => {
          selectObject(null);
          useViewStore.getState().goTo("interstellar", { direction: dir });
        },
      }}
      onDistance={(camera) => useViewStore.getState().setCameraDistance(camera.position.length())}
    />
  );
}

/**
 * Millions of light-years: famous galaxies, 43,700 real galaxies with their
 * groups, clusters and superclusters, voids, quasars and the edge.
 */
/**
 * No photographs, textures or billboards here: every galaxy, cluster, wall,
 * void and quasar is a procedural 3D point cloud anchored on its catalogued
 * position (regardless of the Point-cloud setting, which applies elsewhere).
 */
export function CosmicScene() {
  return (
    <>
      <MilkyWayPoints />
      <ModelledGalaxies />
      <CosmicWeb />
      <StructureOutline />
      <GalaxyClouds objects={GALAXIES} unitScale={1} pointSlot photos={false} />
      <PointGalaxyLabel />
      <PointGalaxyPicking />
      <Structures />
      <CatalogLayer objects={OTHER_OBJECTS} labelRange={labelRange} markerKinds={MARKER_KINDS} />
      <CatalogLayer objects={STRUCTURES} labelRange={labelRange} markerKinds={[]} opacity={structureNames} />
      <Picking />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        rotateSpeed={0.5}
        zoomSpeed={5}
        panSpeed={0.6}
        minDistance={MIN_MLY}
        maxDistance={MAX_MLY}
      />
      <Rig />
    </>
  );
}
