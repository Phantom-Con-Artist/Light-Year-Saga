/**
 * Black hole close-up: light traced through Schwarzschild spacetime.
 *
 * Units: Schwarzschild radius Rs = 1 (G = c = 1, M = ½). A photon's spatial
 * path obeys, exactly, x″ = −(3/2) h² x / r⁵ with h = |x × x′| its (conserved)
 * angular momentum per unit energy — the Newtonian form of the Binet
 * equation u″ + u = (3/2) u². Each pixel integrates that path backwards from
 * the camera (leapfrog, step ∝ r), so everything follows from the geometry:
 *
 * - the shadow (rays with h < 3√3/2 fall through the horizon),
 * - the photon ring (rays that loop the photon sphere at r = 1.5),
 * - the far side of the disk lifted over the top and bottom of the shadow,
 * - secondary images of the disk and Einstein arcs of the background sky.
 *
 * The disk: thin, optically thick, Keplerian, inner edge at the ISCO (r = 3).
 * Temperature follows the Novikov–Thorne profile
 *   T ∝ r^−¾ (1 − √(3/r))^¼,
 * and every hit is shifted by g = ν_obs/ν_emit = √(1 − 3M/r) / (1 − Ω L_z),
 * which combines Doppler beaming (the approaching side is brighter and bluer)
 * and gravitational redshift. Observed temperature is g·T and brightness goes
 * as g⁴ (Liouville: I/ν³ is invariant), with the radial profile compressed
 * for display. Colours are the true blackbody hues of a disk scaled into
 * visible light: real disks peak in the ultraviolet (supermassive) or X-rays
 * (stellar-mass).
 *
 * Pixels whose rays never come near the hole use the weak-field deflection
 * 2Rs/b analytically, so the ray-march runs only where light actually bends.
 */
export const blackHoleFragment = /* glsl */ `
uniform sampler2D uSky;
uniform float uSkyGain;
uniform float uHasSky;
uniform vec3 uCentre;
uniform float uRs;
uniform float uActive;
uniform vec3 uRing;
uniform vec3 uAxis;       // disk normal (world)
uniform float uOuter;     // disk outer edge, Rs
uniform float uTime;
uniform float uLens;      // 0: no sky lensing (objects placed side by side in the size line-up)
uniform int uSteps;
uniform float uTpeak;     // display temperature at the disk's hottest radius, K
varying vec2 vUv;
varying vec3 vWorld;

const float OBLIQUITY = 0.40909280422;
const float PI = 3.14159265359;
const float ISCO = 3.0;
const float F_PEAK = 0.21407;   // max of r^-3/4 (1 - sqrt(3/r))^1/4, at r = 49/12
const int MAX_STEPS = 320;

vec2 skyUv(vec3 d) {
  vec3 ecl = vec3(d.x, -d.z, d.y);
  float ce = cos(OBLIQUITY), se = sin(OBLIQUITY);
  vec3 eq = vec3(ecl.x, ecl.y * ce - ecl.z * se, ecl.y * se + ecl.z * ce);
  return vec2(fract(0.5 - atan(eq.y, eq.x) / (2.0 * PI)), 0.5 + asin(clamp(eq.z, -1.0, 1.0)) / PI);
}

// Sample the bent direction at the sharpness of the unbent sky, so the patch
// matches the backdrop instead of falling to a blurry mip level.
vec3 skyColour(vec3 bent, vec3 straight) {
  vec2 uv0 = skyUv(straight);
  vec2 alt = vec2(fract(uv0.x + 0.5), uv0.y);
  vec2 dx = dFdx(uv0), dy = dFdy(uv0);
  vec2 dxA = dFdx(alt), dyA = dFdy(alt);
  if (abs(dxA.x) + abs(dyA.x) < abs(dx.x) + abs(dy.x)) { dx = dxA; dy = dyA; }
  return textureGrad(uSky, skyUv(bent), dx, dy).rgb * uSkyGain;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

/** Blackbody colour: Planck's law sampled at red, green and blue wavelengths (µm), max-normalised. */
vec3 blackbody(float T) {
  vec3 lam = vec3(0.61, 0.55, 0.465);
  vec3 b = 1.0 / (pow(lam, vec3(5.0)) * (exp(14388.0 / (lam * max(T, 500.0))) - 1.0));
  return b / max(max(b.r, b.g), b.b);
}

/** Emission of the disk at hit (Rs, hole at origin); v = the traced ray's direction there. */
vec4 disk(vec3 hit, vec3 v) {
  float r = length(hit);
  if (r < ISCO || r > uOuter) return vec4(0.0);
  float f = pow(r, -0.75) * pow(max(1.0 - sqrt(ISCO / r), 0.0), 0.25) / F_PEAK;

  // Redshift factor: the photon we see left the disk along −v; its angular momentum per energy is hit × (−v).
  float omega = sqrt(0.5 / (r * r * r));
  float Lz = dot(cross(hit, -v), uAxis);
  float g = sqrt(max(1.0 - 1.5 / r, 1e-4)) / max(1.0 - omega * Lz, 0.05);

  // Keplerian shear winds turbulence into streaks; the inner disk laps the outer.
  vec3 e1 = normalize(abs(uAxis.y) < 0.9 ? cross(uAxis, vec3(0, 1, 0)) : cross(uAxis, vec3(1, 0, 0)));
  vec3 e2 = cross(uAxis, e1);
  float th = atan(dot(hit, e2), dot(hit, e1)) - uTime * omega * 6.0;
  vec2 ring = vec2(cos(th), sin(th));
  float lr = log(r);
  float n = noise(ring * 2.5 + vec2(lr * 3.0, 0.0)) * 0.55 + noise(ring * 7.0 + vec2(0.0, lr * 9.0)) * 0.45;
  n = mix(0.55, 1.3, n);

  vec3 col = blackbody(uTpeak * f * g);
  // Bolometric g⁴; the radial fall-off (∝ T⁴ ∝ f⁴) softened to f³ so the outer disk stays visible.
  float flux = pow(g, 4.0) * pow(f, 3.0) * n * 0.75;
  float edge = smoothstep(uOuter, uOuter * 0.82, r) * smoothstep(ISCO, ISCO * 1.04, r);
  return vec4(col * flux * edge, 0.96 * edge);
}

/** Weak-field deflection accumulated along a straight line from −∞ to signed distance s (s = 0 at closest approach). */
float partialDeflection(float b, float s) {
  float q = b * b + s * s;
  float F = s * (2.0 * s * s + 3.0 * b * b) / (3.0 * b * b * b * b * q * sqrt(q));
  return 1.5 * b * b * b * (F + 2.0 / (3.0 * b * b * b * b));
}

void main() {
  float edgeR = length(vUv - 0.5) * 2.0;
  if (edgeR > 1.0) discard;
  float fade = 1.0 - smoothstep(0.55, 1.0, edgeR);

  vec3 d = normalize(vWorld - cameraPosition);
  vec3 o = (cameraPosition - uCentre) / uRs;
  float D = length(o);
  vec3 c = -o / D;
  // Impact parameter from |d × c| = sin θ: precise even at a distant hole's tiny angles.
  vec3 dc = cross(d, c);
  float sinT = length(dc);
  float b = D * sinT;
  float sQ = D * dot(d, c);
  vec3 toHole = sinT > 1e-12 ? normalize(cross(dc, d)) : vec3(0.0, 1.0, 0.0);

  float rFar = max(uOuter * 1.15, 14.0);
  vec3 col = vec3(0.0);
  float trans = 1.0;          // how much of what lies behind still shows
  vec3 outDir = d;
  bool captured = false;

  if (b > rFar || uLens < 0.5 && uActive < 0.5) {
    // Never comes close: straight line, bent once by 2Rs/b (faded out toward the patch edge).
    float bend = 2.0 / max(b, 1.0) * fade * uLens;
    outDir = normalize(d * cos(bend) + toHole * sin(bend));
  } else {
    // Start on a sphere just outside the disk, having picked up the far-field bending on the way in.
    float rStart = rFar * 1.3;
    vec3 x = o;
    vec3 v = d;
    if (D > rStart) {
      float s0 = -sqrt(max(rStart * rStart - b * b, 0.0));
      x = o + d * (sQ + s0);
      v = normalize(d + toHole * partialDeflection(b, s0) * uLens);
    }
    float h2 = dot(cross(x, v), cross(x, v));
    float kick = 1.5 * h2 * uLens;
    for (int i = 0; i < MAX_STEPS; i++) {
      // Out of steps: only rays still skimming the photon sphere count as captured.
      if (i >= uSteps) { captured = length(x) < 2.0; break; }
      float r = length(x);
      if (r < 1.0) { captured = true; break; }
      if (r > rStart * 1.02 && dot(x, v) > 0.0) break;
      float dt = max(0.02, 0.15 * r) * (r < 4.0 ? 0.5 : 1.0);
      // Leapfrog: kick, drift, kick.
      vec3 a0 = -kick * x / (r * r * r * r * r);
      v += 0.5 * dt * a0;
      vec3 xn = x + dt * v;
      float rn = length(xn);
      vec3 a1 = -kick * xn / (rn * rn * rn * rn * rn);
      v += 0.5 * dt * a1;
      // Crossed the disk plane? Composite front to back.
      if (uActive > 0.5) {
        float s0 = dot(x, uAxis);
        float s1 = dot(xn, uAxis);
        if (s0 * s1 < 0.0) {
          vec3 hit = mix(x, xn, s0 / (s0 - s1));
          vec4 e = disk(hit, normalize(v));
          col += trans * e.rgb;
          trans *= 1.0 - e.a;
          if (trans < 0.02) break;
        }
      }
      x = xn;
    }
    if (!captured) {
      // Remaining far-field bending from here out to infinity.
      vec3 vn = normalize(v);
      vec3 perp = x - vn * dot(x, vn);
      float bb = max(length(perp), 1.0);
      float sE = dot(x, vn);
      float rest = 2.0 / bb - partialDeflection(bb, sE);
      outDir = normalize(vn - normalize(perp) * rest * uLens * fade);
    }
  }

  float alphaOut;
  if (captured) {
    alphaOut = 1.0;           // the shadow: nothing behind shows
  } else {
    col += trans * skyColour(outDir, d) * uHasSky * uLens;
    // Outside the lensing core, blend the patch into the ordinary sky.
    alphaOut = uLens > 0.5 ? max(1.0 - smoothstep(0.75, 1.0, edgeR), 1.0 - trans) : 1.0 - trans;
  }
  // In the size line-up (no sky) a faint rim marks the shadow's edge.
  if (uLens < 0.5) {
    float ring = exp(-pow((b - 2.6) / 0.05, 2.0));
    col += uRing * ring * 0.5;
    alphaOut = max(alphaOut, clamp(ring * 2.0, 0.0, 1.0));
  }
  if (alphaOut < 0.004) discard;
  gl_FragColor = vec4(col / (1.0 + col * 0.25), alphaOut);
  #include <colorspace_fragment>
}
`;
