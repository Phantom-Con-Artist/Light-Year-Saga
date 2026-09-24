import { useEffect } from "react";
import { SpaceScene } from "./scene/SpaceScene";
import { TopBar } from "./ui/TopBar";
import { Navigator } from "./ui/Navigator";
import { Inspector } from "./ui/Inspector";
import { TimeControls } from "./ui/TimeControls";
import { useTimeStore } from "./state/timeStore";
import { selectObject } from "./state/selectionStore";
import { useCameraStore } from "./state/cameraStore";
import { FADE_DURATION_MS, useViewStore } from "./state/viewStore";
import { useStarStore } from "./data/stars";
import { ScaleReadout } from "./ui/ScaleReadout";

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const time = useTimeStore.getState();
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
        case "Escape":
          selectObject(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Black cross-fade used when moving between view levels. */
function TransitionOverlay() {
  const fade = useViewStore((s) => s.fade);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 bg-black"
      style={{ opacity: fade, transition: `opacity ${FADE_DURATION_MS}ms ease` }}
    />
  );
}

function Credits() {
  const level = useViewStore((s) => s.level);
  return (
    <div className="fixed bottom-4 left-4 z-10 hidden flex-col gap-0.5 text-[11px] text-ink-faint xl:flex">
      <a href="https://svs.gsfc.nasa.gov/4851" target="_blank" rel="noreferrer" className="hover:text-ink-dim">
        Sky: NASA/GSFC SVS Deep Star Maps 2020
      </a>
      {level === "interstellar" && (
        <a href="https://github.com/astronexus/HYG-Database" target="_blank" rel="noreferrer" className="hover:text-ink-dim">
          Stars: HYG Database v4.1 (CC BY-SA 4.0)
        </a>
      )}
    </div>
  );
}

export default function App() {
  useKeyboardShortcuts();
  const level = useViewStore((s) => s.level);

  // The star catalogue (~2 MB) also powers search, so fetch it right away.
  useEffect(() => useStarStore.getState().load(), []);

  return (
    <>
      <div className="fixed inset-0">
        <SpaceScene />
      </div>
      <TopBar />
      <Navigator />
      <Inspector />
      {level === "system" ? <TimeControls /> : <ScaleReadout />}
      <Credits />
      <TransitionOverlay />
    </>
  );
}
