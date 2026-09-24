import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { AdditiveBlending, MeshBasicMaterial, type Group } from "three";
import { getObject } from "../data/solarSystem";
import { useSelectionStore } from "../state/selectionStore";
import { getRenderPosition, getRenderRadius } from "./renderRegistry";

/** A thin ring around the selected object. */
export function SelectionReticle() {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const focusRequest = useSelectionStore((s) => s.focusRequest);
  const root = useRef<Group>(null);
  const appear = useRef(0);
  const obj = getObject(selectedId);

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    appear.current = 0;
  }, [focusRequest]);

  useFrame((_, delta) => {
    if (!obj || !root.current) return;
    root.current.position.copy(getRenderPosition(obj.id));
    const extent = obj.visual.rings ? obj.visual.rings.outerRadii : 1;
    appear.current = Math.min(1, appear.current + delta * 2);
    const ease = 1 - Math.pow(1 - appear.current, 3);
    root.current.scale.setScalar(getRenderRadius(obj.id) * extent * (1.35 + 0.25 * (1 - ease)));
    material.opacity = ease * 0.35;
  });

  if (!obj) return null;

  return (
    <group ref={root}>
      <Billboard>
        <mesh material={material} raycast={() => null}>
          <ringGeometry args={[1, 1.012, 128]} />
        </mesh>
      </Billboard>
    </group>
  );
}
