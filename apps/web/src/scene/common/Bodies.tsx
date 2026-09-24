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
      uniforms: { uMap: { value: target.texture }, uBoost: { value: temperatureK < 4500 ? 1.0 : 1.25 } },
      toneMapped: false,
    });
  }, [gl, key, temperatureK]);

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

const shadowFragment = /* glsl */ `
uniform float uActive;
uniform vec3 uRing;
varying vec2 vUv;
void main() {
  // Billboard spans ±5 Rs.
  float r = length(vUv - 0.5) * 10.0;
  float shadow = step(r, 2.6);
  float ring = exp(-pow((r - 2.68) / 0.07, 2.0));
  // Lensed image of the far side of the disk, wrapped around the shadow.
  float halo = exp(-pow((r - 3.05) / 0.35, 2.0)) * uActive;
  vec3 col = uRing * (ring * 2.2 + halo * 0.9);
  float a = max(shadow, clamp(ring * 1.4 + halo * 0.8, 0.0, 1.0));
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

const diskVertex = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorld;
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const diskFragment = /* glsl */ `
uniform float uInner;
uniform float uOuter;
uniform float uTime;
uniform vec3 uCentre;
uniform vec3 uAxis;
varying vec3 vLocal;
varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec2 p = vLocal.xy;
  float r = length(p);
  float t = (r - uInner) / (uOuter - uInner);
  float th = atan(p.y, p.x);
  // Keplerian shear: inner gas laps the outer gas.
  float omega = pow(uInner / r, 1.5);
  float swirl = th + uTime * omega * 1.2 + log(r) * 3.0;
  // Sample noise on a circle so there is no seam where the angle wraps at ±π.
  vec2 ring = vec2(cos(swirl), sin(swirl));
  float rr = r / uInner;
  float n = noise(ring * 3.0 + vec2(rr * 2.0, 0.0)) * 0.6 + noise(ring * 9.0 + vec2(0.0, rr * 7.0)) * 0.4;

  // Hot white-blue inside, cooling to orange-red outside (T ∝ r^-3/4).
  vec3 hot = vec3(0.85, 0.92, 1.0);
  vec3 warm = vec3(1.0, 0.62, 0.25);
  vec3 cool = vec3(0.75, 0.2, 0.08);
  vec3 col = mix(hot, warm, smoothstep(0.0, 0.35, t));
  col = mix(col, cool, smoothstep(0.35, 1.0, t));
  float bright = pow(1.0 - t, 1.6) * (0.55 + 0.9 * n);

  // Relativistic beaming: the side turning toward us is brighter.
  vec3 radial = normalize(vWorld - uCentre);
  vec3 orbitDir = normalize(cross(uAxis, radial));
  float toward = dot(orbitDir, normalize(cameraPosition - vWorld));
  bright *= pow(1.0 + 0.45 * toward, 2.5);

  float edge = smoothstep(0.0, 0.04, t) * smoothstep(1.0, 0.8, t);
  vec3 c = col * bright * edge * 0.8;
  gl_FragColor = vec4(c / (1.0 + c * 0.35), 1.0);
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
  gl_FragColor = vec4(vec3(0.45, 0.65, 1.0) * fade * (0.03 + 0.05 * across), 1.0);
  #include <colorspace_fragment>
}
`;
const uvVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

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
  const tilt = 0.22;

  const shadow = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: uvVertex,
        fragmentShader: shadowFragment,
        uniforms: { uActive: { value: active ? 1 : 0.25 }, uRing: { value: new Color(active ? "#ffb870" : "#9fb4d8") } },
        transparent: true,
        depthWrite: true,
        toneMapped: false,
      }),
    [active],
  );

  const disk = useMemo(
    () =>
      active
        ? new ShaderMaterial({
            vertexShader: diskVertex,
            fragmentShader: diskFragment,
            uniforms: {
              uInner: { value: 3 * rs },
              uOuter: { value: diskOuterRs * rs },
              uTime: { value: 0 },
              uCentre: { value: new Vector3() },
              uAxis: { value: new Vector3(0, 1, 0) },
            },
            side: DoubleSide,
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          })
        : null,
    [active, rs, diskOuterRs],
  );

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
    disk?.dispose();
    jet?.dispose();
  }, [shadow, disk, jet]);

  useFrame(({ clock }) => {
    if (!disk || !group.current) return;
    disk.uniforms.uTime.value = clock.elapsedTime;
    group.current.getWorldPosition(disk.uniforms.uCentre.value);
    disk.uniforms.uAxis.value.set(0, Math.cos(tilt), Math.sin(tilt));
  });

  const jetLength = rs * 140;
  const jetGeometry = useMemo(() => new ConeGeometry(rs * 3.5, jetLength, 32, 1, true), [rs, jetLength]);
  useEffect(() => () => jetGeometry.dispose(), [jetGeometry]);

  return (
    <group ref={group} position={position}>
      <mesh scale={rs} raycast={() => null}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <Billboard>
        <mesh material={shadow} renderOrder={1} raycast={() => null}>
          <planeGeometry args={[rs * 10, rs * 10]} />
        </mesh>
      </Billboard>
      <group rotation={[tilt, 0, 0]}>
        {disk && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={disk} renderOrder={2} raycast={() => null}>
            <ringGeometry args={[3 * rs, diskOuterRs * rs, 256, 12]} />
          </mesh>
        )}
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

