import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useSolarStore, type SolarLayers } from "../state/solarStore";
import { useSelectionStore } from "../state/selectionStore";
import { useViewStore } from "../state/viewStore";
import { auFromRender } from "../astronomy/scale";
import { focusObject } from "../state/navigation";
import { formatNumber } from "./format";
import { useIsMobile } from "./useMedia";
import { Icon } from "./Icon";

const LAYERS: [keyof SolarLayers, string][] = [
  ["moons", "Moons"],
  ["dwarfPlanets", "Dwarf planets"],
  ["asteroids", "Asteroids & belts"],
  ["beltColors", "Belt colours"],
  ["comets", "Comets"],
  ["spacecraft", "Spacecraft"],
  ["satellites", "Earth satellites"],
  ["features", "Surface features"],
  ["heliosphere", "Heliosphere"],
  ["oort", "Oort cloud"],
  ["orbits", "Orbits"],
];

/** Where the camera is, in words. */
function zoneOf(au: number): { name: string; id?: string } {
  if (au < 0.4) return { name: "Inside Mercury's orbit" };
  if (au < 1.8) return { name: "Inner Solar System" };
  if (au < 3.4) return { name: "Asteroid belt", id: "asteroid-belt" };
  if (au < 30) return { name: "Among the giant planets" };
  if (au < 55) return { name: "Kuiper belt", id: "kuiper-belt" };
  if (au < 90) return { name: "Scattered disc" };
  if (au < 125) return { name: "Edge of the heliosphere", id: "heliosphere" };
  if (au < 2000) return { name: "Beyond the heliopause" };
  return { name: "Oort cloud (theorised)", id: "oort-cloud" };
}

function Readout() {
  const d = useViewStore((s) => s.cameraDistance);
  const au = auFromRender(d);
  const zone = zoneOf(au);
  const value = au < 10 ? formatNumber(au, 2) : au < 10_000 ? formatNumber(au, 0) : formatNumber(Math.round(au / 100) * 100, 0);
  return (
    <div className="text-[12px] text-ink-dim tabular-nums">
      <span className="font-medium text-ink">{value} AU</span> from the Sun ·{" "}
      {zone.id ? (
        <button type="button" className="underline decoration-white/20 underline-offset-2 hover:text-ink" onClick={() => focusObject(zone.id!)}>
          {zone.name}
        </button>
      ) : (
        zone.name
      )}
    </div>
  );
}

function Toggles({ compact }: { compact?: boolean }) {
  const layers = useSolarStore(
    useShallow((s) => Object.fromEntries(LAYERS.map(([k]) => [k, s[k]])) as Record<keyof SolarLayers, boolean>),
  );
  const toggle = useSolarStore((s) => s.toggle);
  return (
    <div className={`grid grid-cols-2 gap-0.5 ${compact ? "" : "w-64"}`}>
      {LAYERS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`btn !justify-start ${compact ? "!h-9 !text-[12.5px]" : "!h-8 !text-[12.5px]"}`}
          data-on={layers[key]}
          aria-pressed={layers[key]}
          onClick={() => toggle(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Solar System view: what's shown, and where the camera is. */
export function SolarHud() {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const selected = useSelectionStore((s) => s.selectedId !== null);

  if (mobile) {
    if (selected) return null;
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[3.6rem] z-20 flex flex-col items-center gap-1 px-2">
        {open && (
          <div className="panel pointer-events-auto p-1.5">
            <Toggles compact />
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="rounded-full bg-black/45 px-3 py-1">
            <Readout />
          </div>
          <button type="button" className="btn panel pointer-events-auto !h-8 !px-2.5 !text-[12px]" data-on={open} onClick={() => setOpen(!open)}>
            <Icon name="settings" size={13} /> Layers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-10 flex flex-col items-start gap-1.5">
      {open && (
        <div className="panel animate-fade-in pointer-events-auto p-1.5">
          <Toggles />
        </div>
      )}
      <div className="panel pointer-events-auto flex items-center gap-2 py-1 pr-3 pl-1">
        <button type="button" className="btn !h-8" data-on={open} aria-expanded={open} onClick={() => setOpen(!open)} title="Show or hide layers">
          <Icon name="settings" size={13} /> Layers
        </button>
        <Readout />
      </div>
    </div>
  );
}
