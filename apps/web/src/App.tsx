import { useEffect } from "react";
import { SpaceScene } from "./scene/SpaceScene";
import { TopBar } from "./ui/TopBar";
import { Navigator } from "./ui/Navigator";
import { Inspector } from "./ui/Inspector";
import { TimeControls } from "./ui/TimeControls";
import { useTimeStore } from "./state/timeStore";
import { selectObject } from "./state/selectionStore";
import { useCameraStore } from "./state/cameraStore";

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

function ControlsHint() {
  const hints = [
    ["DRAG", "Orbit"],
    ["SCROLL", "Zoom"],
    ["R-DRAG", "Pan"],
    ["ESC", "Release"],
  ];
  return (
    <div className="animate-fade-in pointer-events-none fixed bottom-5 left-5 z-10 hidden flex-col gap-1.5 xl:flex">
      {hints.map(([key, label]) => (
        <div key={key} className="flex items-center gap-2 font-mono text-[9px] tracking-[0.2em] text-ink-faint">
          <span className="w-14 text-hud/60">{key}</span>
          {label.toUpperCase()}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  useKeyboardShortcuts();
  return (
    <>
      <div className="fixed inset-0">
        <SpaceScene />
      </div>
      <div className="scanlines pointer-events-none fixed inset-0 z-[5]" />
      <TopBar />
      <Navigator />
      <Inspector />
      <TimeControls />
      <ControlsHint />
    </>
  );
}
