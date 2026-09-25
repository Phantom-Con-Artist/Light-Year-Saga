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
import { cloudFragment, sunFragment, surfaceFragment, surfaceUniforms, surfaceVertex } from "../shaders";
import { ATMOSPHERES, createAtmosphere, presetFromColor, type AtmospherePreset } from "../atmosphere";
import { BODY_TEXTURES, useRealTexture } from "../realTextures";
import { STARMAP_SOURCES } from "../Backdrop";
import { radialGlowTexture } from "./GalaxyDisks";
import { blackHoleFragment } from "./blackHoleShader";
import { graphics } from "../../state/graphicsStore";

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
    // Sun-like stars keep the photographed colour; hotter and cooler ones take their own.
    material.uniforms.uTintMix.value = 0.2 + 0.8 * Math.min(1, Math.max(0, (Math.abs(temperatureK - 5772) - 300) / 1500));
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
  ocean: "terran-clear",
  temperate: "terran-clear",
  ice: "ice",
  "hot-jupiter": "banded",
  gas: "banded",
  "ice-giant": "ice",
};

/** Lighting model and atmosphere by world type (see surfaceFragment and atmosphere.ts). */
function worldModel(p: Pick<ExoPlanet, "style" | "colorA">): { surface: Parameters<typeof surfaceUniforms>[0]; atmosphere: AtmospherePreset | null; clouds: boolean } {
  switch (p.style) {
    case "rocky":
      return { surface: { bump: 2.2, airless: 1 }, atmosphere: null, clouds: false };
    case "lava":
      return { surface: { bump: 1.6, airless: 0.6 }, atmosphere: null, clouds: false };
    case "ice":
      return { surface: { bump: 1.2, airless: 0.8 }, atmosphere: null, clouds: false };
    case "ocean":
    case "temperate":
      return { surface: { bump: 0.5, rough: 0.9, waterKey: 1 }, atmosphere: ATMOSPHERES.earth, clouds: true };
    case "gas":
      return { surface: { minnaert: 0.85 }, atmosphere: ATMOSPHERES.jupiter, clouds: false };
    case "ice-giant":
      return { surface: { minnaert: 0.85 }, atmosphere: ATMOSPHERES.neptune, clouds: false };
    case "hot-jupiter":
      return { surface: { minnaert: 0.8 }, atmosphere: presetFromColor(p.colorA, 0.3), clouds: false };
  }
}

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
        uNight: { value: null },
        uNightGain: { value: 0 },
        uOcean: { value: null },
        uOceanGain: { value: 0 },
        ...surfaceUniforms(worldModel(planet).surface),
      },
    });
  }, [gl, planet]);
  useEffect(() => () => material.dispose(), [material]);

  // A cloud deck on its own layer, turning a little faster than the ground, shading it.
  const clouds = useMemo(() => {
    if (!worldModel(planet).clouds) return null;
    const map = getBakedCustom(gl, `clouds:${planet.id}`, { style: "clouds", colorA: "#ffffff", colorB: "#ffffff" }, 1024).texture;
    material.uniforms.uClouds.value = map;
    material.uniforms.uCloudShadow.value = 0.35;
    return new ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: cloudFragment,
      uniforms: { uMap: { value: map }, uLightPos: material.uniforms.uLightPos },
      transparent: true,
      depthWrite: false,
    });
  }, [gl, planet, material]);
  useEffect(() => () => clouds?.dispose(), [clouds]);

  const atmosphere = useMemo(() => {
    const preset = worldModel(planet).atmosphere;
    return preset ? createAtmosphere(preset) : null;
  }, [planet]);
  useEffect(() => () => atmosphere?.material.dispose(), [atmosphere]);
  const cloudMesh = useRef<Mesh>(null);
  const centre = useMemo(() => new Vector3(), []);
  const camera = useThree((s) => s.camera);

  // Solar System worlds (e.g. in the size line-up) use their real surface maps.
  const real = useRealTexture(BODY_TEXTURES[planet.id]?.map);
  useEffect(() => {
    if (real) material.uniforms.uMap.value = real;
  }, [material, real]);

  useFrame((_, delta) => {
    material.uniforms.uLightPos.value.copy(lightPosition);
    if (mesh.current) {
      mesh.current.rotation.y += delta * spin;
      mesh.current.getWorldPosition(centre);
    }
    if (cloudMesh.current && mesh.current) {
      cloudMesh.current.rotation.y = mesh.current.rotation.y * 1.15;
      // Shadows under the clouds follow the layer's offset.
      material.uniforms.uCloudShift.value.set((mesh.current.rotation.y * 0.15) / (Math.PI * 2), 0);
    }
    atmosphere?.update(centre, radius, lightPosition, camera.position);
  });

  return (
    <group position={position}>
      <mesh ref={mesh} scale={radius} material={material} raycast={() => null}>
        <sphereGeometry args={[1, 64, 48]} />
      </mesh>
      {clouds && (
        <mesh ref={cloudMesh} scale={radius * 1.008} material={clouds} renderOrder={1} raycast={() => null}>
          <sphereGeometry args={[1, 64, 48]} />
        </mesh>
      )}
      {atmosphere && (
        <mesh scale={radius * atmosphere.scale} material={atmosphere.material} renderOrder={3} raycast={() => null}>
          <sphereGeometry args={[1, 64, 48]} />
        </mesh>
      )}
    </group>
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
  /** Bend the background sky (off where objects are artificially side by side). */
  lensing?: boolean;
}

export function BlackHoleBody({ rs, diskOuterRs, jets, position, lensing = true }: BlackHoleProps) {
  const group = useRef<Group>(null);
  const active = diskOuterRs > 0;
  const tilt = DISK_TILT;
  const lensSpan = Math.max(LENS_SPAN_RS, diskOuterRs * 2.6);

  const shadow = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: lensVertex,
        fragmentShader: blackHoleFragment,
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
          uLens: { value: lensing ? 1 : 0 },
          uSteps: { value: graphics().lensSteps },
          uTpeak: { value: 5_400 },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [active, rs, diskOuterRs, lensing],
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
    shadow.uniforms.uSteps.value = graphics().lensSteps;
  });

  const jetLength = rs * 140;
  const jetGeometry = useMemo(() => new ConeGeometry(rs * 7, jetLength, 32, 1, true), [rs, jetLength]);
  useEffect(() => () => jetGeometry.dispose(), [jetGeometry]);

  return (
    <group ref={group} position={position}>
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

