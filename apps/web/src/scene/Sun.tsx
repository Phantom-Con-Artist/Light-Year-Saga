import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { AdditiveBlending, Color, ShaderMaterial, type Mesh } from "three";
import type { SpaceObject } from "../domain/types";
import { selectObject, useSelectionStore } from "../state/selectionStore";
import { getRenderRadius } from "./renderRegistry";
import { coronaFragment, coronaVertex, sunFragment, surfaceVertex } from "./shaders";
import { getBakedSurface } from "./bake";
import { BodyLabel } from "./BodyLabel";

export function Sun({ obj }: { obj: SpaceObject }) {
  const gl = useThree((s) => s.gl);
  const surface = useRef<Mesh>(null!);
  const radius = getRenderRadius(obj.id);

  const surfaceMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: surfaceVertex,
        fragmentShader: sunFragment,
        uniforms: { uMap: { value: getBakedSurface(gl, obj).texture }, uBoost: { value: 1.6 } },
        toneMapped: false,
      }),
    [gl, obj],
  );

  const coronaMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: coronaVertex,
        fragmentShader: coronaFragment,
        uniforms: { uColor: { value: new Color("#ffb45a") } },
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  // Slow cosmetic rotation on wall-clock time.
  useFrame((_, delta) => {
    surface.current.rotation.y += delta * 0.02;
  });

  return (
    <group>
      <mesh
        ref={surface}
        scale={radius}
        material={surfaceMat}
        onClick={(e) => {
          e.stopPropagation();
          selectObject(obj.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          useSelectionStore.getState().hoverObject(obj.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          useSelectionStore.getState().hoverObject(null);
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[1, 64, 48]} />
      </mesh>
      <Billboard>
        <mesh material={coronaMat} renderOrder={3} raycast={() => null}>
          <planeGeometry args={[radius * 8, radius * 8]} />
        </mesh>
      </Billboard>
      <BodyLabel obj={obj} radius={radius} />
    </group>
  );
}
