import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { FEATURES, type SurfaceFeature } from "../../data/solar/features";
import { getObject } from "../../data/solarSystem";
import { selectObject, useSelectionStore } from "../../state/selectionStore";
import { useSolarStore } from "../../state/solarStore";
import { getBodyOrientation, getRenderPosition, getRenderRadius, isPresent } from "../renderRegistry";
import { ScreenLabel } from "../ScreenLabel";

const DEG = Math.PI / 180;

/** Unit vector of a surface point in the body's mesh frame (+X = longitude 0, +Y = north, east toward −Z). */
export function featureLocalDir(f: SurfaceFeature, out = new Vector3()): Vector3 {
  const lat = f.lat * DEG;
  const lon = f.lon * DEG;
  return out.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
}

/** World-space outward normal of a feature at the current orientation. */
export function featureWorldNormal(f: SurfaceFeature, out = new Vector3()): Vector3 {
  featureLocalDir(f, out);
  const q = getBodyOrientation(f.bodyId);
  return q ? out.applyQuaternion(q) : out;
}

const toCam = new Vector3();

function FeaturePin({ f }: { f: SurfaceFeature }) {
  const camera = useThree((s) => s.camera);
  const body = getObject(f.bodyId);
  const shape = body?.visual.shape ?? [1, 1, 1];
  const local = useMemo(() => featureLocalDir(f), [f]);
  const world = useMemo(() => new Vector3(), []);
  const normal = useMemo(() => new Vector3(), []);
  const text = f.heightKm !== undefined ? `${f.name} · ${f.heightKm > 0 ? "" : "−"}${Math.abs(f.heightKm).toLocaleString("en-US", { maximumFractionDigits: 1 })} km` : f.name;

  const position = () => {
    const r = getRenderRadius(f.bodyId);
    normal.set(local.x * shape[0], local.y * shape[1], local.z * shape[2]);
    const q = getBodyOrientation(f.bodyId);
    if (q) normal.applyQuaternion(q);
    return world.copy(getRenderPosition(f.bodyId)).addScaledVector(normal, r * 1.002);
  };

  return (
    <ScreenLabel
      position={position}
      text={text}
      className="feature-label"
      withDot
      opacity={() => {
        const s = useSelectionStore.getState();
        const selected = s.selectedId === f.id;
        if (!isPresent(f.bodyId)) return 0;
        if (!selected && !useSolarStore.getState().features) return 0;
        const r = getRenderRadius(f.bodyId);
        const center = getRenderPosition(f.bodyId);
        const d = camera.position.distanceTo(center);
        // Only once the body fills a good part of the view (or its own feature is selected)…
        const near = selected ? 1 : Math.min(1, Math.max(0, (r * 9 - d) / (r * 3)));
        if (near <= 0) return 0;
        // …and only on the hemisphere facing us.
        position();
        toCam.copy(camera.position).sub(world).normalize();
        const facing = toCam.dot(normal.normalize());
        return near * Math.min(1, Math.max(0, facing * 4));
      }}
      active={() => {
        const s = useSelectionStore.getState();
        return s.selectedId === f.id || s.hoveredId === f.id;
      }}
      onClick={() => selectObject(f.id)}
      onHover={(h) => useSelectionStore.getState().hoverObject(h ? f.id : null)}
    />
  );
}

export function SurfaceFeatures() {
  return (
    <>
      {FEATURES.map((f) => (
        <FeaturePin key={f.id} f={f} />
      ))}
    </>
  );
}
