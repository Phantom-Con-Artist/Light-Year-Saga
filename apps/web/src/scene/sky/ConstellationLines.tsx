import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, ShaderMaterial, Vector3 } from "three";
import { CONSTELLATIONS, getConstellation, skyDirection, type ConstellationGeometry } from "../../data/constellations";
import { useSelectionStore } from "../../state/selectionStore";
import { useSkyStore } from "../../state/skyStore";

export const LINE_RADIUS = 900;
const INDEX = new Map(CONSTELLATIONS.map((c, i) => [c.id, i]));
/** Leave a small gap where a line meets a star, as printed star charts do. */
const GAP_DEG = 0.45;

const figureVertex = /* glsl */ `
attribute float aIdx;
uniform float uSel;
varying float vSel;
void main() {
  vSel = abs(aIdx - uSel) < 0.5 ? 1.0 : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const figureFragment = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uSelColor;
varying float vSel;
void main() {
  vec3 c = mix(uColor, uSelColor, vSel) * uOpacity;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

const borderVertex = /* glsl */ `
attribute vec2 aPair;
uniform float uSel;
varying float vSel;
void main() {
  vSel = (abs(aPair.x - uSel) < 0.5 || abs(aPair.y - uSel) < 0.5) ? 1.0 : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FIGURE_COLOR = new Vector3(0.2, 0.32, 0.55);
const BORDER_COLOR = new Vector3(0.09, 0.11, 0.16);

function lineMaterial(vertexShader: string, color: Vector3, selColor: Vector3) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader: figureFragment,
    uniforms: {
      uSel: { value: -1 },
      uOpacity: { value: 1 },
      uColor: { value: color.clone() },
      uSelColor: { value: selColor },
    },
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

function segments(geometry: BufferGeometry, material: ShaderMaterial | LineBasicMaterial, renderOrder: number) {
  const l = new LineSegments(geometry, material);
  l.frustumCulled = false;
  l.renderOrder = renderOrder;
  l.raycast = () => {};
  return l;
}

function buildFigures(data: ConstellationGeometry) {
  const pos: number[] = [];
  const idx: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const gap = (GAP_DEG * Math.PI) / 180;
  for (const [id, lines] of Object.entries(data.figures)) {
    const n = INDEX.get(id) ?? -1;
    for (const line of lines) {
      for (let k = 0; k + 3 < line.length; k += 2) {
        a.copy(skyDirection(line[k], line[k + 1]));
        b.copy(skyDirection(line[k + 2], line[k + 3]));
        const ang = a.angleTo(b);
        if (ang < gap * 2.5) continue;
        // Trim both ends along the great circle.
        const t0 = gap / ang;
        const p = a.clone().lerp(b, t0).normalize().multiplyScalar(LINE_RADIUS);
        const q = a
          .clone()
          .lerp(b, 1 - t0)
          .normalize()
          .multiplyScalar(LINE_RADIUS);
        pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
        idx.push(n, n);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aIdx", new BufferAttribute(new Float32Array(idx), 1));
  return g;
}

/** Boundaries run along lines of constant RA or Dec, so interpolate in RA/Dec, not along great circles. */
function buildBorders(data: ConstellationGeometry) {
  const pos: number[] = [];
  const pair: number[] = [];
  for (const [ids, line] of data.borders) {
    const [x, y] = ids.split(",").map((id) => INDEX.get(id) ?? -1);
    for (let k = 0; k + 3 < line.length; k += 2) {
      let ra0 = line[k];
      const dec0 = line[k + 1];
      let ra1 = line[k + 2];
      const dec1 = line[k + 3];
      if (ra1 - ra0 > 180) ra0 += 360;
      else if (ra0 - ra1 > 180) ra1 += 360;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(ra1 - ra0) * Math.cos(((dec0 + dec1) * Math.PI) / 360), Math.abs(dec1 - dec0)) / 1.5));
      let prev = skyDirection(ra0, dec0).multiplyScalar(LINE_RADIUS);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const next = skyDirection(ra0 + (ra1 - ra0) * t, dec0 + (dec1 - dec0) * t).multiplyScalar(LINE_RADIUS);
        pos.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
        pair.push(x, y, x, y);
        prev = next;
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aPair", new BufferAttribute(new Float32Array(pair), 2));
  return g;
}

function circle(pts: number[], dir: (t: number) => Vector3, n: number) {
  let prev = dir(0).multiplyScalar(LINE_RADIUS);
  for (let i = 1; i <= n; i++) {
    const next = dir(i / n).multiplyScalar(LINE_RADIUS);
    pts.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
    prev = next;
  }
}

function buildGrid() {
  const grid: number[] = [];
  for (let ra = 0; ra < 360; ra += 15) circle(grid, (t) => skyDirection(ra, -80 + 160 * t), 40);
  for (let dec = -75; dec <= 75; dec += 15) if (dec !== 0) circle(grid, (t) => skyDirection(360 * t, dec), 120);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(grid), 3));

  // Celestial equator, and the ecliptic (the render x–z plane: axes are ecliptic J2000).
  const equator: number[] = [];
  circle(equator, (t) => skyDirection(360 * t, 0), 180);
  const ecliptic: number[] = [];
  circle(ecliptic, (t) => new Vector3(Math.cos(t * Math.PI * 2), 0, Math.sin(t * Math.PI * 2)), 180);
  const eq = new BufferGeometry();
  eq.setAttribute("position", new BufferAttribute(new Float32Array(equator), 3));
  const ecl = new BufferGeometry();
  ecl.setAttribute("position", new BufferAttribute(new Float32Array(ecliptic), 3));
  return { grid: g, equator: eq, ecliptic: ecl };
}

const basic = (color: string, opacity: number) =>
  new LineBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false });

/** Stick figures, IAU boundaries and an optional RA/Dec grid on the celestial sphere. */
export function ConstellationLines({ data }: { data: ConstellationGeometry }) {
  const layers = useMemo(() => {
    const figures = segments(buildFigures(data), lineMaterial(figureVertex, FIGURE_COLOR, new Vector3(1.0, 0.76, 0.36)), -2);
    const borders = segments(buildBorders(data), lineMaterial(borderVertex, BORDER_COLOR, new Vector3(0.42, 0.33, 0.16)), -3);
    const g = buildGrid();
    const grid = segments(g.grid, basic("#5a78a8", 0.14), -4);
    const equator = segments(g.equator, basic("#6f9ad6", 0.3), -4);
    const ecliptic = segments(g.ecliptic, basic("#d6b36f", 0.32), -4);
    return { figures, borders, grid, equator, ecliptic };
  }, [data]);

  useEffect(
    () => () => {
      for (const l of Object.values(layers)) {
        l.geometry.dispose();
        (l.material as ShaderMaterial).dispose();
      }
    },
    [layers],
  );

  useFrame(() => {
    const sky = useSkyStore.getState();
    const c = getConstellation(useSelectionStore.getState().selectedId);
    const sel = c ? (INDEX.get(c.id) ?? -1) : -1;
    // With a layer switched off, the selected constellation still shows its own figure and outline.
    const fig = layers.figures.material as ShaderMaterial;
    fig.uniforms.uSel.value = sel;
    fig.uniforms.uColor.value.copy(FIGURE_COLOR).multiplyScalar(sky.figures ? 1 : 0);
    layers.figures.visible = sky.figures || sel >= 0;
    const bor = layers.borders.material as ShaderMaterial;
    bor.uniforms.uSel.value = sel;
    bor.uniforms.uColor.value.copy(BORDER_COLOR).multiplyScalar(sky.borders ? 1 : 0);
    layers.borders.visible = sky.borders || sel >= 0;
    layers.grid.visible = layers.equator.visible = layers.ecliptic.visible = sky.grid;
  });

  return (
    <>
      <primitive object={layers.grid} />
      <primitive object={layers.equator} />
      <primitive object={layers.ecliptic} />
      <primitive object={layers.borders} />
      <primitive object={layers.figures} />
    </>
  );
}
