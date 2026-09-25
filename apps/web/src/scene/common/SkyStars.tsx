import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, type Group } from "three";
import { useGraphicsStore } from "../../state/graphicsStore";
import { apparentMagnitude, starDistanceLy, type StarCatalog } from "../../data/stars";
import { createStarPoints, starUniforms, starVertexChunk, syncStarUniforms } from "../starShading";

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

/** Real stars on the celestial sphere, as seen from Earth: crisp stars plus their glow. */
export function SkyStars({ catalog, radius = 1000, limitMag, opacity, followCamera = false, depthTest = false, renderOrder = 0 }: SkyStarsProps) {
  const group = useRef<Group>(null!);
  const glowOn = useGraphicsStore((g) => g.starGlow);
  const layer = useMemo(() => {
    const sky = skySphere(catalog);
    const pos = new Float32Array(sky.directions.length);
    for (let i = 0; i < pos.length; i++) pos[i] = sky.directions[i] * radius;
    const colors = new Float32Array(sky.indices.length * 3);
    sky.indices.forEach((ci, k) => colors.set(catalog.colors.subarray(ci * 3, ci * 3 + 3), k * 3));

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(pos, 3));
    geometry.setAttribute("aMag", new BufferAttribute(sky.mags, 1));
    geometry.setAttribute("aColor", new BufferAttribute(colors, 3));
    return createStarPoints(geometry, vertex, { ...starUniforms(), uLimitMag: { value: 6 }, uFade: { value: 1 } }, { depthTest, renderOrder });
  }, [catalog, radius, depthTest, renderOrder]);

  useEffect(() => () => layer.dispose(), [layer]);

  useFrame(({ camera, gl, clock }) => {
    if (followCamera) group.current.position.copy(camera.position);
    const u = layer.uniforms;
    const o = opacity ? opacity() : 1;
    group.current.visible = o > 0.001;
    layer.glow.visible = glowOn;
    u.uFade.value = o;
    u.uLimitMag.value = limitMag();
    syncStarUniforms(u, clock.elapsedTime, gl.getPixelRatio());
  });

  return (
    <group ref={group}>
      <primitive object={layer.glow} />
      <primitive object={layer.main} />
    </group>
  );
}
