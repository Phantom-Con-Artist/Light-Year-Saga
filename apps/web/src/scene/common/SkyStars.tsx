import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, type Group } from "three";
import { apparentMagnitude, starDistanceLy, type StarCatalog } from "../../data/stars";
import { starFragment, starUniforms, starVertexChunk, syncStarUniforms } from "../starShading";

const vertex = /* glsl */ `
attribute float aMag;
attribute vec3 aColor;
uniform float uLimitMag;
uniform float uFade;
varying vec3 vColor;
${starVertexChunk}

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vColor = aColor;
  starSprite(pow(10.0, -0.4 * (aMag - uLimitMag)), uFade);
}
`;

export interface SkySphere {
  /** Catalogue index per point. */
  indices: Uint32Array;
  /** Unit direction per point (render axes). */
  directions: Float32Array;
  /** Apparent magnitude from the Sun. */
  mags: Float32Array;
}

const cache = new WeakMap<StarCatalog, SkySphere>();

/** The catalogue as seen from the Solar System: directions and apparent magnitudes. */
export function skySphere(catalog: StarCatalog): SkySphere {
  const hit = cache.get(catalog);
  if (hit) return hit;
  const n = catalog.count - 1;
  const indices = new Uint32Array(n);
  const directions = new Float32Array(n * 3);
  const mags = new Float32Array(n);
  let k = 0;
  for (let i = 0; i < catalog.count; i++) {
    if (catalog.meta.hyg[i] === 0) continue; // the Sun
    const d = starDistanceLy(catalog, i);
    indices[k] = i;
    directions[k * 3] = catalog.positions[i * 3] / d;
    directions[k * 3 + 1] = catalog.positions[i * 3 + 1] / d;
    directions[k * 3 + 2] = catalog.positions[i * 3 + 2] / d;
    mags[k] = apparentMagnitude(catalog.absMag[i], d);
    k++;
  }
  const sphere = { indices: indices.subarray(0, k), directions: directions.subarray(0, k * 3), mags: mags.subarray(0, k) };
  cache.set(catalog, sphere);
  return sphere;
}

interface SkyStarsProps {
  catalog: StarCatalog;
  radius?: number;
  /** Faintest magnitude drawn at full strength (per frame). */
  limitMag: () => number;
  opacity?: () => number;
  /** Keep the sphere centred on the camera (stars at infinity). */
  followCamera?: boolean;
  /** Let nearer opaque geometry (planets) hide the stars. */
  depthTest?: boolean;
  renderOrder?: number;
}

/** Real stars on the celestial sphere, as seen from Earth. One draw call. */
export function SkyStars({ catalog, radius = 1000, limitMag, opacity, followCamera = false, depthTest = false, renderOrder = 0 }: SkyStarsProps) {
  const group = useRef<Group>(null!);
  const points = useMemo(() => {
    const sky = skySphere(catalog);
    const pos = new Float32Array(sky.directions.length);
    for (let i = 0; i < pos.length; i++) pos[i] = sky.directions[i] * radius;
    const colors = new Float32Array(sky.indices.length * 3);
    sky.indices.forEach((ci, k) => colors.set(catalog.colors.subarray(ci * 3, ci * 3 + 3), k * 3));

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(pos, 3));
    geometry.setAttribute("aMag", new BufferAttribute(sky.mags, 1));
    geometry.setAttribute("aColor", new BufferAttribute(colors, 3));
    const material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: starFragment,
      uniforms: { ...starUniforms(), uLimitMag: { value: 6 }, uFade: { value: 1 } },
      transparent: true,
      blending: AdditiveBlending,
      depthTest,
      depthWrite: false,
      toneMapped: false,
    });
    const p = new Points(geometry, material);
    p.frustumCulled = false;
    p.renderOrder = renderOrder;
    p.raycast = () => {};
    return p;
  }, [catalog, radius, depthTest, renderOrder]);

  useEffect(
    () => () => {
      points.geometry.dispose();
      (points.material as ShaderMaterial).dispose();
    },
    [points],
  );

  useFrame(({ camera, gl, clock }) => {
    if (followCamera) group.current.position.copy(camera.position);
    const u = (points.material as ShaderMaterial).uniforms;
    const o = opacity ? opacity() : 1;
    group.current.visible = o > 0.001;
    u.uFade.value = o;
    u.uLimitMag.value = limitMag();
    syncStarUniforms(u, clock.elapsedTime, gl.getPixelRatio());
  });

  return (
    <group ref={group}>
      <primitive object={points} />
    </group>
  );
}
