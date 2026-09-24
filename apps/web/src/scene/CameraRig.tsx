import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { OBJECTS_BY_ID, getObject } from "../data/solarSystem";
import { useViewStore } from "../state/viewStore";
import { useSelectionStore } from "../state/selectionStore";
import { useCameraStore } from "../state/cameraStore";
import { getRenderPosition, getRenderRadius } from "./renderRegistry";

/** The subset of OrbitControls this rig drives. */
interface Controls {
  target: Vector3;
  minDistance: number;
}

const FLIGHT_SECONDS = 1.8;
const INTRO_SECONDS = 3.2;
const HOME_DISTANCE = 400;
/** Where the camera appears when arriving from the interstellar view. */
const ENTRY_DISTANCE = 1350;
const HOME_DIRECTION = new Vector3(0, 0.5, 1).normalize();
const ORIGIN = new Vector3();

interface Flight {
  trackId: string | null;
  startTarget: Vector3;
  startDir: Vector3;
  startDistance: number;
  endDir: Vector3;
  endDistance: number;
  duration: number;
  elapsed: number;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Comfortable viewing distance for a body, accounting for rings. */
function framingDistance(id: string): number {
  const obj = getObject(id);
  const r = getRenderRadius(id);
  const extent = obj?.visual.rings ? obj.visual.rings.outerRadii : 1;
  return r * extent * (obj?.type === "star" ? 5 : 7);
}

/**
 * Flies to the selected object, then keeps the camera locked to it as it
 * moves along its orbit (the user can still orbit/zoom around it).
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const flight = useRef<Flight | null>(null);
  const trackId = useRef<string | null>(null);
  const lastTrackPos = useRef(new Vector3());

  const startFlight = (id: string | null, endDistance: number, endDir: Vector3 | null, duration: number) => {
    if (!controls) return;
    const offset = camera.position.clone().sub(controls.target);
    const startDir = offset.clone().normalize();
    flight.current = {
      trackId: id,
      startTarget: controls.target.clone(),
      startDir,
      startDistance: Math.max(offset.length(), 0.001),
      endDir: endDir ?? startDir.clone().add(new Vector3(0, 0.22, 0)).normalize(),
      endDistance,
      duration,
      elapsed: 0,
    };
    trackId.current = id;
    lastTrackPos.current.copy(id ? getRenderPosition(id) : ORIGIN);
    controls.minDistance = id ? getRenderRadius(id) * 1.4 : 5;
  };

  // Intro: sweep in from deep space, or — when arriving from the interstellar
  // view — continue along the same view direction.
  useEffect(() => {
    if (!controls) return;
    const carried = useViewStore.getState().carryDirection;
    const dir = carried ?? new Vector3(0, 900, 1500).normalize();
    camera.position.copy(dir).multiplyScalar(carried ? ENTRY_DISTANCE : 1750);
    controls.target.set(0, 0, 0);
    startFlight(null, HOME_DISTANCE, carried ?? HOME_DIRECTION, carried ? FLIGHT_SECONDS : INTRO_SECONDS);
  }, [controls]);

  useEffect(
    () =>
      useSelectionStore.subscribe((s, prev) => {
        if (s.focusRequest === prev.focusRequest) return;
        if (s.selectedId && OBJECTS_BY_ID.has(s.selectedId))
          startFlight(s.selectedId, framingDistance(s.selectedId), null, FLIGHT_SECONDS);
        else trackId.current = null;
      }),
    [controls],
  );

  useEffect(
    () =>
      useCameraStore.subscribe((s, prev) => {
        if (s.homeRequest === prev.homeRequest) return;
        startFlight(null, HOME_DISTANCE, HOME_DIRECTION, FLIGHT_SECONDS * 1.3);
      }),
    [controls],
  );

  useFrame((_, delta) => {
    if (!controls) return;
    const f = flight.current;

    if (f) {
      f.elapsed = Math.min(f.elapsed + delta, f.duration);
      const e = easeInOutCubic(f.elapsed / f.duration);
      const goal = f.trackId ? getRenderPosition(f.trackId) : ORIGIN;
      const target = f.startTarget.clone().lerp(goal, e);
      const dir = f.startDir.clone().lerp(f.endDir, e).normalize();
      const dist = f.startDistance * Math.pow(f.endDistance / f.startDistance, e);
      controls.target.copy(target);
      camera.position.copy(target).addScaledVector(dir, dist);
      if (f.elapsed >= f.duration) flight.current = null;
    } else if (trackId.current) {
      const now = getRenderPosition(trackId.current);
      const shift = now.clone().sub(lastTrackPos.current);
      controls.target.add(shift);
      camera.position.add(shift);
    }

    if (trackId.current) lastTrackPos.current.copy(getRenderPosition(trackId.current));
  });

  return null;
}
