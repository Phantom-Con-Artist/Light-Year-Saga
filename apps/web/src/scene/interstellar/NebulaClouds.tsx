import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, Box3, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Sphere, Vector3, type PerspectiveCamera, type Texture } from "three";
import { skyPlaneBasis } from "../../astronomy/sky";
import { photoSize, type CatalogObject } from "../../data/catalog";
import { useGraphicsStore } from "../../state/graphicsStore";
import { loadTexture } from "../realTextures";
import { shimmerChunk } from "../twinkle";

/**
 * Nebulae as GPU point clouds shaped by their real photographs.
 *
 * Each nebula is one THREE.Points draw placed from the photo's astrometry (true
 * position, size and orientation as seen from Earth). The vertex shader
 * importance-samples the photo: every point draws candidate spots and keeps one
 * with probability ∝ its brightness, taking the photo's colour there. So from
 * afar the cloud reproduces the observed shape; up close, points sampled from
 * finer mip levels resolve filaments, and the brightest peaks become stars
 * with their own glow. Depth along the line of sight is not observable in a
 * photograph and is modelled (a smooth, seeded relief).
 *
 * Cost: frustum-culled per nebula, and the drawn point count follows the
 * nebula's size on screen (a distant one is ~1,000 points, a close one up to
 * the tier budget), with each point's light scaled so the total stays constant.
 */

const vertex = /* glsl */ `
uniform sampler2D uMap;
uniform float uBlack;
uniform float uCount;       // points drawn now
uniform float uFocal;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uTime;
uniform float uTwinkle;
uniform float uSeed;
uniform float uWorldSize;   // largest photo side (world units)
varying vec3 vColor;
varying float vAlpha;
varying float vStar;
${shimmerChunk}

uint rng;
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float rnd() { rng = pcg(rng); return float(rng) * 2.3283064365386963e-10; }
float gauss() { return sqrt(-2.0 * log(max(rnd(), 1e-7))) * cos(6.28318530718 * rnd()); }
/**
 * Isotropic 3D scatter with a solid core: a random direction times an
 * exponential radius. (Three chained Box–Muller normals collapse to planes
 * after D3D shader translation, so they're avoided.)
 */
vec3 gauss3() {
  float u = rnd() * 2.0 - 1.0;
  float phi = rnd() * 6.28318530718;
  float q = sqrt(1.0 - u * u);
  float r = -log(max(rnd(), 1e-7)) * 0.8;
  return vec3(q * cos(phi), q * sin(phi), u) * r;
}
float cellHash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
float smoothNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cellHash(i), cellHash(i + vec2(1, 0)), f.x), mix(cellHash(i + vec2(0, 1)), cellHash(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vAlpha = 0.0;
  vStar = 0.0;
  vColor = vec3(0.0);
  gl_PointSize = 1.0;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  rng = pcg(uint(gl_VertexID) * 2654435761u + uint(uSeed * 1000.0));

  // What this point is: mostly gas, some fine filament detail, a few stars.
  float kindR = rnd();
  bool star = kindR < 0.035;
  bool fine = !star && kindR < 0.3;
  // Coarse mips give the overall shape, fine mips the filaments.
  float lod = star ? 1.0 : fine ? 1.5 : 3.5;
  float power = star ? 6.0 : fine ? 1.6 : 1.0;

  vec2 uv = vec2(0.5);
  vec3 col = vec3(0.0);
  float lum = 0.0;
  bool found = false;
  for (int i = 0; i < 6; i++) {
    vec2 c = vec2(rnd(), rnd());
    vec3 t = max(textureLod(uMap, c, lod).rgb - uBlack, 0.0);
    float l = dot(t, vec3(0.3, 0.55, 0.15));
    // Keep it with probability ∝ brightness (a soft edge vignette hides the frame).
    vec2 e = smoothstep(vec2(0.0), vec2(0.06), c) * smoothstep(vec2(1.0), vec2(0.94), c);
    if (!found && rnd() < pow(min(l * 2.2, 1.0), power) * e.x * e.y) {
      uv = c;
      col = t;
      lum = l;
      found = true;
    }
  }
  if (!found) return;

  // Modelled depth: a smooth seeded relief plus thickness, thinner where it's bright.
  float relief = (smoothNoise(uv * 4.0) - 0.5) * 0.35 + (smoothNoise(uv * 11.0) - 0.5) * 0.1;
  float z = relief + gauss() * (star ? 0.12 : 0.05 + 0.08 * (1.0 - min(lum * 2.0, 1.0)));
  // Sub-texel jitter so close up the points don't sit on a grid.
  vec3 p = vec3(uv - 0.5, z) + vec3(gauss3().xy, 0.0) * (fine ? 0.0015 : 0.004);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 1e-6);
  float spacing = uWorldSize / sqrt(uCount);        // mean distance between points
  float px;
  if (star) {
    // Stars: own glow, size from brightness; a minority twinkle strongly.
    float tw = shimmer(uint(gl_VertexID), uTime, uTwinkle * 1.6);
    px = clamp(1.4 + 3.0 * lum * uFocal * uWorldSize / depth / 400.0, 1.4, 7.0);
    col = mix(col, vec3(1.0), 0.6) / max(max(col.r, col.g), max(col.b, 0.2));
    vAlpha = uOpacity * min(1.0, lum * 3.0) * tw;
    vStar = 1.0;
  } else {
    // Gas sprites overlap into a continuous glow; fine points stay small and sharp.
    px = (fine ? 0.6 : 2.6) * spacing * uFocal / depth;
    float cap = fine ? 4.0 : 48.0;
    // Each point carries its share of the light: more points, fainter each.
    float share = clamp(1500.0 / uCount, 0.02, 1.0) * (fine ? 0.5 : 1.0);
    vAlpha = uOpacity * share * (1.0 - smoothstep(cap * 0.6, cap, px)) * smoothstep(0.5, 1.5, px) * 1.1;
    px = min(px, cap);
    col /= max(lum, 0.05);                          // hue from the photo; brightness from density
    col = min(col, vec3(2.0)) * 0.5;
  }
  // Flying through the cloud: fade the nearest points.
  vAlpha *= smoothstep(uWorldSize * 0.015, uWorldSize * 0.12, depth);
  gl_PointSize = max(px, 1.0) * uPixelRatio;
  vColor = col;
  if (vAlpha < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vStar;
void main() {
  vec2 c = (gl_PointCoord - 0.5) * 2.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float a = vStar > 0.5 ? exp(-r2 * 7.0) + exp(-r2 * 2.0) * 0.25 : exp(-r2 * 2.2) * (1.0 - r2) * (1.0 - r2);
  a *= vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

function budget(particles: number): number {
  return particles >= 300_000 ? 160_000 : particles >= 160_000 ? 100_000 : particles >= 80_000 ? 60_000 : 30_000;
}

interface Cloud {
  id: string;
  points: Points;
  material: ShaderMaterial;
  centre: Vector3;
  size: number;
  file: string;
}

/** Real nebulae (those with a photograph) as photo-shaped point clouds. */
export function NebulaClouds({ objects }: { objects: CatalogObject[] }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const particles = useGraphicsStore((g) => g.galaxyParticles);
  const max = budget(particles);

  const clouds = useMemo<Cloud[]>(
    () =>
      objects
        .filter((o) => o.photo)
        .map((obj, k) => {
          const p = obj.photo!;
          const distance = obj.position.length();
          const [width, height] = photoSize(p, distance);
          const { right, up, normal } = skyPlaneBasis(p.ra, p.dec, p.northDeg);
          const centre = normal.clone().negate().multiplyScalar(distance);
          if (p.anchor) {
            centre.copy(obj.position);
            centre.addScaledVector(right, -(p.anchor[0] - 0.5) * width).addScaledVector(up, -(0.5 - p.anchor[1]) * height);
          }
          const size = Math.max(width, height);
          const g = new BufferGeometry();
          // Positions come from the shader; one byte per point sets the count.
          g.setAttribute("position", new BufferAttribute(new Uint8Array(max), 1));
          // Bounds in the unit frame, so three.js frustum-culls each nebula.
          g.boundingSphere = new Sphere(new Vector3(), 0.9);
          g.boundingBox = new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5));
          const material = new ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: fragment,
            uniforms: {
              uMap: { value: null },
              uBlack: { value: p.black ?? 0.02 },
              uCount: { value: 1000 },
              uFocal: { value: 1000 },
              uPixelRatio: { value: 1 },
              uOpacity: { value: 0 },
              uTime: { value: 0 },
              uTwinkle: { value: 0.5 },
              uSeed: { value: k * 1.37 + 0.5 },
              uWorldSize: { value: size },
            },
            transparent: true,
            blending: AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          });
          const points = new Points(g, material);
          points.matrixAutoUpdate = false;
          // Photo plane (right, up) with a modelled depth along the line of sight.
          points.matrix.makeBasis(right, up, normal).scale(new Vector3(width, height, size * 0.6)).setPosition(centre);
          points.renderOrder = -2;
          points.raycast = () => {};
          points.visible = false;
          return { id: obj.id, points, material, centre, size, file: p.file };
        }),
    [objects, max],
  );

  useEffect(() => {
    let live = true;
    for (const c of clouds)
      loadTexture(c.file, 1).then(
        (t: Texture) => {
          if (live) c.material.uniforms.uMap.value = t;
        },
        () => {},
      );
    return () => {
      live = false;
      for (const c of clouds) {
        c.points.geometry.dispose();
        c.material.dispose();
      }
    };
  }, [clouds]);

  useFrame(({ size, clock }) => {
    const focal = size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
    const g = useGraphicsStore.getState();
    for (const c of clouds) {
      const u = c.material.uniforms;
      const d = camera.position.distanceTo(c.centre);
      const px = (c.size * focal) / Math.max(d, 1e-9);
      // Adaptive LOD: points ∝ screen area, from ~1,000 (a smudge) to the budget.
      const n = Math.round(Math.min(max, Math.max(1000, px * px * 0.6)));
      c.points.geometry.setDrawRange(0, n);
      u.uCount.value = n;
      u.uFocal.value = focal;
      u.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
      u.uTime.value = clock.elapsedTime;
      u.uTwinkle.value = g.twinkle ? g.twinkleStrength : 0;
      // Too small to matter (< 6 px), or not loaded yet: skip the draw entirely.
      u.uOpacity.value = Math.min(1, Math.max(0, (px - 6) / 30)) * g.starBrightness;
      c.points.visible = !!u.uMap.value && u.uOpacity.value > 0.002;
    }
  });

  return (
    <>
      {clouds.map((c) => (
        <primitive key={c.id} object={c.points} />
      ))}
    </>
  );
}
