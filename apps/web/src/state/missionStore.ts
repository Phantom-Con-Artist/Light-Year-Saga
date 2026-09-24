import { create } from "zustand";
import { getMission, type MissionTarget } from "../data/missions";
import { SCALE_LINEUP } from "../data/scaleLineup";
import { useStarStore, starId } from "../data/stars";
import { useAudioStore } from "../audio/audioStore";
import { focusObject, visitUpClose } from "./navigation";
import { useViewStore } from "./viewStore";
import { useScaleStore } from "./scaleStore";
import { selectObject } from "./selectionStore";
import { useDiscoveryStore } from "./discoveryStore";

interface MissionState {
  missionId: string | null;
  step: number;
  line: number;
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  start: (id: string) => void;
  /** Next line of dialogue, or the next destination. */
  advance: () => void;
  /** Skip remaining lines and travel to the next destination. */
  skipStep: () => void;
  exit: () => void;
}

function starIdByName(name: string): string | null {
  const catalog = useStarStore.getState().catalog;
  if (!catalog) return null;
  const i = catalog.meta.proper.indexOf(name);
  return i >= 0 ? starId(catalog, i) : null;
}

/** Fly to a mission destination, switching views as needed. */
function travelTo(target: MissionTarget) {
  // A view transition is already running: try again once it settles.
  if (useViewStore.getState().transitioning) {
    window.setTimeout(() => travelTo(target), 350);
    return;
  }
  const discover = useDiscoveryStore.getState().discover;
  if ("scale" in target) {
    const entry = SCALE_LINEUP.find((e) => e.id === target.scale);
    const go = () => useScaleStore.getState().goToId(target.scale);
    selectObject(null);
    if (useViewStore.getState().level === "scale") go();
    else useViewStore.getState().goTo("scale", { then: go });
    if (entry?.linkId) discover(entry.linkId);
    return;
  }
  if ("closeUp" in target) {
    visitUpClose(target.closeUp);
    discover(target.closeUp);
    return;
  }
  if ("star" in target) {
    const id = starIdByName(target.star);
    if (!id) return;
    if (target.upClose) visitUpClose(id);
    else focusObject(id);
    return;
  }
  focusObject(target.id);
}

export const useMissionStore = create<MissionState>()((set, get) => ({
  missionId: null,
  step: 0,
  line: 0,
  pickerOpen: false,

  openPicker: () => set({ pickerOpen: true }),
  closePicker: () => set({ pickerOpen: false }),

  start: (id) => {
    const mission = getMission(id);
    if (!mission) return;
    set({ missionId: id, step: 0, line: 0, pickerOpen: false });
    useAudioStore.getState().setCockpit(true);
    travelTo(mission.steps[0].target);
  },

  advance: () => {
    const { missionId, step, line } = get();
    const mission = getMission(missionId);
    if (!mission) return;
    if (line + 1 < mission.steps[step].lines.length) {
      set({ line: line + 1 });
      return;
    }
    get().skipStep();
  },

  skipStep: () => {
    const { missionId, step } = get();
    const mission = getMission(missionId);
    if (!mission) return;
    if (step + 1 >= mission.steps.length) {
      useDiscoveryStore.getState().completeMission(mission.id, mission.title);
      get().exit();
      return;
    }
    set({ step: step + 1, line: 0 });
    travelTo(mission.steps[step + 1].target);
  },

  exit: () => {
    set({ missionId: null, step: 0, line: 0 });
    useAudioStore.getState().setCockpit(false);
  },
}));
