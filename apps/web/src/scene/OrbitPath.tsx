import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  ShaderMaterial,
  Vector3,
  type Group,
} from "three";
import type { SpaceObject } from "../domain/types";
import { OBJECTS_BY_ID } from "../data/solarSystem";
import { sampleOrbit } from "../astronomy/ephemeris";
import { heliocentricToRender, localToRender, type RenderTuple } from "../astronomy/scale";
import { useTimeStore } from "../state/timeStore";
import { useSelectionStore } from "../state/selectionStore";
import { getRenderPosition } from "./renderRegistry";

const YEAR_MS = 365.25 * 86_400_000;

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
  float trail = pow(1.0 - behind, 2.2);
  float glow = 0.18 + 0.82 * trail;
  gl_FragColor = vec4(uColor * glow * uOpacity, 1.0);
}
`;

/**
 * Orbits are resampled only when the simulation clock crosses a coarse time
 * bucket — orbital shapes barely change, and sampling is the costly part.
 */
function bucketMs(obj: SpaceObject): number {
  return obj.ephemeris.kind === "geocentric-moon" ? 30 * 86_400_000 : 5 * YEAR_MS;
}

export function OrbitPath({ obj }: { obj: SpaceObject }) {
  const group = useRef<Group>(null!);
  const isMoon = obj.ephemeris.kind === "geocentric-moon";
  const parent = obj.parentId ? OBJECTS_BY_ID.get(obj.parentId) : undefined;
  const bucketSize = bucketMs(obj);
  const bucket = useTimeStore((s) => Math.floor(s.timeMs / bucketSize));
  const selected = useSelectionStore((s) => s.selectedId === obj.id);
  const hovered = useSelectionStore((s) => s.hoveredId === obj.id);

  const positions = useMemo(() => {
    const samples = sampleOrbit(obj, new Date(bucket * bucketSize), isMoon ? 120 : 360);
    const arr = new Float32Array(samples.length * 3);
    const tmp: RenderTuple = [0, 0, 0];
    samples.forEach((p, i) => {
      if (isMoon) localToRender(p, parent!.physical.meanRadiusKm, tmp);
      else heliocentricToRender(p, tmp);
      arr.set(tmp, i * 3);
    });
    return arr;
  }, [obj, bucket, bucketSize, isMoon, parent]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: orbitVertex,
        fragmentShader: orbitFragment,
        uniforms: {
          uColor: { value: new Color(obj.visual.accent) },
          uPhase: { value: 0 },
          uOpacity: { value: 0.5 },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [obj.visual.accent],
  );

  const line = useMemo(() => {
    const geom = new BufferGeometry();
    const l = new Line(geom, material);
    l.raycast = () => {};
    l.frustumCulled = false;
    return l;
  }, [material]);

  useEffect(() => {
    const n = positions.length / 3;
    const phase = new Float32Array(n);
    for (let i = 0; i < n; i++) phase[i] = i / (n - 1);
    line.geometry.setAttribute("position", new BufferAttribute(positions, 3));
    line.geometry.setAttribute("aPhase", new BufferAttribute(phase, 1));
    line.geometry.computeBoundingSphere();
  }, [line, positions]);

  useEffect(() => () => line.geometry.dispose(), [line]);

  const probe = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    const bodyPos = getRenderPosition(obj.id);
    if (isMoon && parent) {
      group.current.position.copy(getRenderPosition(parent.id));
      probe.copy(bodyPos).sub(group.current.position);
    } else {
      probe.copy(bodyPos);
    }

    // Find where along the sampled loop the body currently sits.
    const n = positions.length / 3;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const dx = positions[i * 3] - probe.x;
      const dy = positions[i * 3 + 1] - probe.y;
      const dz = positions[i * 3 + 2] - probe.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    material.uniforms.uPhase.value = best / (n - 1);

    const target = selected ? 1.6 : hovered ? 1.1 : 0.55;
    const u = material.uniforms.uOpacity;
    u.value += (target - u.value) * Math.min(1, delta * 6);
  });

  return (
    <group ref={group}>
      <primitive object={line} />
    </group>
  );
}
