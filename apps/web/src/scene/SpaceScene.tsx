import { useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";
import { useTimeStore } from "../state/timeStore";
import { useViewStore } from "../state/viewStore";
import { SolarSystemScene } from "./SolarSystemScene";
import { InterstellarScene } from "./interstellar/InterstellarScene";
import { CosmicScene } from "./cosmic/CosmicScene";
import { FocusScene } from "./focus/FocusScene";
import { ScaleScene } from "./scale/ScaleScene";

/** Advances the shared simulation clock. Mounted first so bodies read a fresh time. */
function ClockDriver() {
  useFrame((_, delta) => useTimeStore.getState().advance(Math.min(delta, 0.1)));
  return null;
}

/** Phones have tiny, very dense screens and weaker GPUs: cap lower there. */
const MAX_DPR = Math.min(window.devicePixelRatio, window.matchMedia("(pointer: coarse)").matches ? 1.5 : 1.75);

/**
 * In portrait the default 45° vertical field of view leaves a sliver of sky
 * side to side; widen it so a phone shows as much of space as it can.
 */
function FovAdapter() {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  useEffect(() => {
    if (!("fov" in camera)) return;
    const fov = aspect >= 1 ? 45 : aspect > 0.75 ? 52 : 62;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, aspect]);
  return null;
}

export function SpaceScene() {
  // Start at native-ish resolution and step down if the frame rate drops.
  const [dpr, setDpr] = useState(MAX_DPR);
  const level = useViewStore((s) => s.level);
  const focusId = useViewStore((s) => s.focusId);

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 900, 1500], fov: 45, near: 0.05, far: 10_000 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: ACESFilmicToneMapping }}
    >
      <PerformanceMonitor
        bounds={() => [45, 58]}
        onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(MAX_DPR, d + 0.25))}
        flipflops={4}
        onFallback={() => setDpr(1)}
      />
      <color attach="background" args={["#000000"]} />
      <ClockDriver />
      <FovAdapter />
      {level === "system" && <SolarSystemScene />}
      {level === "interstellar" && <InterstellarScene />}
      {level === "cosmic" && <CosmicScene />}
      {level === "focus" && <FocusScene key={focusId ?? "none"} />}
      {level === "scale" && <ScaleScene />}
    </Canvas>
  );
}
