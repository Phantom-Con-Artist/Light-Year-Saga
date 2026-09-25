import type { IUniform } from "three";
import { graphics } from "../state/graphicsStore";

/**
 * Shared look for point stars: per-star size and brightness variation,
 * twinkle, a diamond glint and four-point diffraction spikes on bright stars.
 *
 * Cost is kept to a few ALU ops per fragment; faint stars stay 2–3 px and
 * only the few hundred brightest get large sprites. Per-star randomness comes
 * from gl_VertexID, so it needs no extra attribute memory.
 */

export const starUniforms = (): Record<string, IUniform> => ({
  uTime: { value: 0 },
  uTwinkle: { value: 0.5 },
  uSpikes: { value: 1 },
  uStarSize: { value: 1 },
  uStarGain: { value: 1 },
  uPixelRatio: { value: 1 },
});

/** Copy the current graphics settings into a star material's uniforms. */
export function syncStarUniforms(u: Record<string, IUniform>, time: number, pixelRatio: number) {
  const g = graphics();
  u.uTime.value = time;
  u.uTwinkle.value = g.twinkle ? g.twinkleStrength : 0;
  u.uSpikes.value = g.spikes ? 1 : 0;
  u.uStarSize.value = g.starSize;
  u.uStarGain.value = g.starBrightness;
  u.uPixelRatio.value = pixelRatio;
}

/**
 * Vertex helpers. Call `starSprite(flux, fade)` after setting gl_Position;
 * `flux` is brightness relative to the visibility limit (1 = just visible).
 */
export const starVertexChunk = /* glsl */ `
uniform float uTime;
uniform float uTwinkle;
uniform float uSpikes;
uniform float uStarSize;
uniform float uStarGain;
uniform float uPixelRatio;
varying float vIntensity;
varying float vHalo;
varying float vSpike;
varying float vExpand;
varying vec2 vRot;

float hashId(uint n) {
  n = (n << 13u) ^ n;
  n = n * (n * n * 15731u + 789221u) + 1376312589u;
  return float(n & 0x7fffffffu) / 2147483647.0;
}

void starSprite(float flux, float fade) {
  uint id = uint(gl_VertexID);
  float r1 = hashId(id);
  float r2 = hashId(id + 7919u);
  float r3 = hashId(id + 104729u);

  // Twinkle: two incommensurate waves per star, at its own pace.
  float tw = 1.0 + uTwinkle * (0.55 * sin(uTime * (1.3 + 3.1 * r1) + r2 * 6.2832) + 0.35 * sin(uTime * (4.7 + 2.3 * r2) + r3 * 6.2832));
  float f = flux * uStarGain * (0.8 + 0.4 * r3);
  vIntensity = min(f, 1.0) * fade * max(tw, 0.15);

  // Brighter than the limit: grow the sprite rather than saturating it.
  float grow = pow(max(f, 1.0), 0.18);
  float base = clamp(2.2 * grow, 2.2, 44.0) * uStarSize * (0.8 + 0.45 * r1);
  vHalo = clamp((grow - 1.4) / 6.0, 0.0, 1.0);
  vSpike = clamp((grow - 1.9) / 5.0, 0.0, 1.0) * uSpikes * (0.75 + 0.25 * tw);
  // Spikes need room beyond the halo; the core keeps its pixel size.
  vExpand = 1.0 + vSpike * 2.2;
  gl_PointSize = base * vExpand * uPixelRatio;
  float a = (r2 - 0.5) * 0.5;
  vRot = vec2(cos(a), sin(a));

  // Too faint to see: move outside the clip volume so it costs no fragments.
  if (vIntensity < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

/** Complete fragment shader; expects `varying vec3 vColor`. */
export const starFragment = /* glsl */ `
varying vec3 vColor;
varying float vIntensity;
varying float vHalo;
varying float vSpike;
varying float vExpand;
varying vec2 vRot;

void main() {
  vec2 c = (gl_PointCoord - 0.5) * 2.0;     // −1…1 across the sprite
  vec2 q = c * vExpand;                      // units of the un-expanded sprite
  float r2 = dot(q, q);
  float core = exp(-r2 * 9.0);
  float edge = 1.0 - smoothstep(0.7, 1.0, sqrt(r2));
  float halo = exp(-sqrt(r2) * 5.0) * vHalo * 0.55 * edge;
  // Diamond glint: an L1-norm falloff reads as a four-sided sparkle.
  float diamond = exp(-(abs(q.x) + abs(q.y)) * 5.0) * vHalo * 0.5;
  float a = core + halo + diamond;
  if (vSpike > 0.0) {
    vec2 s = vec2(vRot.x * c.x - vRot.y * c.y, vRot.y * c.x + vRot.x * c.y);
    vec2 fall = max(1.0 - abs(s), 0.0);
    float spikes = exp(-abs(s.y) * 70.0) * fall.x * fall.x + exp(-abs(s.x) * 70.0) * fall.y * fall.y;
    a += spikes * vSpike * 0.6;
  }
  a *= vIntensity;
  if (a < 0.003) discard;
  vec3 col = mix(vColor, vec3(1.0), min(core * 0.5 + vSpike * 0.1, 1.0)) * a;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
