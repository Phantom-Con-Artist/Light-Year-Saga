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

/**
 * DOM labels. On touch screens they don't take pointer events (so a swipe that
 * starts on a label still turns the camera); taps on them are resolved here.
 */
export interface TapLabel {
  el: HTMLElement;
  onTap: () => void;
}
export const tapLabels = new Set<TapLabel>();

function labelAt(clientX: number, clientY: number): TapLabel | null {
  let best: TapLabel | null = null;
  let bestD = Infinity;
  for (const l of tapLabels) {
    if (l.el.style.display === "none" || Number(l.el.style.opacity || 1) < 0.5) continue;
    const r = l.el.getBoundingClientRect();
    const pad = 8;
    if (clientX < r.left - pad || clientX > r.right + pad || clientY < r.top - pad || clientY > r.bottom + pad) continue;
    const d = Math.hypot(clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2));
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

const CLICK_SLOP_PX = 5;
/** Fingers wobble and cover more screen than a cursor. */
const TAP_SLOP_PX = 12;
const TAP_REACH_PX = 18;
const RING = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)]);

/** Best hit at a point; for touch, also look a finger's width around it. */
function hitNear(x: number, y: number, touch: boolean): PickHit | null {
  const direct = bestHit(x, y);
  if (direct || !touch) return direct;
  let best: PickHit | null = null;
  for (const [dx, dy] of RING) {
    const hit = bestHit(x + dx * TAP_REACH_PX, y + dy * TAP_REACH_PX);
    if (hit && (!best || hit.score < best.score)) best = hit;
  }
  return best;
}

/** Mount once per canvas: turns clicks and taps into `onPick(id)`, and sets the hover cursor. */
export function useScreenPicking(onPick: (id: string) => void) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number } | null = null;
    const active = new Set<number>();
    // A pinch or two-finger pan is never a tap, even when one finger lifts cleanly.
    let multiTouch = false;
    let lastHover = 0;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent) => {
      active.add(e.pointerId);
      if (active.size > 1) multiTouch = true;
      else {
        multiTouch = false;
        down = local(e);
      }
    };
    const onUp = (e: PointerEvent) => {
      active.delete(e.pointerId);
      if (!down || multiTouch) {
        if (active.size === 0) down = null;
        return;
      }
      const p = local(e);
      const touch = e.pointerType === "touch" || e.pointerType === "pen";
      const moved = Math.hypot(p.x - down.x, p.y - down.y);
      down = null;
      if (moved > (touch ? TAP_SLOP_PX : CLICK_SLOP_PX)) return;
      if (touch) {
        const label = labelAt(e.clientX, e.clientY);
        if (label) return label.onTap();
      }
      const hit = hitNear(p.x, p.y, touch);
      if (hit) onPick(hit.id);
    };
    const onCancel = (e: PointerEvent) => {
      active.delete(e.pointerId);
      down = null;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.buttons || performance.now() - lastHover < 80) return;
      lastHover = performance.now();
      const p = local(e);
      el.style.cursor = bestHit(p.x, p.y) ? "pointer" : "";
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("pointermove", onMove);
      el.style.cursor = "";
    };
  }, [gl, onPick]);
}
