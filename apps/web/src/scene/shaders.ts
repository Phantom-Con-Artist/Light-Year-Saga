import { Vector2 } from "three";

/**
 * GLSL for all bodies.
 *
 * Surfaces are procedural, but the noise is evaluated only once: each body's
 * surface is baked into an equirectangular texture at startup (see bake.ts).
 * Per-frame shaders just sample that texture and light it. The Sun is assumed
 * to sit at the world origin for lighting.
 */

export const NOISE = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
        mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
        mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return v;
}
`;

/* ---------- One-time bake: equirectangular surface colour ---------- */

export const bakeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Style ids: 0 rocky, 1 cloudy, 2 terran, 3 banded, 4 ice, 5 star, 6 cloud cover, 7 terran without clouds. */
export const bakeFragment = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uStyle;
uniform float uSeed;
varying vec2 vUv;
${NOISE}

vec3 terran(vec3 p, vec3 q, bool clouds) {
  float n = fbm(q * 2.2);
  float land = smoothstep(0.5, 0.52, n);
  vec3 ocean = uColorA * (0.65 + 0.35 * fbm(q * 6.0));
  vec3 ground = mix(uColorB, vec3(0.55, 0.46, 0.32), smoothstep(0.56, 0.7, n));
  vec3 col = mix(ocean, ground, land);
  float ice = smoothstep(0.93, 0.96, abs(p.y) + 0.04 * fbm(q * 8.0));
  col = mix(col, vec3(0.92, 0.95, 1.0), ice);
  if (clouds) {
    float c = smoothstep(0.52, 0.75, fbm(q * 4.0 + vec3(3.0)));
    col = mix(col, vec3(1.0), c * 0.8);
  }
  return col;
}

void main() {
  // Inverse of THREE.SphereGeometry's UV mapping, so the texture wraps exactly.
  float phi = vUv.x * 6.28318530718;
  float theta = (1.0 - vUv.y) * 3.14159265359;
  vec3 p = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
  vec3 q = p + uSeed;
  vec3 col;

  if (uStyle < 0.5) {            // rocky
    float n = fbm(q * 3.0);
    float c = fbm(q * 12.0);
    col = mix(uColorB, uColorA, smoothstep(0.25, 0.75, n));
    col *= 0.75 + 0.45 * c;
  } else if (uStyle < 1.5) {     // cloudy (Venus)
    float warp = fbm(q * 3.0);
    float n = fbm(q * 2.0 + vec3(0.0, p.y * 5.0, 0.0) + warp * 1.6);
    col = mix(uColorB, uColorA, smoothstep(0.2, 0.8, n));
  } else if (uStyle < 2.5) {     // terran (Earth)
    col = terran(p, q, true);
  } else if (uStyle < 3.5) {     // banded gas giant
    float warp = fbm(q * vec3(2.5, 7.0, 2.5));
    float b = sin(p.y * 16.0 + warp * 4.5);
    float fine = sin(p.y * 55.0 + fbm(q * 6.0) * 3.0);
    col = mix(uColorB, uColorA, 0.5 + 0.5 * b);
    col *= 0.9 + 0.1 * fine;
  } else if (uStyle < 4.5) {     // ice giant
    float b = sin(p.y * 9.0 + fbm(q * 2.0) * 2.0);
    col = mix(uColorB, uColorA, 0.62 + 0.38 * b);
  } else if (uStyle < 5.5) {     // star granulation
    float warp = fbm(p * 3.0);
    float gran = fbm(p * 10.0 + warp * 2.0);
    col = mix(uColorB, uColorA, smoothstep(0.3, 0.75, gran));
  } else if (uStyle < 6.5) {     // cloud cover: swirled fronts, zonal bands, clearer subtropics
    float warp = fbm(q * 2.0);
    float n = fbm(q * vec3(3.0, 6.0, 3.0) + warp * 1.6);
    float bands = 0.5 + 0.5 * cos(p.y * 9.0 + warp * 2.5);
    float cover = smoothstep(0.42, 0.72, n * 0.85 + bands * 0.22);
    col = vec3(cover);
  } else {                       // terran, clouds on their own layer
    col = terran(p, q, false);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

/* ---------- Per-frame shaders (cheap: one texture fetch) ---------- */

const SURFACE_VARYINGS = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
`;

export const surfaceVertex = /* glsl */ `
${SURFACE_VARYINGS}
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/**
 * Lit surface, physically based where it counts:
 *
 * - Relief: a normal perturbed by the surface map's brightness gradient in a
 *   tangent frame built from screen-space derivatives (no tangent attributes).
 *   Brightness stands in for height — right for cratered, airless worlds, so
 *   it is strongest there and off for gas giants.
 * - Diffuse: Lambert for worlds with air; Lommel–Seeliger for airless regolith
 *   (why the full Moon looks flat, not like a shaded ball); Minnaert limb
 *   darkening for cloud decks.
 * - Specular: GGX microfacets with Schlick Fresnel — sun glint on water.
 * - Clouds cast shadows on the ground below them.
 */
export const surfaceFragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uAtmo;
uniform float uHasAtmo;
uniform float uHighlight;
uniform vec3 uLightPos;
uniform vec3 uEmissive;
uniform sampler2D uNight;
uniform float uNightGain;
uniform sampler2D uOcean;
uniform float uOceanGain;
uniform float uBump;        // relief strength (0 = smooth)
uniform float uRough;       // land roughness (1 = no highlight)
uniform float uAirless;     // 1 = Lommel–Seeliger regolith
uniform float uMinnaert;    // limb-darkening exponent k (0 = off)
uniform sampler2D uClouds;
uniform float uCloudShadow;
uniform vec2 uCloudShift;   // cloud layer's longitude offset (uv)
uniform float uWaterKey;    // 1: find water by colour (procedural worlds without a mask)
${SURFACE_VARYINGS}

const float PI = 3.14159265359;

float luma(vec2 uv) { return dot(texture2D(uMap, uv).rgb, vec3(0.3, 0.59, 0.11)); }

// Tangent frame from derivatives (Schüler 2013).
mat3 cotangentFrame(vec3 N, vec3 p, vec2 uv) {
  vec3 dp1 = dFdx(p), dp2 = dFdy(p);
  vec2 duv1 = dFdx(uv), duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, N), dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float invmax = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-20));
  return mat3(T * invmax, B * invmax, N);
}

float ggx(vec3 N, vec3 V, vec3 L, float rough, float f0) {
  vec3 H = normalize(L + V);
  float ndl = max(dot(N, L), 0.0), ndv = max(dot(N, V), 1e-3), ndh = max(dot(N, H), 0.0);
  float a2 = pow(rough, 4.0);
  float dd = ndh * ndh * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  float k = (rough + 1.0) * (rough + 1.0) / 8.0;
  float G = ndl / (ndl * (1.0 - k) + k) * ndv / (ndv * (1.0 - k) + k);
  float F = f0 + (1.0 - f0) * pow(clamp(1.0 - dot(H, V), 0.0, 1.0), 5.0);
  return D * G * F / (4.0 * ndv) ;
}

void main() {
  vec3 col = texture2D(uMap, vUv).rgb;
  vec3 Ng = normalize(vWorldNormal);
  vec3 L = normalize(uLightPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float water = uOceanGain > 0.0 ? texture2D(uOcean, vUv).r : uWaterKey * smoothstep(0.04, 0.14, col.b - max(col.r, col.g * 0.85));

  // Relief from the map's brightness gradient (none on water).
  vec3 N = Ng;
  if (uBump > 0.0) {
    vec2 texel = 1.0 / vec2(textureSize(uMap, 0));
    float hx = luma(vUv + vec2(texel.x, 0.0)) - luma(vUv - vec2(texel.x, 0.0));
    float hy = luma(vUv + vec2(0.0, texel.y)) - luma(vUv - vec2(0.0, texel.y));
    mat3 tbn = cotangentFrame(Ng, vWorldPos, vUv);
    N = normalize(tbn * vec3(-hx * uBump * (1.0 - water), -hy * uBump * (1.0 - water), 1.0));
  }

  float ndlG = dot(Ng, L);
  float mu0 = max(dot(N, L), 0.0);
  float mu = max(dot(N, V), 1e-3);
  // Air scatters a little light past the terminator; airless worlds have a hard one.
  float twilight = uHasAtmo > 0.0 ? smoothstep(-0.12, 0.08, ndlG) * 0.06 : 0.0;
  float diffuse = mu0;
  if (uAirless > 0.0) diffuse = mix(mu0, 2.0 * mu0 / (mu0 + mu), uAirless);
  if (uMinnaert > 0.0) diffuse = pow(mu0, uMinnaert) * pow(mu, uMinnaert - 1.0);
  // Self-shadowing of the relief can't light the night side.
  diffuse *= smoothstep(-0.02, 0.06, ndlG);

  // Cloud shadows on the ground.
  float shade = 1.0;
  if (uCloudShadow > 0.0) shade = 1.0 - uCloudShadow * texture2D(uClouds, vUv + uCloudShift).r;

  vec3 lit = col * (0.004 + 1.35 * (diffuse * shade + twilight));

  // Sun glint: GGX on water (and on smooth land, if any).
  float rough = mix(uRough, 0.16, water);
  vec3 spec = vec3(0.0);
  if (rough < 0.99 && ndlG > 0.0) {
    float f0 = mix(0.04, 0.02, water);
    spec = vec3(1.0, 0.95, 0.85) * ggx(water > 0.5 ? Ng : N, V, L, rough, f0) * mu0 * shade * (water > 0.0 ? max(uOceanGain, 0.5 * uWaterKey) * 1.6 : 0.25);
  }

  float rim = pow(1.0 - max(dot(Ng, V), 0.0), 3.0);
  vec3 atmo = uAtmo * rim * smoothstep(-0.35, 0.5, ndlG) * uHasAtmo * 0.5;
  vec3 hl = vec3(1.0) * rim * uHighlight * 0.25;

  // Self-glow on the night side: lava oceans, white-hot gas giants.
  float light = smoothstep(-0.12, 0.65, ndlG);
  vec3 glow = uEmissive * (1.0 - light) * (0.35 + 0.65 * (1.0 - dot(col, vec3(0.333))));

  // City lights on the night side.
  vec3 city = uNightGain > 0.0 ? texture2D(uNight, vUv).rgb * uNightGain * (1.0 - smoothstep(-0.2, 0.08, ndlG)) : vec3(0.0);

  gl_FragColor = vec4(lit + spec + atmo + hl + glow + city, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Defaults for the physically based surface uniforms (add to any material using surfaceFragment). */
export function surfaceUniforms(o: { bump?: number; rough?: number; airless?: number; minnaert?: number; waterKey?: number } = {}) {
  return {
    uWaterKey: { value: o.waterKey ?? 0 },
    uBump: { value: o.bump ?? 0 },
    uRough: { value: o.rough ?? 1 },
    uAirless: { value: o.airless ?? 0 },
    uMinnaert: { value: o.minnaert ?? 0 },
    uClouds: { value: null },
    uCloudShadow: { value: 0 },
    uCloudShift: { value: new Vector2() },
  };
}

export const sunFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uBoost;
uniform vec3 uTint;
uniform float uTintMix;
${SURFACE_VARYINGS}

void main() {
  vec3 col = texture2D(uMap, vUv).rgb;
  // Keep the photographed granulation but recolour it to the star's temperature.
  float lum = dot(col, vec3(0.3, 0.55, 0.15));
  vec3 tint = pow(uTint, vec3(1.5));   // richer colour; the limb term adds the brightness range
  col = mix(col, tint * pow(lum * 1.5, 1.3), uTintMix);
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float limb = 0.6 + 0.4 * sqrt(max(dot(N, V), 0.0));
  gl_FragColor = vec4(col * limb * uBoost, 1.0);
  #include <colorspace_fragment>
}
`;

export const coronaVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const coronaFragment = /* glsl */ `
uniform vec3 uColor;
varying vec2 vUv;

void main() {
  float r = length(vUv - 0.5) * 2.0;
  float halo = pow(max(1.0 - r, 0.0), 4.0);
  float core = pow(max(1.0 - r, 0.0), 14.0);
  gl_FragColor = vec4(uColor * (halo * 0.9 + core * 1.6), 1.0);
  #include <colorspace_fragment>
}
`;

export const ringVertex = /* glsl */ `
varying vec2 vLocal;
varying vec3 vWorldPos;
void main() {
  vLocal = position.xy;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const ringFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uInner;
uniform float uOuter;
uniform vec3 uPlanetCenter;
uniform float uPlanetRadius;
uniform sampler2D uRingMap;
uniform float uHasRingMap;
varying vec2 vLocal;
varying vec3 vWorldPos;

float hash1(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  float r = length(vLocal);
  float t = (r - uInner) / (uOuter - uInner);
  float bands = 0.55 + 0.45 * sin(t * 90.0 + sin(t * 23.0) * 2.0);
  float k = t * 140.0;
  float grain = 0.6 + 0.4 * mix(hash1(floor(k)), hash1(floor(k) + 1.0), fract(k));
  float cassini = smoothstep(0.012, 0.03, abs(t - 0.64));
  float edge = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.94, t);
  float alpha = edge * cassini * (0.25 + 0.55 * bands * grain);

  // Planet shadow: does the ray from this fragment toward the Sun hit the planet?
  vec3 L = normalize(-vWorldPos);
  vec3 oc = vWorldPos - uPlanetCenter;
  float b = dot(oc, L);
  float c = dot(oc, oc) - uPlanetRadius * uPlanetRadius;
  float shadow = (b < 0.0 && b * b - c > 0.0) ? 0.12 : 1.0;

  vec3 col = uColor * (0.35 + 0.65 * bands) * shadow;
  if (uHasRingMap > 0.5) {
    vec4 ringTex = texture2D(uRingMap, vec2(clamp(t, 0.0, 1.0), 0.5));
    col = ringTex.rgb * shadow;
    alpha = ringTex.a;
  }
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/* ---------- Milky Way sky ---------- */

export const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Samples NASA's Deep Star Map (equatorial plate carrée, RA 0h at image centre
 * increasing leftward, north up). Scene directions are ecliptic, so rotate by
 * the obliquity ε to get equatorial RA/Dec first.
 */
export const skyFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uBrightness;
uniform float uBlack;
uniform float uBlur;
varying vec3 vDir;

const float OBLIQUITY = 0.40909280422; // 23.4393° (J2000)
const float PI = 3.14159265359;

void main() {
  vec3 d = normalize(vDir);
  // render (x, y-up, z) -> ecliptic (x, y, z-north)
  vec3 ecl = vec3(d.x, -d.z, d.y);
  float ce = cos(OBLIQUITY), se = sin(OBLIQUITY);
  vec3 eq = vec3(ecl.x, ecl.y * ce - ecl.z * se, ecl.y * se + ecl.z * ce);

  float ra = atan(eq.y, eq.x);
  float dec = asin(clamp(eq.z, -1.0, 1.0));
  vec2 uv = vec2(fract(0.5 - ra / (2.0 * PI)), 0.5 + dec / PI);

  // Seam-safe mip selection: take derivatives from whichever u parameterisation
  // is continuous at this pixel.
  vec2 uvAlt = vec2(fract(uv.x + 0.5), uv.y);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec2 dxAlt = dFdx(uvAlt), dyAlt = dFdy(uvAlt);
  if (abs(dxAlt.x) + abs(dyAlt.x) < abs(dx.x) + abs(dy.x)) { dx = dxAlt; dy = dyAlt; }

  // uBlur > 1 samples a softer mip level (hides residual noise in diffuse maps).
  vec3 col = max(textureGrad(uMap, uv, dx * uBlur, dy * uBlur).rgb - uBlack, 0.0) * uBrightness;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

/* ---------- Cloud layer (Earth) ---------- */

export const cloudFragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uLightPos;
${SURFACE_VARYINGS}

void main() {
  float cover = texture2D(uMap, vUv).r;
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uLightPos - vWorldPos);
  float light = smoothstep(-0.1, 0.6, dot(N, L));
  gl_FragColor = vec4(vec3(1.0) * (0.02 + 1.15 * light), cover * 0.9);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
