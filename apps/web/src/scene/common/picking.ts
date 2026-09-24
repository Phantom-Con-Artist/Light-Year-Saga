import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Screen-space picking shared by every scene. Providers (star field, catalog
 * markers, planets…) report their best hit for a cursor position; the single
 * canvas listener picks the winner. Avoids raycasting large point clouds and
 * prevents two layers from both reacting to one click.
 */
export interface PickHit {
  id: string;
  /** Lower wins. Roughly pixel distance, minus bonuses for importance. */
  score: number;
}

export type PickProvider = (x: number, y: number) => PickHit | null;

const providers = new Set<PickProvider>();

export function usePickProvider(provider: PickProvider) {
  useEffect(() => {
    providers.add(provider);
    return () => {
      providers.delete(provider);
    };
  }, [provider]);
}

function bestHit(x: number, y: number): PickHit | null {
  let best: PickHit | null = null;
  for (const p of providers) {
    const hit = p(x, y);
    if (hit && (!best || hit.score < best.score)) best = hit;
  }
  return best;
}

const CLICK_SLOP_PX = 5;

/** Mount once per canvas: turns clicks into `onPick(id)`, and sets the hover cursor. */
export function useScreenPicking(onPick: (id: string) => void) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number } | null = null;
    let lastHover = 0;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent) => (down = local(e));
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const p = local(e);
      const moved = Math.hypot(p.x - down.x, p.y - down.y);
      down = null;
      if (moved > CLICK_SLOP_PX) return;
      const hit = bestHit(p.x, p.y);
      if (hit) onPick(hit.id);
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons || performance.now() - lastHover < 80) return;
      lastHover = performance.now();
      const p = local(e);
      el.style.cursor = bestHit(p.x, p.y) ? "pointer" : "";
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointermove", onMove);
      el.style.cursor = "";
    };
  }, [gl, onPick]);
}
