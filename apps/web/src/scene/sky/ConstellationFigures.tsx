import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, Group, Vector3 } from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { getConstellation, skyDirection, type ConstellationGeometry } from "../../data/constellations";
import { useSelectionStore } from "../../state/selectionStore";
import { useSkyStore } from "../../state/skyStore";
import { LINE_RADIUS } from "./ConstellationLines";

/** Leave a small gap where a line meets a star, as printed star charts do. */
const GAP_DEG = 0.45;
/** Glow as stacked ribbons: [width in px, opacity]. The last one is the crisp line. */
const LAYERS: [number, number][] = [
  [11, 0.07],
  [5, 0.16],
  [1.6, 0.95],
];
const HOVER_COLOR = new Color("#a9d4ff");
const SELECT_COLOR = new Color("#ffc46b");
const RESTING_COLOR = new Color("#5f86c4");

/** Stick-figure segments per constellation, trimmed at the stars, on the line sphere. */
function segmentsFor(lines: number[][]): number[] {
  const out: number[] = [];
  const gap = (GAP_DEG * Math.PI) / 180;
  const a = new Vector3();
  const b = new Vector3();
  for (const line of lines) {
    for (let k = 0; k + 3 < line.length; k += 2) {
      a.copy(skyDirection(line[k], line[k + 1]));
      b.copy(skyDirection(line[k + 2], line[k + 3]));
      const ang = a.angleTo(b);
      if (ang < gap * 2.5) continue;
      const t = gap / ang;
      const p = a.clone().lerp(b, t).normalize().multiplyScalar(LINE_RADIUS);
      const q = a
        .clone()
        .lerp(b, 1 - t)
        .normalize()
        .multiplyScalar(LINE_RADIUS);
      out.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  }
  return out;
}

interface Figure {
  id: string;
  group: Group;
  materials: LineMaterial[];
  /** 0 hidden … 1 fully lit (hover or selection), animated. */
  light: number;
}

/**
 * Stick figures, hidden until found: the constellation under the cursor (or
 * the screen centre on touch) glows, the selection glows gold, and "All lines"
 * shows every figure faintly.
 */
export function ConstellationFigures({ data }: { data: ConstellationGeometry }) {
  const figures = useMemo<Figure[]>(
    () =>
      Object.entries(data.figures).map(([id, lines]) => {
        const geometry = new LineSegmentsGeometry().setPositions(segmentsFor(lines));
        const group = new Group();
        const materials = LAYERS.map(([width], i) => {
          const m = new LineMaterial({ linewidth: width, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
          m.blending = AdditiveBlending;
          const line = new LineSegments2(geometry, m);
          line.frustumCulled = false;
          line.renderOrder = -2 + i * 0.01;
          line.raycast = () => {};
          group.add(line);
          return m;
        });
        group.visible = false;
        return { id, group, materials, light: 0 };
      }),
    [data],
  );

  useEffect(
    () => () => {
      for (const f of figures) {
        (f.group.children[0] as LineSegments2).geometry.dispose();
        f.materials.forEach((m) => m.dispose());
      }
    },
    [figures],
  );

  const color = useMemo(() => new Color(), []);
  useFrame(({ gl }, delta) => {
    const sky = useSkyStore.getState();
    const selected = getConstellation(useSelectionStore.getState().selectedId)?.id;
    const ratio = gl.getPixelRatio();
    const fadeIn = 1 - Math.exp(-delta * 10);
    const fadeOut = 1 - Math.exp(-delta * 5);
    for (const f of figures) {
      const lit = f.id === selected || f.id === sky.hovered;
      const target = lit ? 1 : 0;
      f.light += (target - f.light) * (target > f.light ? fadeIn : fadeOut);
      if (f.light < 0.002) f.light = 0;
      // Resting level when every figure is shown.
      const rest = sky.figures ? 0.4 : 0;
      const shown = Math.max(rest, f.light);
      f.group.visible = shown > 0.002;
      if (!f.group.visible) continue;
      color.copy(RESTING_COLOR).lerp(f.id === selected ? SELECT_COLOR : HOVER_COLOR, f.light);
      f.materials.forEach((m, i) => {
        const [width, opacity] = LAYERS[i];
        const isCore = i === LAYERS.length - 1;
        // The glow layers belong to a lit figure only; resting figures are a plain thin line.
        m.opacity = isCore ? opacity * shown : opacity * f.light;
        m.linewidth = width * ratio;
        m.color.copy(color);
      });
    }
  });

  return (
    <>
      {figures.map((f) => (
        <primitive key={f.id} object={f.group} />
      ))}
    </>
  );
}
