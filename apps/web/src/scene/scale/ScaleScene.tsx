import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3, type Group, type PerspectiveCamera } from "three";
import { SCALE_LINEUP, type ScaleEntry } from "../../data/scaleLineup";
import { scaleCursor, useScaleStore } from "../../state/scaleStore";
import { STARMAP_SOURCES, SkyDome } from "../Backdrop";
import { ScreenLabel } from "../ScreenLabel";
import { BlackHoleBody, OrbitRing, PlanetBody, StarSphere, LENS_SKY_GAIN } from "../common/Bodies";
import { reportFlightSpeed } from "../../state/flightStore";

/** Units: kilometres. Positions are recomputed every frame relative to the focus (floating origin). */

const LIGHT_DIR = new Vector3(-1, 0.35, 0.9).normalize();

/** How much room an entry visually needs (corona, accretion disk…), as a radius. */
function visualExtent(e: ScaleEntry): number {
  if (e.kind === "black-hole") return e.radiusKm * Math.max(5, e.diskOuterRs ?? 0);
  if (e.kind === "star") return e.radiusKm * 1.4;
  return e.radiusKm;
}

/** Left-to-right layout, each object leaving room for its neighbour. */
const LAYOUT = (() => {
  const x: number[] = [];
  let cursor = 0;
  SCALE_LINEUP.forEach((e, i) => {
    const ext = visualExtent(e);
    if (i === 0) cursor = 0;
    else cursor += visualExtent(SCALE_LINEUP[i - 1]) + ext * 1.35;
    x.push(cursor);
  });
  return x;
})();

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Focus point and camera distance for a continuous line-up position. */
function framingAt(t: number): { focusX: number; distance: number } {
  const i = Math.floor(t);
  const j = Math.min(SCALE_LINEUP.length - 1, i + 1);
  const s = smooth(t - i);
  const fx = (k: number) => LAYOUT[k] - visualExtent(SCALE_LINEUP[k]) * 0.55;
  const dist = (k: number) => visualExtent(SCALE_LINEUP[k]) * 3.6;
  return {
    focusX: fx(i) + (fx(j) - fx(i)) * s,
    distance: Math.exp(Math.log(dist(i)) + (Math.log(dist(j)) - Math.log(dist(i))) * s),
  };
}

function Entry({ entry, index, holder }: { entry: ScaleEntry; index: number; holder: (Group | null)[] }) {
  const light = useMemo(() => new Vector3(), []);
  const group = useRef<Group>(null);

  useFrame(() => {
    if (group.current) light.copy(group.current.position).addScaledVector(LIGHT_DIR, entry.radiusKm * 1e3);
  });

  return (
    <group
      ref={(g) => {
        group.current = g;
        holder[index] = g;
      }}
    >
      {entry.kind === "planet" && entry.planet && <PlanetBody planet={entry.planet} radius={entry.radiusKm} lightPosition={light} spin={0.08} />}
      {entry.kind === "star" && <StarSphere radius={entry.radiusKm} temperatureK={entry.temperatureK ?? 5772} />}
      {entry.kind === "black-hole" && <BlackHoleBody rs={entry.radiusKm} diskOuterRs={entry.diskOuterRs ?? 0} jets={entry.jets} lensing={false} />}
      {entry.kind === "orbit" && (
        <>
          <OrbitRing radius={entry.radiusKm} color="#7d9bff" opacity={0.7} dashed={false} />
          <StarSphere radius={695_700} temperatureK={5772} />
        </>
      )}
    </group>
  );
}

function Lineup() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3 } | null;
  const gl = useThree((s) => s.gl);
  const holder = useMemo<(Group | null)[]>(() => [], []);
  const lastT = useRef(scaleCursor.t);

  // Scroll moves along the line-up instead of zooming.
  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useScaleStore.getState();
      s.setTarget(s.target + Math.sign(e.deltaY) * 0.34);
    };
    // Pinch works like the wheel: fingers together (zooming out) moves to bigger objects.
    let lastSpread = 0;
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => {
      lastSpread = e.touches.length === 2 ? spread(e.touches) : 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || lastSpread <= 0) return;
      const now = spread(e.touches);
      const s = useScaleStore.getState();
      s.setTarget(s.target - Math.log(now / lastSpread) * 2.2);
      lastSpread = now;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [gl]);

  useEffect(() => {
    camera.position.set(0, 0.25, 1).normalize();
  }, [camera]);

  useFrame((_, delta) => {
    const { target, setIndex } = useScaleStore.getState();
    scaleCursor.t += (target - scaleCursor.t) * Math.min(1, delta * 2.4);
    if (Math.abs(target - scaleCursor.t) < 1e-4) scaleCursor.t = target;
    const t = scaleCursor.t;
    setIndex(Math.round(t));

    const { focusX, distance } = framingAt(t);
    const focusExtent = visualExtent(SCALE_LINEUP[Math.round(t)]);
    SCALE_LINEUP.forEach((e, i) => {
      const g = holder[i];
      if (!g) return;
      g.position.set(LAYOUT[i] - focusX, 0, 0);
      // Far-too-small neighbours are sub-pixel; skip drawing them.
      g.visible = visualExtent(e) > focusExtent * 2e-4;
    });

    if (controls) controls.target.set(0, 0, 0);
    const dir = camera.position.clone().normalize();
    camera.position.copy(dir.multiplyScalar(distance));
    camera.near = distance * 2e-3;
    camera.far = distance * 3e4;
    camera.updateProjectionMatrix();
    reportFlightSpeed(Math.abs(t - lastT.current) / Math.max(delta, 1e-3) / 1.5);
    lastT.current = t;
  });

  return (
    <>
      {SCALE_LINEUP.map((e, i) => (
        <Entry key={e.id} entry={e} index={i} holder={holder} />
      ))}
      {SCALE_LINEUP.map((e, i) => (
        <ScreenLabel
          key={`l-${e.id}`}
          position={() => holder[i]?.position ?? new Vector3()}
          offset={[0, -visualExtent(e) * (e.kind === "black-hole" ? 0.5 : 1.15), 0]}
          text={e.name}
          className="scale-lineup-label"
          opacity={() => {
            const d = Math.abs(i - scaleCursor.t);
            return d > 5 ? 0 : 1 - Math.max(0, d - 3) / 2;
          }}
          onClick={() => useScaleStore.getState().setTarget(i)}
        />
      ))}
    </>
  );
}

/** Size line-up from a neutron star to TON 618. */
export function ScaleScene() {
  return (
    <>
      <SkyDome sources={STARMAP_SOURCES} gain={LENS_SKY_GAIN} />
      <Lineup />
      <OrbitControls makeDefault enableZoom={false} enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.45} minPolarAngle={0.35} maxPolarAngle={Math.PI - 0.35} />
    </>
  );
}
