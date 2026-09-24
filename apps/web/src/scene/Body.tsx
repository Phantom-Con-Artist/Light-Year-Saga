import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
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
import type { SpaceObject } from "../domain/types";
import { useTimeStore } from "../state/timeStore";
import { selectObject, useSelectionStore } from "../state/selectionStore";
import { getRenderPosition, getRenderRadius, syncRenderPositions } from "./renderRegistry";
import { atmosphereFragment, cloudFragment, ringFragment, ringVertex, surfaceFragment, surfaceVertex } from "./shaders";
import { BODY_TEXTURES, useRealTexture } from "./realTextures";
import { getBakedSurface } from "./bake";
import { BodyLabel } from "./BodyLabel";

const ATMOSPHERE_SCALE = 1.08;
/** Visual cap on spin so fast-forwarding doesn't strobe (rad per real second). */
const MAX_SPIN_RATE = 0.9;
const DEG = Math.PI / 180;

export function Body({ obj }: { obj: SpaceObject }) {
  const gl = useThree((s) => s.gl);
  const group = useRef<Group>(null!);
  const surface = useRef<Mesh>(null!);
  const clouds = useRef<Mesh>(null);
  const lastSimTime = useRef<number | null>(null);
  const radius = getRenderRadius(obj.id);
  const { visual, physical } = obj;

  const surfaceMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: surfaceVertex,
        fragmentShader: surfaceFragment,
        uniforms: {
          uMap: { value: getBakedSurface(gl, obj).texture },
          uAtmo: { value: new Color(visual.atmosphere ?? "#000000") },
          uHasAtmo: { value: visual.atmosphere ? 1 : 0 },
          uHighlight: { value: 0 },
          uLightPos: { value: new Vector3() },
          uEmissive: { value: new Color(0, 0, 0) },
          uNight: { value: null },
          uNightGain: { value: 0 },
          uOcean: { value: null },
          uOceanGain: { value: 0 },
        },
      }),
    [gl, obj, visual.atmosphere],
  );

  // Real surface maps replace the baked placeholder as they arrive.
  const files = BODY_TEXTURES[obj.id];
  const map = useRealTexture(files?.map);
  const night = useRealTexture(files?.night);
  const ocean = useRealTexture(files?.ocean, true);
  const cloudMap = useRealTexture(files?.clouds, true);
  const ringMap = useRealTexture(files?.ring);
  useEffect(() => {
    const u = surfaceMat.uniforms;
    if (map) u.uMap.value = map;
    if (night) {
      u.uNight.value = night;
      u.uNightGain.value = 1.4;
    }
    if (ocean) {
      u.uOcean.value = ocean;
      u.uOceanGain.value = 0.55;
    }
  }, [surfaceMat, map, night, ocean]);

  const cloudMat = useMemo(
    () =>
      cloudMap
        ? new ShaderMaterial({
            vertexShader: surfaceVertex,
            fragmentShader: cloudFragment,
            uniforms: { uMap: { value: cloudMap }, uLightPos: { value: new Vector3() } },
            transparent: true,
            depthWrite: false,
          })
        : null,
    [cloudMap],
  );
  useEffect(() => () => cloudMat?.dispose(), [cloudMat]);

  const atmosphereMat = useMemo(
    () =>
      visual.atmosphere
        ? new ShaderMaterial({
            vertexShader: surfaceVertex,
            fragmentShader: atmosphereFragment,
            uniforms: {
              uAtmo: { value: new Color(visual.atmosphere) },
              uLimb: { value: Math.sqrt(1 - 1 / (ATMOSPHERE_SCALE * ATMOSPHERE_SCALE)) },
              uIntensity: { value: 1.2 },
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
              uRingMap: { value: null },
              uHasRingMap: { value: 0 },
            },
            side: DoubleSide,
            transparent: true,
            depthWrite: false,
          })
        : null,
    [visual.rings, radius],
  );

  useEffect(() => {
    if (!ringMat || !ringMap) return;
    ringMat.uniforms.uRingMap.value = ringMap;
    ringMat.uniforms.uHasRingMap.value = 1;
  }, [ringMat, ringMap]);

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
    // Weather drifts a little faster than the ground turns.
    if (clouds.current) clouds.current.rotation.y = surface.current.rotation.y * 1.04 + 0.4;
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
          <sphereGeometry args={[1, 64, 48]} />
        </mesh>
        {cloudMat && (
          <mesh ref={clouds} scale={radius * 1.006} material={cloudMat} renderOrder={1} raycast={() => null}>
            <sphereGeometry args={[1, 64, 48]} />
          </mesh>
        )}
        {ringMat && visual.rings && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={ringMat} renderOrder={2} raycast={() => null}>
            <ringGeometry
              args={[visual.rings.innerRadii * radius, visual.rings.outerRadii * radius, 128, 1]}
            />
          </mesh>
        )}
      </group>
      {atmosphereMat && (
        <mesh scale={radius * ATMOSPHERE_SCALE} material={atmosphereMat} renderOrder={1} raycast={() => null}>
          <sphereGeometry args={[1, 48, 32]} />
        </mesh>
      )}
      <BodyLabel obj={obj} radius={radius} />
    </group>
  );
}
