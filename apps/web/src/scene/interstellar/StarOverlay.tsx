import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Matrix4, Vector4 } from "three";
import { starId, starName, type StarCatalog } from "../../data/stars";
import { selectObject, useSelectionStore } from "../../state/selectionStore";
import { apparentMagFromCamera, starVisibility } from "./visibility";

const MAX_LABELS = 22;
const LABEL_W = 110;
const LABEL_H = 18;
const PICK_RADIUS_PX = 12;
const CLICK_SLOP_PX = 5;

interface Projected {
  index: number;
  x: number;
  y: number;
  mag: number;
}

/**
 * DOM layer over the star field: names for the brightest named stars (with
 * overlap culling), a ring on the selected star, and click/hover picking done
 * in screen space — far cheaper than raycasting 40k points.
 */
export function StarOverlay({ catalog }: { catalog: StarCatalog }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const container = useRef<HTMLDivElement | null>(null);
  const labels = useRef<HTMLButtonElement[]>([]);
  const ring = useRef<HTMLDivElement | null>(null);
  const viewProj = useRef(new Matrix4());

  const sunIndex = catalog.indexById.get("sun")!;
  const candidates = useRef<number[]>([sunIndex, ...catalog.named.filter((i) => i !== sunIndex)]);

  // Build the DOM pool once.
  useEffect(() => {
    const parent = gl.domElement.parentElement!;
    const root = document.createElement("div");
    root.className = "star-overlay";
    parent.appendChild(root);
    container.current = root;

    labels.current = Array.from({ length: MAX_LABELS }, () => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "star-label";
      b.style.display = "none";
      b.addEventListener("click", () => {
        const id = b.dataset.id;
        if (id) selectObject(id);
      });
      root.appendChild(b);
      return b;
    });

    const r = document.createElement("div");
    r.className = "star-ring";
    r.style.display = "none";
    root.appendChild(r);
    ring.current = r;

    return () => {
      root.remove();
      labels.current = [];
      ring.current = null;
    };
  }, [gl]);

  /** Screen position of star i, or null when behind the camera / off screen. */
  const project = (i: number, out: Vector4): boolean => {
    const p = catalog.positions;
    out.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], 1).applyMatrix4(viewProj.current);
    if (out.w <= 0) return false;
    out.x = ((out.x / out.w) * 0.5 + 0.5) * size.width;
    out.y = ((-out.y / out.w) * 0.5 + 0.5) * size.height;
    return out.x > -50 && out.x < size.width + 50 && out.y > -50 && out.y < size.height + 50;
  };

  const distanceToCamera = (i: number) => {
    const p = catalog.positions;
    return Math.hypot(p[i * 3] - camera.position.x, p[i * 3 + 1] - camera.position.y, p[i * 3 + 2] - camera.position.z);
  };

  /** Brightest visible star under the cursor. */
  const pick = (sx: number, sy: number): number | null => {
    const { limitMag } = starVisibility(camera.position.length());
    const v = new Vector4();
    let best: number | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < catalog.count; i++) {
      if (!project(i, v)) continue;
      const dx = v.x - sx;
      const dy = v.y - sy;
      const d2 = dx * dx + dy * dy;
      if (d2 > PICK_RADIUS_PX * PICK_RADIUS_PX * 4) continue;
      const mag = apparentMagFromCamera(catalog.absMag[i], distanceToCamera(i));
      if (mag > limitMag) continue;
      const radius = PICK_RADIUS_PX + Math.max(0, limitMag - mag) * 1.5;
      if (d2 > radius * radius) continue;
      const score = Math.sqrt(d2) + mag * 2;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  };

  // Click / hover picking on the canvas.
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
      const hit = pick(p.x, p.y);
      if (hit !== null) selectObject(starId(catalog, hit));
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons || performance.now() - lastHover < 80) return;
      lastHover = performance.now();
      const p = local(e);
      el.style.cursor = pick(p.x, p.y) !== null ? "pointer" : "";
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
  });

  const v4 = useRef(new Vector4());
  const placed = useRef<Projected[]>([]);

  useFrame(() => {
    if (!container.current) return;
    camera.updateMatrixWorld();
    viewProj.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const dSun = camera.position.length();
    const { labelMag } = starVisibility(dSun);
    // At galactic scale the Galaxy layer shows its own "you are here" marker.
    const forceSun = dSun < 15_000;
    const selectedId = useSelectionStore.getState().selectedId;
    const selectedIndex = selectedId ? catalog.indexById.get(selectedId) : undefined;

    // Collect label candidates that are bright enough from here.
    const visible: Projected[] = [];
    for (const i of candidates.current) {
      const mag = apparentMagFromCamera(catalog.absMag[i], distanceToCamera(i));
      if (mag > labelMag && i !== selectedIndex && !(forceSun && i === sunIndex)) continue;
      if (!project(i, v4.current)) continue;
      // The Sun is always labelled (home marker); the selection always wins.
      const priority = i === selectedIndex ? -99 : forceSun && i === sunIndex ? -50 : mag;
      visible.push({ index: i, x: v4.current.x, y: v4.current.y, mag: priority });
    }
    if (selectedIndex !== undefined && !candidates.current.includes(selectedIndex) && project(selectedIndex, v4.current)) {
      visible.push({ index: selectedIndex, x: v4.current.x, y: v4.current.y, mag: -99 });
    }
    visible.sort((a, b) => a.mag - b.mag);

    // Greedy placement without overlaps.
    placed.current.length = 0;
    for (const c of visible) {
      if (placed.current.length >= MAX_LABELS) break;
      const clash = placed.current.some((p) => Math.abs(p.x - c.x) < LABEL_W && Math.abs(p.y - c.y) < LABEL_H);
      if (!clash) placed.current.push(c);
    }

    labels.current.forEach((el, slot) => {
      const c = placed.current[slot];
      if (!c) {
        if (el.style.display !== "none") el.style.display = "none";
        return;
      }
      const id = starId(catalog, c.index);
      if (el.dataset.id !== id) {
        el.dataset.id = id;
        el.textContent = starName(catalog, c.index);
      }
      el.dataset.active = String(c.index === selectedIndex);
      el.style.display = "";
      el.style.transform = `translate(${c.x + 9}px, ${c.y - 8}px)`;
    });

    // Selection ring.
    const r = ring.current!;
    if (selectedIndex !== undefined && project(selectedIndex, v4.current)) {
      r.style.display = "";
      r.style.transform = `translate(${v4.current.x - 14}px, ${v4.current.y - 14}px)`;
    } else if (r.style.display !== "none") {
      r.style.display = "none";
    }
  });

  return null;
}
