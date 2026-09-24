import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Vector3 } from "three";
import type { SpaceObject } from "../domain/types";
import { selectObject, useSelectionStore } from "../state/selectionStore";
import { getRenderPosition } from "./renderRegistry";

/** Moons only get a label once the camera is close enough to separate them. */
const MOON_LABEL_DISTANCE = 45;
const tmp = new Vector3();

export function BodyLabel({ obj, radius }: { obj: SpaceObject; radius: number }) {
  const el = useRef<HTMLButtonElement>(null);
  const selected = useSelectionStore((s) => s.selectedId === obj.id);
  const hovered = useSelectionStore((s) => s.hoveredId === obj.id);

  useFrame(({ camera }) => {
    if (!el.current || obj.type !== "moon") return;
    const d = camera.position.distanceTo(tmp.copy(getRenderPosition(obj.id)));
    const visible = d < MOON_LABEL_DISTANCE || selected;
    el.current.style.opacity = visible ? "1" : "0";
    el.current.style.pointerEvents = visible ? "auto" : "none";
  });

  return (
    <Html position={[0, radius, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <button
        ref={el}
        type="button"
        className="body-label"
        data-active={selected || hovered}
        style={{ ["--accent" as string]: obj.visual.accent }}
        onClick={() => selectObject(obj.id)}
        onPointerEnter={() => useSelectionStore.getState().hoverObject(obj.id)}
        onPointerLeave={() => useSelectionStore.getState().hoverObject(null)}
      >
        <span className="body-label__tick" />
        <span className="body-label__name">{obj.name}</span>
      </button>
    </Html>
  );
}
