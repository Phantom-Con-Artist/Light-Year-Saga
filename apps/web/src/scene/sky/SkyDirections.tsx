import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Camera } from "three";
import { constellationAt, getConstellation, type ConstellationGeometry } from "../../data/constellations";
import { CELESTIAL_NORTH, renderToRaDec } from "../../astronomy/sky";
import { useSkyStore } from "../../state/skyStore";
import { isTouchDevice } from "../../ui/useMedia";
import { ScreenLabel } from "../ScreenLabel";
import { LINE_RADIUS } from "./ConstellationLines";

/** Sky direction through a screen point (u, v in 0…1 from the top-left) for a camera at the origin. */
export function screenDirection(camera: Camera, u: number, v: number, out: Vector3): Vector3 {
  return out
    .set(u * 2 - 1, 1 - v * 2, 0.5)
    .unproject(camera)
    .sub(camera.position)
    .normalize();
}

/**
 * Tracks which constellation is being looked at: the one under the mouse, or
 * on touch screens the one under the centre crosshair as you pan.
 */
export function ConstellationHover({ geometry }: { geometry: ConstellationGeometry }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const pointer = useRef<{ u: number; v: number } | null>(null);
  const dir = useRef(new Vector3());
  const last = useRef(new Vector3());

  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      pointer.current = { u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height };
    };
    const onLeave = () => {
      pointer.current = null;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      useSkyStore.getState().setHovered(null);
    };
  }, [gl]);

  const touch = isTouchDevice();
  useFrame(() => {
    const p = pointer.current ?? (touch ? { u: 0.5, v: 0.5 } : null);
    const sky = useSkyStore.getState();
    if (!p) {
      if (sky.hovered) sky.setHovered(null);
      return;
    }
    screenDirection(camera, p.u, p.v, dir.current);
    // Only re-test once the direction has moved a little (~0.03°).
    if (dir.current.dot(last.current) > 0.9999999) return;
    last.current.copy(dir.current);
    const id = constellationAt(geometry, dir.current);
    if (id !== sky.hovered) sky.setHovered(id);
  });

  return null;
}

const COMPASS = 76;
const R = 27;

/**
 * Directions on the sky: a compass that turns with the view (north towards the
 * celestial pole, east to its left, as seen from the ground), the celestial
 * poles marked on the sky, where the view is pointing in RA/Dec, and on touch
 * screens a centre crosshair.
 */
export function SkyDirections() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const els = useRef<{ root: HTMLDivElement; letters: HTMLSpanElement[]; needle: HTMLDivElement; readout: HTMLDivElement; name: HTMLDivElement } | null>(null);
  const touch = isTouchDevice();

  useEffect(() => {
    const parent = gl.domElement.parentElement!;
    const root = document.createElement("div");
    root.className = "sky-compass";
    root.setAttribute("aria-hidden", "true");
    const dial = document.createElement("div");
    dial.className = "sky-compass__dial";
    dial.style.width = dial.style.height = `${COMPASS}px`;
    const needle = document.createElement("div");
    needle.className = "sky-compass__needle";
    dial.appendChild(needle);
    const letters = ["N", "E", "S", "W"].map((t) => {
      const s = document.createElement("span");
      s.className = `sky-compass__letter${t === "N" ? " sky-compass__letter--n" : ""}`;
      s.textContent = t;
      dial.appendChild(s);
      return s;
    });
    const readout = document.createElement("div");
    readout.className = "sky-compass__readout";
    const name = document.createElement("div");
    name.className = "sky-compass__name";
    root.append(dial, name, readout);
    parent.appendChild(root);

    let reticle: HTMLDivElement | null = null;
    if (touch) {
      reticle = document.createElement("div");
      reticle.className = "sky-reticle";
      parent.appendChild(reticle);
    }
    els.current = { root, letters, needle, readout, name };
    return () => {
      root.remove();
      reticle?.remove();
      els.current = null;
    };
  }, [gl, touch]);

  const d = useRef(new Vector3());
  const t = useRef(new Vector3());
  const p = useRef(new Vector3());
  const q = useRef(new Vector3());
  /** Screen angle (radians, 0 = right, clockwise) of a tangent direction at the view centre. */
  const screenAngle = (tangent: Vector3) => {
    p.current.copy(d.current).project(camera);
    q.current.copy(d.current).addScaledVector(tangent, 0.01).project(camera);
    return Math.atan2(-(q.current.y - p.current.y) * size.height, (q.current.x - p.current.x) * size.width);
  };

  useFrame(() => {
    const e = els.current;
    if (!e) return;
    camera.getWorldDirection(d.current);
    // North: towards the celestial pole along the sky; east: 90° from it, to the left when facing south.
    t.current.copy(CELESTIAL_NORTH).addScaledVector(d.current, -d.current.dot(CELESTIAL_NORTH));
    if (t.current.lengthSq() < 1e-8) return; // looking straight at a pole
    t.current.normalize();
    const north = screenAngle(t.current);
    t.current.crossVectors(CELESTIAL_NORTH, d.current).normalize();
    const east = screenAngle(t.current);
    const angles = [north, east, north + Math.PI, east + Math.PI];
    e.letters.forEach((el, i) => {
      el.style.transform = `translate(${(Math.cos(angles[i]) * R).toFixed(1)}px, ${(Math.sin(angles[i]) * R).toFixed(1)}px)`;
    });
    e.needle.style.transform = `rotate(${((north * 180) / Math.PI + 90).toFixed(1)}deg)`;

    const { raDeg, decDeg } = renderToRaDec(d.current);
    const h = Math.floor(raDeg / 15);
    const m = Math.floor((raDeg / 15 - h) * 60);
    const text = `RA ${h}h ${String(m).padStart(2, "0")}m · Dec ${decDeg >= 0 ? "+" : "−"}${Math.abs(Math.round(decDeg))}°`;
    if (e.readout.textContent !== text) e.readout.textContent = text;
    // On touch the crosshair picks the constellation; name it under the compass.
    const hovered = touch ? (getConstellation(`con-${useSkyStore.getState().hovered}`)?.name ?? "") : "";
    if (e.name.textContent !== hovered) e.name.textContent = hovered;
  });

  return (
    <>
      <ScreenLabel position={CELESTIAL_NORTH.clone().multiplyScalar(LINE_RADIUS)} text="North celestial pole" className="sky-pole-label" withDot />
      <ScreenLabel position={CELESTIAL_NORTH.clone().multiplyScalar(-LINE_RADIUS)} text="South celestial pole" className="sky-pole-label" withDot />
    </>
  );
}
