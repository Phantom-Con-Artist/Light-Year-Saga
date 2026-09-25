import { useCallback, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Matrix4, Vector3, Vector4, type PerspectiveCamera } from "three";
import { starId, starName, useStarStore, type StarCatalog } from "../../data/stars";
import { CONSTELLATIONS, figureExtent, getConstellation, skyDirection, useConstellationStore, type ConstellationGeometry } from "../../data/constellations";
import { CELESTIAL_NORTH, renderToRaDec } from "../../astronomy/sky";
import { selectObject, useSelectionStore } from "../../state/selectionStore";
import { useCameraStore } from "../../state/cameraStore";
import { useSkyStore } from "../../state/skyStore";
import { SkyDome } from "../Backdrop";
import { SkyStars, skySphere } from "../common/SkyStars";
import { usePickProvider, useScreenPicking } from "../common/picking";
import { ScreenLabel } from "../ScreenLabel";
import { ConstellationLines, LINE_RADIUS } from "./ConstellationLines";
import { smoothstep } from "../interstellar/visibility";

const MIN_FOV = 6;
const MAX_FOV = 120;
/** Opening view: Orion, the best-known figure in the sky. */
const HOME = { raDeg: 83, decDeg: 2, fovDeg: 75 };

const clampFov = (f: number) => Math.min(MAX_FOV, Math.max(MIN_FOV, f));
const wrap360 = (a: number) => ((a % 360) + 360) % 360;
/** Shortest signed RA difference in degrees. */
const deltaRa = (from: number, to: number) => ((to - from + 540) % 360) - 180;

/** Faintest star drawn at full strength: zooming in reveals fainter stars, like a pair of binoculars. */
export const skyLimitMag = (fov: number) => Math.min(8.5, 5.6 + 2.6 * Math.log10(90 / fov));

/**
 * Look-around camera fixed at the Solar System: drag turns the sky (grab
 * style), wheel or pinch zooms the field of view. North celestial pole is up.
 */
function SkyLook() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const view = useRef({ ra: HOME.raDeg, dec: HOME.decDeg, fov: HOME.fovDeg });
  const velocity = useRef({ ra: 0, dec: 0 });
  const target = useRef<{ ra: number; dec: number; fov: number } | null>(null);
  const dragging = useRef(false);

  // Own the camera while mounted; hand it back as it was.
  useEffect(() => {
    const saved = { fov: camera.fov, near: camera.near, far: camera.far, up: camera.up.clone() };
    const portrait = gl.domElement.clientHeight > gl.domElement.clientWidth;
    view.current.fov = portrait ? 95 : HOME.fovDeg;
    camera.position.set(0, 0, 0);
    camera.near = 0.1;
    camera.far = 10_000;
    camera.up.copy(CELESTIAL_NORTH);
    return () => {
      camera.fov = saved.fov;
      camera.near = saved.near;
      camera.far = saved.far;
      camera.up.copy(saved.up);
      camera.updateProjectionMatrix();
    };
  }, [camera, gl]);

  // Pointer, touch and wheel input.
  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let last = 0;

    const degPerPx = () => view.current.fov / Math.max(el.clientHeight, 1);
    const pan = (dx: number, dy: number, dt: number) => {
      const v = view.current;
      const k = degPerPx();
      const dRa = (dx * k) / Math.max(Math.cos((v.dec * Math.PI) / 180), 0.2);
      const dDec = dy * k;
      v.ra = wrap360(v.ra + dRa);
      v.dec = Math.max(-89.5, Math.min(89.5, v.dec + dDec));
      if (dt > 0) {
        // Smoothed velocity (deg/s) for the glide after release.
        velocity.current.ra = velocity.current.ra * 0.6 + (dRa / dt) * 0.4;
        velocity.current.dec = velocity.current.dec * 0.6 + (dDec / dt) * 0.4;
      }
    };
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
      target.current = null;
      velocity.current = { ra: 0, dec: 0 };
      dragging.current = true;
      last = performance.now();
      if (pointers.size === 2) pinch = spread();
    };
    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (pointers.size === 1) {
        pan(e.clientX - p.x, e.clientY - p.y, dt);
      } else if (pointers.size === 2) {
        // Two fingers: pan by half the motion of each, zoom by the change in spread.
        pan((e.clientX - p.x) / 2, (e.clientY - p.y) / 2, 0);
        p.x = e.clientX;
        p.y = e.clientY;
        const s = spread();
        if (pinch > 0 && s > 0) view.current.fov = clampFov(view.current.fov * (pinch / s));
        pinch = s;
        return;
      }
      p.x = e.clientX;
      p.y = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (pointers.size === 0) {
        dragging.current = false;
        // No glide if the finger stopped before lifting.
        if (performance.now() - last > 80) velocity.current = { ra: 0, dec: 0 };
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      target.current = null;
      view.current.fov = clampFov(view.current.fov * Math.exp(e.deltaY * 0.0012));
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  // Look requests: HUD, selection, home.
  useEffect(() => {
    const go = (raDeg: number, decDeg: number, fovDeg?: number) => {
      velocity.current = { ra: 0, dec: 0 };
      target.current = { ra: raDeg, dec: decDeg, fov: clampFov(fovDeg ?? view.current.fov) };
    };
    const unsubLook = useSkyStore.subscribe((s, p) => {
      if (s.look && s.look !== p.look) go(s.look.raDeg, s.look.decDeg, s.look.fovDeg);
      if (s.zoom && s.zoom !== p.zoom) {
        const t = target.current ?? { ...view.current };
        go(t.ra, t.dec, (target.current?.fov ?? view.current.fov) * s.zoom.factor);
      }
    });
    const unsubHome = useCameraStore.subscribe((s, p) => {
      if (s.homeRequest !== p.homeRequest) go(HOME.raDeg, HOME.decDeg, HOME.fovDeg);
    });
    return () => {
      unsubLook();
      unsubHome();
    };
  }, []);

  const dir = useRef(new Vector3());
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const v = view.current;
    const t = target.current;
    if (t) {
      const k = 1 - Math.exp(-dt * 4.5);
      v.ra = wrap360(v.ra + deltaRa(v.ra, t.ra) * k);
      v.dec += (t.dec - v.dec) * k;
      v.fov += (t.fov - v.fov) * k;
      if (Math.abs(deltaRa(v.ra, t.ra)) < 0.01 && Math.abs(t.dec - v.dec) < 0.01 && Math.abs(t.fov - v.fov) < 0.01) target.current = null;
    } else if (!dragging.current) {
      const vel = velocity.current;
      if (Math.abs(vel.ra) + Math.abs(vel.dec) > 0.01) {
        v.ra = wrap360(v.ra + vel.ra * dt);
        v.dec = Math.max(-89.5, Math.min(89.5, v.dec + vel.dec * dt));
        const decay = Math.exp(-dt * 4);
        vel.ra *= decay;
        vel.dec *= decay;
      }
    }
    camera.position.set(0, 0, 0);
    camera.up.copy(CELESTIAL_NORTH);
    camera.lookAt(dir.current.copy(skyDirection(v.ra, v.dec)));
    if (Math.abs(camera.fov - v.fov) > 1e-4) {
      camera.fov = v.fov;
      camera.updateProjectionMatrix();
    }
    const sky = useSkyStore.getState();
    if (Math.abs(sky.fov - v.fov) > 0.2) sky.setFov(v.fov);
  });

  return null;
}

/** Turn the view toward whatever gets selected (from the list, search or a tap). */
function useLookAtSelection(catalog: StarCatalog | null, geometry: ConstellationGeometry | null) {
  useEffect(() => {
    const look = (id: string | null) => {
      const c = getConstellation(id);
      if (c) {
        const ext = geometry ? figureExtent(geometry, c.id) : { centre: c.direction, radiusDeg: 15 };
        const { raDeg, decDeg } = renderToRaDec(ext.centre);
        useSkyStore.getState().lookAt(raDeg, decDeg, Math.max(24, Math.min(110, ext.radiusDeg * 2.6)));
        return;
      }
      const i = id && catalog ? catalog.indexById.get(id) : undefined;
      if (i === undefined || !catalog || id === "sun") return;
      const p = catalog.positions;
      const { raDeg, decDeg } = renderToRaDec(new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]));
      useSkyStore.getState().lookAt(raDeg, decDeg, Math.min(useSkyStore.getState().fov, 50));
    };
    // Something may already be selected on arrival (search jumped here).
    look(useSelectionStore.getState().selectedId);
    return useSelectionStore.subscribe((s, p) => {
      if (s.focusRequest !== p.focusRequest) look(s.selectedId);
    });
  }, [catalog, geometry]);
}

const segmentCache = new WeakMap<ConstellationGeometry, { ends: Float32Array; ids: string[] }>();

/** Every stick-figure segment as unit-vector end points, for picking. */
function figureSegments(geometry: ConstellationGeometry) {
  let hit = segmentCache.get(geometry);
  if (hit) return hit;
  const ends: number[] = [];
  const ids: string[] = [];
  for (const [id, lines] of Object.entries(geometry.figures)) {
    for (const line of lines) {
      for (let k = 0; k + 3 < line.length; k += 2) {
        const p = skyDirection(line[k], line[k + 1]);
        const q = skyDirection(line[k + 2], line[k + 3]);
        ends.push(p.x, p.y, p.z, q.x, q.y, q.z);
        ids.push(id);
      }
    }
  }
  hit = { ends: new Float32Array(ends), ids };
  segmentCache.set(geometry, hit);
  return hit;
}

const MAX_LABELS = 28;
const LABEL_W = 96;
const LABEL_H = 16;
const PICK_RADIUS_PX = 12;

/**
 * DOM layer for the sky: names of bright stars (with overlap culling), a ring
 * on the selected star, and screen-space picking for stars and figures.
 */
function SkyOverlay({ catalog, geometry }: { catalog: StarCatalog; geometry: ConstellationGeometry | null }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const labels = useRef<HTMLButtonElement[]>([]);
  const ring = useRef<HTMLDivElement | null>(null);
  const viewProj = useRef(new Matrix4());
  const sky = skySphere(catalog);

  // Label candidates: named stars, brightest first.
  const named = useRef<number[]>([]);
  if (named.current.length === 0) {
    for (let k = 0; k < sky.indices.length; k++) if (catalog.meta.proper[sky.indices[k]] && sky.mags[k] < 4.5) named.current.push(k);
    named.current.sort((a, b) => sky.mags[a] - sky.mags[b]);
  }

  useEffect(() => {
    const root = document.createElement("div");
    root.className = "star-overlay";
    gl.domElement.parentElement!.appendChild(root);
    labels.current = Array.from({ length: MAX_LABELS }, () => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "star-label sky-star-label";
      b.style.display = "none";
      b.addEventListener("click", () => b.dataset.id && selectObject(b.dataset.id));
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

  const project = (x: number, y: number, z: number, out: Vector4): boolean => {
    out.set(x, y, z, 1).applyMatrix4(viewProj.current);
    if (out.w <= 0) return false;
    out.x = ((out.x / out.w) * 0.5 + 0.5) * size.width;
    out.y = ((-out.y / out.w) * 0.5 + 0.5) * size.height;
    return out.x > -40 && out.x < size.width + 40 && out.y > -40 && out.y < size.height + 40;
  };
  const projectStar = (k: number, out: Vector4) => project(sky.directions[k * 3], sky.directions[k * 3 + 1], sky.directions[k * 3 + 2], out);

  const refreshMatrix = () => {
    camera.updateMatrixWorld();
    viewProj.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  };

  // Stars: the brightest visible star near the cursor.
  usePickProvider(
    useCallback(
      (x: number, y: number) => {
        refreshMatrix();
        const limit = skyLimitMag(useSkyStore.getState().fov);
        const v = new Vector4();
        let best = -1;
        let bestScore = Infinity;
        for (let k = 0; k < sky.indices.length; k++) {
          const mag = sky.mags[k];
          if (mag > limit) continue;
          if (!projectStar(k, v)) continue;
          const d = Math.hypot(v.x - x, v.y - y);
          const radius = PICK_RADIUS_PX + Math.max(0, limit - mag) * 1.5;
          if (d > radius) continue;
          const score = d + mag * 2;
          if (score < bestScore) {
            bestScore = score;
            best = k;
          }
        }
        return best < 0 ? null : { id: starId(catalog, sky.indices[best]), score: bestScore - 20 };
      },
      [catalog, size],
    ),
  );

  // Figures: a tap on or near a stick-figure line selects the constellation.
  usePickProvider(
    useCallback(
      (x: number, y: number) => {
        if (!geometry || !useSkyStore.getState().figures) return null;
        refreshMatrix();
        const { ends, ids } = figureSegments(geometry);
        const a = new Vector4();
        const b = new Vector4();
        let best: string | null = null;
        let bestD = 14;
        for (let n = 0; n < ids.length; n++) {
          const e = n * 6;
          if (!project(ends[e], ends[e + 1], ends[e + 2], a) || !project(ends[e + 3], ends[e + 4], ends[e + 5], b)) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / Math.max(dx * dx + dy * dy, 1e-6)));
          const d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
          if (d < bestD) {
            bestD = d;
            best = ids[n];
          }
        }
        return best ? { id: `con-${best}`, score: bestD } : null;
      },
      [geometry, size],
    ),
  );

  const v4 = useRef(new Vector4());
  useFrame(() => {
    refreshMatrix();
    const s = useSkyStore.getState();
    const selectedId = useSelectionStore.getState().selectedId;
    const selectedIndex = selectedId ? catalog.indexById.get(selectedId) : undefined;
    const labelMag = s.starNames ? Math.min(4.5, 1.2 + 2.4 * Math.log10(100 / s.fov)) : -99;

    const placed: { k: number; x: number; y: number }[] = [];
    const tryPlace = (k: number) => {
      if (placed.length >= MAX_LABELS || !projectStar(k, v4.current)) return;
      const { x, y } = v4.current;
      if (placed.some((p) => Math.abs(p.x - x) < LABEL_W && Math.abs(p.y - y) < LABEL_H)) return;
      placed.push({ k, x, y });
    };
    const selectedK = selectedIndex !== undefined ? sky.indices.indexOf(selectedIndex) : -1;
    if (selectedK >= 0) tryPlace(selectedK);
    for (const k of named.current) {
      if (sky.mags[k] > labelMag) break;
      if (k !== selectedK) tryPlace(k);
    }

    labels.current.forEach((el, slot) => {
      const c = placed[slot];
      if (!c) {
        if (el.style.display !== "none") el.style.display = "none";
        return;
      }
      const ci = sky.indices[c.k];
      const id = starId(catalog, ci);
      if (el.dataset.id !== id) {
        el.dataset.id = id;
        el.textContent = starName(catalog, ci);
      }
      el.dataset.active = String(ci === selectedIndex);
      el.style.display = "";
      el.style.transform = `translate(${c.x + 8}px, ${c.y - 8}px)`;
    });

    const r = ring.current;
    if (!r) return;
    if (selectedK >= 0 && projectStar(selectedK, v4.current)) {
      r.style.display = "";
      r.style.transform = `translate(${v4.current.x - 14}px, ${v4.current.y - 14}px)`;
    } else if (r.style.display !== "none") r.style.display = "none";
  });

  return null;
}

/** Constellation names: prominent figures always, fainter ones as you zoom in. */
function ConstellationNames() {
  return (
    <>
      {CONSTELLATIONS.map((c) => (
        <ScreenLabel
          key={c.id}
          position={c.direction.clone().multiplyScalar(LINE_RADIUS)}
          text={c.name}
          className="constellation-label"
          opacity={() => {
            const s = useSkyStore.getState();
            if (useSelectionStore.getState().selectedId === c.key) return 1;
            if (!s.names) return 0;
            const reveal = c.rank === 1 ? 140 : c.rank === 2 ? 85 : 55;
            return 1 - smoothstep(reveal * 0.8, reveal, s.fov);
          }}
          active={() => useSelectionStore.getState().selectedId === c.key}
          onClick={() => selectObject(c.key)}
        />
      ))}
    </>
  );
}

function Picking() {
  useScreenPicking(selectObject);
  return null;
}

/**
 * The night sky as seen from Earth: every catalogue star at its true position
 * and brightness, the 88 IAU constellations, and the real Milky Way photo.
 */
export function SkyScene() {
  const catalog = useStarStore((s) => s.catalog);
  const geometry = useConstellationStore((s) => s.geometry);
  useEffect(() => useConstellationStore.getState().load(), []);
  useLookAtSelection(catalog, geometry);

  return (
    <>
      <SkyLook />
      <SkyDome gain={0.55} blackLevel={0.035} opacity={() => (useSkyStore.getState().milkyWay ? 1 : 0)} />
      {geometry && <ConstellationLines data={geometry} />}
      {catalog && (
        <>
          <SkyStars catalog={catalog} limitMag={() => skyLimitMag(useSkyStore.getState().fov)} />
          <SkyOverlay catalog={catalog} geometry={geometry} />
        </>
      )}
      <ConstellationNames />
      <Picking />
    </>
  );
}
