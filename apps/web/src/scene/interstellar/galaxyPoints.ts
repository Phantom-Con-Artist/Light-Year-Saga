import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  Points,
  ShaderMaterial,
  Sphere,
  SrcColorFactor,
  Vector3,
  ZeroFactor,
  type IUniform,
} from "three";
import { ARMS, BAR_ANGLE, ORION_SPUR, PITCH_TAN } from "./galaxyModel";

/**
 * The Milky Way as pure GPU point clouds. Nothing is generated on the CPU and
 * no per-point data is uploaded: every vertex hashes its own index
 * (gl_VertexID) into a random stream and draws its position, colour and
 * brightness from the same published structure as galaxyModel.ts — bar and
 * bulge, four logarithmic arms plus the Orion Spur, old thin/thick disk,
 * halo and ~150 globular clusters. Every sampler is closed-form (inverse
 * CDFs, Box–Muller), so a point costs a few hundred ALU ops per frame and
 * one byte of vertex memory, whatever the budget.
 *
 * Four layers share the generator: resolved stars, soft sprites for the
 * unresolved starlight between them, absorbing dust and glowing gas.
 */

export type GalaxyLayerKind = "stars" | "glow" | "dust" | "gas";
const KIND_ID: Record<GalaxyLayerKind, number> = { stars: 0, glow: 1, dust: 2, gas: 3 };

const generator = /* glsl */ `
uniform vec4 uArmR;
uniform vec4 uArmS;
uniform float uTanP;
uniform float uBarAngle;
uniform vec3 uSpur;        // radiusAtSun, strength, halfSpan
uniform vec3 uSun;         // galactocentric (ly)
uniform float uExclude;    // real stars cover this radius around the Sun
uniform float uCount;

const float PI = 3.14159265359;
uint rng;
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float rnd() { rng = pcg(rng); return float(rng) * 2.3283064365386963e-10; }
float gauss() { return sqrt(-2.0 * log(max(rnd(), 1e-7))) * cos(6.28318530718 * rnd()); }
float expo(float s) { return -log(max(rnd(), 1e-7)) * s; }
/** Exponential with scale s, truncated to [lo, hi]: inverse CDF, no rejection loop. */
float truncExpo(float lo, float s, float hi) { return lo - s * log(1.0 - rnd() * (1.0 - exp(-(hi - lo) / s))); }

float armAngle(float rAtSun, float r) { return PI + log(r / rAtSun) / uTanP; }
float pickArm(out float strength) {
  float p = rnd() * (uArmS.x + uArmS.y + uArmS.z + uArmS.w);
  float r = uArmR.w;
  strength = uArmS.w;
  if (p < uArmS.x) { r = uArmR.x; strength = uArmS.x; }
  else if (p < uArmS.x + uArmS.y) { r = uArmR.y; strength = uArmS.y; }
  else if (p < uArmS.x + uArmS.y + uArmS.z) { r = uArmR.z; strength = uArmS.z; }
  return r;
}
float armRadius() { return truncExpo(11000.0, 14000.0, 56000.0); }

const vec3 BLUE = vec3(0.62, 0.75, 1.0);
const vec3 WHITE = vec3(0.95, 0.96, 1.0);
const vec3 YELLOW = vec3(1.0, 0.88, 0.7);
const vec3 ORANGE = vec3(1.0, 0.72, 0.48);
const vec3 RED = vec3(1.0, 0.52, 0.38);

/** Most stars faint; a few luminous giants. */
float brightness(float giantChance) { return rnd() < giantChance ? 2.5 + rnd() * 3.0 : 0.35 * exp(gauss() * 0.55); }

/**
 * One star of the model. Returns its population in 'pop'
 * (0 arm, 1 spur, 2 bar/bulge, 3 disk, 4 halo, 5 globular).
 */
vec3 galaxyStar(float f, out vec3 col, out float bright, out float pop) {
  col = WHITE;
  bright = 1.0;
  pop = 0.0;
  vec3 p = vec3(0.0);
  if (f < 0.44) {
    float strength;
    float rAt = pickArm(strength);
    float r = armRadius();
    float width = 1100.0 + 0.035 * r;
    float rr = r + gauss() * width * 0.75;
    float th = armAngle(rAt, r) + gauss() * 0.02;
    float t = rnd();
    col = t < 0.03 ? RED : t < 0.55 ? mix(BLUE, WHITE, rnd()) : mix(WHITE, YELLOW, rnd());
    bright = brightness(0.02);
    p = vec3(cos(th) * rr, sin(th) * rr, gauss() * (180.0 + r * 0.004));
  } else if (f < 0.47) {
    pop = 1.0;
    float th = PI + 0.05 + (rnd() * 2.0 - 1.0) * uSpur.z;
    float r = uSpur.x * exp(uTanP * (th - PI)) + gauss() * 650.0;
    col = mix(BLUE, WHITE, rnd());
    bright = brightness(0.015);
    p = vec3(cos(th) * r, sin(th) * r, gauss() * 220.0);
  } else if (f < 0.67) {
    pop = 2.0;
    if (rnd() < 0.5) {
      float a = gauss() * 7000.0;
      float b = gauss() * 2200.0;
      float c = cos(uBarAngle), sn = sin(uBarAngle);
      p = vec3(c * a - sn * b, sn * a + c * b, gauss() * 1100.0);
    } else {
      float rad = expo(2300.0);
      float u = rnd() * 2.0 - 1.0;
      float phi = rnd() * 6.28318530718;
      float q = sqrt(1.0 - u * u);
      p = vec3(rad * q * cos(phi), rad * q * sin(phi), rad * u * 0.65);
    }
    col = mix(YELLOW, ORANGE, rnd());
    bright = brightness(0.004) * 0.55;
  } else if (f < 0.93) {
    pop = 3.0;
    float r = truncExpo(0.0, 10500.0, 54000.0);
    float phi = rnd() * 6.28318530718;
    bool thick = rnd() < 0.15;
    col = mix(YELLOW, WHITE, rnd() * 0.6);
    bright = brightness(0.006);
    p = vec3(cos(phi) * r, sin(phi) * r, gauss() * (thick ? 1800.0 : 450.0));
  } else if (f < 0.955) {
    pop = 4.0;
    float rad = 4000.0 + expo(22000.0);
    float u = rnd() * 2.0 - 1.0;
    float phi = rnd() * 6.28318530718;
    float q = sqrt(1.0 - u * u);
    col = mix(ORANGE, YELLOW, rnd());
    bright = brightness(0.0);
    p = vec3(rad * q * cos(phi), rad * q * sin(phi), rad * u * 0.8);
  } else {
    // Globular clusters: the cluster comes from its own seed, the member from the vertex's.
    pop = 5.0;
    uint mine = rng;
    rng = pcg(uint(floor(rnd() * 150.0)) + 7919u);
    float rad = 2000.0 + expo(14000.0);
    float u = rnd() * 2.0 - 1.0;
    float phi = rnd() * 6.28318530718;
    float q = sqrt(1.0 - u * u);
    vec3 c = vec3(rad * q * cos(phi), rad * q * sin(phi), rad * u * 0.85);
    float core = 40.0 + rnd() * 90.0;
    rng = mine;
    float scale = core * (rnd() < 0.7 ? 1.0 : 3.0);
    col = mix(YELLOW, WHITE, rnd() * 0.5);
    bright = 0.5 + rnd() * 0.6;
    p = c + vec3(gauss(), gauss(), gauss()) * scale;
  }
  return p;
}

/** Dust lanes along the inner (concave) edge of each arm, plus the dusty inner ring. Size in ly. */
vec3 galaxyDust(out float size, out float alpha) {
  alpha = 0.15 + rnd() * 0.3;
  vec3 p;
  if (rnd() < 0.82) {
    float r = armRadius();
    float width = 1100.0 + 0.035 * r;
    float rr = r - width * 0.75 + gauss() * width * 0.35;
    float strength;
    float th = armAngle(pickArm(strength), r);
    size = 450.0 + rnd() * 900.0;
    p = vec3(cos(th) * rr, sin(th) * rr, gauss() * 110.0);
  } else {
    float r = 5000.0 + rnd() * 9000.0;
    float phi = rnd() * 6.28318530718;
    size = 600.0 + rnd() * 900.0;
    p = vec3(cos(phi) * r, sin(phi) * r, gauss() * 90.0);
  }
  return p;
}

/** Pink HII regions and blue reflection clouds on the arm crests; warm haze over the bulge. */
vec3 galaxyGas(out vec3 col, out float size, out float alpha) {
  float t = rnd();
  vec3 p;
  if (t < 0.06) {
    float rad = expo(2600.0);
    float phi = rnd() * 6.28318530718;
    col = vec3(1.0, 0.78, 0.52);
    size = 2000.0 + rnd() * 3500.0;
    alpha = 0.02 + rnd() * 0.02;
    p = vec3(cos(phi) * rad, sin(phi) * rad, gauss() * 700.0);
  } else {
    float r = armRadius();
    float width = 1100.0 + 0.035 * r;
    float rr = r + gauss() * width * 0.5;
    float strength;
    float th = armAngle(pickArm(strength), r);
    bool pink = t < 0.7;
    col = pink ? vec3(1.0, 0.36, 0.52) : vec3(0.42, 0.58, 1.0);
    size = pink ? 250.0 + rnd() * 650.0 : 400.0 + rnd() * 900.0;
    alpha = pink ? 0.04 + rnd() * 0.06 : 0.025 + rnd() * 0.035;
    p = vec3(cos(th) * rr, sin(th) * rr, gauss() * 140.0);
  }
  return p;
}

bool nearSun(vec3 p) { return uExclude > 0.0 && distance(p, uSun) < uExclude; }
`;

const common = /* glsl */ `
uniform float uFocal;       // CSS px focal length
uniform float uOpacity;
uniform float uPixelRatio;
uniform float uMaxPx;
uniform float uUnit;        // light-years per render unit
uniform float uTime;
uniform float uTwinkle;
uniform float uAbsorb;      // 1 when the dust layer is off: fold its extinction in analytically
varying vec3 vColor;
varying float vAlpha;
${generator}

/** Light surviving the dusty inner ring (r ≈ 5,000–14,000 ly), when dust isn't drawn as its own layer. */
float extinction(vec3 p) {
  float r = length(p.xy);
  float ring = smoothstep(3500.0, 6500.0, r) * (1.0 - smoothstep(12000.0, 17000.0, r));
  float plane = exp(-abs(p.z) / 600.0);
  return 1.0 - uAbsorb * (0.25 + 0.4 * ring * plane);
}
`;

const starsVertex = /* glsl */ `
${common}
varying float vGlint;
void main() {
  rng = pcg(uint(gl_VertexID) * 2654435761u + 17u);
  vec3 col; float bright; float pop;
  vec3 p = galaxyStar((float(gl_VertexID) + 0.5) / uCount, col, bright, pop);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z * uUnit, 1.0);
  // Apparent size from brightness and distance; below a pixel, keep the light as alpha.
  float px = bright * uFocal * 50.0 / depth;
  float seed = rnd();
  float tw = 1.0 + uTwinkle * 0.45 * sin(uTime * (1.2 + 3.0 * seed) + seed * 40.0);
  gl_PointSize = clamp(px, 1.0, uMaxPx) * uPixelRatio;
  vAlpha = uOpacity * min(1.0, px * px) * tw * smoothstep(900.0, 4500.0, depth) * extinction(p);
  vGlint = smoothstep(2.5, uMaxPx, px);
  vColor = col;
  if (vAlpha < 0.003 || nearSun(p)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

/** Glow, dust and gas: soft sprites with a real size in light-years. */
const spriteVertex = (kind: number) => /* glsl */ `
${common}
void main() {
  rng = pcg(uint(gl_VertexID) * 2246822519u + ${kind * 7919 + 3}u);
  vec3 col = vec3(1.0);
  float size;
  float alpha;
  vec3 p;
#if ${kind} == 1
  // Unresolved starlight: the same populations as the stars, as wide faint sprites.
  float bright; float pop;
  p = galaxyStar(rnd(), col, bright, pop);
  // Adaptive kernel (as in SPH): each sprite stands for the same number of stars, so it
  // widens where the model is sparse and fades to keep its light — no lone blobs at the edge.
  float r = length(p.xy);
  float h = pop == 2.0 ? 700.0 + 0.3 * length(p)
          : pop == 3.0 ? 1300.0 * exp(r / 21000.0)
          : 900.0 * exp(max(r - 11000.0, 0.0) / 28000.0);
  size = min(h * (0.8 + 0.4 * rnd()), 7000.0);
  float base = pop >= 4.0 ? 0.0 : pop == 2.0 ? 0.12 : pop == 3.0 ? 0.55 : pop == 1.0 ? 0.06 : 0.14;
  alpha = base * min(1.0, pow(1300.0 / size, 2.0) * (pop == 2.0 ? 1.4 : 1.0));
  col = mix(col, vec3(1.0, 0.86, 0.68), 0.35);
#elif ${kind} == 2
  p = galaxyDust(size, alpha);
  col = vec3(0.5, 0.4, 0.32);
#else
  p = galaxyGas(col, size, alpha);
#endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z * uUnit, 1.0);
  float px = size * 2.0 * uFocal / depth;
  gl_PointSize = min(px, uMaxPx) * uPixelRatio;
  // Too small to matter, or too big to draw cheaply (the camera is inside it): fade out.
  vAlpha = alpha * uOpacity * smoothstep(1.5, 5.0, px) * (1.0 - smoothstep(uMaxPx * 0.6, uMaxPx, px));
  if (${kind} != 2) vAlpha *= extinction(p);
  // Individual clouds near the camera read as blobs; gas, dust and glow only work en masse.
  vAlpha *= smoothstep(${kind === 1 ? "5000.0, 22000.0" : "4000.0, 16000.0"}, depth);
  vColor = col;
  // Real catalogue stars replace the model near the Sun; the diffuse glow stays.
  if (vAlpha < 0.002 || (${kind} != 1 && nearSun(p))) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

export const starFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vGlint;
void main() {
  vec2 c = (gl_PointCoord - 0.5) * 2.0;
  float core = exp(-dot(c, c) * 5.0);
  float diamond = exp(-(abs(c.x) + abs(c.y)) * 4.0) * vGlint * 0.6;
  float a = (core + diamond) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.3) * a, 1.0);
  #include <colorspace_fragment>
}
`;

export const softFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 14.0) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

/** Multiplied into what is already drawn: 1 = clear, tint = opaque dust. */
export const dustFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  if (r2 > 1.0) discard;
  float a = (1.0 - r2) * (1.0 - r2) * vAlpha;
  gl_FragColor = vec4(mix(vec3(1.0), vColor, a), 1.0);
}
`;

/**
 * A layer of `count` procedural points. The only vertex data is one byte per
 * point, needed so WebGL knows how many vertices to draw.
 */
function layer(kind: GalaxyLayerKind, count: number, sun: Vector3 | null, exclude: number, renderOrder: number): Points {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Uint8Array(Math.max(1, count)), 1));
  geometry.setDrawRange(0, count);
  // Positions come from the shader: give three.js bounds so it never tries to compute them.
  geometry.boundingSphere = new Sphere(new Vector3(), 1e7);
  geometry.boundingBox = new Box3(new Vector3(-1e7, -1e7, -1e7), new Vector3(1e7, 1e7, 1e7));
  const uniforms: Record<string, IUniform> = {
    uArmR: { value: ARMS.map((a) => a.radiusAtSun) },
    uArmS: { value: ARMS.map((a) => a.strength) },
    uTanP: { value: PITCH_TAN },
    uBarAngle: { value: BAR_ANGLE },
    uSpur: { value: new Vector3(ORION_SPUR.radiusAtSun, ORION_SPUR.strength, ORION_SPUR.halfSpan) },
    uSun: { value: sun ?? new Vector3() },
    uExclude: { value: sun ? exclude : 0 },
    uCount: { value: count },
    uFocal: { value: 1000 },
    uOpacity: { value: 0 },
    uPixelRatio: { value: 1 },
    uMaxPx: { value: 3 },
    uUnit: { value: 1 },
    uTime: { value: 0 },
    uTwinkle: { value: 0 },
    uAbsorb: { value: 0 },
  };
  const id = KIND_ID[kind];
  const material = new ShaderMaterial({
    vertexShader: kind === "stars" ? starsVertex : spriteVertex(id),
    fragmentShader: kind === "stars" ? starFragment : kind === "dust" ? dustFragment : softFragment,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  if (kind === "dust") {
    // Absorption: framebuffer × fragment colour. Order-independent, so no sorting.
    material.blending = CustomBlending;
    material.blendSrc = ZeroFactor;
    material.blendDst = SrcColorFactor;
  } else material.blending = AdditiveBlending;
  const p = new Points(geometry, material);
  p.frustumCulled = false;
  p.renderOrder = renderOrder;
  p.raycast = () => {};
  p.visible = count > 0;
  return p;
}

export interface ProceduralGalaxy {
  stars: Points;
  glow: Points;
  dust: Points;
  gas: Points;
  dispose: () => void;
}

export interface GalaxyBudget {
  stars: number;
  glow: number;
  dust: number;
  gas: number;
}

/** Point budgets for a graphics tier (the CPU model's particle setting), ×4 for stars: GPU points cost no memory. */
export function galaxyBudget(particles: number, dust: boolean, gas: boolean): GalaxyBudget {
  const stars = particles * 4;
  return {
    stars,
    // Glow costs fill, not vertices: many small sprites look smoother than a few big ones for the same light.
    glow: particles >= 300_000 ? 30_000 : particles >= 160_000 ? 20_000 : particles >= 80_000 ? 14_000 : 11_000,
    // Clouds keep the classic model's counts: more would only stack up brighter.
    dust: dust ? Math.min(9_000, Math.round(particles * 0.05)) : 0,
    gas: gas ? Math.min(5_000, Math.round(particles * 0.02)) : 0,
  };
}

/**
 * Build the four layers. `sun` (galactocentric) and `exclude` carve out the
 * volume the real catalogue stars already cover; pass null to draw it all.
 */
export function createProceduralGalaxy(budget: GalaxyBudget, sun: Vector3 | null, exclude = 0): ProceduralGalaxy {
  // Draw order: glow, then dust dims it, then gas and stars on top.
  const g = {
    glow: layer("glow", budget.glow, sun, exclude, -5),
    dust: layer("dust", budget.dust, sun, exclude, -4),
    gas: layer("gas", budget.gas, sun, exclude, -3),
    stars: layer("stars", budget.stars, sun, exclude, -2),
  };
  return {
    ...g,
    dispose: () => {
      for (const p of Object.values(g)) {
        p.geometry.dispose();
        (p.material as ShaderMaterial).dispose();
      }
    },
  };
}

export interface GalaxyFrame {
  /** Dust layer present: without it nothing absorbs, so the diffuse light is dimmed to match. */
  dust?: boolean;
  focal: number;
  pixelRatio: number;
  /** Overall visibility, 0–1. */
  opacity: number;
  /** Dims the glow near the bright core. */
  exposure: number;
  time: number;
  twinkle: number;
  starSize: number;
  starBrightness: number;
  /** Light-years per render unit. */
  unit: number;
  maxSprite: number;
  /** Extra gain on the diffuse light (the glow and gas). */
  glowGain?: number;
}

/** Per-frame uniforms for all four layers. */
export function updateProceduralGalaxy(g: ProceduralGalaxy, f: GalaxyFrame) {
  const on = f.opacity > 0.001;
  const glowGain = f.glowGain ?? 1;
  const absorb = f.dust === false ? 1 : 0;
  for (const key of ["stars", "glow", "dust", "gas"] as const) {
    const p = g[key];
    const u = (p.material as ShaderMaterial).uniforms;
    p.visible = on && p.geometry.drawRange.count > 0;
    u.uFocal.value = f.focal;
    u.uPixelRatio.value = f.pixelRatio;
    u.uUnit.value = f.unit;
    u.uAbsorb.value = absorb;
    if (key === "stars") {
      // Same total light as the classic model's (count / 4) points; more points, each fainter.
      const classic = Math.max(u.uCount.value, 1) / 4;
      u.uOpacity.value = f.opacity * Math.pow(30_000 / classic, 0.6) * 0.22 * f.starBrightness;
      u.uMaxPx.value = 3.5 * f.starSize;
      u.uTime.value = f.time;
      u.uTwinkle.value = f.twinkle;
    } else if (key === "glow") {
      u.uOpacity.value = f.opacity * f.exposure * glowGain * (7_000 / Math.max(u.uCount.value, 1)) * 0.16;
      u.uMaxPx.value = f.maxSprite;
    } else {
      u.uOpacity.value = key === "dust" ? f.opacity * f.exposure ** 0.3 : f.opacity * f.exposure * glowGain * 0.36;
      u.uMaxPx.value = f.maxSprite;
    }
  }
}
