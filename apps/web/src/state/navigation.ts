import { OBJECTS_BY_ID } from "../data/solarSystem";
import { getCatalogObject, getExoPlanet, hasCloseUp } from "../data/catalog";
import { isStarId } from "../data/stars";
import { selectObject } from "./selectionStore";
import { useViewStore, type ViewLevel } from "./viewStore";

/** Where an object lives. The Sun is valid in the Solar System and interstellar views. */
export function levelOf(id: string): ViewLevel | null {
  if (id === "sun") {
    const level = useViewStore.getState().level;
    return level === "system" || level === "interstellar" ? null : "system";
  }
  if (OBJECTS_BY_ID.has(id)) return "system";
  if (isStarId(id)) return "interstellar";
  const c = getCatalogObject(id);
  if (c) return c.level;
  if (getExoPlanet(id)) return "focus";
  return null;
}

/**
 * Select an object from anywhere (search, lists, missions, links), switching
 * view level first when it lives elsewhere. Exoplanets open their system's
 * close-up view.
 */
export function focusObject(id: string): void {
  const view = useViewStore.getState();
  const planet = getExoPlanet(id);
  if (planet) {
    if (view.level === "focus" && view.focusId === planet.system.id) selectObject(id);
    else {
      selectObject(null);
      view.goTo("focus", { focusId: planet.system.id, then: () => selectObject(id) });
    }
    return;
  }
  // Inside a close-up, the subject itself stays put.
  if (view.level === "focus" && view.focusId === id) {
    selectObject(id);
    return;
  }
  const target = levelOf(id);
  if (target && target !== view.level) {
    selectObject(null);
    view.goTo(target, { then: () => selectObject(id) });
  } else {
    selectObject(id);
  }
}

/** Can this object be opened in the true-scale close-up view? */
export function canVisitUpClose(id: string): boolean {
  if (id === "sun" || isStarId(id)) return true;
  const c = getCatalogObject(id);
  return !!c && hasCloseUp(c);
}

/** Open the true-scale close-up of a star, black hole or planetary system. */
export function visitUpClose(id: string): void {
  selectObject(null);
  useViewStore.getState().goTo("focus", { focusId: id, then: () => selectObject(id) });
}

/** Leave a close-up / size view back to where the user came from. */
export function leaveSpecialView(): void {
  const { returnLevel, focusId } = useViewStore.getState();
  selectObject(null);
  useViewStore.getState().goTo(returnLevel, {
    then: () => {
      if (focusId && levelOf(focusId) === returnLevel) selectObject(focusId);
    },
  });
}
