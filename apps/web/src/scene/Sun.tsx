import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { AdditiveBlending, Color, ShaderMaterial } from "three";
import type { SpaceObject } from "../domain/types";
import { selectObject, useSelectionStore } from "../state/selectionStore";
import { getRenderRadius } from "./renderRegistry";
import { coronaFragment, coronaVertex, sunFragment, worldVertex } from "./shaders";
import { BodyLabel } from "./BodyLabel";

export function Sun({ obj }: { obj: SpaceObject }) {
  const radius = getRenderRadius(obj.id);

  const surfaceMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: worldVertex,
        fragmentShader: sunFragment,
        uniforms: {
          uColorA: { value: new Color(obj.visual.colorA) },
          uColorB: { value: new Color(obj.visual.colorB) },
          uTime: { value: 0 },
        },
        toneMapped: false,
      }),
    [obj.visual],
  );

  const coronaMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: coronaVertex,
        fragmentShader: coronaFragment,
        uniforms: { uColor: { value: new Color("#ffb45a") }, uTime: { value: 0 } },
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  // Surface animation is cosmetic, so it runs on wall-clock time.
  useFrame(({ clock }) => {
    surfaceMat.uniforms.uTime.value = clock.elapsedTime;
    coronaMat.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <group>
      <mesh
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
        <sphereGeometry args={[1, 96, 64]} />
      </mesh>
      <Billboard>
        <mesh material={coronaMat} renderOrder={3} raycast={() => null}>
          <planeGeometry args={[radius * 9, radius * 9]} />
        </mesh>
      </Billboard>
      <BodyLabel obj={obj} radius={radius} />
    </group>
  );
}
