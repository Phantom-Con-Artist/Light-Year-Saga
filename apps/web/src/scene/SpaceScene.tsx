import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping, NoToneMapping, type ToneMapping } from "three";
import { useTimeStore } from "../state/timeStore";
import { useViewStore } from "../state/viewStore";
import { useGraphicsStore, type ToneMap } from "../state/graphicsStore";
import { usePerfStore } from "../state/perfStore";
import { SolarSystemScene } from "./SolarSystemScene";
import { InterstellarScene } from "./interstellar/InterstellarScene";
import { CosmicScene } from "./cosmic/CosmicScene";
import { FocusScene } from "./focus/FocusScene";
import { ScaleScene } from "./scale/ScaleScene";
import { SkyScene } from "./sky/SkyScene";

/** Advances the shared simulation clock. Mounted first so bodies read a fresh time. */
function ClockDriver() {
  useFrame((_, delta) => useTimeStore.getState().advance(Math.min(delta, 0.1)));
  return null;
}

/**
 * In portrait the default 45° vertical field of view leaves a sliver of sky
 * side to side; widen it so a phone shows as much of space as it can.
 */
function FovAdapter() {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  const level = useViewStore((s) => s.level);
  useEffect(() => {
    if (!("fov" in camera) || level === "sky") return; // the sky view zooms its own field of view
    const fov = aspect >= 1 ? 45 : aspect > 0.75 ? 52 : 62;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, aspect, level]);
  return null;
}

const TONE_MAPPING: Record<ToneMap, ToneMapping> = {
  aces: ACESFilmicToneMapping,
  agx: AgXToneMapping,
  neutral: NeutralToneMapping,
  none: NoToneMapping,
};

/** Settings that apply to a live renderer without recreating it. */
function RendererSettings() {
  const gl = useThree((s) => s.gl);
  const toneMapping = useGraphicsStore((s) => s.toneMapping);
  const exposure = useGraphicsStore((s) => s.exposure);
  useEffect(() => {
    gl.toneMapping = TONE_MAPPING[toneMapping];
    gl.toneMappingExposure = exposure;
  }, [gl, toneMapping, exposure]);
  return null;
}

/**
 * Custom frame pacing when the browser's default (one frame per display
 * refresh) isn't wanted: a frame-rate cap, and/or VSync off (render as soon as
 * the previous frame is done). Browsers still present at the display's
 * refresh, so VSync off mainly lowers input latency and shows raw GPU headroom.
 */
function FrameDriver({ vsync, cap }: { vsync: boolean; cap: number }) {
  const advance = useThree((s) => s.advance);
  const clock = useThree((s) => s.clock);
  useEffect(() => {
    let alive = true;
    let raf = 0;
    let timer = 0;
    const interval = cap > 0 ? 1000 / cap : 0;
    let next = performance.now();
    clock.elapsedTime = next / 1000;
    const channel = new MessageChannel();

    const frame = (now: number) => {
      if (!alive) return;
      if (interval === 0 || now >= next - 1) {
        // Stay on the cap's grid, but never try to catch up on missed frames.
        next = Math.max(next + interval, now);
        advance(now / 1000);
      }
      schedule();
    };
    const schedule = () => {
      if (vsync) raf = requestAnimationFrame(frame);
      else if (interval > 0) timer = window.setTimeout(() => frame(performance.now()), Math.max(0, next - performance.now()));
      else channel.port1.postMessage(0);
    };
    channel.port2.onmessage = () => frame(performance.now());
    schedule();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
    };
  }, [advance, clock, vsync, cap]);
  return null;
}

/** Counts frames for the FPS readout; publishes twice a second. */
function FrameCounter() {
  const gl = useThree((s) => s.gl);
  const show = useGraphicsStore((s) => s.showFps);
  useFrame(() => {
    if (!show) return;
    const perf = usePerfStore.getState();
    perf.tick(performance.now(), gl.getPixelRatio(), gl.info.render.calls, gl.info.render.points + gl.info.render.triangles);
  });
  return null;
}

export function SpaceScene() {
  const level = useViewStore((s) => s.level);
  const focusId = useViewStore((s) => s.focusId);
  const g = useGraphicsStore(
    useShallow((s) => ({
      maxPixelRatio: s.maxPixelRatio,
      resolutionScale: s.resolutionScale,
      adaptiveResolution: s.adaptiveResolution,
      targetFps: s.targetFps,
      vsync: s.vsync,
      fpsCap: s.fpsCap,
      antialias: s.antialias,
      powerPreference: s.powerPreference,
      toneMapping: s.toneMapping,
    })),
  );

  const nativeRatio = window.devicePixelRatio || 1;
  const baseDpr = Math.min(nativeRatio, g.maxPixelRatio) * g.resolutionScale;
  const minDpr = Math.max(0.5, baseDpr * 0.6);
  // Adaptive resolution steps between `minDpr` and the chosen resolution.
  const [dpr, setDpr] = useState(baseDpr);
  useEffect(() => setDpr(baseDpr), [baseDpr]);
  // After settling, watch again a little later: one-off hitches (loading a
  // view, baking textures) shouldn't cost resolution for the whole session.
  const [monitorRun, setMonitorRun] = useState(0);
  const rearm = useRef(0);
  useEffect(() => () => clearTimeout(rearm.current), []);

  const customPacing = !g.vsync || g.fpsCap > 0;
  // A cap below the target would read as a permanent slowdown.
  const band = Math.max(20, g.fpsCap > 0 ? Math.min(g.targetFps, g.fpsCap) : g.targetFps);

  return (
    <Canvas
      // Context-creation options can only change with a fresh WebGL context.
      key={`${g.antialias}-${g.powerPreference}`}
      dpr={g.adaptiveResolution ? dpr : baseDpr}
      frameloop={customPacing ? "never" : "always"}
      camera={{ position: [0, 900, 1500], fov: 45, near: 0.05, far: 10_000 }}
      gl={{ antialias: g.antialias, powerPreference: g.powerPreference, toneMapping: TONE_MAPPING[g.toneMapping] }}
    >
      {customPacing && <FrameDriver vsync={g.vsync} cap={g.fpsCap} />}
      {g.adaptiveResolution && (
        <PerformanceMonitor
          key={`${band}-${monitorRun}`}
          bounds={() => [band - 8, band + 2]}
          onDecline={() => setDpr((d) => Math.max(minDpr, d - 0.15))}
          onIncline={() => setDpr((d) => Math.min(baseDpr, d + 0.15))}
          flipflops={4}
          // Flip-flopping means the frame rate sits on the boundary: settle near full resolution.
          onFallback={() => {
            setDpr((d) => Math.max(minDpr, d, baseDpr * 0.85));
            rearm.current = window.setTimeout(() => setMonitorRun((n) => n + 1), 20_000);
          }}
        />
      )}
      <RendererSettings />
      <FrameCounter />
      <color attach="background" args={["#000000"]} />
      <ClockDriver />
      <FovAdapter />
      {level === "system" && <SolarSystemScene />}
      {level === "interstellar" && <InterstellarScene />}
      {level === "cosmic" && <CosmicScene />}
      {level === "focus" && <FocusScene key={focusId ?? "none"} />}
      {level === "scale" && <ScaleScene />}
      {level === "sky" && <SkyScene />}
    </Canvas>
  );
}
