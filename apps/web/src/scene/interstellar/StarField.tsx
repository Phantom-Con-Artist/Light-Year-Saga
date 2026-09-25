import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry } from "three";
import type { StarCatalog } from "../../data/stars";
import { useGraphicsStore } from "../../state/graphicsStore";
import { starVisibility } from "./visibility";
import { createStarPoints, starUniforms, starVertexChunk, syncStarUniforms } from "../starShading";
import { angularRaycast } from "../common/pointRaycast";
import type { Points } from "three";
import { apparentMagFromCamera } from "./visibility";

/** The rendered star cloud, for raycast picking (StarOverlay). */
export const starPoints: { current: Points | null; limitMag: number } = { current: null, limitMag: 6.5 };
const PICK_RADIUS_PX = 12;

const vertex = /* glsl */ `
attribute float aAbsMag;
attribute vec3 aColor;
uniform float uLimitMag;
uniform float uFade;
varying vec3 vColor;
${starVertexChunk}

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;

  // Apparent magnitude from the camera's actual position.
  float dPc = max(length(mv.xyz), 1e-7) / 3.261563777;
  float m = aAbsMag + 5.0 * log(dPc) * 0.4342944819 - 5.0;

  // Flux relative to the visibility limit (1.0 exactly at the limit).
  vColor = aColor;
  starSprite(pow(10.0, -0.4 * (m - uLimitMag)), uFade);
}
`;

/** All catalogue stars: crisp stars plus their glow pass, two draw calls. */
export function StarField({ catalog }: { catalog: StarCatalog }) {
  const glowOn = useGraphicsStore((g) => g.starGlow);
  const layer = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(catalog.positions, 3));
    geometry.setAttribute("aAbsMag", new BufferAttribute(catalog.absMag, 1));
    geometry.setAttribute("aColor", new BufferAttribute(catalog.colors, 3));
    const l = createStarPoints(geometry, vertex, { ...starUniforms(), uLimitMag: { value: 6.5 }, uFade: { value: 1 } });
    // Every star is pickable by index: brighter stars get a bigger target, invisible ones none.
    l.main.raycast = angularRaycast({
      positions: () => catalog.positions,
      maxRadiusPx: PICK_RADIUS_PX + 30,
      radiusPx: (i, d) => {
        const mag = apparentMagFromCamera(catalog.absMag[i], d);
        const limit = starPoints.limitMag;
        return mag > limit ? 0 : PICK_RADIUS_PX + Math.min(30, (limit - mag) * 1.5);
      },
    });
    return l;
  }, [catalog]);
  useEffect(() => {
    starPoints.current = layer.main;
    return () => {
      if (starPoints.current === layer.main) starPoints.current = null;
      layer.dispose();
    };
  }, [layer]);

  useFrame(({ camera, gl, clock }) => {
    const u = layer.uniforms;
    const v = starVisibility(camera.position.length());
    u.uLimitMag.value = v.limitMag;
    starPoints.limitMag = v.limitMag;
    u.uFade.value = v.fade;
    layer.main.visible = v.fade > 0.001;
    layer.glow.visible = glowOn && layer.main.visible;
    syncStarUniforms(u, clock.elapsedTime, gl.getPixelRatio());
  });

  return (
    <>
      <primitive object={layer.glow} />
      <primitive object={layer.main} />
    </>
  );
}
