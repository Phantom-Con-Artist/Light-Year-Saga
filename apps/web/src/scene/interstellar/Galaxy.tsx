import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
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
import {
  ARMS,
  BAR_ANGLE,
  GALAXY_EXTENT_LY,
  ORION_SPUR,
  PITCH_TAN,
  armAngleAt,
  galaxyBakeFragment,
  generateSparkle,
} from "./galaxyModel";
import { galaxyOpacity, smoothstep } from "./visibility";

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

const sparkleVertex = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
uniform float uScale;
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // ~150 ly cloud × focal length (~1087 px at 900 px tall, 45° fov) / distance.
  float px = aSize * 163000.0 * uScale / max(-mv.z, 1.0);
  gl_PointSize = clamp(px, 1.0, 2.6);
  // Conserve light below a pixel; keep close-up clouds from reading as snow.
  vAlpha = uOpacity * min(1.0, px * px) * 0.5 / (1.0 + max(px - 2.6, 0.0) * 0.08);
  // Illustrative clouds vanish up close, where they'd read as snow.
  vAlpha *= smoothstep(6000.0, 24000.0, -mv.z);
  vColor = aColor;
}
`;

const sparkleFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 14.0) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

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

export function Galaxy() {
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

  const sparkle = useMemo(() => {
    const cloud = generateSparkle(SUN_GALACTOCENTRIC, REAL_STAR_RADIUS_LY);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(cloud.positions, 3));
    geometry.setAttribute("aColor", new BufferAttribute(cloud.colors, 3));
    geometry.setAttribute("aSize", new BufferAttribute(cloud.sizes, 1));
    const material = new ShaderMaterial({
      vertexShader: sparkleVertex,
      fragmentShader: sparkleFragment,
      uniforms: { uScale: { value: 1 }, uOpacity: { value: 0 } },
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const p = new Points(geometry, material);
    p.frustumCulled = false;
    p.raycast = () => {};
    return p;
  }, []);

  useEffect(
    () => () => {
      layerMaterials.forEach((m) => m.dispose());
      sparkle.geometry.dispose();
      (sparkle.material as ShaderMaterial).dispose();
    },
    [layerMaterials, sparkle],
  );

  useEffect(() => {
    group.current.matrixAutoUpdate = false;
    group.current.matrix.copy(GALACTOCENTRIC_TO_RENDER);
    group.current.matrixWorldNeedsUpdate = true;
  }, []);

  useFrame(({ size }) => {
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
    const su = (sparkle.material as ShaderMaterial).uniforms;
    // Point-cloud star clouds only read well at galactic scale; from inside the
    // disk the NASA sky map already shows the Milky Way, and these look like snow.
    su.uOpacity.value = opacity * smoothstep(12_000, 30_000, dSun);
    su.uScale.value = size.height / 900;
  });

  return (
    <>
      <group ref={group}>
        {LAYERS.map(([z], i) => (
          <mesh key={z} position={[0, 0, z]} material={layerMaterials[i]} renderOrder={-5} frustumCulled={false} raycast={() => null}>
            <planeGeometry args={[GALAXY_EXTENT_LY, GALAXY_EXTENT_LY]} />
          </mesh>
        ))}
        <primitive object={sparkle} />
      </group>

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
function GalaxyLabel({
  position,
  text,
  tone,
  onClick,
}: {
  position: Vector3;
  text: string;
  tone?: "sun" | "structure";
  onClick?: () => void;
}) {
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
