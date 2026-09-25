import { BackSide, Color, CustomBlending, FrontSide, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial, Vector3 } from "three";
import { graphics } from "../state/graphicsStore";

/**
 * Atmospheres by single scattering: each pixel marches its view ray through
 * the shell, and at every sample adds sunlight scattered toward the camera
 * by molecules (Rayleigh: ∝ λ⁻⁴, which makes skies blue and sunsets red) and
 * by aerosols or dust (Mie: strongly forward, Henyey–Greenstein phase),
 * dimmed by extinction along both the sun path and the view path. Densities
 * fall off exponentially with height.
 *
 * Shells are drawn thicker than real atmospheres (which would be a hair's
 * width at these scales), so coefficients are set from each world's measured
 * vertical optical depth: the colours and the balance of haze are right even
 * though the height is exaggerated.
 *
 * Blending is premultiplied: result = in-scattered light + background ×
 * transmittance, so the atmosphere both glows and veils the surface and stars
 * behind it.
 */

export interface AtmospherePreset {
  /** Vertical Rayleigh optical depth at R, G, B (≈ 680, 550, 440 nm). */
  rayleigh: [number, number, number];
  /** Vertical aerosol/dust optical depth, and its scattering colour. */
  mie: number;
  mieColor: [number, number, number];
  /** Henyey–Greenstein asymmetry: 0 isotropic, → 1 strongly forward. */
  g: number;
  /** Shell thickness, planet radii (visual). */
  thickness: number;
  /** Overall sunlight strength. */
  sun: number;
}

/** Earth: τ_R(550 nm) ≈ 0.10, clear-sky aerosols τ ≈ 0.05–0.1 (AERONET). */
const EARTH: AtmospherePreset = { rayleigh: [0.046, 0.108, 0.265], mie: 0.06, mieColor: [1, 1, 1], g: 0.76, thickness: 0.035, sun: 22 };

/**
 * Where a world's map already shows its cloud tops (Venus, the giants, Titan),
 * the shell holds only the haze above them, so its optical depth is small.
 */
export const ATMOSPHERES: Record<string, AtmospherePreset> = {
  earth: EARTH,
  // Sulfuric-acid haze above the cloud deck: faint, yellow-white.
  venus: { rayleigh: [0.02, 0.045, 0.1], mie: 0.22, mieColor: [1, 0.93, 0.72], g: 0.7, thickness: 0.04, sun: 16 },
  // 6 mbar of CO₂ with suspended dust (τ ≈ 0.5): butterscotch haze, thin blue limb.
  mars: { rayleigh: [0.004, 0.009, 0.02], mie: 0.35, mieColor: [1, 0.72, 0.48], g: 0.65, thickness: 0.03, sun: 20 },
  // Hydrogen over the ammonia cloud tops, with a little stratospheric haze.
  jupiter: { rayleigh: [0.006, 0.014, 0.032], mie: 0.05, mieColor: [1, 0.9, 0.75], g: 0.7, thickness: 0.02, sun: 16 },
  saturn: { rayleigh: [0.006, 0.014, 0.032], mie: 0.07, mieColor: [1, 0.9, 0.72], g: 0.7, thickness: 0.022, sun: 16 },
  // Methane absorbs red: the limb glows blue-green.
  uranus: { rayleigh: [0.015, 0.05, 0.11], mie: 0.03, mieColor: [0.8, 1, 1], g: 0.6, thickness: 0.03, sun: 18 },
  neptune: { rayleigh: [0.012, 0.04, 0.13], mie: 0.03, mieColor: [0.7, 0.85, 1], g: 0.6, thickness: 0.03, sun: 18 },
  // Orange tholin haze, with the detached blue layer Cassini saw at the limb.
  titan: { rayleigh: [0.02, 0.05, 0.12], mie: 0.35, mieColor: [1, 0.62, 0.26], g: 0.65, thickness: 0.1, sun: 16 },
  // Thin nitrogen haze with blue layers (New Horizons).
  pluto: { rayleigh: [0.01, 0.025, 0.07], mie: 0.05, mieColor: [0.7, 0.85, 1], g: 0.6, thickness: 0.05, sun: 20 },
};

/** A preset for worlds without one: Rayleigh-like, tinted by the catalogue's atmosphere colour. */
export function presetFromColor(color: string, strength = 0.12): AtmospherePreset {
  const c = new Color(color);
  return { rayleigh: [0.2 * c.r * strength * 5, 0.2 * c.g * strength * 5, 0.2 * c.b * strength * 5], mie: 0.08, mieColor: [c.r, c.g, c.b], g: 0.7, thickness: 0.035, sun: 18 };
}

const vertex = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const fragment = (primary: number, light: number) => /* glsl */ `
#define PRIMARY ${primary}
#define LIGHT ${light}
uniform vec3 uCentre;
uniform float uRadius;       // planet radius (world)
uniform float uTop;          // atmosphere top, planet radii
uniform vec3 uSunPos;
uniform vec3 uBetaR;         // Rayleigh scattering per planet radius at ground level
uniform vec3 uBetaM;         // Mie scattering per planet radius at ground level
uniform float uHR;           // scale heights, planet radii
uniform float uHM;
uniform float uG;
uniform float uSun;
varying vec3 vWorldPos;

const float PI = 3.14159265359;

// Ray-sphere (origin-centred) intersection: returns (near, far), or near > far for a miss.
vec2 sphere(vec3 o, vec3 d, float r) {
  float b = dot(o, d);
  float c = dot(o, o) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

void main() {
  // Work in planet radii with the planet at the origin.
  vec3 o = (cameraPosition - uCentre) / uRadius;
  vec3 d = normalize(vWorldPos - cameraPosition);
  vec3 L = normalize(uSunPos - uCentre);
  vec2 atm = sphere(o, d, uTop);
  if (atm.x > atm.y) discard;
  float t0 = max(atm.x, 0.0);
  float t1 = atm.y;
  vec2 ground = sphere(o, d, 1.0);
  if (ground.x < ground.y && ground.x > 0.0) t1 = min(t1, ground.x);
  if (t1 <= t0) discard;

  float ds = (t1 - t0) / float(PRIMARY);
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odR = 0.0, odM = 0.0;
  for (int i = 0; i < PRIMARY; i++) {
    vec3 p = o + d * (t0 + ds * (float(i) + 0.5));
    float h = length(p) - 1.0;
    float dR = exp(-h / uHR) * ds;
    float dM = exp(-h / uHM) * ds;
    odR += dR;
    odM += dM;
    // Light path to the sun; in the planet's shadow, no direct light.
    vec2 sp = sphere(p, L, 1.0);
    if (sp.x < sp.y && sp.x > 0.0) continue;
    float tl = sphere(p, L, uTop).y;
    float dl = tl / float(LIGHT);
    float lR = 0.0, lM = 0.0;
    for (int j = 0; j < LIGHT; j++) {
      float hl = length(p + L * dl * (float(j) + 0.5)) - 1.0;
      lR += exp(-hl / uHR) * dl;
      lM += exp(-hl / uHM) * dl;
    }
    vec3 tau = uBetaR * (odR + lR) + uBetaM * 1.1 * (odM + lM);
    vec3 att = exp(-tau);
    sumR += att * dR;
    sumM += att * dM;
  }
  float mu = dot(d, L);
  float phaseR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
  float g2 = uG * uG;
  float phaseM = 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * uG * mu, 1.5));
  vec3 inscatter = uSun * (sumR * uBetaR * phaseR + sumM * uBetaM * phaseM);
  // Transmittance of the view path veils what lies behind (averaged: blending has one alpha).
  vec3 T = exp(-(uBetaR * odR + uBetaM * 1.1 * odM));
  float alpha = 1.0 - dot(T, vec3(0.3333));
  // Soft tone curve so the thick Venus and Titan veils don't clip.
  inscatter = inscatter / (1.0 + inscatter * 0.6);
  gl_FragColor = vec4(inscatter, clamp(alpha, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

export interface AtmosphereHandle {
  material: ShaderMaterial;
  /** Shell radius as a multiple of the planet's. */
  scale: number;
  /** Per frame: planet centre and radius (world), sun position, camera position. */
  update: (centre: Vector3, radius: number, sun: Vector3, camera: Vector3) => void;
}

export function createAtmosphere(preset: AtmospherePreset): AtmosphereHandle {
  const top = 1 + preset.thickness;
  // Scale heights: gas ~¼ of the shell, haze lower down.
  const hR = preset.thickness * 0.25;
  const hM = preset.thickness * 0.12;
  // β = τ / H makes the vertical optical depth come out right.
  const betaR = new Vector3(...preset.rayleigh).divideScalar(hR);
  const betaM = new Vector3(...preset.mieColor).multiplyScalar(preset.mie / hM);
  // Samples by graphics tier (the black-hole step budget tracks the GPU tier).
  const steps = graphics().lensSteps;
  const [primary, light] = steps < 90 ? [6, 2] : steps < 140 ? [8, 3] : [10, 5];
  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment(primary, light),
    uniforms: {
      uCentre: { value: new Vector3() },
      uRadius: { value: 1 },
      uTop: { value: top },
      uSunPos: { value: new Vector3() },
      uBetaR: { value: betaR },
      uBetaM: { value: betaM },
      uHR: { value: hR },
      uHM: { value: hM },
      uG: { value: preset.g },
      uSun: { value: preset.sun },
    },
    side: FrontSide,
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    toneMapped: false,
  });
  return {
    material,
    scale: top,
    update: (centre, radius, sun, camera) => {
      const u = material.uniforms;
      u.uCentre.value.copy(centre);
      u.uRadius.value = radius;
      u.uSunPos.value.copy(sun);
      // From inside the shell, draw its far side instead, over everything in the way.
      const inside = camera.distanceTo(centre) < radius * top;
      material.side = inside ? BackSide : FrontSide;
      material.depthTest = !inside;
    },
  };
}
