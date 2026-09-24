import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { SOLAR_SYSTEM } from "../data/solarSystem";
import { useTimeStore } from "../state/timeStore";
import { Body } from "./Body";
import { Sun } from "./Sun";
import { OrbitPath } from "./OrbitPath";
import { CameraRig } from "./CameraRig";
import { SelectionReticle } from "./SelectionReticle";
import { EclipticGrid, SkyDome } from "./Backdrop";

/** Advances the shared simulation clock. Mounted first so bodies read a fresh time. */
function ClockDriver() {
  useFrame((_, delta) => useTimeStore.getState().advance(Math.min(delta, 0.1)));
  return null;
}

export function SpaceScene() {
  return (
    <Canvas
      camera={{ position: [0, 900, 1500], fov: 45, near: 0.05, far: 10_000 }}
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#010208"]} />
      <ClockDriver />
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
        maxDistance={1400}
      />
      <CameraRig />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.9} luminanceSmoothing={0.25} radius={0.75} />
        <Noise opacity={0.03} />
        <Vignette offset={0.28} darkness={0.72} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}
