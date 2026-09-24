import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { AdditiveBlending, Color, MeshBasicMaterial, type Group } from "three";
import { getObject } from "../data/solarSystem";
import { useSelectionStore } from "../state/selectionStore";
import { getRenderPosition, getRenderRadius } from "./renderRegistry";

const TICKS = [0, 1, 2, 3];

function hudMaterial(color: Color) {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

/** Holographic targeting brackets around the selected object. */
export function SelectionReticle() {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const focusRequest = useSelectionStore((s) => s.focusRequest);
  const root = useRef<Group>(null);
  const spinner = useRef<Group>(null);
  const appear = useRef(0);

  const obj = getObject(selectedId);
  const accent = obj?.visual.accent ?? "#5fd0ff";
  const [ringMat, tickMat] = useMemo(() => {
    const c = new Color(accent).multiplyScalar(1.4);
    return [hudMaterial(c), hudMaterial(c)];
  }, [accent]);

  useEffect(() => {
    appear.current = 0;
  }, [focusRequest]);

  useFrame((_, delta) => {
    if (!obj || !root.current || !spinner.current) return;
    root.current.position.copy(getRenderPosition(obj.id));
    const extent = obj.visual.rings ? obj.visual.rings.outerRadii : 1;
    appear.current = Math.min(1, appear.current + delta * 2.5);
    const pop = 1 + (1 - appear.current) * 0.8;
    root.current.scale.setScalar(getRenderRadius(obj.id) * extent * 1.45 * pop);
    spinner.current.rotation.z -= delta * 0.4;
    ringMat.opacity = appear.current * 0.55;
    tickMat.opacity = appear.current * 0.95;
  });

  if (!obj) return null;

  return (
    <group ref={root}>
      <Billboard>
        <mesh material={ringMat} raycast={() => null}>
          <ringGeometry args={[1, 1.015, 128]} />
        </mesh>
        <group ref={spinner}>
          {TICKS.map((i) => (
            <mesh key={i} material={tickMat} rotation={[0, 0, (i * Math.PI) / 2]} raycast={() => null}>
              <ringGeometry args={[1.08, 1.12, 32, 1, -0.22, 0.44]} />
            </mesh>
          ))}
        </group>
      </Billboard>
    </group>
  );
}
