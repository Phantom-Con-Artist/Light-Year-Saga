import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial, Sphere, Vector3, type PerspectiveCamera } from "three";
import type { CatalogObject } from "../../data/catalog";
import { useGraphicsStore } from "../../state/graphicsStore";
import { shimmerChunk } from "../twinkle";

/**
 * Clusters, walls, voids, quasars and the edge of the observable universe as
 * procedural 3D point clouds anchored on their catalogued positions and sizes.
 * No images or textures: every point is generated here from the object's
 * physical model, then drawn with a shader glow (one draw per object type,
 * each frustum-culled, sizes in world units so detail grows as you approach).
 *
 * - Clusters: member galaxies with an NFW-like profile (dense core, extended
 *   halo), early types dominating (morphology–density relation), plus wide
 *   faint sprites for the hot intracluster gas.
 * - Walls (e.g. the Great Wall): a curved sheet laced with filaments and knots.
 * - Voids: galaxies thinning toward the centre, piled up on the bounding shell.
 * - Quasars: a point-like core, host galaxy and two relativistic jets.
 * - The observable universe: the last-scattering surface as a shell of points.
 */

type Kind = "cluster" | "structure" | "void" | "quasar" | "edge";

const vertex = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;     // world diameter; 0 = a pixel-sized point
attribute float aAlpha;
uniform float uFocal;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uTime;
uniform float uTwinkle;
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
${shimmerChunk}
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 1e-6);
  float px = aSize > 0.0 ? aSize * uFocal / depth : 1.6;
  float sh = aSize > 0.0 ? 1.0 : shimmer(uint(gl_VertexID), uTime, uTwinkle);
  // Soft gas sprites fade out when huge (flying through them); points fade in with size.
  float fade = aSize > 0.0 ? (1.0 - smoothstep(60.0, 110.0, px)) * smoothstep(1.0, 4.0, px) : 1.0;
  gl_PointSize = clamp(px, 1.0, 110.0) * sqrt(sh) * uPixelRatio;
  vSoft = aSize > 0.0 ? 1.0 : 0.0;
  vAlpha = aAlpha * uOpacity * fade * sh;
  vColor = aColor;
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
  if (r2 > 1.0) discard;
  float a = (vSoft > 0.5 ? exp(-r2 * 3.0) * (1.0 - r2) : exp(-r2 * 5.0)) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (id: string) => [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

class Builder {
  pos: number[] = [];
  col: number[] = [];
  size: number[] = [];
  alpha: number[] = [];
  push(p: Vector3, c: Color, size: number, alpha: number) {
    this.pos.push(p.x, p.y, p.z);
    this.col.push(c.r, c.g, c.b);
    this.size.push(size);
    this.alpha.push(alpha);
  }
}

const GOLD = new Color("#ffd9a0");
const RED_SEQ = new Color("#ffc890");
const BLUE = new Color("#b8c8ff");
const GAS = new Color("#ff9f6a");
const VOID = new Color("#8a96ff");
const EDGE = new Color("#ff9ec7");
const JET = new Color("#9fd4ff");

function generate(o: CatalogObject, b: Builder, scale: number) {
  const rand = mulberry32(seedOf(o.id));
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(2 * Math.PI * rand());
  const dir = () => {
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return new Vector3(s * Math.cos(phi), s * Math.sin(phi), u);
  };
  const R = o.extent / 2;
  const c = o.position;
  const p = new Vector3();
  const col = new Color();

  if (o.kind === "cluster") {
    const n = Math.round(700 * scale);
    const rs = R * 0.18;
    for (let i = 0; i < n; i++) {
      // NFW-like: r = rs · x/(1−x)-ish, capped at the virial radius.
      const u = rand() * 0.92;
      const r = Math.min(R, rs * (u / (1 - u)) ** 0.9);
      p.copy(dir()).multiplyScalar(r).add(c);
      const early = rand() < 0.75 - 0.4 * (r / R);
      col.copy(early ? RED_SEQ : BLUE).multiplyScalar(0.8 + 0.4 * rand());
      b.push(p, col, 0, 0.55 + 0.45 * rand());
    }
    // A brightest cluster galaxy at the centre, and the hot gas halo (X-ray gas).
    b.push(c.clone(), GOLD, R * 0.08, 0.9);
    for (let i = 0; i < 40 * scale; i++) {
      p.copy(dir()).multiplyScalar(Math.abs(gauss()) * R * 0.35).add(c);
      b.push(p, GAS, R * (0.35 + 0.3 * rand()), 0.035);
    }
  } else if (o.kind === "structure") {
    // A wall: a gently curved sheet, laced with filaments and knots.
    const n = Math.round(2500 * scale);
    const e1 = dir();
    const e2 = dir().cross(e1).normalize();
    const e3 = e1.clone().cross(e2);
    const knots = Array.from({ length: 14 }, () => [(rand() * 2 - 1) * R, (rand() * 2 - 1) * R * 0.35]);
    for (let i = 0; i < n; i++) {
      let a: number, bb: number;
      if (rand() < 0.45) {
        const k = knots[Math.floor(rand() * knots.length)];
        a = k[0] + gauss() * R * 0.04;
        bb = k[1] + gauss() * R * 0.04;
      } else if (rand() < 0.6) {
        // Filaments between knots.
        const k1 = knots[Math.floor(rand() * knots.length)];
        const k2 = knots[Math.floor(rand() * knots.length)];
        const t = rand();
        a = k1[0] + (k2[0] - k1[0]) * t + gauss() * R * 0.012;
        bb = k1[1] + (k2[1] - k1[1]) * t + gauss() * R * 0.012;
      } else {
        a = (rand() * 2 - 1) * R;
        bb = gauss() * R * 0.25;
      }
      const bend = 0.15 * R * Math.cos((a / R) * 1.4);
      p.copy(c).addScaledVector(e1, a).addScaledVector(e2, bb).addScaledVector(e3, bend + gauss() * R * 0.02);
      col.copy(rand() < 0.5 ? GOLD : BLUE).multiplyScalar(0.7 + 0.5 * rand());
      b.push(p, col, 0, 0.35 + 0.4 * rand());
    }
  } else if (o.kind === "void") {
    // Few galaxies inside, many on the rim: density rises steeply toward the wall.
    const n = Math.round(1500 * scale);
    for (let i = 0; i < n; i++) {
      const inside = rand() < 0.12;
      const r = inside ? R * Math.cbrt(rand()) * 0.85 : R * (1 + gauss() * 0.04);
      p.copy(dir()).multiplyScalar(r).add(c);
      col.copy(inside ? BLUE : VOID).multiplyScalar(0.7 + 0.4 * rand());
      b.push(p, col, 0, inside ? 0.5 : 0.22);
    }
  } else if (o.kind === "quasar") {
    const size = o.framing * 0.05;
    b.push(c.clone(), new Color("#eaf6ff"), size * 0.25, 1);
    for (let i = 0; i < 160 * scale; i++) {
      p.copy(dir()).multiplyScalar(Math.abs(gauss()) * size * 0.4).add(c);
      b.push(p, RED_SEQ, 0, 0.5);
    }
    const axis = dir();
    for (let i = 0; i < 260 * scale; i++) {
      const t = rand() ** 1.5 * size * 3;
      const side = rand() < 0.5 ? -1 : 1;
      p.copy(axis).multiplyScalar(side * t).add(c).addScaledVector(dir(), t * 0.04);
      b.push(p, JET, 0, 0.7 * (1 - t / (size * 3)));
    }
  } else if (o.id === "observable-universe") {
    // The last-scattering surface, 46.5 billion ly away in every direction.
    const n = Math.round(9000 * scale);
    for (let i = 0; i < n; i++) {
      p.copy(dir()).multiplyScalar(R * (1 + gauss() * 0.004));
      col.copy(EDGE).multiplyScalar(0.7 + 0.5 * rand());
      b.push(p, col, 0, 0.35);
    }
  }
}

function kindOf(o: CatalogObject): Kind | null {
  if (o.id === "observable-universe") return "edge";
  if (o.kind === "cluster" || o.kind === "structure" || o.kind === "void" || o.kind === "quasar") return o.kind;
  return null;
}

export function StructureClouds({ objects }: { objects: CatalogObject[] }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const particles = useGraphicsStore((g) => g.galaxyParticles);
  const scale = particles >= 160_000 ? 1.5 : particles >= 80_000 ? 1 : 0.6;

  const clouds = useMemo(() => {
    const out: { points: Points; material: ShaderMaterial; kind: Kind }[] = [];
    // One draw per object: three.js frustum-culls each from its bounding sphere.
    for (const o of objects) {
      const kind = kindOf(o);
      if (!kind) continue;
      const b = new Builder();
      generate(o, b, scale);
      if (!b.alpha.length) continue;
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(b.pos), 3));
      g.setAttribute("aColor", new BufferAttribute(new Float32Array(b.col), 3));
      g.setAttribute("aSize", new BufferAttribute(new Float32Array(b.size), 1));
      g.setAttribute("aAlpha", new BufferAttribute(new Float32Array(b.alpha), 1));
      g.boundingSphere = new Sphere(o.position.clone(), kind === "quasar" ? o.framing * 0.2 : (o.extent / 2) * 1.2);
      const material = new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uFocal: { value: 1000 }, uPixelRatio: { value: 1 }, uOpacity: { value: 1 }, uTime: { value: 0 }, uTwinkle: { value: 0 } },
        transparent: true,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const points = new Points(g, material);
      // The edge surrounds the camera: never culled.
      points.frustumCulled = kind !== "edge";
      points.raycast = () => {};
      out.push({ points, material, kind });
    }
    return out;
  }, [objects, scale]);
  useEffect(
    () => () => {
      for (const c of clouds) {
        c.points.geometry.dispose();
        c.material.dispose();
      }
    },
    [clouds],
  );

  const tmp = useMemo(() => new Vector3(), []);
  useFrame(({ size }) => {
    const focal = size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
    const g = useGraphicsStore.getState();
    const t = performance.now() / 1000;
    for (const c of clouds) {
      const u = c.material.uniforms;
      u.uFocal.value = focal;
      u.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
      u.uTime.value = t;
      u.uTwinkle.value = g.twinkle ? g.twinkleStrength * 1.6 : 0;
      const s = c.points.geometry.boundingSphere!;
      // A void or wall seen from inside or right up close just scatters dots over the view: fade it.
      const d = tmp.copy(camera.position).distanceTo(s.center);
      u.uOpacity.value = c.kind === "edge" ? Math.min(1, Math.max(0, (camera.position.length() - 8_000) / 20_000)) : c.kind === "void" || c.kind === "structure" ? Math.min(1, Math.max(0, (d - s.radius * 0.2) / s.radius)) : 1;
      c.points.visible = u.uOpacity.value > 0.003;
    }
  });

  return (
    <>
      {clouds.map((c, i) => (
        <primitive key={i} object={c.points} />
      ))}
    </>
  );
}
