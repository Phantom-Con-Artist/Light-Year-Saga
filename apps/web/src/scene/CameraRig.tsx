import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import { OBJECTS_BY_ID, getObject } from "../data/solarSystem";
import { useViewStore } from "../state/viewStore";
import { useSelectionStore } from "../state/selectionStore";
import { useCameraStore } from "../state/cameraStore";
import { getBodyOrientation, getRenderPosition, getRenderRadius, regionRenderRadius } from "./renderRegistry";
import { getFeature } from "../data/solar/features";
import { featureWorldNormal } from "./solar/SurfaceFeatures";

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

const IDENTITY = new Quaternion();
const dq = new Quaternion();
const inv = new Quaternion();
const offset = new Vector3();

/** A view 55° above the ecliptic, keeping the current compass direction. */
function regionView(from: Vector3): Vector3 {
  const h = new Vector3(from.x, 0, from.z);
  if (h.lengthSq() < 1e-6) h.set(0, 0, 1);
  h.normalize().multiplyScalar(Math.cos(0.96));
  return h.setY(Math.sin(0.96)).normalize();
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Comfortable viewing distance for a body, accounting for rings; regions are framed whole. */
function framingDistance(id: string): number {
  const obj = getObject(id);
  if (obj?.type === "region") return regionRenderRadius(id) * (obj.parentId === "earth" ? 3 : obj.id === "oort-cloud" ? 1 : 1.9);
  const r = getRenderRadius(id);
  const extent = obj?.visual.rings ? obj.visual.rings.outerRadii : 1;
  // Comets: stand back far enough to see the tail.
  if (obj?.type === "comet") return Math.max(r * 7, 4);
  return r * extent * (obj?.type === "star" ? 5 : 7);
}

/** What the camera centres on: regions around the Sun centre on the Sun, Earth's satellites on Earth. */
function anchorOf(id: string): string | null {
  const obj = getObject(id);
  if (obj?.type === "region") return obj.parentId && obj.parentId !== "sun" ? obj.parentId : null;
  return id;
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
  const spinWith = useRef<string | null>(null);
  const lastSpin = useRef(new Quaternion());

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
        const feature = getFeature(s.selectedId);
        spinWith.current = null;
        if (feature) {
          // Swing round so the feature faces the camera, then turn with the body.
          startFlight(feature.bodyId, getRenderRadius(feature.bodyId) * 3.2, featureWorldNormal(feature), FLIGHT_SECONDS);
          spinWith.current = feature.bodyId;
          lastSpin.current.copy(getBodyOrientation(feature.bodyId) ?? IDENTITY);
        } else if (s.selectedId && OBJECTS_BY_ID.has(s.selectedId)) {
          const obj = getObject(s.selectedId)!;
          // Belts and bubbles read best from above the ecliptic.
          const dir = obj.type === "region" && obj.parentId === "sun" ? regionView(camera.position) : null;
          startFlight(anchorOf(s.selectedId), framingDistance(s.selectedId), dir, FLIGHT_SECONDS);
        } else trackId.current = null;
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

    // Keep a selected surface feature under the camera as its body rotates.
    const spinId = spinWith.current;
    const q = spinId ? getBodyOrientation(spinId) : undefined;
    if (spinId && q && trackId.current === spinId) {
      dq.copy(q).multiply(inv.copy(lastSpin.current).invert());
      if (!f) {
        offset.copy(camera.position).sub(controls.target).applyQuaternion(dq);
        camera.position.copy(controls.target).add(offset);
      } else f.endDir.applyQuaternion(dq);
      lastSpin.current.copy(q);
    }
  });

  return null;
}
