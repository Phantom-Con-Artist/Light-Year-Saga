import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial, Vector3 } from "three";
import { getCatalogObject } from "../../data/catalog";
import { useSelectionStore } from "../../state/selectionStore";

export { CosmicWeb } from "./PointGalaxies";

/** Points scattered over a unit sphere, with a little radial spread so the shell reads as a soft boundary. */
function shellPoints(n: number): Float32Array {
  const out = new Float32Array(n * 3);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < n; i++) {
    const y = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    const k = 1 + (rnd() - 0.5) * 0.03;
    out.set([Math.cos(a) * r * k, y * k, Math.sin(a) * r * k], i * 3);
  }
  return out;
}

/** The selected group, cluster or supercluster's extent, sized from the data, drawn as a faint shell of points. */
export function StructureOutline() {
  const camera = useThree((s) => s.camera);
  const points = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(shellPoints(2400), 3));
    const p = new Points(
      g,
      new PointsMaterial({ color: "#ffd08a", size: 2, sizeAttenuation: false, transparent: true, opacity: 0, blending: AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    p.frustumCulled = false;
    p.raycast = () => {};
    return p;
  }, []);
  useEffect(
    () => () => {
      points.geometry.dispose();
      (points.material as PointsMaterial).dispose();
    },
    [points],
  );
  const tmp = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    const sel = getCatalogObject(useSelectionStore.getState().selectedId);
    const m = points.material as PointsMaterial;
    const show = sel && (sel.structureIndex !== undefined || sel.superclusterIndex !== undefined);
    let target = 0;
    if (show) {
      points.position.copy(sel.position);
      points.scale.setScalar(sel.extent / 2);
      m.color.set(sel.accent);
      // From inside, the shell would only sprinkle dots over the view.
      target = tmp.copy(camera.position).distanceTo(sel.position) < sel.extent / 2 ? 0.15 : 0.45;
    }
    m.opacity += (target - m.opacity) * Math.min(1, delta * 4);
    points.visible = m.opacity > 0.01;
  });
  return <primitive object={points} />;
}
