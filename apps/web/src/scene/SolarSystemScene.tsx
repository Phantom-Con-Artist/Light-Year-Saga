import { useCallback, useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
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
import { getRenderPosition, getRenderRadius } from "./renderRegistry";
import { isTouchDevice } from "../ui/useMedia";
import { useStarStore } from "../data/stars";
import { SkyStars } from "./common/SkyStars";

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
      for (const obj of SOLAR_SYSTEM) {
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

const MAX_DISTANCE = 1400;

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
    camera.far = 10_000;
    camera.updateProjectionMatrix();
  }, [camera]);

  return (
    <>
      <SkyDome />
      {/* The photo already holds these stars; this layer adds their sparkle. Planets hide them. */}
      {catalog && <SkyStars catalog={catalog} radius={3000} followCamera depthTest limitMag={() => 3.6} renderOrder={-9} />}
      <EclipticGrid />

      {SOLAR_SYSTEM.map((obj) =>
        obj.type === "star" ? (
          <Sun key={obj.id} obj={obj} />
        ) : (
          <group key={obj.id}>
            <OrbitPath obj={obj} />
            <Body obj={obj} />
          </group>
        ),
      )}

      <SelectionReticle />
      {isTouchDevice() && <TouchPicking />}
      <OrbitControls makeDefault enableDamping dampingFactor={0.07} rotateSpeed={0.5} zoomSpeed={0.9} panSpeed={0.6} maxDistance={MAX_DISTANCE} />
      <CameraRig />
      <ExitToStars />
    </>
  );
}
