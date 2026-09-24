import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  LineDashedMaterial,
  LineLoop,
  MeshBasicMaterial,
  ShaderMaterial,
  SpriteMaterial,
  Vector3,
  type Group,
  type Mesh,
} from "three";
import { blackbodyRGB } from "../../data/stars";
import type { ExoPlanet } from "../../data/catalog";
import type { SurfaceStyle } from "../../domain/types";
import { getBakedCustom } from "../bake";
import { sunFragment, surfaceFragment, surfaceVertex } from "../shaders";
import { BODY_TEXTURES, useRealTexture } from "../realTextures";
import { STARMAP_SOURCES } from "../Backdrop";
import { radialGlowTexture } from "./GalaxyDisks";

/* ----------------------------------------------------------- units */

export const R_SUN_KM = 695_700;
export const AU_IN_RSUN = 215.032;
export const R_EARTH_IN_RSUN = 6371 / R_SUN_KM;
export const R_JUPITER_IN_RSUN = 69_911 / R_SUN_KM;

/** Schwarzschild radius (event horizon) in solar radii. */
export function schwarzschildRadiusSolar(massSolar: number): number {
  return (2.953 * massSolar) / R_SUN_KM;
}

export function temperatureColor(tempK: number, boost = 1): Color {
  const [r, g, b] = blackbodyRGB(tempK);
  const m = Math.max(r, g, b);
  return new Color(r / m, g / m, b / m).multiplyScalar(boost);
}

/* ----------------------------------------------------------- stars */

export function StarSphere({ radius, temperatureK, position }: { radius: number; temperatureK: number; position?: Vector3 }) {
  const gl = useThree((s) => s.gl);
  const surface = useRef<Mesh>(null);
  const key = `star:${Math.round(temperatureK / 150)}`;

  const material = useMemo(() => {
    const hot = temperatureColor(temperatureK);
    const cool = temperatureColor(temperatureK * 0.72);
    const target = getBakedCustom(gl, key, { style: "star", colorA: `#${hot.getHexString()}`, colorB: `#${cool.getHexString()}` }, 1024);
    return new ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: sunFragment,
      // Cooler stars clip to yellow-white if pushed too hard; keep their colour.
      uniforms: {
        uMap: { value: target.texture },
        uBoost: { value: temperatureK < 4500 ? 1.0 : 1.25 },
        uTint: { value: hot },
        uTintMix: { value: 0 },
      },
      toneMapped: false,
    });
  }, [gl, key, temperatureK]);

  // Real solar granulation, recoloured to this star's temperature.
  const sunMap = useRealTexture(BODY_TEXTURES.sun.map);
  useEffect(() => {
    if (!sunMap) return;
    material.uniforms.uMap.value = sunMap;
    material.uniforms.uTintMix.value = 1;
    material.uniforms.uBoost.value = temperatureK < 4500 ? 1.1 : 1.25;
  }, [material, sunMap, temperatureK]);

  const corona = useMemo(
    () =>
      new SpriteMaterial({
        map: radialGlowTexture(),
        color: temperatureColor(temperatureK),
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
        toneMapped: false,
      }),
    [temperatureK],
  );

  useEffect(() => () => {
    material.dispose();
    corona.dispose();
  }, [material, corona]);

  useFrame((_, delta) => {
    if (surface.current) surface.current.rotation.y += delta * 0.03;
  });

  return (
    <group position={position}>
      <mesh ref={surface} scale={radius} material={material} raycast={() => null}>
        <sphereGeometry args={[1, 64, 48]} />
      </mesh>
      <sprite material={corona} scale={radius * 5} raycast={() => null} />
    </group>
  );
}

/* ----------------------------------------------------------- planets */

const PLANET_STYLE: Record<ExoPlanet["style"], SurfaceStyle> = {
  rocky: "rocky",
  lava: "rocky",
  ocean: "terran",
  temperate: "terran",
  ice: "ice",
  "hot-jupiter": "banded",
  gas: "banded",
  "ice-giant": "ice",
};

function emissiveFor(p: Pick<ExoPlanet, "style" | "equilibriumTempK">): Color {
  if (p.style === "lava") return new Color("#ff4a12").multiplyScalar(0.9);
  if (p.style === "hot-jupiter") {
    const t = p.equilibriumTempK ?? 1200;
    return temperatureColor(Math.max(1200, t)).multiplyScalar(Math.min(1, Math.max(0.1, (t - 1000) / 2500)));
  }
  return new Color(0, 0, 0);
}

interface PlanetBodyProps {
  planet: Pick<ExoPlanet, "id" | "style" | "colorA" | "colorB" | "equilibriumTempK">;
  radius: number;
  /** World-space light position (the host star). */
  lightPosition: Vector3;
  position?: Vector3;
  spin?: number;
}

export function PlanetBody({ planet, radius, lightPosition, position, spin = 0.2 }: PlanetBodyProps) {
  const gl = useThree((s) => s.gl);
  const mesh = useRef<Mesh>(null);
  const material = useMemo(() => {
    const target = getBakedCustom(gl, `planet:${planet.id}`, { style: PLANET_STYLE[planet.style], colorA: planet.colorA, colorB: planet.colorB }, 1024);
    const hasAtmo = planet.style === "temperate" || planet.style === "ocean" || planet.style === "gas" || planet.style === "hot-jupiter";
    return new ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
      uniforms: {
        uMap: { value: target.texture },
        uAtmo: { value: new Color(planet.style === "hot-jupiter" ? planet.colorA : "#7fb8ff") },
        uHasAtmo: { value: hasAtmo ? 0.7 : 0 },
        uHighlight: { value: 0 },
        uLightPos: { value: new Vector3() },
        uEmissive: { value: emissiveFor(planet) },
      },
    });
  }, [gl, planet]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, delta) => {
    material.uniforms.uLightPos.value.copy(lightPosition);
    if (mesh.current) mesh.current.rotation.y += delta * spin;
  });

  return (
    <mesh ref={mesh} position={position} scale={radius} material={material} raycast={() => null}>
      <sphereGeometry args={[1, 64, 48]} />
    </mesh>
  );
}

/* ----------------------------------------------------------- black holes */

const lensVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/**
 * Gravitational lensing of the real star map. Each pixel's view ray is bent
 * toward the black hole by roughly 2·Rs/b (steepening near the photon sphere),
 * then used to look up the NASA sky map — so background stars smear into arcs
 * and an Einstein ring. Rays with impact parameter below the critical
 * 3√3/2 Rs fall in: that is the shadow.
 */
const lensFragment = /* glsl */ `
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
varying vec2 vUv;
varying vec3 vWorld;

const float OBLIQUITY = 0.40909280422;
const float PI = 3.14159265359;
const float INNER = 3.0;  // innermost stable circular orbit, Rs

vec3 skyColour(vec3 d) {
  vec3 ecl = vec3(d.x, -d.z, d.y);
  float ce = cos(OBLIQUITY), se = sin(OBLIQUITY);
  vec3 eq = vec3(ecl.x, ecl.y * ce - ecl.z * se, ecl.y * se + ecl.z * ce);
  vec2 uv = vec2(fract(0.5 - atan(eq.y, eq.x) / (2.0 * PI)), 0.5 + asin(clamp(eq.z, -1.0, 1.0)) / PI);
  return texture2D(uSky, uv).rgb * uSkyGain;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// Emission of the disk at point h (Rs units, centred), seen along ray direction rd.
vec4 disk(vec3 h, vec3 rd) {
  float r = length(h);
  if (r < INNER || r > uOuter) return vec4(0.0);
  vec3 e1 = normalize(abs(uAxis.y) < 0.9 ? cross(uAxis, vec3(0, 1, 0)) : cross(uAxis, vec3(1, 0, 0)));
  vec3 e2 = cross(uAxis, e1);
  float th = atan(dot(h, e2), dot(h, e1));
  // Keplerian shear winds the gas into long streaks; sample on a circle so the angle has no seam.
  float swirl = th + uTime * pow(INNER / r, 1.5) * 0.9;
  vec2 ring = vec2(cos(swirl), sin(swirl));
  float lr = log(r);
  float n = noise(ring * 2.5 + vec2(lr * 3.0, 0.0)) * 0.55 + noise(ring * 7.0 + vec2(0.0, lr * 9.0)) * 0.45;
  n = mix(0.6, 1.25, n);
  // Thin-disk temperature profile: hot white-blue inside, orange-red outside.
  float t = (r - INNER) / (uOuter - INNER);
  vec3 col = mix(vec3(1.0, 0.93, 0.85), vec3(1.0, 0.55, 0.2), smoothstep(0.0, 0.45, t));
  col = mix(col, vec3(0.6, 0.16, 0.05), smoothstep(0.45, 1.0, t));
  float flux = pow(INNER / r, 2.2) * (1.0 - 0.75 * sqrt(INNER / r)) * 4.0;
  // Doppler beaming: gas moving toward the viewer is brighter.
  vec3 orbit = normalize(cross(uAxis, h / r));
  float toward = dot(orbit, -rd) * sqrt(0.5 / max(r - 1.0, 0.5));
  flux *= pow(max(1.0 + 1.2 * toward, 0.05), 3.0);
  float edge = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.6, t);
  float a = clamp(flux * edge * n * 0.9, 0.0, 1.0);
  return vec4(col * flux * edge * n, a);
}

// First crossing of the disk plane along o + rd·s, 0 < s < sMax.
vec4 crossDisk(vec3 o, vec3 rd, float sMax) {
  float dn = dot(rd, uAxis);
  if (abs(dn) < 1e-5) return vec4(0.0);
  float s = -dot(o, uAxis) / dn;
  if (s <= 0.0 || s > sMax) return vec4(0.0);
  return disk(o + rd * s, rd);
}

void main() {
  float edgeR = length(vUv - 0.5) * 2.0;
  if (edgeR > 1.0) discard;

  vec3 d = normalize(vWorld - cameraPosition);
  vec3 o = (cameraPosition - uCentre) / uRs;          // camera, in Rs, hole at origin
  float sQ = -dot(o, d);                              // distance to closest approach
  vec3 q = o + d * sQ;
  float b = length(q);                                // impact parameter, Rs
  float fade = 1.0 - smoothstep(0.55, 1.0, edgeR);

  // Light path as two straight legs: camera -> closest approach -> bent onward.
  vec4 front = uActive > 0.5 ? crossDisk(o, d, max(sQ, 0.0)) : vec4(0.0);
  vec3 col = vec3(0.0);
  float alphaOut = 1.0;
  if (b < 2.598) {
    col = vec3(0.0);                                  // captured: the shadow
  } else {
    float bend = 2.0 / (b - 1.35) * fade;
    vec3 toward = -q / b;
    vec3 bent = normalize(d * cos(bend) + toward * sin(bend));
    vec4 back = uActive > 0.5 ? crossDisk(q, bent, uOuter * 4.0) : vec4(0.0);
    col = back.rgb + skyColour(bent) * uHasSky * (1.0 - back.a);
    // Outside the disk, blend the patch into the ordinary sky.
    alphaOut = max(1.0 - smoothstep(0.75, 1.0, edgeR), back.a);
  }
  col = front.rgb + col * (1.0 - front.a);

  float ring = exp(-pow((b - 2.64) / 0.05, 2.0));
  col += uRing * ring * (uActive > 0.5 ? 0.45 : 0.5);
  gl_FragColor = vec4(col / (1.0 + col * 0.25), max(alphaOut, front.a));
  #include <colorspace_fragment>
}
`;

const jetFragment = /* glsl */ `
varying vec2 vUv;
void main() {
  // Brightest at the base (near the black hole), fading along the jet.
  float along = vUv.y;
  float fade = pow(along, 3.0);
  // Soften the cone's silhouette so it reads as a beam, not a solid.
  float across = sin(vUv.x * 3.14159265 * 2.0) * 0.5 + 0.5;
  gl_FragColor = vec4(vec3(0.45, 0.65, 1.0) * fade * (0.008 + 0.018 * across), 1.0);
  #include <colorspace_fragment>
}
`;
const uvVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** Disk inclination about x (radians); the close-up camera arrives just above its plane. */
export const DISK_TILT = 0.22;
/** Lensed patch diameter, in Schwarzschild radii. */
const LENS_SPAN_RS = 60;
/** Must match the close-up view's SkyDome gain so the patch blends in. */
export const LENS_SKY_GAIN = 0.55;

interface BlackHoleProps {
  /** Schwarzschild radius in scene units. */
  rs: number;
  /** Disk outer edge in Rs; 0 for a dormant black hole. */
  diskOuterRs: number;
  jets?: boolean;
  position?: Vector3;
}

export function BlackHoleBody({ rs, diskOuterRs, jets, position }: BlackHoleProps) {
  const group = useRef<Group>(null);
  const active = diskOuterRs > 0;
  const tilt = DISK_TILT;
  const lensSpan = Math.max(LENS_SPAN_RS, diskOuterRs * 2.6);

  const shadow = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: lensVertex,
        fragmentShader: lensFragment,
        uniforms: {
          uSky: { value: null },
          uSkyGain: { value: LENS_SKY_GAIN },
          uHasSky: { value: 0 },
          uCentre: { value: new Vector3() },
          uRs: { value: rs },
          uActive: { value: active ? 1 : 0 },
          uRing: { value: new Color(active ? "#ffd2a0" : "#b8c8e8") },
          uAxis: { value: new Vector3(0, Math.cos(DISK_TILT), Math.sin(DISK_TILT)) },
          uOuter: { value: Math.max(diskOuterRs, 4) },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [active, rs, diskOuterRs],
  );
  const sky = useRealTexture(STARMAP_SOURCES[0]);
  useEffect(() => {
    if (!sky) return;
    shadow.uniforms.uSky.value = sky;
    shadow.uniforms.uHasSky.value = 1;
  }, [shadow, sky]);

  const jet = useMemo(
    () =>
      jets
        ? new ShaderMaterial({
            vertexShader: uvVertex,
            fragmentShader: jetFragment,
            side: DoubleSide,
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          })
        : null,
    [jets],
  );

  useEffect(() => () => {
    shadow.dispose();
    jet?.dispose();
  }, [shadow, jet]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.getWorldPosition(shadow.uniforms.uCentre.value);
    shadow.uniforms.uTime.value = clock.elapsedTime;
  });

  const jetLength = rs * 140;
  const jetGeometry = useMemo(() => new ConeGeometry(rs * 7, jetLength, 32, 1, true), [rs, jetLength]);
  useEffect(() => () => jetGeometry.dispose(), [jetGeometry]);

  return (
    <group ref={group} position={position}>
      <mesh scale={rs} raycast={() => null}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <Billboard>
        <mesh material={shadow} renderOrder={1} raycast={() => null}>
          <planeGeometry args={[rs * lensSpan, rs * lensSpan]} />
        </mesh>
      </Billboard>
      <group rotation={[tilt, 0, 0]}>
        {jet && (
          <>
            <mesh geometry={jetGeometry} material={jet} position={[0, jetLength / 2 + rs * 3, 0]} rotation={[Math.PI, 0, 0]} raycast={() => null} />
            <mesh geometry={jetGeometry} material={jet} position={[0, -jetLength / 2 - rs * 3, 0]} raycast={() => null} />
          </>
        )}
      </group>
    </group>
  );
}

/* ----------------------------------------------------------- references */

export function OrbitRing({
  radius,
  color = "#9fb4d8",
  opacity = 0.5,
  dashed = true,
  position,
}: {
  radius: number;
  color?: string;
  opacity?: number;
  dashed?: boolean;
  position?: Vector3;
}) {
  const line = useMemo(() => {
    const pts: number[] = [];
    const n = 256;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    const m = new LineDashedMaterial({
      color,
      transparent: true,
      opacity,
      dashSize: dashed ? radius * 0.03 : radius * 10,
      gapSize: dashed ? radius * 0.025 : 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const l = new LineLoop(g, m);
    l.computeLineDistances();
    l.raycast = () => {};
    l.renderOrder = 6;
    return l;
  }, [radius, color, opacity, dashed]);
  useEffect(() => () => {
    line.geometry.dispose();
    (line.material as LineDashedMaterial).dispose();
  }, [line]);
  return <primitive object={line} position={position} />;
}

/** Habitable-zone annulus (flat, translucent green). Fades when the camera is down among the planets. */
export function HabitableZone({ inner, outer }: { inner: number; outer: number }) {
  const camera = useThree((s) => s.camera);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#3fdc8a",
        transparent: true,
        opacity: 0.08,
        side: DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    const d = camera.position.length();
    const t = Math.min(1, Math.max(0, (d - outer * 0.8) / (outer * 1.2)));
    material.opacity = 0.08 * t;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={material} raycast={() => null}>
      <ringGeometry args={[inner, outer, 128, 1]} />
    </mesh>
  );
}

