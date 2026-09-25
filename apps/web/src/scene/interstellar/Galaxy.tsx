import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  CustomBlending,
  SrcColorFactor,
  ZeroFactor,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderTarget,
  type Group,
  type PerspectiveCamera,
  type WebGLRenderer,
} from "three";
import { GALACTIC_CENTRE, GALACTOCENTRIC_TO_RENDER, SUN_GALACTOCENTRIC } from "../../astronomy/galactic";
import { selectObject } from "../../state/selectionStore";
import { bakeVertex } from "../shaders";
import { ScreenLabel } from "../ScreenLabel";
import { ARMS, BAR_ANGLE, GALAXY_EXTENT_LY, ORION_SPUR, PITCH_TAN, armAngleAt, galaxyBakeFragment, generateGalaxyCloud, type PointLayer } from "./galaxyModel";
import { galaxyOpacity, smoothstep } from "./visibility";
import { useGraphicsStore } from "../../state/graphicsStore";
import { createProceduralGalaxy, galaxyBudget, updateProceduralGalaxy } from "./galaxyPoints";

/** Real catalogue stars cover this radius around the Sun; the model stays out of it. */
const REAL_STAR_RADIUS_LY = 3_200;

/** Stacked disk layers: height above the plane (ly) and weight. Gives the disk thickness edge-on. */
const LAYERS: [number, number][] = [
  [-700, 0.07],
  [-300, 0.16],
  [0, 0.54],
  [300, 0.16],
  [700, 0.07],
];

let bakedTarget: WebGLRenderTarget | null = null;

export function bakeGalaxy(gl: WebGLRenderer): WebGLRenderTarget {
  if (bakedTarget) return bakedTarget;
  const size = Math.min(2048, gl.capabilities.maxTextureSize);
  const target = new WebGLRenderTarget(size, size, {
    colorSpace: SRGBColorSpace,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
  target.texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());

  const material = new ShaderMaterial({
    vertexShader: bakeVertex,
    fragmentShader: galaxyBakeFragment,
    uniforms: {
      uExtent: { value: GALAXY_EXTENT_LY },
      uTanP: { value: PITCH_TAN },
      uBarAngle: { value: BAR_ANGLE },
      uArmR: { value: ARMS.map((a) => a.radiusAtSun) },
      uArmS: { value: ARMS.map((a) => a.strength) },
      uSpur: { value: new Vector3(ORION_SPUR.radiusAtSun, ORION_SPUR.strength, ORION_SPUR.halfSpan) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  gl.render(scene, new OrthographicCamera(-1, 1, 1, -1, 0, 1));
  gl.setRenderTarget(previous);
  material.dispose();
  geometry.dispose();

  bakedTarget = target;
  return target;
}

const layerVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const layerFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uGain;
uniform float uLayerWeight;
uniform float uThick;       // 1 for the mid-plane, 0 for outer layers (bulge-only)
uniform float uEdgeOn;      // keep a thin edge-on disk only when viewing from outside the galaxy
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
  vec3 col = texture2D(uMap, vUv).rgb;
  // Outer layers only carry the thick central bulge, not the thin disk.
  float r = length(vUv - 0.5) * 2.0;
  float bulgeOnly = mix(exp(-r / 0.12), 1.0, uThick);
  // Planes seen at grazing angles, or right next to the camera, would smear
  // across the screen (e.g. when the camera sits inside the disk). Fade them.
  vec3 toCam = cameraPosition - vWorldPos;
  float facing = abs(dot(normalize(toCam), vNormalW));
  float edge = mix(uThick * 0.2 * uEdgeOn, 1.0, smoothstep(0.03, 0.35, facing));
  float near = smoothstep(1500.0, 7000.0, length(toCam));
  vec3 c = col * uGain * bulgeOnly * edge * near;
  c = c / (1.0 + c * 0.35);   // gentle highlight roll-off so the core never clips to flat white
  gl_FragColor = vec4(c * uLayerWeight, 1.0);
  #include <colorspace_fragment>
}
`;

/* Point-cloud Milky Way. uFocal is the camera's focal length in CSS pixels. */

const cloudStarVertex = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
uniform float uFocal;
uniform float uOpacity;
uniform float uPixelRatio;
uniform float uMaxPx;
uniform float uTime;
uniform float uTwinkle;
varying vec3 vColor;
varying float vAlpha;
varying float vGlint;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 1.0);
  // Apparent size from brightness and distance; below a pixel, conserve light as alpha instead.
  float px = aSize * uFocal * 50.0 / depth;
  float size = clamp(px, 1.0, uMaxPx);
  float seed = fract(sin(float(gl_VertexID) * 12.9898) * 43758.5453);
  float tw = 1.0 + uTwinkle * 0.45 * sin(uTime * (1.2 + 3.0 * seed) + seed * 40.0);
  gl_PointSize = size * uPixelRatio;
  vAlpha = uOpacity * min(1.0, px * px) * tw;
  // Right in front of the camera these read as snow; let them go.
  vAlpha *= smoothstep(900.0, 4500.0, depth);
  vGlint = smoothstep(2.5, uMaxPx, px);
  vColor = aColor;
  if (vAlpha < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const cloudStarFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vGlint;
void main() {
  vec2 c = (gl_PointCoord - 0.5) * 2.0;
  float core = exp(-dot(c, c) * 5.0);
  // Bright giants get a small diamond sparkle.
  float diamond = exp(-(abs(c.x) + abs(c.y)) * 4.0) * vGlint * 0.6;
  float a = (core + diamond) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.3) * a, 1.0);
  #include <colorspace_fragment>
}
`;

/** Dust and gas: soft sprites with a real size in light-years. */
const cloudSpriteVertex = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
uniform float uFocal;
uniform float uOpacity;
uniform float uPixelRatio;
uniform float uMaxPx;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 1.0);
  float px = aSize * 2.0 * uFocal / depth;
  gl_PointSize = min(px, uMaxPx) * uPixelRatio;
  // Too small to matter, or too big to draw cheaply (the camera is inside it): fade out.
  vAlpha = aAlpha * uOpacity * smoothstep(1.5, 5.0, px) * (1.0 - smoothstep(uMaxPx * 0.6, uMaxPx, px));
  // Individual clouds near the camera read as blobs; gas and dust only work en masse.
  vAlpha *= smoothstep(3000.0, 14000.0, depth);
  vColor = aColor;
  if (vAlpha < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const gasFragment = /* glsl */ `
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
const dustFragment = /* glsl */ `
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

function cloudPoints(layer: PointLayer, vertexShader: string, fragmentShader: string, blend: "add" | "dust", renderOrder: number) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(layer.positions, 3));
  geometry.setAttribute("aColor", new BufferAttribute(layer.colors, 3));
  geometry.setAttribute("aSize", new BufferAttribute(layer.sizes, 1));
  geometry.setAttribute("aAlpha", new BufferAttribute(layer.alphas, 1));
  if (layer.sizes.length === 0) geometry.setDrawRange(0, 0);
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uFocal: { value: 1000 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: 1 },
      uMaxPx: { value: 3 },
      uTime: { value: 0 },
      uTwinkle: { value: 0 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  if (blend === "add") material.blending = AdditiveBlending;
  else {
    // Absorption: framebuffer × fragment colour. Order-independent, so no sorting needed.
    material.blending = CustomBlending;
    material.blendSrc = ZeroFactor;
    material.blendDst = SrcColorFactor;
  }
  const p = new Points(geometry, material);
  p.frustumCulled = false;
  p.renderOrder = renderOrder;
  p.raycast = () => {};
  return p;
}

function labelPoint(radius: number, theta: number): Vector3 {
  return new Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0).applyMatrix4(GALACTOCENTRIC_TO_RENDER);
}

/** Named-structure labels, placed a little past each arm's crossing of the Sun's azimuth. */
const STRUCTURE_LABELS = [
  ...ARMS.map((arm, i) => {
    const r = arm.radiusAtSun * (1.25 + 0.05 * i);
    return { name: arm.name, position: labelPoint(r, armAngleAt(arm, r)) };
  }),
  { name: ORION_SPUR.name, position: labelPoint(ORION_SPUR.radiusAtSun + 1_800, Math.PI - 0.12) },
];

/** The Milky Way: GPU point clouds, or the classic baked-glow look (Settings → Point-cloud galaxies). */
export function Galaxy() {
  const pointClouds = useGraphicsStore((g) => g.pointClouds);
  return (
    <>
      {pointClouds ? <PointCloudGalaxy /> : <ClassicGalaxy />}
      <GalaxyLabels />
    </>
  );
}

/** Every star, glow, dust and gas point generated on the GPU; nothing but a byte per point in memory. */
function PointCloudGalaxy() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const group = useRef<Group>(null!);
  const particles = useGraphicsStore((g) => g.galaxyParticles);
  const withDust = useGraphicsStore((g) => g.dust);
  const withGas = useGraphicsStore((g) => g.nebulae);
  const galaxy = useMemo(
    () => createProceduralGalaxy(galaxyBudget(particles, withDust, withGas), SUN_GALACTOCENTRIC, REAL_STAR_RADIUS_LY),
    [particles, withDust, withGas],
  );
  useEffect(() => () => galaxy.dispose(), [galaxy]);
  useEffect(() => {
    group.current.matrixAutoUpdate = false;
    group.current.matrix.copy(GALACTOCENTRIC_TO_RENDER);
    group.current.matrixWorldNeedsUpdate = true;
  }, []);

  useFrame(({ size, gl, clock }) => {
    const dSun = camera.position.length();
    const dCore = camera.position.distanceTo(GALACTIC_CENTRE);
    const g = useGraphicsStore.getState();
    // With no glow planes to bridge the gap, the points take over as the NASA sky map fades.
    const opacity = galaxyOpacity(dSun) * smoothstep(2_500, 9_000, dSun);
    group.current.visible = opacity > 0.001;
    updateProceduralGalaxy(galaxy, {
      focal: size.height / 2 / Math.tan((camera.fov * Math.PI) / 360),
      pixelRatio: gl.getPixelRatio(),
      opacity,
      exposure: 0.14 + 0.86 * smoothstep(6_000, 80_000, dCore),
      time: clock.elapsedTime,
      twinkle: g.twinkle ? g.twinkleStrength : 0,
      starSize: g.starSize,
      starBrightness: g.starBrightness,
      unit: 1,
      maxSprite: g.galaxyParticles >= 160_000 ? 96 : 56,
      dust: galaxy.dust.geometry.drawRange.count > 0,
    });
  });

  return (
    <group ref={group}>
      <primitive object={galaxy.glow} />
      <primitive object={galaxy.dust} />
      <primitive object={galaxy.gas} />
      <primitive object={galaxy.stars} />
    </group>
  );
}

function ClassicGalaxy() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const group = useRef<Group>(null!);
  const texture = useMemo(() => bakeGalaxy(gl).texture, [gl]);

  const layerMaterials = useMemo(
    () =>
      LAYERS.map(
        ([z, weight]) =>
          new ShaderMaterial({
            vertexShader: layerVertex,
            fragmentShader: layerFragment,
            uniforms: {
              uMap: { value: texture },
              uGain: { value: 0 },
              uLayerWeight: { value: weight },
              uThick: { value: z === 0 ? 1 : 0 },
              uEdgeOn: { value: 1 },
            },
            side: DoubleSide,
            transparent: true,
            blending: AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          }),
      ),
    [texture],
  );

  const particles = useGraphicsStore((g) => g.galaxyParticles);
  const withDust = useGraphicsStore((g) => g.dust);
  const withGas = useGraphicsStore((g) => g.nebulae);
  const cloud = useMemo(() => {
    const c = generateGalaxyCloud(particles, { dust: withDust, gas: withGas }, SUN_GALACTOCENTRIC, REAL_STAR_RADIUS_LY);
    return {
      // Draw order: glow layers, then dust dims them, then gas and stars on top.
      dust: cloudPoints(c.dust, cloudSpriteVertex, dustFragment, "dust", -4),
      gas: cloudPoints(c.gas, cloudSpriteVertex, gasFragment, "add", -3),
      stars: cloudPoints(c.stars, cloudStarVertex, cloudStarFragment, "add", -2),
    };
  }, [particles, withDust, withGas]);

  useEffect(
    () => () => {
      layerMaterials.forEach((m) => m.dispose());
      for (const p of Object.values(cloud)) {
        p.geometry.dispose();
        (p.material as ShaderMaterial).dispose();
      }
    },
    [layerMaterials, cloud],
  );

  useEffect(() => {
    group.current.matrixAutoUpdate = false;
    group.current.matrix.copy(GALACTOCENTRIC_TO_RENDER);
    group.current.matrixWorldNeedsUpdate = true;
  }, []);

  useFrame(({ size, gl, clock }) => {
    const dSun = camera.position.length();
    const opacity = galaxyOpacity(dSun);
    group.current.visible = opacity > 0.001;
    // Auto-exposure: dim the glow as the camera approaches the bright core.
    const dCore = camera.position.distanceTo(GALACTIC_CENTRE);
    const exposure = 0.14 + 0.86 * smoothstep(6_000, 80_000, dCore);
    const edgeOn = smoothstep(45_000, 90_000, dCore);
    for (const m of layerMaterials) {
      m.uniforms.uGain.value = opacity * 2.6 * exposure;
      m.uniforms.uEdgeOn.value = edgeOn;
    }
    // Point clouds read well at galactic scale; from inside the disk the NASA sky map
    // already shows the Milky Way, and nearby points would look like snow.
    const cloudOpacity = opacity * smoothstep(5_000, 16_000, dSun);
    const focal = size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
    const g = useGraphicsStore.getState();
    const maxSprite = g.galaxyParticles >= 160_000 ? 96 : 48;
    for (const [key, p] of Object.entries(cloud)) {
      const u = (p.material as ShaderMaterial).uniforms;
      p.visible = cloudOpacity > 0.001 && p.geometry.drawRange.count !== 0;
      u.uFocal.value = focal;
      u.uPixelRatio.value = gl.getPixelRatio();
      if (key === "stars") {
        // Keep total light roughly constant as the particle budget changes.
        u.uOpacity.value = cloudOpacity * Math.pow(30_000 / g.galaxyParticles, 0.6) * g.starBrightness;
        u.uMaxPx.value = 3.5 * g.starSize;
        u.uTime.value = clock.elapsedTime;
        u.uTwinkle.value = g.twinkle ? g.twinkleStrength : 0;
      } else {
        u.uOpacity.value = key === "dust" ? cloudOpacity * exposure ** 0.3 : cloudOpacity * exposure;
        u.uMaxPx.value = maxSprite;
      }
    }
  });

  return (
    <>
      <group ref={group}>
        {LAYERS.map(([z], i) => (
          <mesh key={z} position={[0, 0, z]} material={layerMaterials[i]} renderOrder={-5} frustumCulled={false} raycast={() => null}>
            <planeGeometry args={[GALAXY_EXTENT_LY, GALAXY_EXTENT_LY]} />
          </mesh>
        ))}
        <primitive object={cloud.dust} />
        <primitive object={cloud.gas} />
        <primitive object={cloud.stars} />
      </group>
    </>
  );
}

function GalaxyLabels() {
  return (
    <>
      {/* Labels live in render space (outside the model-matrix group) so drei projects them directly. */}
      <group>
        <GalaxyLabel position={new Vector3(0, 0, 0)} text="Sun · you are here" tone="sun" />
        <GalaxyLabel position={GALACTIC_CENTRE} text="Galactic Centre" onClick={() => selectObject("sgr-a-star")} />
        {STRUCTURE_LABELS.map((l) => (
          <GalaxyLabel key={l.name} position={l.position} text={l.name} tone="structure" />
        ))}
      </group>
    </>
  );
}

/** A label that fades in only at galactic scales. */
function GalaxyLabel({ position, text, tone, onClick }: { position: Vector3; text: string; tone?: "sun" | "structure"; onClick?: () => void }) {
  const camera = useThree((s) => s.camera);
  return (
    <ScreenLabel
      position={position}
      text={text}
      className={`galaxy-label galaxy-label--${tone ?? "default"}`}
      withDot={tone !== "structure"}
      opacity={() => smoothstep(18_000, 40_000, camera.position.length())}
      onClick={onClick}
    />
  );
}
