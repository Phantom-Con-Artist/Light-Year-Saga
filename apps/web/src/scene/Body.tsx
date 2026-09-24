import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  ShaderMaterial,
  Vector3,
  type Group,
  type Mesh,
} from "three";
import type { SpaceObject, SurfaceStyle } from "../domain/types";
import { useTimeStore } from "../state/timeStore";
import { selectObject, useSelectionStore } from "../state/selectionStore";
import { getRenderPosition, getRenderRadius, syncRenderPositions } from "./renderRegistry";
import { atmosphereFragment, ringFragment, ringVertex, surfaceFragment, worldVertex } from "./shaders";
import { BodyLabel } from "./BodyLabel";

const STYLE_INDEX: Record<SurfaceStyle, number> = {
  star: 0,
  rocky: 0,
  cloudy: 1,
  terran: 2,
  banded: 3,
  ice: 4,
};

const ATMOSPHERE_SCALE = 1.08;
/** Visual cap on spin so fast-forwarding doesn't strobe (rad per real second). */
const MAX_SPIN_RATE = 0.9;
const DEG = Math.PI / 180;

function seedFromId(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h / 97;
}

export function Body({ obj }: { obj: SpaceObject }) {
  const group = useRef<Group>(null!);
  const surface = useRef<Mesh>(null!);
  const lastSimTime = useRef<number | null>(null);
  const radius = getRenderRadius(obj.id);
  const { visual, physical } = obj;

  const surfaceMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: worldVertex,
        fragmentShader: surfaceFragment,
        uniforms: {
          uColorA: { value: new Color(visual.colorA) },
          uColorB: { value: new Color(visual.colorB) },
          uAtmo: { value: new Color(visual.atmosphere ?? "#000000") },
          uHasAtmo: { value: visual.atmosphere ? 1 : 0 },
          uStyle: { value: STYLE_INDEX[visual.style] },
          uSeed: { value: seedFromId(obj.id) },
          uHighlight: { value: 0 },
        },
      }),
    [obj.id, visual],
  );

  const atmosphereMat = useMemo(
    () =>
      visual.atmosphere
        ? new ShaderMaterial({
            vertexShader: worldVertex,
            fragmentShader: atmosphereFragment,
            uniforms: {
              uAtmo: { value: new Color(visual.atmosphere) },
              uLimb: { value: Math.sqrt(1 - 1 / (ATMOSPHERE_SCALE * ATMOSPHERE_SCALE)) },
              uIntensity: { value: 1.6 },
            },
            side: BackSide,
            blending: AdditiveBlending,
            transparent: true,
            depthWrite: false,
          })
        : null,
    [visual.atmosphere],
  );

  const ringMat = useMemo(
    () =>
      visual.rings
        ? new ShaderMaterial({
            vertexShader: ringVertex,
            fragmentShader: ringFragment,
            uniforms: {
              uColor: { value: new Color(visual.rings.color) },
              uInner: { value: visual.rings.innerRadii * radius },
              uOuter: { value: visual.rings.outerRadii * radius },
              uPlanetCenter: { value: new Vector3() },
              uPlanetRadius: { value: radius },
            },
            side: DoubleSide,
            transparent: true,
            depthWrite: false,
          })
        : null,
    [visual.rings, radius],
  );

  useFrame((_, delta) => {
    const { timeMs } = useTimeStore.getState();
    syncRenderPositions(timeMs);
    const pos = getRenderPosition(obj.id);
    group.current.position.copy(pos);
    if (ringMat) ringMat.uniforms.uPlanetCenter.value.copy(pos);

    if (obj.type === "moon" && obj.parentId) {
      // Tidally locked: always present the same face to the parent.
      surface.current.lookAt(getRenderPosition(obj.parentId));
    } else if (physical.rotationPeriodHours && lastSimTime.current !== null) {
      const simSeconds = (timeMs - lastSimTime.current) / 1000;
      const dAngle = (2 * Math.PI * simSeconds) / (physical.rotationPeriodHours * 3600);
      const cap = MAX_SPIN_RATE * delta;
      surface.current.rotation.y += Math.max(-cap, Math.min(cap, dAngle));
    }
    lastSimTime.current = timeMs;

    const { selectedId, hoveredId } = useSelectionStore.getState();
    const target = obj.id === selectedId ? 1 : obj.id === hoveredId ? 0.6 : 0;
    const u = surfaceMat.uniforms.uHighlight;
    u.value += (target - u.value) * Math.min(1, delta * 8);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectObject(obj.id);
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    useSelectionStore.getState().hoverObject(obj.id);
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    useSelectionStore.getState().hoverObject(null);
    document.body.style.cursor = "";
  };

  return (
    <group ref={group}>
      <group rotation={[0, 0, -(physical.axialTiltDeg ?? 0) * DEG]}>
        <mesh
          ref={surface}
          scale={radius}
          material={surfaceMat}
          onClick={onClick}
          onPointerOver={onOver}
          onPointerOut={onOut}
        >
          <sphereGeometry args={[1, 96, 64]} />
        </mesh>
        {ringMat && visual.rings && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={ringMat} renderOrder={2}>
            <ringGeometry
              args={[visual.rings.innerRadii * radius, visual.rings.outerRadii * radius, 256, 1]}
            />
          </mesh>
        )}
      </group>
      {atmosphereMat && (
        <mesh scale={radius * ATMOSPHERE_SCALE} material={atmosphereMat} renderOrder={1}>
          <sphereGeometry args={[1, 64, 48]} />
        </mesh>
      )}
      <BodyLabel obj={obj} radius={radius} />
    </group>
  );
}
