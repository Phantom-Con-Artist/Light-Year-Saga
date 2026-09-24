import {
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";
import type { GalaxyVisual } from "../../data/catalog";
import { bakeVertex } from "../shaders";

/**
 * Face-on appearance of a galaxy by morphology, in normalised disk
 * coordinates (edge of the stellar disk at r = 1). Baked once per galaxy.
 * These are illustrations from morphology, not photographs.
 */
const fragment = /* glsl */ `
uniform float uStyle;   // 0 spiral 1 barred 2 elliptical 3 sombrero 4 ring 5 irregular 6 interacting 7 lenticular
uniform float uArms;
uniform float uTanP;
uniform float uWarm;    // 0 cool/star-forming … 1 old/golden
uniform float uSeed;
varying vec2 vUv;

const float PI = 3.14159265359;
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise2(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
float fbm2(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise2(p); p = p * 2.03 + 7.3; a *= 0.5; }
  return v;
}

// Round star-forming knots scattered on a jittered grid (density = cells per unit).
float knots(vec2 p, float density, float threshold, float size) {
  vec2 cell = floor(p * density + uSeed);
  vec2 centre = (cell + vec2(hash2(cell + 3.1), hash2(cell + 7.7)) - uSeed) / density;
  vec2 d = p - centre;
  return step(threshold, hash2(cell)) * exp(-dot(d, d) / (size * size));
}

// m-armed logarithmic spiral density in [0,1].
float spiral(vec2 p, float r, float m, float tanP, float sharp) {
  float th = atan(p.y, p.x);
  float phase = m * (th - log(max(r, 0.02)) / tanP);
  return pow(0.5 + 0.5 * cos(phase), sharp);
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  vec2 q = p * 3.0 + uSeed;
  float clump = fbm2(q * 2.0);
  float fine = fbm2(q * 7.0);

  vec3 oldCol = mix(vec3(0.95, 0.9, 0.85), vec3(1.0, 0.82, 0.58), uWarm);
  vec3 youngCol = vec3(0.6, 0.74, 1.0);
  vec3 hiiCol = vec3(1.0, 0.4, 0.62);
  vec3 col = vec3(0.0);
  float edge = smoothstep(1.0, 0.75, r);

  if (uStyle < 1.5) {                       // spiral / barred
    float bulge = exp(-r / 0.07) * 1.6 + exp(-r / 0.18) * 0.5;
    float disk = exp(-r / 0.32) * edge;
    float inner = uStyle > 0.5 ? 0.28 : 0.12;
    float arms = spiral(p, r, uArms, uTanP, 3.0) * smoothstep(inner * 0.8, inner * 1.6, r) * edge;
    arms *= 0.4 + 1.0 * clump;
    // Shift dust slightly inside the arm crest.
    float th = atan(p.y, p.x);
    float dustLane = pow(0.5 + 0.5 * cos(uArms * (th + 0.18 - log(max(r, 0.02)) / uTanP)), 14.0) * smoothstep(0.1, 0.3, r) * edge;
    float bar = 0.0;
    if (uStyle > 0.5) bar = exp(-pow(abs(p.x) / 0.3, 2.5) - pow(abs(p.y) / 0.07, 2.0));
    float hii = knots(p, 26.0, 0.72, 0.012) * arms;
    col = oldCol * (bulge + disk * 0.45 + bar * 0.9)
        + youngCol * arms * (0.5 + 0.6 * (1.0 - uWarm))
        + hiiCol * hii * 0.9;
    col *= 1.0 - 0.55 * dustLane * (0.5 + fine);
    col *= 0.85 + 0.3 * fine;
  } else if (uStyle < 2.5) {                // elliptical (smooth, core-concentrated)
    float s = pow(max(r, 0.001), 0.25);
    float light = exp(-7.67 * (s - 1.0)) * 0.0022;
    col = oldCol * clamp(light, 0.0, 2.2) * smoothstep(1.0, 0.6, r);
  } else if (uStyle < 3.5) {                // sombrero / dusty lenticular
    float bulge = exp(-r / 0.16) * 1.3;
    float disk = exp(-r / 0.4) * edge * 0.5;
    float ring = exp(-pow((r - 0.78) / 0.07, 2.0));
    col = oldCol * (bulge + disk) + vec3(0.9, 0.85, 0.8) * ring * 0.35;
    float dust = exp(-pow((r - 0.72) / 0.09, 2.0)) * (0.6 + 0.6 * fine);
    col *= 1.0 - 0.75 * clamp(dust, 0.0, 1.0);
  } else if (uStyle < 4.5) {                // ring
    float core = exp(-r / 0.06) * 1.4;
    float ring = exp(-pow((r - 0.78) / 0.07, 2.0)) * (0.5 + clump);
    float spokes = spiral(p, r, 5.0, 3.0, 6.0) * smoothstep(0.15, 0.3, r) * smoothstep(0.7, 0.5, r) * 0.25;
    float hii = knots(p, 30.0, 0.6, 0.012) * ring;
    col = oldCol * core + youngCol * (ring + spokes) + hiiCol * hii;
  } else if (uStyle < 5.5) {                // irregular
    vec2 w = p + 0.25 * vec2(fbm2(q), fbm2(q + 4.0)) - 0.12;
    float rr = length(w * vec2(1.0, 1.35));
    float body = exp(-rr / 0.3) * (0.4 + 1.1 * clump);
    float bar = exp(-pow(abs(w.x + 0.05) / 0.35, 2.0) - pow(abs(w.y) / 0.09, 2.0)) * 0.6;
    float blobs = knots(p, 22.0, 0.7, 0.016) * body;
    col = mix(youngCol, oldCol, 0.35) * (body + bar) + hiiCol * blobs * 1.2;
    col *= smoothstep(1.0, 0.65, r);
  } else if (uStyle < 6.5) {                // interacting pair with tidal tails
    vec2 a = p - vec2(-0.18, 0.05), b = p - vec2(0.16, -0.06);
    float cores = exp(-length(a) / 0.07) + exp(-length(b) / 0.06);
    float bodies = exp(-length(a) / 0.2) + exp(-length(b) / 0.18);
    float tail1 = exp(-pow((length(p - vec2(-0.2, -0.55)) - 0.62) / 0.05, 2.0)) * smoothstep(-0.2, 0.4, p.x) * step(p.y, 0.2);
    float tail2 = exp(-pow((length(p - vec2(0.25, 0.6)) - 0.65) / 0.05, 2.0)) * smoothstep(0.2, -0.4, p.x) * step(-0.2, p.y);
    float blobs = knots(p, 24.0, 0.68, 0.014) * bodies;
    col = oldCol * cores * 1.2 + youngCol * (bodies * 0.6 + (tail1 + tail2) * 0.35) * (0.5 + clump) + hiiCol * blobs * 1.3;
  } else {                                  // lenticular
    col = oldCol * (exp(-r / 0.12) * 1.3 + exp(-r / 0.35) * edge * 0.6);
  }

  // Nothing may reach the quad corners, or the square would show.
  col *= smoothstep(1.0, 0.88, r);
  gl_FragColor = vec4(col * 0.4, 1.0);
}
`;

const STYLE_INDEX: Record<GalaxyVisual["style"], number> = {
  spiral: 0,
  barred: 1,
  elliptical: 2,
  sombrero: 3,
  ring: 4,
  irregular: 5,
  interacting: 6,
  lenticular: 7,
};

const cache = new Map<string, WebGLRenderTarget>();
const quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

export function bakeGalaxyTexture(gl: WebGLRenderer, id: string, visual: GalaxyVisual, size = 512): Texture {
  const cached = cache.get(id);
  if (cached) return cached.texture;
  const target = new WebGLRenderTarget(size, size, {
    colorSpace: SRGBColorSpace,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
  let seed = 0;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 1000;
  const material = new ShaderMaterial({
    vertexShader: bakeVertex,
    fragmentShader: fragment,
    uniforms: {
      uStyle: { value: STYLE_INDEX[visual.style] },
      uArms: { value: visual.arms ?? 2 },
      uTanP: { value: Math.tan((visual.style === "barred" ? 18 : 14) * (Math.PI / 180)) },
      uWarm: { value: visual.tint === "warm" ? 0.9 : visual.tint === "cool" ? 0.15 : 0.5 },
      uSeed: { value: seed / 37 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  gl.render(scene, quadCamera);
  gl.setRenderTarget(previous);
  material.dispose();
  geometry.dispose();
  cache.set(id, target);
  return target.texture;
}
