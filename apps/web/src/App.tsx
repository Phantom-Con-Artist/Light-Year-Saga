import { useEffect } from "react";
import { SpaceScene } from "./scene/SpaceScene";
import { TopBar } from "./ui/TopBar";
import { Navigator } from "./ui/Navigator";
import { Inspector } from "./ui/Inspector";
import { TimeControls } from "./ui/TimeControls";
import { DistanceReadout, FocusHud, ScaleHud } from "./ui/ViewHud";
import { Logbook, Toasts } from "./ui/Logbook";
import { Cockpit } from "./ui/cockpit/Cockpit";
import { MissionPicker } from "./ui/cockpit/MissionPicker";
import { WarpOverlay } from "./ui/cockpit/WarpOverlay";
import { useTimeStore } from "./state/timeStore";
import { selectObject, useSelectionStore } from "./state/selectionStore";
import { useCameraStore } from "./state/cameraStore";
import { FADE_DURATION_MS, useViewStore } from "./state/viewStore";
import { useScaleStore } from "./state/scaleStore";
import { useMissionStore } from "./state/missionStore";
import { useDiscoveryStore } from "./state/discoveryStore";
import { useUiStore } from "./state/uiStore";
import { leaveSpecialView } from "./state/navigation";
import { installAudioUnlock } from "./audio/audioStore";
import { useStarStore, starName } from "./data/stars";
import { getObject } from "./data/solarSystem";
import { CATALOG_KIND_LABEL, getCatalogObject, getExoPlanet } from "./data/catalog";
import { TEXTURE_CREDIT } from "./scene/realTextures";

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const time = useTimeStore.getState();
      const level = useViewStore.getState().level;
      switch (e.key) {
        case " ":
          e.preventDefault();
          time.togglePause();
          break;
        case "[":
          time.slower();
          break;
        case "]":
          time.faster();
          break;
        case "r":
        case "R":
          time.toggleDirection();
          break;
        case "n":
        case "N":
          time.resetToNow();
          break;
        case "h":
        case "H":
          selectObject(null);
          useCameraStore.getState().flyHome();
          break;
        case "ArrowRight":
          if (level === "scale") useScaleStore.getState().step(1);
          break;
        case "ArrowLeft":
          if (level === "scale") useScaleStore.getState().step(-1);
          break;
        case "Escape":
          if (useUiStore.getState().logbookOpen) useUiStore.getState().closeLogbook();
          else if (useMissionStore.getState().pickerOpen) useMissionStore.getState().closePicker();
          else if (useSelectionStore.getState().selectedId) selectObject(null);
          else if (level === "focus" || level === "scale") leaveSpecialView();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Every inspected object is logged; first-time finds get a toast. */
function useDiscoveries() {
  useEffect(
    () =>
      useSelectionStore.subscribe((s, prev) => {
        const id = s.selectedId;
        if (!id || id === prev.selectedId) return;
        if (!useDiscoveryStore.getState().discover(id)) return;
        const body = getObject(id);
        const c = getCatalogObject(id);
        const p = getExoPlanet(id);
        const catalog = useStarStore.getState().catalog;
        const i = catalog?.indexById.get(id);
        const title = body?.name ?? c?.name ?? p?.planet.name ?? (catalog && i !== undefined ? starName(catalog, i) : id);
        const kind = body?.classification ?? (c ? CATALOG_KIND_LABEL[c.kind] : p ? "Exoplanet" : "Catalogue star");
        useDiscoveryStore.getState().pushToast({ tone: "discovery", title, body: kind });
      }),
    [],
  );
}

/** Black cross-fade used when moving between view levels. */
function TransitionOverlay() {
  const fade = useViewStore((s) => s.fade);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[35] bg-black" style={{ opacity: fade, transition: `opacity ${FADE_DURATION_MS}ms ease` }} />
  );
}

function Credits() {
  const level = useViewStore((s) => s.level);
  return (
    <div className="fixed bottom-4 left-4 z-10 hidden flex-col gap-0.5 text-[11px] text-ink-faint xl:flex">
      {level !== "cosmic" && (
        <a href="https://svs.gsfc.nasa.gov/4851" target="_blank" rel="noreferrer" className="hover:text-ink-dim">
          Sky: NASA/GSFC SVS Deep Star Maps 2020
        </a>
      )}
      {level === "interstellar" && (
        <a href="https://github.com/astronexus/HYG-Database" target="_blank" rel="noreferrer" className="hover:text-ink-dim">
          Stars: HYG Database v4.1 (CC BY-SA 4.0)
        </a>
      )}
      {level === "cosmic" && (
        <a href="https://doi.org/10.1088/0067-0049/199/2/26" target="_blank" rel="noreferrer" className="hover:text-ink-dim">
          Galaxies: 2MASS Redshift Survey (Huchra et al. 2012)
        </a>
      )}
      {(level === "interstellar" || level === "cosmic") && <span>Photos: ESA/Hubble, ESA/Webb, ESO, NOIRLab (CC BY 4.0) — credits per object</span>}
      {(level === "system" || level === "focus") && (
        <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer" className="hover:text-ink-dim">
          {TEXTURE_CREDIT}
        </a>
      )}
      <span>Music: “Weightless Wonder”</span>
    </div>
  );
}

export default function App() {
  useKeyboardShortcuts();
  useDiscoveries();
  const level = useViewStore((s) => s.level);
  const inMission = useMissionStore((s) => s.missionId !== null);

  // The star catalogue (~2 MB) also powers search, so fetch it right away.
  useEffect(() => useStarStore.getState().load(), []);
  useEffect(() => installAudioUnlock(), []);

  return (
    <>
      <div className="fixed inset-0">
        <SpaceScene />
      </div>
      <WarpOverlay strength={inMission ? 1 : 0.35} />

      {inMission ? (
        <Cockpit />
      ) : (
        <>
          <TopBar />
          <Navigator />
          <Inspector />
          {(level === "system" || level === "focus") && <TimeControls />}
          <DistanceReadout />
          {level === "focus" && <FocusHud />}
          {level === "scale" && <ScaleHud />}
          <Credits />
        </>
      )}
      <MissionPicker />
      <Logbook />
      <Toasts />
      <TransitionOverlay />
    </>
  );
}
