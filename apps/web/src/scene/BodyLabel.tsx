import { useThree } from "@react-three/fiber";
import type { SpaceObject } from "../domain/types";
import { selectObject, useSelectionStore } from "../state/selectionStore";
import { layerOn, useSolarStore } from "../state/solarStore";
import { getRenderPosition, getRenderRadius, isPresent } from "./renderRegistry";
import { ScreenLabel } from "./ScreenLabel";

/**
 * How close the camera must be (scene units) before a label shows, so the
 * view doesn't fill with names. Moons scale with their planet's size.
 */
function labelRange(obj: SpaceObject): number {
  switch (obj.type) {
    case "star":
    case "planet":
      return Infinity;
    case "dwarf-planet":
      return obj.id === "pluto" || obj.id === "ceres" || obj.id === "eris" ? Infinity : 400;
    case "moon":
      return obj.id === "moon" ? 45 : Math.max(18, getRenderRadius(obj.parentId ?? "") * 14);
    case "asteroid":
      return obj.interstellar ? 260 : 60;
    case "comet":
      return 140;
    default:
      // Earth-orbiting craft only near Earth; deep-space probes are alone out there.
      return obj.parentId === "earth" ? 14 : 900;
  }
}

export function BodyLabel({ obj, radius }: { obj: SpaceObject; radius: number }) {
  const camera = useThree((s) => s.camera);
  const range = labelRange(obj);
  return (
    <ScreenLabel
      position={() => getRenderPosition(obj.id)}
      offset={[0, radius, 0]}
      text={obj.name}
      className="body-label"
      accent={obj.visual.accent}
      withDot
      opacity={() => {
        const s = useSelectionStore.getState();
        const focused = s.selectedId === obj.id || s.hoveredId === obj.id;
        if (!isPresent(obj.id)) return 0;
        if (focused) return 1;
        if (!layerOn(obj, useSolarStore.getState())) return 0;
        if (range === Infinity) return 1;
        const d = camera.position.distanceTo(getRenderPosition(obj.id));
        return d < range ? Math.min(1, (range - d) / (range * 0.25)) : 0;
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
