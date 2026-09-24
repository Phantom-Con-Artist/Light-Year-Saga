import { OrbitControls } from "@react-three/drei";
import { useStarStore } from "../../data/stars";
import { DIFFUSE_SOURCES, SkyDome } from "../Backdrop";
import { StarField } from "./StarField";
import { StarOverlay } from "./StarOverlay";
import { Galaxy } from "./Galaxy";
import { InterstellarCameraRig } from "./InterstellarCameraRig";
import { diffuseSkyOpacity } from "./visibility";

/**
 * Light-year scale, Sun at the origin: 42k real stars (HYG) inside a
 * Milky Way model, over NASA's diffuse Milky Way near the Sun.
 */
export function InterstellarScene() {
  const catalog = useStarStore((s) => s.catalog);

  return (
    <>
      <SkyDome
        sources={DIFFUSE_SOURCES}
        gain={0.5}
        blackLevel={0.05}
        blur={6}
        opacity={(camera) => diffuseSkyOpacity(camera.position.length())}
      />
      <Galaxy />
      {catalog && (
        <>
          <StarField catalog={catalog} />
          <StarOverlay catalog={catalog} />
        </>
      )}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        rotateSpeed={0.5}
        zoomSpeed={5}
        panSpeed={0.6}
        minDistance={0.015}
        maxDistance={400_000}
      />
      {catalog && <InterstellarCameraRig catalog={catalog} />}
    </>
  );
}
