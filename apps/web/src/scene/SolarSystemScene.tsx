import { useEffect } from "react";
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

  useEffect(() => {
    camera.near = 0.05;
    camera.far = 10_000;
    camera.updateProjectionMatrix();
  }, [camera]);

  return (
    <>
      <SkyDome />
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
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        rotateSpeed={0.5}
        zoomSpeed={0.9}
        panSpeed={0.6}
        maxDistance={MAX_DISTANCE}
      />
      <CameraRig />
      <ExitToStars />
    </>
  );
}
