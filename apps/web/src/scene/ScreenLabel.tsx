import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

interface ScreenLabelProps {
  /** World position, or a getter for moving objects. */
  position: Vector3 | (() => Vector3);
  /** Local offset applied before projection (e.g. above a planet). */
  offset?: [number, number, number];
  text: string;
  className: string;
  /** Optional coloured dot before the text (sets --accent). */
  accent?: string;
  withDot?: boolean;
  /** Per-frame opacity 0–1; hidden and non-interactive below ~0.02. */
  opacity?: () => number;
  /** Per-frame `data-active` flag for styling. */
  active?: () => boolean;
  onClick?: () => void;
  onHover?: (hovering: boolean) => void;
}

const world = new Vector3();

/**
 * A DOM label pinned to a 3D point. Created imperatively and positioned in
 * useFrame — no React root per label, so mounting/unmounting whole scenes
 * is cheap and safe.
 */
export function ScreenLabel({
  position,
  offset,
  text,
  className,
  accent,
  withDot,
  opacity,
  active,
  onClick,
  onHover,
}: ScreenLabelProps) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const el = useRef<HTMLButtonElement | null>(null);
  const handlers = useRef({ onClick, onHover });
  handlers.current = { onClick, onHover };

  useEffect(() => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.position = "absolute";
    b.style.top = "0";
    b.style.left = "0";
    b.style.willChange = "transform";
    b.addEventListener("click", () => handlers.current.onClick?.());
    b.addEventListener("pointerenter", () => handlers.current.onHover?.(true));
    b.addEventListener("pointerleave", () => handlers.current.onHover?.(false));
    gl.domElement.parentElement!.appendChild(b);
    el.current = b;
    return () => {
      b.remove();
      el.current = null;
    };
  }, [gl]);

  useEffect(() => {
    const b = el.current;
    if (!b) return;
    b.className = className;
    b.replaceChildren();
    if (withDot) {
      const dot = document.createElement("span");
      dot.className = `${className.split(" ")[0]}__dot`;
      b.appendChild(dot);
    }
    b.appendChild(document.createTextNode(text));
    if (accent) b.style.setProperty("--accent", accent);
  }, [className, text, accent, withDot]);

  useFrame(() => {
    const b = el.current;
    if (!b) return;
    const a = opacity ? opacity() : 1;
    if (a < 0.02) {
      if (b.style.display !== "none") b.style.display = "none";
      return;
    }
    world.copy(typeof position === "function" ? position() : position);
    if (offset) {
      world.x += offset[0];
      world.y += offset[1];
      world.z += offset[2];
    }
    world.project(camera);
    if (world.z > 1 || world.z < -1) {
      if (b.style.display !== "none") b.style.display = "none";
      return;
    }
    const x = (world.x * 0.5 + 0.5) * size.width;
    const y = (-world.y * 0.5 + 0.5) * size.height;
    b.style.display = "";
    b.style.opacity = a < 1 ? String(a) : "";
    b.style.pointerEvents = a > 0.5 && (handlers.current.onClick || handlers.current.onHover) ? "auto" : "none";
    b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    if (active) b.dataset.active = String(active());
  });

  return null;
}
