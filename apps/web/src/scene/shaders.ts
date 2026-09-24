/**
 * Procedural GLSL for all bodies. No texture assets: every surface is
 * generated from 3D value noise so the look stays consistent and stylised.
 * The Sun is assumed to sit at the world origin for lighting.
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
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return v;
}
`;

const WORLD_VARYINGS = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
`;

export const worldVertex = /* glsl */ `
${WORLD_VARYINGS}
void main() {
  vObjPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const surfaceFragment = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uAtmo;
uniform float uHasAtmo;
uniform float uStyle;
uniform float uSeed;
uniform float uHighlight;
${WORLD_VARYINGS}
${NOISE}

void main() {
  vec3 p = normalize(vObjPos);
  vec3 q = p * 1.0 + uSeed;
  vec3 col;

  if (uStyle < 0.5) {            // rocky
    float n = fbm(q * 3.0);
    float c = fbm(q * 11.0);
    col = mix(uColorB, uColorA, smoothstep(0.25, 0.75, n));
    col *= 0.75 + 0.45 * c;
  } else if (uStyle < 1.5) {     // cloudy (Venus)
    float warp = fbm(q * 3.0);
    float n = fbm(q * 2.0 + vec3(0.0, p.y * 5.0, 0.0) + warp * 1.6);
    col = mix(uColorB, uColorA, smoothstep(0.2, 0.8, n));
  } else if (uStyle < 2.5) {     // terran (Earth)
    float n = fbm(q * 2.2);
    float land = smoothstep(0.5, 0.53, n);
    vec3 ocean = uColorA * (0.65 + 0.35 * fbm(q * 6.0));
    vec3 ground = mix(uColorB, vec3(0.55, 0.46, 0.32), smoothstep(0.56, 0.7, n));
    col = mix(ocean, ground, land);
    float ice = smoothstep(0.8, 0.86, abs(p.y) + 0.06 * fbm(q * 8.0));
    col = mix(col, vec3(0.92, 0.95, 1.0), ice);
    float clouds = smoothstep(0.52, 0.75, fbm(q * 4.0 + vec3(3.0)));
    col = mix(col, vec3(1.0), clouds * 0.8);
  } else if (uStyle < 3.5) {     // banded gas giant
    float warp = fbm(q * vec3(2.5, 7.0, 2.5));
    float b = sin(p.y * 16.0 + warp * 4.5);
    float fine = sin(p.y * 55.0 + fbm(q * 6.0) * 3.0);
    col = mix(uColorB, uColorA, 0.5 + 0.5 * b);
    col *= 0.9 + 0.1 * fine;
  } else {                       // ice giant
    float b = sin(p.y * 9.0 + fbm(q * 2.0) * 2.0);
    col = mix(uColorB, uColorA, 0.62 + 0.38 * b);
  }

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(-vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndl = dot(N, L);
  float light = smoothstep(-0.12, 0.65, ndl);
  vec3 lit = col * (0.03 + 1.2 * light);

  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 atmo = uAtmo * rim * smoothstep(-0.35, 0.5, ndl) * uHasAtmo * 1.4;
  vec3 hl = vec3(0.37, 0.82, 1.0) * rim * uHighlight * 0.7;

  gl_FragColor = vec4(lit + atmo + hl, 1.0);
  #include <colorspace_fragment>
}
`;

export const atmosphereFragment = /* glsl */ `
uniform vec3 uAtmo;
uniform float uLimb;
uniform float uIntensity;
${WORLD_VARYINGS}

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(-vWorldPos);
  float g = clamp(-dot(N, V) / uLimb, 0.0, 1.0);
  float glow = pow(g, 2.2);
  float sun = smoothstep(-0.45, 0.55, dot(N, L));
  gl_FragColor = vec4(uAtmo * glow * sun * uIntensity, 1.0);
}
`;

export const sunFragment = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
${WORLD_VARYINGS}
${NOISE}

void main() {
  vec3 p = normalize(vObjPos);
  float t = uTime * 0.04;
  float warp = fbm(p * 3.0 + vec3(t));
  float gran = fbm(p * 9.0 + warp * 2.0 - vec3(t * 1.7));
  vec3 col = mix(uColorB, uColorA, smoothstep(0.3, 0.75, gran));

  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = max(dot(N, V), 0.0);
  float limb = 0.55 + 0.45 * pow(mu, 0.5);
  gl_FragColor = vec4(col * limb * 3.2, 1.0);
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
uniform float uTime;
varying vec2 vUv;
${NOISE}

void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float a = atan(c.y, c.x);
  float rays = 0.75 + 0.25 * vnoise(vec3(cos(a) * 3.0, sin(a) * 3.0, uTime * 0.15));
  float falloff = pow(max(1.0 - r, 0.0), 3.5) * rays;
  float core = pow(max(1.0 - r, 0.0), 12.0);
  gl_FragColor = vec4(uColor * (falloff * 1.3 + core * 2.0), 1.0);
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
varying vec2 vLocal;
varying vec3 vWorldPos;
${NOISE}

void main() {
  float r = length(vLocal);
  float t = (r - uInner) / (uOuter - uInner);
  float bands = 0.55 + 0.45 * sin(t * 90.0 + sin(t * 23.0) * 2.0);
  float grain = 0.6 + 0.4 * vnoise(vec3(t * 140.0, 0.0, 0.0));
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
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

export const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const skyFragment = /* glsl */ `
varying vec3 vDir;
${NOISE}

void main() {
  vec3 d = normalize(vDir);
  float n = fbm(d * 2.2);
  float m = fbm(d * 4.5 + n * 1.5);
  vec3 violet = vec3(0.05, 0.012, 0.09);
  vec3 teal = vec3(0.0, 0.05, 0.075);
  vec3 col = mix(violet, teal, m) * smoothstep(0.38, 0.8, n) * 0.9;

  // Faint Milky Way band. Galactic north pole ≈ ecliptic (λ 180°, β +29.8°),
  // mapped into render axes.
  vec3 galPole = normalize(vec3(-0.868, 0.497, 0.0));
  float band = exp(-pow(dot(d, galPole) * 5.0, 2.0));
  col += vec3(0.05, 0.045, 0.06) * band * (0.4 + 0.8 * fbm(d * 7.0));

  gl_FragColor = vec4(col, 1.0);
}
`;
