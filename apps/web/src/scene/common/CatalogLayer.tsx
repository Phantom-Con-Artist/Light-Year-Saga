import { useCallback, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial, Vector3 } from "three";
import type { CatalogObject } from "../../data/catalog";
import { selectObject, useSelectionStore } from "../../state/selectionStore";
import { usePickProvider } from "./picking";
import { projectToScreen } from "./project";
import { ScreenLabel } from "../ScreenLabel";

const markerVertex = /* glsl */ `
attribute vec3 aColor;
attribute float aRing;
uniform float uPixelRatio;
uniform float uOpacity;
varying vec3 vColor;
varying float vRing;
void main() {
  vColor = aColor;
  vRing = aRing;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (aRing > 0.5 ? 13.0 : 7.0) * uPixelRatio;
}
`;

const markerFragment = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vRing;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float a;
  if (vRing > 0.5) {
    // Black holes: a dark centre with a bright photon-ring halo.
    a = smoothstep(0.45, 0.62, r) * smoothstep(1.0, 0.72, r);
  } else {
    a = exp(-r * r * 6.0);
  }
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;

const KIND_COLOR: Partial<Record<CatalogObject["kind"], string>> = {
  "black-hole": "#ffb45a",
  quasar: "#bfe6ff",
  "stellar-remnant": "#dfeaff",
  "exo-system": "#8fffc1",
  galaxy: "#d9c8ff",
  cluster: "#ffd08a",
  star: "#ffd2a0",
};

interface CatalogLayerProps {
  objects: CatalogObject[];
  /** Beyond this camera→object distance the label fades out (level units). */
  labelRange: (o: CatalogObject) => number;
  /** Kinds that get a point marker (others have their own visuals). */
  markerKinds: CatalogObject["kind"][];
  /** Overall layer opacity from the camera position (e.g. hide at galactic scale). */
  opacity?: (cameraPosition: Vector3) => number;
}

/** Point markers, labels and click-picking for curated catalogue objects. */
export function CatalogLayer({ objects, labelRange, markerKinds, opacity }: CatalogLayerProps) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const markers = useMemo(() => {
    const list = objects.filter((o) => markerKinds.includes(o.kind));
    const pos = new Float32Array(list.length * 3);
    const col = new Float32Array(list.length * 3);
    const ring = new Float32Array(list.length);
    list.forEach((o, i) => {
      pos.set([o.position.x, o.position.y, o.position.z], i * 3);
      const c = new Color(KIND_COLOR[o.kind] ?? o.accent);
      col.set([c.r, c.g, c.b], i * 3);
      ring[i] = o.kind === "black-hole" ? 1 : 0;
    });
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aColor", new BufferAttribute(col, 3));
    g.setAttribute("aRing", new BufferAttribute(ring, 1));
    const m = new ShaderMaterial({
      vertexShader: markerVertex,
      fragmentShader: markerFragment,
      uniforms: { uPixelRatio: { value: 1 }, uOpacity: { value: 1 } },
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const p = new Points(g, m);
    p.frustumCulled = false;
    p.raycast = () => {};
    p.renderOrder = 5;
    return p;
  }, [objects, markerKinds]);

  useEffect(
    () => () => {
      markers.geometry.dispose();
      (markers.material as ShaderMaterial).dispose();
    },
    [markers],
  );

  useFrame(({ gl }) => {
    const u = (markers.material as ShaderMaterial).uniforms;
    u.uPixelRatio.value = gl.getPixelRatio();
    u.uOpacity.value = opacity ? opacity(camera.position) : 1;
  });

  const screen = useMemo(() => ({ x: 0, y: 0 }), []);
  const pick = useCallback(
    (x: number, y: number) => {
      const layer = opacity ? opacity(camera.position) : 1;
      if (layer < 0.3) return null;
      let best: { id: string; score: number } | null = null;
      for (const o of objects) {
        if (!projectToScreen(o.position, camera, size.width, size.height, screen)) continue;
        const d = Math.hypot(screen.x - x, screen.y - y);
        // Extended objects are clickable across their apparent size.
        const dist = camera.position.distanceTo(o.position);
        const apparent = o.extent > 0 ? (o.extent / Math.max(dist, 1e-9)) * size.height * 0.6 : 0;
        const radius = Math.max(14, Math.min(apparent, 120));
        if (d > radius) continue;
        const score = d - 8; // curated objects win ties against plain stars
        if (!best || score < best.score) best = { id: o.id, score };
      }
      return best;
    },
    [objects, camera, size, screen, opacity],
  );
  usePickProvider(pick);

  return (
    <>
      <primitive object={markers} />
      {objects.map((o) => (
        <CatalogLabel key={o.id} obj={o} range={labelRange(o)} layerOpacity={opacity} />
      ))}
    </>
  );
}

function CatalogLabel({
  obj,
  range,
  layerOpacity,
}: {
  obj: CatalogObject;
  range: number;
  layerOpacity?: (cameraPosition: Vector3) => number;
}) {
  const camera = useThree((s) => s.camera);
  return (
    <ScreenLabel
      position={obj.position}
      text={obj.name}
      className="catalog-label"
      accent={obj.accent}
      withDot
      opacity={() => {
        const s = useSelectionStore.getState();
        const layer = layerOpacity ? layerOpacity(camera.position) : 1;
        if (s.selectedId === obj.id || s.hoveredId === obj.id) return Math.max(layer, 0.9);
        if (range <= 0) return 0;
        const d = camera.position.distanceTo(obj.position);
        const t = 1 - Math.min(1, Math.max(0, (d - range * 0.6) / (range * 0.4)));
        return t * layer;
      }}
      active={() => useSelectionStore.getState().selectedId === obj.id}
      onClick={() => selectObject(obj.id)}
      onHover={(h) => useSelectionStore.getState().hoverObject(h ? obj.id : null)}
    />
  );
}
