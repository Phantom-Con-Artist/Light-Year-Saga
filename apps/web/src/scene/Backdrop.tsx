import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Stars } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  ShaderMaterial,
  type Group,
} from "three";
import { renderDistance } from "../astronomy/scale";
import { skyFragment, skyVertex } from "./shaders";

/** Nebula dome + starfield; follows the camera so it's always "at infinity". */
export function SkyDome() {
  const group = useRef<Group>(null!);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: BackSide,
        depthWrite: false,
      }),
    [],
  );
  useFrame(({ camera }) => group.current.position.copy(camera.position));

  return (
    <group ref={group}>
      <mesh material={material} renderOrder={-10} raycast={() => null}>
        <sphereGeometry args={[4000, 48, 32]} />
      </mesh>
      <Stars radius={2400} depth={900} count={9000} factor={9} saturation={0.35} fade speed={0.4} />
    </group>
  );
}

const SCALE_RINGS_AU = [1, 5, 10, 20, 30];
const GRID_SPOKES = 12;

/**
 * Faint ecliptic grid with true-distance rings. Because distances are
 * compressed (see astronomy/scale.ts), the rings make the scale honest.
 */
export function EclipticGrid() {
  const { rings, spokes } = useMemo(() => {
    const ringMat = new LineBasicMaterial({
      color: new Color("#3aa8ff"),
      transparent: true,
      opacity: 0.16,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const rings = SCALE_RINGS_AU.map((au) => {
      const r = renderDistance(au);
      const pts: number[] = [];
      for (let i = 0; i < 256; i++) {
        const a = (i / 256) * Math.PI * 2;
        pts.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(pts, 3));
      const loop = new LineLoop(g, ringMat);
      loop.raycast = () => {};
      return { au, r, loop };
    });

    const outer = renderDistance(SCALE_RINGS_AU[SCALE_RINGS_AU.length - 1]);
    const inner = renderDistance(0.3);
    const spokePts: number[] = [];
    for (let i = 0; i < GRID_SPOKES; i++) {
      const a = (i / GRID_SPOKES) * Math.PI * 2;
      spokePts.push(Math.cos(a) * inner, 0, Math.sin(a) * inner, Math.cos(a) * outer, 0, Math.sin(a) * outer);
    }
    const sg = new BufferGeometry();
    sg.setAttribute("position", new Float32BufferAttribute(spokePts, 3));
    const spokes = new LineSegments(
      sg,
      new LineBasicMaterial({
        color: new Color("#3aa8ff"),
        transparent: true,
        opacity: 0.06,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    spokes.raycast = () => {};
    return { rings, spokes };
  }, []);

  return (
    <group>
      <primitive object={spokes} />
      {rings.map(({ au, r, loop }) => (
        <group key={au}>
          <primitive object={loop} />
          <Html
            position={[r * Math.SQRT1_2, 0, r * Math.SQRT1_2]}
            zIndexRange={[5, 0]}
            style={{ pointerEvents: "none" }}
          >
            <span className="scale-label">{au} AU</span>
          </Html>
        </group>
      ))}
    </group>
  );
}
