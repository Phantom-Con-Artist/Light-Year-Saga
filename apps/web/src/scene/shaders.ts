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

/** Style ids: 0 rocky, 1 cloudy, 2 terran, 3 banded, 4 ice, 5 star. */
export const bakeFragment = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uStyle;
uniform float uSeed;
varying vec2 vUv;
${NOISE}

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
    float n = fbm(q * 2.2);
    float land = smoothstep(0.5, 0.52, n);
    vec3 ocean = uColorA * (0.65 + 0.35 * fbm(q * 6.0));
    vec3 ground = mix(uColorB, vec3(0.55, 0.46, 0.32), smoothstep(0.56, 0.7, n));
    col = mix(ocean, ground, land);
    float ice = smoothstep(0.93, 0.96, abs(p.y) + 0.04 * fbm(q * 8.0));
    col = mix(col, vec3(0.92, 0.95, 1.0), ice);
    float clouds = smoothstep(0.52, 0.75, fbm(q * 4.0 + vec3(3.0)));
    col = mix(col, vec3(1.0), clouds * 0.8);
  } else if (uStyle < 3.5) {     // banded gas giant
    float warp = fbm(q * vec3(2.5, 7.0, 2.5));
    float b = sin(p.y * 16.0 + warp * 4.5);
    float fine = sin(p.y * 55.0 + fbm(q * 6.0) * 3.0);
    col = mix(uColorB, uColorA, 0.5 + 0.5 * b);
    col *= 0.9 + 0.1 * fine;
  } else if (uStyle < 4.5) {     // ice giant
    float b = sin(p.y * 9.0 + fbm(q * 2.0) * 2.0);
    col = mix(uColorB, uColorA, 0.62 + 0.38 * b);
  } else {                       // star granulation
    float warp = fbm(p * 3.0);
    float gran = fbm(p * 10.0 + warp * 2.0);
    col = mix(uColorB, uColorA, smoothstep(0.3, 0.75, gran));
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
${SURFACE_VARYINGS}

void main() {
  vec3 col = texture2D(uMap, vUv).rgb;
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uLightPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndl = dot(N, L);
  float light = smoothstep(-0.12, 0.65, ndl);
  vec3 lit = col * (0.006 + 1.25 * light);

  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 atmo = uAtmo * rim * smoothstep(-0.35, 0.5, ndl) * uHasAtmo;
  vec3 hl = vec3(1.0) * rim * uHighlight * 0.25;

  // Self-glow on the night side: lava oceans, white-hot gas giants.
  vec3 glow = uEmissive * (1.0 - light) * (0.35 + 0.65 * (1.0 - dot(col, vec3(0.333))));

  // Earth: city lights on the night side, sun glint on the oceans.
  vec3 city = uNightGain > 0.0 ? texture2D(uNight, vUv).rgb * uNightGain * (1.0 - smoothstep(-0.2, 0.08, ndl)) : vec3(0.0);
  float glint = 0.0;
  if (uOceanGain > 0.0) {
    float water = texture2D(uOcean, vUv).r;
    glint = pow(max(dot(N, normalize(L + V)), 0.0), 70.0) * water * light * uOceanGain;
  }

  gl_FragColor = vec4(lit + atmo + hl + glow + city + vec3(1.0, 0.93, 0.8) * glint, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

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

export const atmosphereFragment = /* glsl */ `
uniform vec3 uAtmo;
uniform float uLimb;
uniform float uIntensity;
${SURFACE_VARYINGS}

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(-vWorldPos);
  float g = clamp(-dot(N, V) / uLimb, 0.0, 1.0);
  float glow = pow(g, 2.2);
  float sun = smoothstep(-0.45, 0.55, dot(N, L));
  gl_FragColor = vec4(uAtmo * glow * sun * uIntensity, 1.0);
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
