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
  [-700, 0.12],
  [-300, 0.3],
  [0, 1],
  [300, 0.3],
  [700, 0.12],
];

let bakedTarget: WebGLRenderTarget | null = null;

function bakeGalaxy(gl: WebGLRenderer): WebGLRenderTarget {
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
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
  vec3 col = texture2D(uMap, vUv).rgb;
  // Outer layers only carry the thick central bulge, not the thin disk.
  float r = length(vUv - 0.5) * 2.0;
  float bulgeOnly = mix(exp(-r / 0.12), 1.0, uThick);
  // Soften when seen exactly edge-on, where stacked planes would read as hard lines.
  float facing = abs(dot(normalize(cameraPosition - vWorldPos), vNormalW));
  float edge = mix(0.35, 1.0, smoothstep(0.0, 0.25, facing));
  gl_FragColor = vec4(col * uGain * uLayerWeight * bulgeOnly * edge, 1.0);
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
  float px = aSize * 220.0 * uScale / max(-mv.z, 1.0);
  gl_PointSize = clamp(px, 1.0, 4.5);
  // Conserve light when a cloud shrinks below a pixel.
  vAlpha = uOpacity * min(1.0, px * px) * 0.8;
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
    for (const m of layerMaterials) m.uniforms.uGain.value = opacity * 1.5;
    const su = (sparkle.material as ShaderMaterial).uniforms;
    su.uOpacity.value = opacity;
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
