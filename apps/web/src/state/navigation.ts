import { OBJECTS_BY_ID } from "../data/solarSystem";
import { DEEP_SKY_BY_ID } from "../data/deepSky";
import { isStarId } from "../data/stars";
import { selectObject } from "./selectionStore";
import { useViewStore, type ViewLevel } from "./viewStore";

/** Which view level an object lives in. `null` = valid in any level (the Sun). */
export function levelOf(id: string): ViewLevel | null {
  if (id === "sun") return null;
  if (OBJECTS_BY_ID.has(id)) return "system";
  if (isStarId(id) || DEEP_SKY_BY_ID.has(id)) return "interstellar";
  return null;
}

/**
 * Select an object from anywhere (search, lists, links), switching view
 * level first when the object lives elsewhere.
 */
export function focusObject(id: string): void {
  const target = levelOf(id);
  const view = useViewStore.getState();
  if (target && target !== view.level) {
    selectObject(null);
    view.goTo(target, { then: () => selectObject(id) });
  } else {
    selectObject(id);
  }
}
