import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from "three";
import type { StarCatalog } from "../../data/stars";
import { starVisibility } from "./visibility";
import { starFragment, starUniforms, starVertexChunk, syncStarUniforms } from "../starShading";

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

/** All catalogue stars as one draw call. */
export function StarField({ catalog }: { catalog: StarCatalog }) {
  const points = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(catalog.positions, 3));
    geometry.setAttribute("aAbsMag", new BufferAttribute(catalog.absMag, 1));
    geometry.setAttribute("aColor", new BufferAttribute(catalog.colors, 3));
    geometry.computeBoundingSphere();

    const material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: starFragment,
      uniforms: {
        ...starUniforms(),
        uLimitMag: { value: 6.5 },
        uFade: { value: 1 },
      },
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
  }, [catalog]);

  useEffect(
    () => () => {
      points.geometry.dispose();
      (points.material as ShaderMaterial).dispose();
    },
    [points],
  );

  useFrame(({ camera, gl, clock }) => {
    const u = (points.material as ShaderMaterial).uniforms;
    const v = starVisibility(camera.position.length());
    u.uLimitMag.value = v.limitMag;
    u.uFade.value = v.fade;
    syncStarUniforms(u, clock.elapsedTime, gl.getPixelRatio());
  });

  return <primitive object={points} />;
}
