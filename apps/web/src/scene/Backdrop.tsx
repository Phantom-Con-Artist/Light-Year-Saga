import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  LineBasicMaterial,
  LineLoop,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector3,
  type Camera,
  type Group,
} from "three";
import { renderDistance } from "../astronomy/scale";
import { skyFragment, skyVertex } from "./shaders";
import { ScreenLabel } from "./ScreenLabel";
import { graphics } from "../state/graphicsStore";

export const STARMAP_SOURCES = ["/textures/milkyway_4k.jpg", "/textures/milkyway_8k.jpg"];
export const DIFFUSE_SOURCES = ["/textures/milkyway_diffuse_4k.jpg"];

function prepare(tex: Texture, maxAnisotropy: number) {
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = Math.min(graphics().anisotropy, maxAnisotropy);
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
}

interface SkyDomeProps {
  /** Progressive sources: the first loads immediately, later ones are upgrades for high-res displays. */
  sources?: string[];
  gain?: number;
  blackLevel?: number;
  /** Mip-level softening factor (1 = sharp). */
  blur?: number;
  /** Per-frame opacity (0–1), e.g. to fade the sky as the camera leaves the Sun. */
  opacity?: (camera: Camera) => number;
}

/**
 * Real sky: NASA/GSFC SVS "Deep Star Maps 2020" (Hipparcos-2, Tycho-2, Gaia DR2),
 * oriented by true RA/Dec. Upgrades to the next source only on high-resolution
 * displays whose GPU supports 8K textures.
 */
export function SkyDome({ sources = STARMAP_SOURCES, gain = 1, blackLevel = 0, blur = 1, opacity }: SkyDomeProps) {
  const gl = useThree((s) => s.gl);
  const group = useRef<Group>(null!);
  const fadeIn = useRef(0);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        uniforms: {
          uMap: { value: null },
          uBrightness: { value: 0 },
          uBlack: { value: blackLevel },
          uBlur: { value: blur },
        },
        side: BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [blackLevel, blur],
  );

  useEffect(() => {
    let cancelled = false;
    const loader = new TextureLoader();
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    const physicalWidth = window.screen.width * window.devicePixelRatio;
    const allowUpgrade = graphics().hiResTextures && physicalWidth >= 2560 && gl.capabilities.maxTextureSize >= 8192;

    const apply = (tex: Texture) => {
      if (cancelled) return tex.dispose();
      prepare(tex, maxAniso);
      const old = material.uniforms.uMap.value as Texture | null;
      material.uniforms.uMap.value = tex;
      old?.dispose();
    };

    loader.load(sources[0], (tex) => {
      apply(tex);
      if (allowUpgrade && sources[1] && !cancelled) loader.load(sources[1], apply);
    });
    return () => {
      cancelled = true;
      (material.uniforms.uMap.value as Texture | null)?.dispose();
    };
  }, [gl, material, sources]);

  // Fade in once the texture is present; follow the camera so it sits at infinity.
  useFrame(({ camera }, delta) => {
    group.current.position.copy(camera.position);
    if (material.uniforms.uMap.value) fadeIn.current = Math.min(1, fadeIn.current + delta * 0.8);
    const o = opacity ? opacity(camera) : 1;
    material.uniforms.uBrightness.value = fadeIn.current * o * gain;
    group.current.visible = o > 0.001;
  });

  return (
    <group ref={group}>
      <mesh material={material} renderOrder={-10} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[4000, 64, 32]} />
      </mesh>
    </group>
  );
}

const SCALE_RINGS_AU = [1, 5, 10, 20, 30];

/**
 * Faint rings at true distances (1–30 AU). Distances are compressed in the
 * scene (see astronomy/scale.ts), so these keep the scale honest.
 */
export function EclipticGrid() {
  const rings = useMemo(() => {
    const material = new LineBasicMaterial({
      color: new Color("#8fa6c4"),
      transparent: true,
      opacity: 0.08,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    return SCALE_RINGS_AU.map((au) => {
      const r = renderDistance(au);
      const pts: number[] = [];
      for (let i = 0; i < 256; i++) {
        const a = (i / 256) * Math.PI * 2;
        pts.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(pts, 3));
      const loop = new LineLoop(g, material);
      loop.raycast = () => {};
      return { au, r, loop };
    });
  }, []);

  return (
    <group>
      {rings.map(({ au, r, loop }) => (
        <group key={au}>
          <primitive object={loop} />
          <ScreenLabel position={new Vector3(r * Math.SQRT1_2, 0, r * Math.SQRT1_2)} text={`${au} AU`} className="scale-label" />
        </group>
      ))}
    </group>
  );
}
