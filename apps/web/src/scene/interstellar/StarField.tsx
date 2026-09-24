import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from "three";
import type { StarCatalog } from "../../data/stars";
import { starVisibility } from "./visibility";

const vertex = /* glsl */ `
attribute float aAbsMag;
attribute vec3 aColor;
uniform float uPixelRatio;
uniform float uLimitMag;
uniform float uFade;
varying vec3 vColor;
varying float vIntensity;
varying float vHalo;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;

  // Apparent magnitude from the camera's actual position.
  float dPc = max(length(mv.xyz), 1e-7) / 3.261563777;
  float m = aAbsMag + 5.0 * log(dPc) * 0.4342944819 - 5.0;

  // Flux relative to the visibility limit (1.0 exactly at the limit).
  float f = pow(10.0, -0.4 * (m - uLimitMag));
  vIntensity = min(f, 1.0) * uFade;
  // Brighter than the limit: grow the sprite rather than saturating it.
  float grow = pow(max(f, 1.0), 0.18);
  gl_PointSize = clamp(2.2 * grow, 2.2, 44.0) * uPixelRatio;
  vHalo = clamp((grow - 1.4) / 6.0, 0.0, 1.0);
  vColor = aColor;

  // Too faint to see: move outside the clip volume so it costs no fragments.
  if (vIntensity < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vIntensity;
varying float vHalo;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  float core = exp(-r2 * 9.0);
  float halo = exp(-sqrt(r2) * 5.0) * vHalo * 0.55;
  float a = (core + halo) * vIntensity;
  if (a < 0.003) discard;
  vec3 col = mix(vColor, vec3(1.0), core * 0.5) * a;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
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
      fragmentShader: fragment,
      uniforms: {
        uPixelRatio: { value: 1 },
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

  useFrame(({ camera, gl }) => {
    const u = (points.material as ShaderMaterial).uniforms;
    const v = starVisibility(camera.position.length());
    u.uLimitMag.value = v.limitMag;
    u.uFade.value = v.fade;
    u.uPixelRatio.value = gl.getPixelRatio();
  });

  return <primitive object={points} />;
}
