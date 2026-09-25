import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BackSide, Color, DoubleSide, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from "three";
import { getCatalogObject } from "../../data/catalog";
import { useSelectionStore } from "../../state/selectionStore";

export { CosmicWeb } from "./PointGalaxies";

const shellVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const shellFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vN;
varying vec3 vView;
void main() {
  float rim = pow(1.0 - abs(dot(vN, vView)), 6.0);
  gl_FragColor = vec4(uColor * rim * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;

/** A faint rim sphere around the selected group, cluster or supercluster, sized from the data. */
export function StructureOutline() {
  const camera = useThree((s) => s.camera);
  const mesh = useMemo(() => {
    const m = new Mesh(
      new SphereGeometry(1, 48, 24),
      new ShaderMaterial({
        vertexShader: shellVertex,
        fragmentShader: shellFragment,
        uniforms: { uColor: { value: new Color("#ffd08a") }, uOpacity: { value: 0 } },
        side: DoubleSide,
        transparent: true,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    m.frustumCulled = false;
    m.raycast = () => {};
    return m;
  }, []);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as ShaderMaterial).dispose();
    },
    [mesh],
  );

  const inside = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    const sel = getCatalogObject(useSelectionStore.getState().selectedId);
    const u = (mesh.material as ShaderMaterial).uniforms;
    const show = sel && (sel.structureIndex !== undefined || sel.superclusterIndex !== undefined);
    if (show) {
      mesh.position.copy(sel.position);
      mesh.scale.setScalar(sel.extent / 2);
      u.uColor.value.set(sel.accent);
      // From inside, render the back faces so the rim still reads as a boundary.
      const within = inside.copy(camera.position).sub(sel.position).length() < sel.extent / 2;
      (mesh.material as ShaderMaterial).side = within ? BackSide : DoubleSide;
    }
    const target = show ? 0.14 : 0;
    u.uOpacity.value += (target - u.uOpacity.value) * Math.min(1, delta * 4);
    mesh.visible = u.uOpacity.value > 0.01;
  });
  return <primitive object={mesh} />;
}
