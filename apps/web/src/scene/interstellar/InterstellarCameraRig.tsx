import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";
import type { StarCatalog } from "../../data/stars";
import { getDeepSky } from "../../data/deepSky";
import { useSelectionStore } from "../../state/selectionStore";
import { useCameraStore } from "../../state/cameraStore";
import { useViewStore } from "../../state/viewStore";
import { useEdgeZoom } from "../useEdgeZoom";

interface Controls {
  target: Vector3;
  minDistance: number;
}

interface Flight {
  startTarget: Vector3;
  endTarget: Vector3;
  startDir: Vector3;
  endDir: Vector3;
  startDistance: number;
  endDistance: number;
  duration: number;
  elapsed: number;
}

/** Arrival: pull back from the Sun to reveal the neighbourhood. */
const ENTRY_START_LY = 0.02;
const ENTRY_END_LY = 32;
const HOME_DISTANCE_LY = 60;
const SUN_MIN_DISTANCE_LY = 0.015;
const STAR_FRAMING_LY = 3;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function InterstellarCameraRig({ catalog }: { catalog: StarCatalog }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const flight = useRef<Flight | null>(null);
  const lastReported = useRef(0);

  const flyTo = (target: Vector3, distance: number, dir: Vector3 | null, duration: number) => {
    if (!controls) return;
    const offset = camera.position.clone().sub(controls.target);
    const startDir = offset.clone().normalize();
    flight.current = {
      startTarget: controls.target.clone(),
      endTarget: target.clone(),
      startDir,
      endDir: dir?.clone().normalize() ?? startDir,
      startDistance: Math.max(offset.length(), 1e-4),
      endDistance: distance,
      duration,
      elapsed: 0,
    };
    controls.minDistance = target.lengthSq() < 1e-6 ? SUN_MIN_DISTANCE_LY : Math.min(distance * 0.05, 0.05);
  };

  const positionOf = (id: string): { position: Vector3; framing: number; dir: Vector3 | null } | null => {
    if (id === "sun") return { position: new Vector3(), framing: 1.5, dir: null };
    const deep = getDeepSky(id);
    if (deep) return { position: deep.position, framing: deep.framingLy, dir: deep.viewDirection ?? null };
    const i = catalog.indexById.get(id);
    if (i === undefined) return null;
    const p = catalog.positions;
    return { position: new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]), framing: STAR_FRAMING_LY, dir: null };
  };

  // Camera setup + arrival flight.
  useEffect(() => {
    if (!controls) return;
    camera.near = 1e-4;
    camera.far = 3e6;
    camera.updateProjectionMatrix();
    const dir = useViewStore.getState().carryDirection ?? new Vector3(0, 0.45, 1).normalize();
    controls.target.set(0, 0, 0);
    camera.position.copy(dir).multiplyScalar(ENTRY_START_LY);
    flyTo(new Vector3(), ENTRY_END_LY, dir, 2.6);
  }, [controls]);

  // Selection → fly.
  useEffect(
    () =>
      useSelectionStore.subscribe((s, prev) => {
        if (s.focusRequest === prev.focusRequest || !s.selectedId) return;
        const t = positionOf(s.selectedId);
        if (t) flyTo(t.position, t.framing, t.dir, t.framing > 10_000 ? 3 : 2);
      }),
    [controls, catalog],
  );

  // Overview → back to the Sun's neighbourhood.
  useEffect(
    () =>
      useCameraStore.subscribe((s, prev) => {
        if (s.homeRequest !== prev.homeRequest) flyTo(new Vector3(), HOME_DISTANCE_LY, null, 2.2);
      }),
    [controls],
  );

  // Scroll in at the Sun → descend into the Solar System.
  useEdgeZoom({
    direction: "in",
    atEdge: () =>
      !!controls &&
      controls.target.lengthSq() < 1e-6 &&
      camera.position.distanceTo(controls.target) <= SUN_MIN_DISTANCE_LY * 1.1,
    onTrigger: () => {
      useSelectionStore.getState().selectObject(null);
      useViewStore.getState().goTo("system", { direction: camera.position.clone().normalize() });
    },
  });

  useFrame((_, delta) => {
    if (!controls) return;
    const f = flight.current;
    if (f) {
      f.elapsed = Math.min(f.elapsed + delta, f.duration);
      const e = ease(f.elapsed / f.duration);
      const target = f.startTarget.clone().lerp(f.endTarget, e);
      const dir = f.startDir.clone().lerp(f.endDir, e).normalize();
      // Exponential in distance so huge scale changes feel even.
      const dist = f.startDistance * Math.pow(f.endDistance / f.startDistance, e);
      controls.target.copy(target);
      camera.position.copy(target).addScaledVector(dir, dist);
      if (f.elapsed >= f.duration) flight.current = null;
    }

    const d = camera.position.length();
    if (Math.abs(d - lastReported.current) > lastReported.current * 0.01 + 1e-4) {
      lastReported.current = d;
      useViewStore.getState().setCameraDistanceLy(d);
    }
  });

  return null;
}
