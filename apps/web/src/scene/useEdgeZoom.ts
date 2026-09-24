import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

/** Wheel notches required at the zoom limit before switching levels, so it's never accidental. */
const NOTCHES = 3;
const RESET_MS = 700;
/** Pinch: keep pinching this far (log of finger-spread ratio) past the limit. */
const PINCH_LOG = 0.45;

/**
 * Fires `onTrigger` when the user keeps zooming past a zoom limit — scrolling
 * the wheel or pinching — the gesture for moving between view levels.
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

    // Pinch. Spread is measured only while the camera sits at the limit.
    let lastSpread = 0;
    let accumulated = 0;
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => {
      accumulated = 0;
      lastSpread = e.touches.length === 2 ? spread(e.touches) : 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || lastSpread <= 0) return;
      const now = spread(e.touches);
      const step = Math.log(now / lastSpread); // > 0: fingers apart = zoom in
      lastSpread = now;
      const { direction, atEdge, onTrigger } = latest.current;
      if (!atEdge()) {
        accumulated = 0;
        return;
      }
      accumulated += direction === "in" ? step : -step;
      if (accumulated < 0) accumulated = 0;
      if (accumulated >= PINCH_LOG) {
        accumulated = 0;
        lastSpread = 0;
        onTrigger();
      }
    };
    const onTouchEnd = () => {
      accumulated = 0;
      lastSpread = 0;
    };

    const el = gl.domElement;
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      window.clearTimeout(timer);
    };
  }, [gl]);
}
