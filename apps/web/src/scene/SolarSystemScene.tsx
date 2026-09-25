import { useCallback, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { PerspectiveCamera, Vector3 } from "three";
import { SOLAR_SYSTEM } from "../data/solarSystem";
import { useViewStore } from "../state/viewStore";
import { selectObject } from "../state/selectionStore";
import { Body } from "./Body";
import { Sun } from "./Sun";
import { OrbitPath } from "./OrbitPath";
import { CameraRig } from "./CameraRig";
import { SelectionReticle } from "./SelectionReticle";
import { EclipticGrid, SkyDome } from "./Backdrop";
import { useEdgeZoom } from "./useEdgeZoom";
import { usePickProvider, useScreenPicking } from "./common/picking";
import { projectToScreen } from "./common/project";
import { getRenderPosition, getRenderRadius, isPresent } from "./renderRegistry";
import { isTouchDevice } from "../ui/useMedia";
import { useStarStore } from "../data/stars";
import { SkyStars } from "./common/SkyStars";
import { layerOn, useSolarStore } from "../state/solarStore";
import { loadTrajectories } from "../astronomy/trajectories";
import { refreshTles } from "../astronomy/satellites";
import { SmallBodies } from "./solar/SmallBodies";
import { Satellites } from "./solar/Satellites";
import { Comets } from "./solar/Comets";
import { SurfaceFeatures } from "./solar/SurfaceFeatures";
import { Heliosphere } from "./solar/Heliosphere";
import { OortCloud } from "./solar/OortCloud";

/**
 * Touch: planets can be a few pixels wide, so taps are matched in screen space
 * with a finger-sized radius (mouse clicks still raycast the spheres).
 */
function TouchPicking() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const screen = useMemo(() => ({ x: 0, y: 0 }), []);
  const pick = useCallback(
    (x: number, y: number) => {
      let best: { id: string; score: number } | null = null;
      const layers = useSolarStore.getState();
      for (const obj of SOLAR_SYSTEM) {
        if (obj.type === "region" || !isPresent(obj.id) || !layerOn(obj, layers)) continue;
        const p = getRenderPosition(obj.id);
        if (!projectToScreen(p, camera, size.width, size.height, screen)) continue;
        const d = Math.hypot(screen.x - x, screen.y - y);
        const apparent = (getRenderRadius(obj.id) / Math.max(camera.position.distanceTo(p), 1e-6)) * size.height;
        if (d > Math.max(22, apparent)) continue;
        if (!best || d < best.score) best = { id: obj.id, score: d };
      }
      return best;
    },
    [camera, size, screen],
  );
  usePickProvider(pick);
  useScreenPicking(selectObject);
  return null;
}

/** Far enough out to sit inside the Oort cloud (~15,000 AU) before rising to the stars. */
const MAX_DISTANCE = 5000;

/**
 * The near plane follows the camera's distance to what it orbits, so a
 * 100-metre space station can be inspected without clipping while the
 * outer Solar System keeps its depth precision.
 */
function AdaptiveClipping() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3 } | null;
  useFrame(() => {
    if (!controls) return;
    const d = camera.position.distanceTo(controls.target);
    const near = Math.min(0.05, Math.max(0.0002, d * 0.02));
    if (Math.abs(near - camera.near) / camera.near > 0.1) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

/** Feeds the HUD readout (camera distance from the Sun, scene units). */
function DistanceReporter() {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const d = camera.position.length();
    const v = useViewStore.getState();
    if (Math.abs(d - v.cameraDistance) > v.cameraDistance * 0.005) v.setCameraDistance(d);
  });
  return null;
}

/** Scroll outward at the edge of the Solar System to rise into the interstellar view. */
function ExitToStars() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3 } | null;

  useEdgeZoom({
    direction: "out",
    atEdge: () => {
      return !!controls && camera.position.distanceTo(controls.target) >= MAX_DISTANCE * 0.97;
    },
    onTrigger: () => {
      const dir = camera.position.clone().normalize();
      selectObject(null);
      useViewStore.getState().goTo("interstellar", { direction: dir });
    },
  });
  return null;
}

export function SolarSystemScene() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const catalog = useStarStore((s) => s.catalog);

  useEffect(() => {
    camera.near = 0.05;
    camera.far = 40_000;
    camera.updateProjectionMatrix();
    loadTrajectories();
    refreshTles();
  }, [camera]);

  return (
    <>
      <SkyDome />
      {/* The photo already holds these stars; this layer adds their sparkle. Planets hide them. */}
      {catalog && <SkyStars catalog={catalog} radius={3000} followCamera depthTest limitMag={() => 3.6} renderOrder={-9} />}
      <EclipticGrid />

      {/* The Sun lights the spacecraft models (planets use their own shaders). */}
      <pointLight position={[0, 0, 0]} intensity={2.6} decay={0} distance={0} />
      <ambientLight intensity={0.16} />

      {SOLAR_SYSTEM.map((obj) =>
        obj.type === "region" ? null : obj.type === "star" ? (
          <Sun key={obj.id} obj={obj} />
        ) : (
          <group key={obj.id}>
            <OrbitPath obj={obj} />
            <Body obj={obj} />
          </group>
        ),
      )}

      <SmallBodies />
      <Satellites />
      <Comets />
      <SurfaceFeatures />
      <Heliosphere />
      <OortCloud />
      <AdaptiveClipping />
      <DistanceReporter />

      <SelectionReticle />
      {isTouchDevice() && <TouchPicking />}
      <OrbitControls makeDefault enableDamping dampingFactor={0.07} rotateSpeed={0.5} zoomSpeed={0.9} panSpeed={0.6} maxDistance={MAX_DISTANCE} />
      <CameraRig />
      <ExitToStars />
    </>
  );
}
