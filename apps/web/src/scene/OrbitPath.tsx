import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Line, ShaderMaterial, Vector3, type Group } from "three";
import type { SpaceObject } from "../domain/types";
import { OBJECTS_BY_ID } from "../data/solarSystem";
import { orbitBucketMs, orbitGeometry } from "../astronomy/orbits";
import { onTrajectoriesLoaded } from "../astronomy/trajectories";
import { useTimeStore } from "../state/timeStore";
import { useSelectionStore } from "../state/selectionStore";
import { layerOn, useSolarStore } from "../state/solarStore";
import { getRenderPosition, isPresent } from "./renderRegistry";

const orbitVertex = /* glsl */ `
attribute float aPhase;
varying float vPhase;
void main() {
  vPhase = aPhase;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Bright just behind the body, fading around the orbit like a comet trail. */
const orbitFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uPhase;
uniform float uOpacity;
varying float vPhase;
void main() {
  float behind = fract(uPhase - vPhase);
  float trail = pow(1.0 - behind, 3.0);
  float glow = 0.25 + 0.75 * trail;
  gl_FragColor = vec4(uColor * glow * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;

const DEEP_SPACE = new Set(["voyager-1", "voyager-2", "pioneer-10", "pioneer-11", "new-horizons"]);
/** Orbiters show only the stretch of track around the current date (days either side). */
const TRACK_WINDOW_DAYS: Record<string, number> = { juno: 30, cassini: 30, "parker-solar-probe": 120, jwst: 120 };

/** Resting opacity by kind; small bodies' orbits appear only when focused. */
function restingOpacity(obj: SpaceObject): number {
  switch (obj.type) {
    case "planet":
      return 0.35;
    case "dwarf-planet":
      return 0.26;
    case "moon":
      return 0.28;
    case "comet":
      return 0.16;
    case "spacecraft":
    case "telescope":
      // Only the deep-space probes' long voyages by default; orbiters would scribble over their planets.
      return DEEP_SPACE.has(obj.id) ? 0.16 : 0;
    case "space-station":
      return 0.25;
    default:
      return 0;
  }
}

function firstAtOrAbove(a: Float32Array, v: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function OrbitPath({ obj }: { obj: SpaceObject }) {
  const group = useRef<Group>(null!);
  const parent = obj.parentId ? OBJECTS_BY_ID.get(obj.parentId) : undefined;
  const bucketSize = orbitBucketMs(obj);
  const bucket = useTimeStore((s) => (Number.isFinite(bucketSize) ? Math.floor(s.timeMs / bucketSize) : 0));
  const selected = useSelectionStore((s) => s.selectedId === obj.id);
  const hovered = useSelectionStore((s) => s.hoveredId === obj.id);
  const [loads, setLoads] = useState(0);
  useEffect(() => (obj.ephemeris.kind === "trajectory" ? onTrajectoriesLoaded(() => setLoads((n) => n + 1)) : undefined), [obj]);

  const geometry = useMemo(() => {
    const date = new Date(Number.isFinite(bucketSize) ? bucket * bucketSize : useTimeStore.getState().timeMs);
    return orbitGeometry(obj, date, parent?.physical.meanRadiusKm ?? 1);
    // `loads` re-runs this once trajectories arrive.
  }, [obj, bucket, bucketSize, parent, loads]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: orbitVertex,
        fragmentShader: orbitFragment,
        uniforms: {
          uColor: { value: new Color(obj.visual.accent) },
          uPhase: { value: 0 },
          uOpacity: { value: 0 },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [obj.visual.accent],
  );

  const line = useMemo(() => {
    const l = new Line(new BufferGeometry(), material);
    l.raycast = () => {};
    l.frustumCulled = false;
    return l;
  }, [material]);

  useEffect(() => {
    if (!geometry) return;
    line.geometry.setAttribute("position", new BufferAttribute(geometry.positions, 3));
    line.geometry.setAttribute("aPhase", new BufferAttribute(geometry.phases, 1));
    line.geometry.setDrawRange(0, geometry.phases.length);
    lastBest.current = -1;
  }, [line, geometry]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      material.dispose();
    },
    [line, material],
  );

  const probe = useMemo(() => new Vector3(), []);
  const lastBest = useRef(-1);
  const resting = restingOpacity(obj);

  useFrame((_, delta) => {
    if (!geometry) {
      line.visible = false;
      return;
    }
    const layers = useSolarStore.getState();
    const shown = selected || hovered || (layers.orbits && layerOn(obj, layers) && isPresent(obj.id));
    const target = !shown ? 0 : selected ? 0.9 : hovered ? 0.6 : resting;
    const u = material.uniforms.uOpacity;
    u.value += (target - u.value) * Math.min(1, delta * 6);
    line.visible = u.value > 0.004;
    if (!line.visible) return;

    const relativeTo = geometry.relativeTo;
    if (relativeTo) group.current.position.copy(getRenderPosition(relativeTo));
    else group.current.position.set(0, 0, 0);

    if (geometry.phaseAt) {
      const now = useTimeStore.getState().timeMs;
      material.uniforms.uPhase.value = geometry.phaseAt(now);
      const w = TRACK_WINDOW_DAYS[obj.id];
      if (w) {
        // Phases rise with time along a track: draw only the samples within the window.
        const lo = firstAtOrAbove(geometry.phases, geometry.phaseAt(now - w * 86_400_000));
        const hi = firstAtOrAbove(geometry.phases, geometry.phaseAt(now + w * 86_400_000));
        line.geometry.setDrawRange(Math.max(0, lo - 1), Math.max(0, hi - lo + 2));
      }
      return;
    }
    // Otherwise find where along the sampled loop the body currently sits.
    probe.copy(getRenderPosition(obj.id)).sub(group.current.position);
    const pos = geometry.positions;
    const n = pos.length / 3;
    const d2 = (i: number) => (pos[i * 3] - probe.x) ** 2 + (pos[i * 3 + 1] - probe.y) ** 2 + (pos[i * 3 + 2] - probe.z) ** 2;
    // A body moves a few samples per frame at most: search around last frame's answer,
    // and scan the whole loop only at the start or after a time jump.
    const prev = lastBest.current;
    const local = prev >= 0 && prev < n;
    let best = local ? prev : 0;
    let bestD = local ? d2(prev) : Infinity;
    for (let k = local ? -12 : 0; local ? k <= 12 : k < n; k++) {
      const i = local ? (prev + k + n) % n : k;
      const d = d2(i);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    // Stopped at the window's edge: probably lost track, rescan next frame.
    lastBest.current = local && (best === (prev + 12) % n || best === (prev - 12 + n) % n) ? -1 : best;
    material.uniforms.uPhase.value = geometry.phases[best];
  });

  return (
    <group ref={group}>
      <primitive object={line} />
    </group>
  );
}
