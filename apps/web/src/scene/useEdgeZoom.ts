import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

/** Wheel notches required at the zoom limit before switching levels, so it's never accidental. */
const NOTCHES = 3;
const RESET_MS = 700;

/**
 * Fires `onTrigger` when the user keeps scrolling past a zoom limit —
 * the gesture for moving between view levels.
 */
export function useEdgeZoom(opts: { direction: "in" | "out"; atEdge: () => boolean; onTrigger: () => void }) {
  const gl = useThree((s) => s.gl);
  const latest = useRef(opts);
  latest.current = opts;

  useEffect(() => {
    let count = 0;
    let timer = 0;
    const onWheel = (e: WheelEvent) => {
      const { direction, atEdge, onTrigger } = latest.current;
      const outward = e.deltaY > 0;
      if (outward !== (direction === "out") || !atEdge()) {
        count = 0;
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (count = 0), RESET_MS);
      if (++count >= NOTCHES) {
        count = 0;
        onTrigger();
      }
    };
    const el = gl.domElement;
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.clearTimeout(timer);
    };
  }, [gl]);
}
