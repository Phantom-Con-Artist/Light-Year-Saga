import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";
import { useSelectionStore } from "../../state/selectionStore";
import { useCameraStore } from "../../state/cameraStore";
import { useViewStore } from "../../state/viewStore";
import { reportFlightSpeed } from "../../state/flightStore";
import { useEdgeZoom } from "../useEdgeZoom";

export interface RigTarget {
  /** Current position (may move, e.g. an orbiting planet). */
  position: () => Vector3;
  /** Comfortable viewing distance. */
  distance: number;
  /** Preferred view direction (unit); null keeps the current one. */
  direction?: Vector3 | null;
  minDistance?: number;
}

interface Controls {
  target: Vector3;
  minDistance: number;
  maxDistance: number;
}

interface Flight {
  to: RigTarget;
  startTarget: Vector3;
  startDir: Vector3;
  endDir: Vector3;
  startDistance: number;
  duration: number;
  elapsed: number;
}

interface FlightRigProps {
  resolve: (id: string) => RigTarget | null;
  home: RigTarget;
  /** Arrival animation: start at `fromDistance` from the target and fly to it (default: home). */
  entry?: { fromDistance: number; target?: RigTarget };
  /** Near/far planes as a function of camera→target distance. */
  clip?: (distance: number) => [number, number];
  /** Scroll past the inner / outer limit to change level. */
  edgeIn?: { atEdge: (distance: number, target: Vector3) => boolean; onTrigger: (dir: Vector3) => void };
  edgeOut?: { atEdge: (distance: number) => boolean; onTrigger: (dir: Vector3) => void };
  /** Called when the camera moves meaningfully (for distance readouts). */
  onDistance?: (camera: PerspectiveCamera) => void;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Generic camera director: flies to selected objects along an exponential
 * distance curve (so huge scale changes feel even), then keeps tracking them.
 */
export function FlightRig({ resolve, home, entry, clip, edgeIn, edgeOut, onDistance }: FlightRigProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const flight = useRef<Flight | null>(null);
  const tracking = useRef<RigTarget | null>(null);
  const lastTargetPos = useRef(new Vector3());
  const lastDistance = useRef(1);

  const flyTo = (to: RigTarget, duration: number) => {
    if (!controls) return;
    const offset = camera.position.clone().sub(controls.target);
    const startDir = offset.clone().normalize();
    flight.current = {
      to,
      startTarget: controls.target.clone(),
      startDir,
      endDir: to.direction?.clone().normalize() ?? startDir,
      startDistance: Math.max(offset.length(), 1e-9),
      duration,
      elapsed: 0,
    };
    tracking.current = to;
    lastTargetPos.current.copy(to.position());
    controls.minDistance = to.minDistance ?? to.distance * 0.02;
  };

  // Arrival.
  useEffect(() => {
    if (!controls) return;
    const carried = useViewStore.getState().carryDirection;
    const to = entry?.target ?? home;
    const dir = carried ?? to.direction ?? new Vector3(0, 0.45, 1).normalize();
    const start = entry?.fromDistance ?? to.distance * 3;
    controls.target.copy(to.position());
    camera.position.copy(to.position()).addScaledVector(dir, start);
    flyTo({ ...to, direction: to.direction ?? dir }, 2.6);
  }, [controls]);

  // Selection → fly.
  useEffect(
    () =>
      useSelectionStore.subscribe((s, prev) => {
        if (s.focusRequest === prev.focusRequest || !s.selectedId) return;
        const t = resolve(s.selectedId);
        if (!t) return;
        const ratio = Math.abs(Math.log((t.distance + 1e-12) / (lastDistance.current + 1e-12)));
        flyTo(t, Math.min(4, 1.8 + ratio * 0.12));
      }),
    [controls, resolve],
  );

  // Overview button / H key.
  useEffect(
    () =>
      useCameraStore.subscribe((s, prev) => {
        if (s.homeRequest !== prev.homeRequest) flyTo(home, 2.4);
      }),
    [controls, home],
  );

  useEdgeZoom({
    direction: "in",
    atEdge: () => !!edgeIn && !!controls && edgeIn.atEdge(camera.position.distanceTo(controls.target), controls.target),
    onTrigger: () => edgeIn?.onTrigger(camera.position.clone().sub(controls!.target).normalize()),
  });
  useEdgeZoom({
    direction: "out",
    atEdge: () => !!edgeOut && !!controls && edgeOut.atEdge(camera.position.distanceTo(controls.target)),
    onTrigger: () => edgeOut?.onTrigger(camera.position.clone().normalize()),
  });

  useFrame((_, delta) => {
    if (!controls) return;
    const f = flight.current;
    let speed = 0;

    if (f) {
      f.elapsed = Math.min(f.elapsed + delta, f.duration);
      const e = ease(f.elapsed / f.duration);
      const goal = f.to.position();
      const target = f.startTarget.clone().lerp(goal, e);
      const dir = f.startDir.clone().lerp(f.endDir, e).normalize();
      const dist = f.startDistance * Math.pow(f.to.distance / f.startDistance, e);
      const moved = target.distanceTo(controls.target);
      controls.target.copy(target);
      camera.position.copy(target).addScaledVector(dir, dist);
      speed = (moved / Math.max(dist, 1e-12) + Math.abs(Math.log(dist / lastDistance.current))) / Math.max(delta, 1e-3) / 4;
      if (f.elapsed >= f.duration) flight.current = null;
    } else if (tracking.current) {
      // Follow a moving target without fighting the user's orbit/zoom.
      const now = tracking.current.position();
      const shift = now.clone().sub(lastTargetPos.current);
      controls.target.add(shift);
      camera.position.add(shift);
    }
    if (tracking.current) lastTargetPos.current.copy(tracking.current.position());
    reportFlightSpeed(speed);

    const dist = camera.position.distanceTo(controls.target);
    if (clip) {
      const [near, far] = clip(dist);
      if (Math.abs(camera.near - near) > near * 0.2 || Math.abs(camera.far - far) > far * 0.2) {
        camera.near = near;
        camera.far = far;
        camera.updateProjectionMatrix();
      }
    }
    if (Math.abs(dist / lastDistance.current - 1) > 0.005) onDistance?.(camera);
    lastDistance.current = dist;
  });

  return null;
}
