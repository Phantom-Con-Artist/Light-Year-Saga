import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Points,
  Quaternion,
  ShaderMaterial,
  Sphere,
  Vector3,
  Vector4,
  type PerspectiveCamera,
} from "three";
import { diskBasis } from "../../astronomy/sky";
import type { CatalogObject, GalaxyVisual } from "../../data/catalog";
import { useSelectionStore } from "../../state/selectionStore";
import { useGraphicsStore } from "../../state/graphicsStore";
import { isPointGalaxyId, pointGalaxyInfo, pointGalaxyPosition, type PointGalaxyInfo } from "../../data/cosmic/cosmicPoints";
import { photoWeight } from "./SkyPhotos";

/**
 * Catalogued galaxies as procedural point clouds: stars of the bulge, disk
 * and spiral arms, pink star-forming knots and soft sprites for the
 * unresolved light, all generated in the vertex shader from the point's
 * index and its galaxy's style. One draw call for every galaxy; per-galaxy
 * placement (real sky position, position angle and inclination) and style
 * live in uniform arrays.
 *
 * One extra slot shows the selected survey or modelled galaxy up close,
 * styled from its catalogued morphological type.
 */

const STYLE_ID: Record<GalaxyVisual["style"] | "starburst", number> = {
  spiral: 0,
  barred: 1,
  elliptical: 2,
  sombrero: 3,
  ring: 4,
  irregular: 5,
  interacting: 6,
  lenticular: 7,
  starburst: 8,
};

const vertex = (slots: number, per: number) => /* glsl */ `
#define SLOTS ${slots}
#define PER ${per}
#define NORM ${(6000 / per).toFixed(5)}
uniform mat4 uFrameView[SLOTS]; // unit disk (diameter 1, xy plane) → view space, built on the CPU in double precision
uniform vec4 uStyle[SLOTS];     // style id, arms, tint (−1 cool … 1 warm), gain
uniform float uFocal;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;

uint rng;
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float rnd() { rng = pcg(rng); return float(rng) * 2.3283064365386963e-10; }
float gauss() { return sqrt(-2.0 * log(max(rnd(), 1e-7))) * cos(6.28318530718 * rnd()); }
float expo(float s) { return -log(max(rnd(), 1e-7)) * s; }
float truncExpo(float lo, float s, float hi) { return lo - s * log(1.0 - rnd() * (1.0 - exp(-(hi - lo) / s))); }
vec3 sphere() {
  float u = rnd() * 2.0 - 1.0;
  float phi = rnd() * 6.28318530718;
  float q = sqrt(1.0 - u * u);
  return vec3(q * cos(phi), q * sin(phi), u);
}

const vec3 OLD = vec3(1.0, 0.76, 0.5);
const vec3 DISK = vec3(1.0, 0.88, 0.72);
const vec3 YOUNG = vec3(0.5, 0.66, 1.0);
const vec3 HII = vec3(1.0, 0.38, 0.56);

void main() {
  int slot = gl_VertexID / PER;
  int local = gl_VertexID - slot * PER;
  vec4 st = uStyle[slot];
  vAlpha = 0.0;
  vSoft = 0.0;
  vColor = vec3(1.0);
  gl_PointSize = 1.0;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  if (st.w <= 0.001) return;

  int style = int(st.x + 0.5);
  float arms = max(st.y, 1.0);
  // Same seed per galaxy slot: its shape stays put.
  rng = pcg(uint(local) * 2654435761u + uint(slot) * 97u + 11u);
  float f = (float(local) + 0.5) / float(PER);

  // Budget split: soft glow, bulge, disk, arms (or ring / clumps / tails), star-forming knots.
  float glowF = 0.07;
  float bulgeF = style == 2 ? 0.93 : style == 7 ? 0.45 : style == 3 ? 0.5 : style == 5 || style == 8 ? 0.06 : style == 4 ? 0.14 : 0.2;
  float diskF = style == 2 ? 0.0 : style == 7 ? 0.48 : style == 3 ? 0.4 : style == 4 ? 0.14 : style == 5 || style == 8 ? 0.0 : 0.28;
  float knotF = style == 2 || style == 7 ? 0.0 : style == 8 ? 0.18 : style == 3 ? 0.01 : 0.05;

  vec3 p;
  vec3 col;
  float bright = 0.35 * exp(gauss() * 0.5);
  float soft = 0.0;
  float kind;                 // 0 glow, 1 bulge, 2 disk, 3 structure, 4 knot
  if (f < glowF) kind = 0.0;
  else if (f < glowF + bulgeF) kind = 1.0;
  else if (f < glowF + bulgeF + diskF) kind = 2.0;
  else if (f < 1.0 - knotF) kind = 3.0;
  else kind = 4.0;

  // Glow sprites follow the bulge, disk and arm light, so the structure carries into the haze.
  float gsel = kind == 0.0 ? rnd() : 1.0;
  bool glowBulge = kind == 0.0 && gsel < (style == 2 ? 1.0 : style == 7 || style == 3 ? 0.55 : 0.3);
  bool glowDisk = kind == 0.0 && !glowBulge && gsel < (style == 7 || style == 3 ? 1.0 : 0.62);
  if (kind == 1.0 || glowBulge) {
    float scale = style == 2 ? 0.075 : style == 3 ? 0.07 : style == 7 ? 0.06 : 0.04;
    float squash = style == 2 ? 0.6 + 0.35 * fract(float(slot) * 0.618) : style == 3 ? 0.55 : 0.7;
    vec3 d = sphere();
    float r = min(expo(scale), 0.5);
    p = vec3(d.xy, d.z * squash) * r;
    if (style == 6) p.x += rnd() < 0.5 ? -0.18 : 0.18;        // two nuclei
    if (style == 1 && rnd() < 0.5) p = vec3(gauss() * 0.1, gauss() * 0.025, gauss() * 0.02); // bar
    col = OLD;
  } else if (kind == 2.0 || glowDisk) {
    float r = truncExpo(0.0, style == 7 ? 0.1 : 0.14, 0.5);
    float phi = rnd() * 6.28318530718;
    p = vec3(cos(phi) * r, sin(phi) * r, gauss() * 0.012);
    col = mix(DISK, OLD, 0.4);
  } else {
    // Structure: spiral arms, a ring, clumps or tidal tails.
    if (style == 4) {
      float phi = rnd() * 6.28318530718;
      float r = 0.36 + gauss() * 0.025;
      p = vec3(cos(phi) * r, sin(phi) * r, gauss() * 0.01);
      col = YOUNG;
    } else if (style == 5 || style == 8) {
      uint mine = rng;
      rng = pcg(uint(floor(rnd() * 9.0)) + uint(slot) * 131u + 5u);
      vec3 c = vec3(gauss() * 0.16, gauss() * 0.12, gauss() * 0.04);
      float w = 0.03 + rnd() * 0.05;
      rng = mine;
      p = c + vec3(gauss(), gauss(), gauss() * 0.5) * w;
      col = mix(YOUNG, DISK, rnd() * 0.5);
    } else if (style == 6) {
      float t = rnd();
      float side = rnd() < 0.5 ? -1.0 : 1.0;
      float th = t * 3.3;
      float r = 0.1 + t * 0.4;
      p = vec3(side * (0.18 + cos(th) * r * 0.9), side * sin(th) * r, gauss() * 0.02) + vec3(gauss(), gauss(), gauss()) * (0.015 + 0.03 * t);
      col = mix(YOUNG, DISK, t);
    } else {
      float r0 = style == 1 ? 0.1 : 0.05;
      float r = truncExpo(r0, 0.16, 0.5);
      float k = floor(rnd() * arms);
      float tanP = style == 3 ? 0.12 : 0.24;
      float th = k * 6.28318530718 / arms + log(r / r0) / tanP + gauss() * (0.14 + 0.1 * r);
      float rr = r + gauss() * 0.018;
      p = vec3(cos(th) * rr, sin(th) * rr, gauss() * 0.01);
      col = mix(YOUNG, DISK, rnd() * 0.6);
    }
    if (kind == 4.0) {
      col = HII;
      bright = 0.9 + rnd();
    }
  }
  if (kind == 0.0) {
    soft = 1.0;
    col = mix(col, OLD, 0.3);
  }
  // Tint: warm = old population, cool = star-forming.
  col = mix(col, st.z > 0.0 ? OLD : YOUNG, abs(st.z) * 0.35);

  // Camera-relative: a galaxy billions of light-years out keeps full float precision.
  vec4 mv = uFrameView[slot] * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 1e-6);
  // Galaxy diameter on screen, px.
  float diameter = length(uFrameView[slot][0].xyz);
  float dpx = diameter * uFocal / depth;
  // Tiny on screen: the catalogue marker or survey dot stands in for it.
  float show = smoothstep(8.0, 30.0, dpx) * st.w;
  // Flying through it: individual clouds would smear across the screen.
  show *= smoothstep(diameter * 0.04, diameter * 0.25, depth);
  if (soft > 0.5) {
    // Adaptive kernel: sprites widen where the galaxy is sparse and fade to keep their light.
    float h = 0.04 + 0.28 * length(p.xy);
    float px = h * (0.85 + 0.3 * rnd()) * dpx;
    gl_PointSize = min(px, 64.0) * uPixelRatio;
    // More sprites (the close-up cloud) → each one fainter; the bulge's pile up, so dim them more.
    vAlpha = show * 0.06 * NORM * (glowBulge ? 0.4 : 1.0) * pow(0.04 / h, 1.6) * (1.0 - smoothstep(40.0, 64.0, px)) * clamp(px / 6.0, 0.0, 1.0);
    vSoft = 1.0;
  } else {
    // Share the galaxy's light between its points: small on screen, each one faint.
    float coverage = clamp(dpx * dpx / float(PER) * 0.22, 0.04, 1.0);
    // The bulge packs a fifth of the points into a small patch: keep it from burning out.
    float packing = kind == 1.0 ? (style == 2 ? 0.4 : 0.3) : 1.0;
    gl_PointSize = clamp(1.0 + bright * 1.4 * coverage, 1.0, 2.8) * uPixelRatio;
    vAlpha = show * min(1.0, bright) * coverage * 0.8 * packing;
  }
  vColor = col;
  if (vAlpha < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
void main() {
  vec2 c = (gl_PointCoord - 0.5) * 2.0;
  float r2 = dot(c, c);
  float a = (vSoft > 0.5 ? exp(-r2 * 3.5) * (1.0 - r2) : exp(-r2 * 4.0)) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

interface Slot {
  id: string;
  frame: Matrix4;
  style: Vector4;
}

/** Points per galaxy in the crowd, and in the close-up ("hero") cloud of whichever galaxy is largest on screen. */
function budgets(particles: number): { crowd: number; hero: number } {
  if (particles >= 300_000) return { crowd: 6_000, hero: 300_000 };
  if (particles >= 160_000) return { crowd: 4_000, hero: 200_000 };
  if (particles >= 80_000) return { crowd: 3_000, hero: 120_000 };
  return { crowd: 2_000, hero: 60_000 };
}

interface Cloud {
  points: Points;
  styles: Vector4[];
  /** Frames the cloud draws (shared with the slots, or the hero's own). */
  frames: Matrix4[];
  focal: { value: number };
  pixelRatio: { value: number };
  dispose: () => void;
}

function makeCloud(count: number, per: number, frames: Matrix4[]): Cloud {
  const n = count * per;
  const g = new BufferGeometry();
  // Positions are generated in the shader; one byte per point tells WebGL how many to draw.
  g.setAttribute("position", new BufferAttribute(new Uint8Array(Math.max(n, 1)), 1));
  g.setDrawRange(0, n);
  g.boundingSphere = new Sphere(new Vector3(), 1e9);
  g.boundingBox = new Box3(new Vector3(-1e9, -1e9, -1e9), new Vector3(1e9, 1e9, 1e9));
  const styles = frames.map(() => new Vector4(0, 2, 0, 0));
  const focal = { value: 1000 };
  const pixelRatio = { value: 1 };
  const m = new ShaderMaterial({
    vertexShader: vertex(Math.max(count, 1), per),
    fragmentShader: fragment,
    uniforms: {
      uFrameView: { value: frames.map(() => new Matrix4()) },
      uStyle: { value: styles },
      uFocal: focal,
      uPixelRatio: pixelRatio,
    },
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const p = new Points(g, m);
  p.frustumCulled = false;
  p.raycast = () => {};
  p.renderOrder = -3;
  // view × frame in float64 on the CPU, uploaded as float32 relative to the camera.
  // Done at draw time, so it uses this frame's final camera.
  p.onBeforeRender = (_r, _s, cam) => {
    const views = m.uniforms.uFrameView.value as Matrix4[];
    for (let i = 0; i < frames.length; i++) views[i].multiplyMatrices(cam.matrixWorldInverse, frames[i]);
  };
  return {
    points: p,
    styles,
    frames,
    focal,
    pixelRatio,
    dispose: () => {
      g.dispose();
      m.dispose();
    },
  };
}

/** A plausible look for a survey or modelled galaxy: typical diameter by type, seeded orientation. */
function pointGalaxyFrame(info: PointGalaxyInfo, out: Matrix4): Vector4 {
  const typical = { elliptical: 0.12, lenticular: 0.08, spiral: 0.1, irregular: 0.03, starburst: 0.04 }[info.style];
  const diameter = info.diameterLy ? info.diameterLy / 1e6 : typical;
  const h = (k: number) => {
    const x = Math.sin(info.index * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const q = new Quaternion().setFromAxisAngle(new Vector3(h(1) - 0.5, h(2) - 0.5, h(3) - 0.5).normalize(), h(4) * Math.PI * 2);
  out.compose(info.position, q, new Vector3(diameter, diameter, diameter));
  const style = info.style === "elliptical" ? STYLE_ID.elliptical : info.style === "lenticular" ? STYLE_ID.lenticular : info.style === "irregular" ? STYLE_ID.irregular : info.style === "starburst" ? STYLE_ID.starburst : h(5) < 0.35 ? STYLE_ID.barred : STYLE_ID.spiral;
  return new Vector4(style, h(6) < 0.7 ? 2 : 3, info.style === "elliptical" || info.style === "lenticular" ? 0.6 : -0.3, 1);
}

interface GalaxyCloudsProps {
  objects: CatalogObject[];
  /** Level units per catalog unit (1 in the Universe view, 1e6 in light-years). */
  unitScale: number;
  gain?: (cameraPosition: Vector3) => number;
  /** Add a slot for the selected survey / modelled galaxy (Universe view). */
  pointSlot?: boolean;
}

export function GalaxyClouds({ objects, unitScale, gain, pointSlot = false }: GalaxyCloudsProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const particles = useGraphicsStore((g) => g.galaxyParticles);
  const budget = budgets(particles);

  const slots = useMemo<Slot[]>(() => {
    const out: Slot[] = [];
    for (const o of objects) {
      const v = o.visual;
      if (v?.type !== "galaxy") continue;
      const size = o.extent * unitScale;
      const { major, minor, normal } = diskBasis(v.ra, v.dec, v.positionAngleDeg, v.inclinationDeg);
      const frame = new Matrix4()
        .makeBasis(major, minor, normal)
        .scale(new Vector3(size, size, size))
        .setPosition(o.position.clone().multiplyScalar(unitScale));
      const tint = v.tint === "warm" ? 0.6 : v.tint === "cool" ? -0.6 : 0;
      out.push({ id: o.id, frame, style: new Vector4(STYLE_ID[v.style], v.arms ?? 2, tint, 1) });
    }
    if (pointSlot) out.push({ id: "", frame: new Matrix4(), style: new Vector4(0, 2, 0, 0) });
    return out;
  }, [objects, unitScale, pointSlot]);

  // Every galaxy at a small budget, plus one detailed cloud for the one filling the view.
  const crowd = useMemo(() => makeCloud(slots.length, budget.crowd, slots.map((s) => s.frame)), [slots, budget.crowd]);
  const hero = useMemo(() => makeCloud(1, budget.hero, [new Matrix4()]), [budget.hero]);
  useEffect(() => () => crowd.dispose(), [crowd]);
  useEffect(() => () => hero.dispose(), [hero]);

  const at = useMemo(() => new Vector3(), []);
  const centre = useMemo(() => new Vector3(), []);
  useFrame(({ size, gl }) => {
    const focal = size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
    const ratio = Math.min(gl.getPixelRatio(), 1.5);
    for (const c of [crowd, hero]) {
      c.focal.value = focal;
      c.pixelRatio.value = ratio;
    }
    const g = gain ? gain(camera.position) : 1;
    for (const s of slots) {
      if (!s.id) continue;
      // Seen from Earth, the real photograph replaces the modelled galaxy.
      s.style.w = g * (1 - photoWeight(s.id));
    }
    if (pointSlot) {
      const slot = slots[slots.length - 1];
      const id = useSelectionStore.getState().selectedId;
      const info = isPointGalaxyId(id) && pointGalaxyPosition(id, at) ? pointGalaxyInfo(id) : null;
      if (info && slot.id !== id) {
        slot.style.copy(pointGalaxyFrame(info, slot.frame));
        slot.id = id!;
      }
      if (!info) {
        slot.style.w = 0;
        slot.id = "";
      } else slot.style.w = g;
    }

    // The galaxy largest on screen gets the detailed cloud; the crowd hands it over smoothly.
    let best = -1;
    let bestPx = 0;
    slots.forEach((s, i) => {
      if (s.style.w <= 0.001) return;
      centre.setFromMatrixPosition(s.frame);
      const e = s.frame.elements;
      const diameter = Math.hypot(e[0], e[1], e[2]);
      const px = (diameter * focal) / Math.max(centre.distanceTo(camera.position), 1e-9);
      if (px > bestPx) {
        bestPx = px;
        best = i;
      }
    });
    const handover = smoothstep(60, 140, bestPx);
    slots.forEach((s, i) => {
      crowd.styles[i].copy(s.style);
      if (i === best) crowd.styles[i].w *= 1 - handover;
    });
    if (best >= 0 && handover > 0.001) {
      hero.styles[0].copy(slots[best].style);
      hero.styles[0].w *= handover;
      hero.frames[0].copy(slots[best].frame);
    } else hero.styles[0].w = 0;
    crowd.points.visible = crowd.styles.some((s) => s.w > 0.001);
    hero.points.visible = hero.styles[0].w > 0.001;
  });

  return (
    <>
      <primitive object={crowd.points} />
      <primitive object={hero.points} />
    </>
  );
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
