import { useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3, type Group } from "three";
import type { ExoPlanet, ExoSystem } from "../../data/catalog";
import {
  AU_IN_RSUN,
  REFERENCE_BODIES,
  REFERENCE_ORBITS,
  R_EARTH_IN_RSUN,
  resolveCloseUp,
  subjectRadius,
  type CloseUpSubject,
} from "../../data/closeUp";
import { useTimeStore } from "../../state/timeStore";
import { useFocusStore } from "../../state/focusStore";
import { selectObject, useSelectionStore } from "../../state/selectionStore";
import { useViewStore } from "../../state/viewStore";
import { STARMAP_SOURCES, SkyDome } from "../Backdrop";
import { ScreenLabel } from "../ScreenLabel";
import { FlightRig, type RigTarget } from "../common/FlightRig";
import { useScreenPicking } from "../common/picking";
import { BlackHoleBody, HabitableZone, OrbitRing, PlanetBody, StarSphere, schwarzschildRadiusSolar } from "../common/Bodies";

const ORIGIN = new Vector3();
const DAY_MS = 86_400_000;

/* ------------------------------------------------------------ planets */

function phaseOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 3607;
  return (h / 3607) * Math.PI * 2;
}

/** Circular Keplerian position at the current simulation time (R☉). Periods are real; phases illustrative. */
function planetPosition(p: ExoPlanet, out: Vector3): Vector3 {
  const days = useTimeStore.getState().timeMs / DAY_MS;
  const a = (2 * Math.PI * days) / p.periodDays + phaseOf(p.id);
  const r = p.semiMajorAxisAU * AU_IN_RSUN;
  return out.set(Math.cos(a) * r, 0, -Math.sin(a) * r);
}

/** Planet radius as drawn: true scale, or exaggerated so every world is visible from the system view. */
export function planetDisplayRadius(system: ExoSystem, p: ExoPlanet, enlarge: boolean): number {
  const r = p.radiusEarth * R_EARTH_IN_RSUN;
  if (!enlarge) return r;
  const outer = Math.max(...system.planets.map((q) => q.semiMajorAxisAU)) * AU_IN_RSUN;
  const biggest = Math.max(...system.planets.map((q) => q.radiusEarth)) * R_EARTH_IN_RSUN;
  return r * Math.max(1, Math.min(80, (outer * 0.025) / biggest));
}

function Planet({ system, planet }: { system: ExoSystem; planet: ExoPlanet }) {
  const enlarge = useFocusStore((s) => s.enlargePlanets);
  const radius = planetDisplayRadius(system, planet, enlarge);
  const group = useRef<Group>(null);
  const pos = useMemo(() => new Vector3(), []);

  useFrame(() => {
    group.current?.position.copy(planetPosition(planet, pos));
  });

  return (
    <>
      <group ref={group}>
        <PlanetBody planet={planet} radius={radius} lightPosition={ORIGIN} />
      </group>
      <ScreenLabel
        position={() => group.current?.position ?? planetPosition(planet, pos)}
        offset={[0, radius * 1.3, 0]}
        text={planet.name}
        className="catalog-label"
        accent="#8fffc1"
        withDot
        active={() => useSelectionStore.getState().selectedId === planet.id}
        onClick={() => selectObject(planet.id)}
      />
    </>
  );
}

/* ---------------------------------------------------------- references */

function References({ radius, extent, system }: { radius: number; extent: number; system: boolean }) {
  const orbits = REFERENCE_ORBITS.filter((o) => {
    const r = o.au * AU_IN_RSUN;
    return r / extent > 0.15 && r / extent < 40;
  });
  // Spheres beside the subject, e.g. a to-scale Sun next to a supergiant.
  const bodies = REFERENCE_BODIES.filter((b) => radius / b.radius > 0.03 && radius / b.radius < 2500 && Math.abs(radius / b.radius - 1) > 0.15);
  // In a planetary system, park the references outside the outermost orbit.
  let x = system ? extent * 1.2 : radius * 1.35;

  return (
    <>
      {orbits.map((o, i) => {
        const r = o.au * AU_IN_RSUN;
        // Alternate label sides so neighbouring orbits don't collide.
        const at = i % 2 ? new Vector3(0, 0, r) : new Vector3(0, 0, -r);
        return (
          <group key={o.name}>
            <OrbitRing radius={r} color="#9fb4d8" opacity={0.45} />
            <ScreenLabel position={at} text={`${o.name}'s orbit`} className="ref-label" />
          </group>
        );
      })}
      {bodies.map((b) => {
        const gap = Math.max(b.radius, radius) * 0.9;
        x += b.radius + gap;
        const at = new Vector3(x, 0, 0);
        x += b.radius;
        return (
          <group key={b.name}>
            {b.temperatureK ? (
              <StarSphere radius={b.radius} temperatureK={b.temperatureK} position={at} />
            ) : (
              <group position={at}>
                <PlanetBody
                  planet={{ id: `ref-${b.name}`, style: b.name === "Earth" ? "ocean" : "gas", colorA: b.name === "Earth" ? "#2f6fa8" : "#d9b98f", colorB: b.name === "Earth" ? "#3f8f4a" : "#9a6a44" }}
                  radius={b.radius}
                  lightPosition={ORIGIN}
                />
              </group>
            )}
            <ScreenLabel position={at} offset={[0, b.radius * 1.4, 0]} text={`${b.name} (to scale)`} className="ref-label" />
          </group>
        );
      })}
    </>
  );
}

/* ---------------------------------------------------------- subject */

function extentOf(s: CloseUpSubject): number {
  if (s.kind === "system") return Math.max(...s.system.planets.map((p) => p.semiMajorAxisAU)) * AU_IN_RSUN;
  if (s.kind === "black-hole") return schwarzschildRadiusSolar(s.blackHole.massSolar) * Math.max(8, s.blackHole.diskOuterRs);
  return s.star.radiusSolar;
}

function Subject({ subject }: { subject: CloseUpSubject }) {
  const r = subjectRadius(subject);
  if (subject.kind === "star") return <StarSphere radius={r} temperatureK={subject.star.temperatureK} />;
  if (subject.kind === "black-hole")
    return <BlackHoleBody rs={r} diskOuterRs={subject.blackHole.diskOuterRs} jets={subject.blackHole.jets} />;

  const sys = subject.system;
  return (
    <>
      <StarSphere radius={sys.star.radiusSolar} temperatureK={sys.star.temperatureK} />
      {sys.habitableZoneAU && <HabitableZone inner={sys.habitableZoneAU[0] * AU_IN_RSUN} outer={sys.habitableZoneAU[1] * AU_IN_RSUN} />}
      {sys.planets.map((p) => (
        <group key={p.id}>
          <OrbitRing radius={p.semiMajorAxisAU * AU_IN_RSUN} color="#8fffc1" opacity={0.28} dashed={false} />
          <Planet system={sys} planet={p} />
        </group>
      ))}
    </>
  );
}

function Picking() {
  useScreenPicking(selectObject);
  return null;
}

/** True-scale close-up of one star, black hole or planetary system. Units: solar radii. */
export function FocusScene() {
  const focusId = useViewStore((s) => s.focusId);
  const enlarge = useFocusStore((s) => s.enlargePlanets);
  const subject = useMemo(() => resolveCloseUp(focusId), [focusId]);

  const extent = subject ? extentOf(subject) : 1;
  const radius = subject ? subjectRadius(subject) : 1;
  const framing = subject?.kind === "system" ? extent * 1.7 : subject?.kind === "black-hole" ? extent * 1.8 : radius * 4.5;

  const home = useMemo<RigTarget>(() => ({ position: () => ORIGIN, distance: framing, minDistance: radius * 1.05 }), [framing, radius]);
  const resolve = useCallback(
    (id: string): RigTarget | null => {
      if (!subject) return null;
      if (id === subject.id) return home;
      if (subject.kind !== "system") return null;
      const planet = subject.system.planets.find((p) => p.id === id);
      if (!planet) return null;
      const r = planetDisplayRadius(subject.system, planet, enlarge);
      const pos = new Vector3();
      return { position: () => planetPosition(planet, pos), distance: r * 7, minDistance: r * 1.1 };
    },
    [subject, home, enlarge],
  );

  if (!subject) return null;

  return (
    <>
      <SkyDome sources={STARMAP_SOURCES} gain={0.55} />
      <Subject subject={subject} />
      <References radius={radius} extent={subject.kind === "system" ? extent : radius} system={subject.kind === "system"} />
      <Picking />
      <OrbitControls makeDefault enableDamping dampingFactor={0.07} rotateSpeed={0.5} zoomSpeed={1.4} panSpeed={0.6} minDistance={radius * 1.05} maxDistance={framing * 60} />
      <FlightRig
        resolve={resolve}
        home={home}
        entry={{ fromDistance: framing * 8 }}
        clip={(d) => [Math.max(d * 1e-3, radius * 1e-3), d * 2e3 + extent * 10]}
      />
    </>
  );
}
