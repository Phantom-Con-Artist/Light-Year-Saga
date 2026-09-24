import { useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";
import { useTimeStore } from "../state/timeStore";
import { useViewStore } from "../state/viewStore";
import { SolarSystemScene } from "./SolarSystemScene";
import { InterstellarScene } from "./interstellar/InterstellarScene";

/** Advances the shared simulation clock. Mounted first so bodies read a fresh time. */
function ClockDriver() {
  useFrame((_, delta) => useTimeStore.getState().advance(Math.min(delta, 0.1)));
  return null;
}

const MAX_DPR = Math.min(window.devicePixelRatio, 1.75);

export function SpaceScene() {
  // Start at native-ish resolution and step down if the frame rate drops.
  const [dpr, setDpr] = useState(MAX_DPR);
  const level = useViewStore((s) => s.level);

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
      {level === "system" ? <SolarSystemScene /> : <InterstellarScene />}
    </Canvas>
  );
}
