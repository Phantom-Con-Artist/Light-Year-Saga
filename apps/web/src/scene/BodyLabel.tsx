import { useThree } from "@react-three/fiber";
import type { SpaceObject } from "../domain/types";
import { selectObject, useSelectionStore } from "../state/selectionStore";
import { getRenderPosition } from "./renderRegistry";
import { ScreenLabel } from "./ScreenLabel";

/** Moons only get a label once the camera is close enough to separate them. */
const MOON_LABEL_DISTANCE = 45;

export function BodyLabel({ obj, radius }: { obj: SpaceObject; radius: number }) {
  const camera = useThree((s) => s.camera);
  return (
    <ScreenLabel
      position={() => getRenderPosition(obj.id)}
      offset={[0, radius, 0]}
      text={obj.name}
      className="body-label"
      accent={obj.visual.accent}
      withDot
      opacity={() => {
        if (obj.type !== "moon") return 1;
        const selected = useSelectionStore.getState().selectedId === obj.id;
        return selected || camera.position.distanceTo(getRenderPosition(obj.id)) < MOON_LABEL_DISTANCE ? 1 : 0;
      }}
      active={() => {
        const s = useSelectionStore.getState();
        return s.selectedId === obj.id || s.hoveredId === obj.id;
      }}
      onClick={() => selectObject(obj.id)}
      onHover={(h) => useSelectionStore.getState().hoverObject(h ? obj.id : null)}
    />
  );
}
