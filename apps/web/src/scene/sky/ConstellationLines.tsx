import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, ShaderMaterial, Vector3 } from "three";
import { CONSTELLATIONS, getConstellation, skyDirection, type ConstellationGeometry } from "../../data/constellations";
import { useSelectionStore } from "../../state/selectionStore";
import { useSkyStore } from "../../state/skyStore";

export const LINE_RADIUS = 900;
const INDEX = new Map(CONSTELLATIONS.map((c, i) => [c.id, i]));
const lineFragment = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uSelColor;
uniform vec3 uHoverColor;
varying float vSel;
varying float vHover;
void main() {
  vec3 c = mix(mix(uColor, uHoverColor, vHover), uSelColor, vSel) * uOpacity;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

const borderVertex = /* glsl */ `
attribute vec2 aPair;
uniform float uSel;
uniform float uHover;
varying float vSel;
varying float vHover;
void main() {
  vSel = (abs(aPair.x - uSel) < 0.5 || abs(aPair.y - uSel) < 0.5) ? 1.0 : 0.0;
  vHover = (abs(aPair.x - uHover) < 0.5 || abs(aPair.y - uHover) < 0.5) ? 1.0 : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BORDER_COLOR = new Vector3(0.09, 0.11, 0.16);

function lineMaterial(vertexShader: string, color: Vector3, selColor: Vector3) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader: lineFragment,
    uniforms: {
      uSel: { value: -1 },
      uHover: { value: -1 },
      uHoverColor: { value: new Vector3(0.1, 0.16, 0.26) },
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

/** IAU boundaries and an optional RA/Dec grid on the celestial sphere (figures: see ConstellationFigures). */
export function ConstellationLines({ data }: { data: ConstellationGeometry }) {
  const layers = useMemo(() => {
    const borders = segments(buildBorders(data), lineMaterial(borderVertex, BORDER_COLOR, new Vector3(0.42, 0.33, 0.16)), -3);
    const g = buildGrid();
    const grid = segments(g.grid, basic("#5a78a8", 0.14), -4);
    const equator = segments(g.equator, basic("#6f9ad6", 0.3), -4);
    const ecliptic = segments(g.ecliptic, basic("#d6b36f", 0.32), -4);
    return { borders, grid, equator, ecliptic };
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
    const hover = sky.hovered ? (INDEX.get(sky.hovered) ?? -1) : -1;
    // With borders off, the selected and hovered constellations still show their own outline.
    const bor = layers.borders.material as ShaderMaterial;
    bor.uniforms.uSel.value = sel;
    bor.uniforms.uHover.value = hover;
    bor.uniforms.uColor.value.copy(BORDER_COLOR).multiplyScalar(sky.borders ? 1 : 0);
    layers.borders.visible = sky.borders || sel >= 0 || hover >= 0;
    layers.grid.visible = layers.equator.visible = layers.ecliptic.visible = sky.grid;
  });

  return (
    <>
      <primitive object={layers.grid} />
      <primitive object={layers.equator} />
      <primitive object={layers.ecliptic} />
      <primitive object={layers.borders} />
    </>
  );
}
