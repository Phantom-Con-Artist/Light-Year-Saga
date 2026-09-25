import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, Raycaster, ShaderMaterial, Vector3, type PerspectiveCamera } from "three";
import { getCatalogObject } from "../../data/catalog";
import { SUPERCLUSTER_COLORS } from "../../data/catalog/structures";
import { useSelectionStore } from "../../state/selectionStore";
import { useCosmicStore } from "../../state/cosmicStore";
import { useGraphicsStore } from "../../state/graphicsStore";
import {
  ensureModelledUniverse,
  isPointGalaxyId,
  loadGalaxyMeta,
  loadRealGalaxies,
  modelledGalaxyId,
  pointGalaxyIndex,
  pointGalaxyInfo,
  pointGalaxyPosition,
  realGalaxyId,
  useCosmicPoints,
} from "../../data/cosmic/cosmicPoints";
import { modelledBudget } from "../../data/cosmic/modelledUniverse";
import { smoothstep } from "../interstellar/visibility";
import { angularRaycast, rayFromScreen, type AngularHit } from "../common/pointRaycast";
import { usePickProvider } from "../common/picking";
import { ScreenLabel } from "../ScreenLabel";

const realVertex = /* glsl */ `
attribute float aType;
attribute float aStruct;
attribute float aSuper;
uniform float uScale;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uColorBy;
uniform float uSelStruct;
uniform float uSelSuper;
uniform float uSelIndex;
uniform vec3 uSuperColors[${SUPERCLUSTER_COLORS.length}];
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // ~80,000 ly galaxy × focal length / distance.
  float px = 0.08 * 1087.0 * uScale / max(-mv.z, 1e-3);

  // Early types (ellipticals, T <= 0) golden; spirals blue-white.
  vec3 c = aType <= 0.0 ? vec3(1.0, 0.82, 0.58) : vec3(0.72, 0.8, 1.0);
  float a = min(1.0, 0.5 + px * px * 0.3);

  // Colour by supercluster: members take its colour, the field recedes.
  if (uColorBy > 0.5) {
    int s = int(aSuper + 0.5);
    if (aSuper > -0.5) {
      c = mix(c, uSuperColors[s], 0.85);
      a = min(1.0, a * 1.4);
    } else {
      a *= 0.4;
    }
  }

  // A selected structure: its members light up, everything else dims.
  bool selecting = uSelStruct > -0.5 || uSelSuper > -0.5;
  bool member = (uSelStruct > -0.5 && abs(aStruct - uSelStruct) < 0.5) || (uSelSuper > -0.5 && abs(aSuper - uSelSuper) < 0.5);
  float size = clamp(px, 1.3, 3.0);
  if (selecting) {
    if (member) {
      c = mix(c, vec3(1.0, 0.92, 0.72), 0.35);
      a = min(1.0, a * 1.6 + 0.2);
      size = clamp(px * 1.3, 2.2, 4.5);
    } else {
      a *= 0.3;
    }
  }
  // The selected galaxy itself.
  if (abs(float(gl_VertexID) - uSelIndex) < 0.5) {
    size = max(size, 6.0);
    a = 1.0;
    c = mix(c, vec3(1.0), 0.4);
  }
  gl_PointSize = size * uPixelRatio;
  vAlpha = a * uOpacity;
  vColor = c;
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 12.0) * vAlpha;
  if (a < 0.005) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

/** The rendered clouds, for picking. */
const clouds: { real: Points | null; modelled: Points | null } = { real: null, modelled: null };

function selectedIndex(kind: "real" | "modelled"): number {
  const id = useSelectionStore.getState().selectedId;
  const ref = id ? pointGalaxyIndex(id) : null;
  return ref && ref.kind === kind ? ref.index : -1;
}

function disposePoints(p: Points | null) {
  p?.geometry.dispose();
  (p?.material as ShaderMaterial | undefined)?.dispose();
}

/**
 * 43,700 real galaxies: the 2MASS Redshift Survey plus the nearby galaxies
 * with measured distances, each tagged with its group, cluster and
 * supercluster. One draw call; every galaxy is selectable by its row.
 */
export function CosmicWeb() {
  const camera = useThree((s) => s.camera);
  const real = useCosmicPoints((s) => s.real);
  useEffect(() => loadRealGalaxies(), []);

  const points = useMemo(() => {
    if (!real) return null;
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(real.positions, 3));
    g.setAttribute("aType", new BufferAttribute(real.type, 1));
    g.setAttribute("aStruct", new BufferAttribute(real.structure, 1));
    g.setAttribute("aSuper", new BufferAttribute(real.supercluster, 1));
    const m = new ShaderMaterial({
      vertexShader: realVertex,
      fragmentShader: fragment,
      uniforms: {
        uScale: { value: 1 },
        uPixelRatio: { value: 1 },
        uOpacity: { value: 0 },
        uColorBy: { value: 1 },
        uSelStruct: { value: -1 },
        uSelSuper: { value: -1 },
        uSelIndex: { value: -1 },
        uSuperColors: { value: SUPERCLUSTER_COLORS.map((c) => new Color(c)) },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const p = new Points(g, m);
    p.frustumCulled = false;
    p.raycast = angularRaycast({ positions: () => real.positions, maxRadiusPx: 9 });
    return p;
  }, [real]);

  useEffect(() => {
    clouds.real = points;
    return () => {
      if (clouds.real === points) clouds.real = null;
      disposePoints(points);
    };
  }, [points]);

  useFrame(({ size, gl }, delta) => {
    if (!points) return;
    const u = (points.material as ShaderMaterial).uniforms;
    u.uScale.value = size.height / 900;
    u.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    // Fade in on load; nearby galaxies reach almost to the Milky Way itself.
    const target = smoothstep(0.12, 0.5, camera.position.length());
    u.uOpacity.value += (target - u.uOpacity.value) * Math.min(1, delta * 2);
    u.uColorBy.value = useCosmicStore.getState().colorBySupercluster ? 1 : 0;
    const sel = getCatalogObject(useSelectionStore.getState().selectedId);
    u.uSelStruct.value = sel?.structureIndex ?? -1;
    u.uSelSuper.value = sel?.superclusterIndex ?? -1;
    u.uSelIndex.value = selectedIndex("real");
  });

  return points ? <primitive object={points} /> : null;
}

/* --------------------------------------------------- modelled galaxies */

const modelledVertex = /* glsl */ `
attribute vec4 aProps;     // type, environment, brightness (0–255), reddening (0–255)
attribute float aDiam;     // Mly
uniform float uFocal;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uMark;
uniform float uSelIndex;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 1e-3);
  float px = aDiam * uFocal / depth;
  float bright = aProps.z / 255.0;
  int type = int(aProps.x + 0.5);
  vec3 c = type <= 1 ? vec3(1.0, 0.8, 0.56)          // ellipticals, lenticulars: old, red sequence
         : type == 2 ? vec3(0.72, 0.8, 1.0)           // spirals
         : type == 3 ? vec3(0.6, 0.74, 1.0)           // irregulars
         : vec3(0.85, 0.82, 1.0);                     // starbursts
  // Light from far away is redshifted: blue light arrives red.
  c = mix(c, vec3(1.0, 0.5, 0.36), aProps.w / 255.0 * 0.85);
  // Fainter with distance from the camera (softened inverse square), so depth reads and
  // the far shells don't pile up into a glare.
  float a = bright * min(1.0, 0.45 + px * px * 0.25) * clamp(pow(2500.0 / depth, 0.9), 0.1, 1.0);
  float size = clamp(px * 1.4, 1.0, 2.6) * (0.75 + 0.5 * bright);
  if (uMark > 0.5) {
    // Unmistakably not the real map: one neutral hue.
    c = vec3(0.66, 0.62, 0.8);
    a *= 0.75;
  }
  if (abs(float(gl_VertexID) - uSelIndex) < 0.5) {
    size = max(size, 6.0);
    a = 1.0;
    c = mix(c, vec3(1.0), 0.4);
  }
  gl_PointSize = size * uPixelRatio;
  vAlpha = a * uOpacity;
  vColor = c;
  if (vAlpha < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

/**
 * The modelled universe beyond the surveys: generated once in a Web Worker,
 * drawn in one call. Each point is selectable, and every view of it says it
 * is modelled.
 */
export function ModelledGalaxies() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const particles = useGraphicsStore((g) => g.galaxyParticles);
  const on = useCosmicStore((s) => s.modelled);
  const modelled = useCosmicPoints((s) => s.modelled);
  useEffect(() => {
    if (on) ensureModelledUniverse(modelledBudget(particles));
  }, [on, particles]);

  const points = useMemo(() => {
    if (!modelled) return null;
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(modelled.positions, 3));
    g.setAttribute("aProps", new BufferAttribute(modelled.props, 4));
    g.setAttribute("aDiam", new BufferAttribute(modelled.diameter, 1));
    const m = new ShaderMaterial({
      vertexShader: modelledVertex,
      fragmentShader: fragment,
      uniforms: {
        uFocal: { value: 1000 },
        uPixelRatio: { value: 1 },
        uOpacity: { value: 0 },
        uMark: { value: 0 },
        uSelIndex: { value: -1 },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const p = new Points(g, m);
    p.frustumCulled = false;
    p.raycast = angularRaycast({ positions: () => modelled.positions, maxRadiusPx: 7 });
    return p;
  }, [modelled]);

  useEffect(() => {
    clouds.modelled = points;
    return () => {
      if (clouds.modelled === points) clouds.modelled = null;
      disposePoints(points);
    };
  }, [points]);

  useFrame(({ size, gl }, delta) => {
    if (!points) return;
    const u = (points.material as ShaderMaterial).uniforms;
    const state = useCosmicStore.getState();
    u.uFocal.value = size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
    u.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    // Among the real galaxies the model stays in the background.
    const d = camera.position.length();
    const target = state.modelled ? smoothstep(0.5, 4, d) * (0.45 + 0.55 * smoothstep(1_500, 8_000, d)) : 0;
    u.uOpacity.value += (target - u.uOpacity.value) * Math.min(1, delta * 2.5);
    u.uMark.value = state.markModelled ? 1 : 0;
    u.uSelIndex.value = selectedIndex("modelled");
    points.visible = u.uOpacity.value > 0.005;
  });

  return points ? <primitive object={points} /> : null;
}

/* -------------------------------------------------- picking & selection */

/**
 * Point galaxies take part in the shared picking: a Raycaster against each
 * cloud, hit.index → the galaxy's row. Real galaxies win ties against
 * modelled ones; curated catalogue objects (score − 8) win against both.
 */
export function PointGalaxyPicking() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const raycaster = useRef(new Raycaster());
  usePickProvider(
    useCallback(
      (x: number, y: number) => {
        rayFromScreen(raycaster.current, camera, x, y, size.width, size.height);
        let best: { id: string; score: number } | null = null;
        const layers = [
          [clouds.real, 0, realGalaxyId],
          [clouds.modelled, 5, modelledGalaxyId],
        ] as const;
        for (const [p, penalty, idOf] of layers) {
          if (!p || !p.visible || (p.material as ShaderMaterial).uniforms.uOpacity.value < 0.2) continue;
          for (const h of raycaster.current.intersectObject(p, false) as AngularHit[]) {
            const score = h.pixels + penalty;
            if (!best || score < best.score) best = { id: idOf(h.index), score };
          }
        }
        return best;
      },
      [camera, size],
    ),
  );
  return null;
}

/** Name label on the selected point galaxy (the cloud itself draws the highlight). */
export function PointGalaxyLabel() {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const meta = useCosmicPoints((s) => s.meta);
  const isPoint = isPointGalaxyId(selectedId);
  useEffect(() => {
    if (isPoint) loadGalaxyMeta();
  }, [isPoint]);
  const pos = useMemo(() => new Vector3(), []);
  if (!isPoint) return null;
  const info = pointGalaxyInfo(selectedId);
  if (!info) return null;
  return (
    <ScreenLabel
      key={selectedId + (meta ? "+" : "")}
      position={() => pointGalaxyPosition(selectedId, pos) ?? pos}
      text={info.kind === "modelled" ? `${info.name} (modelled)` : info.name}
      className="catalog-label"
      accent={info.kind === "modelled" ? "#b3a8d8" : "#ffd9a0"}
      withDot
      active={() => true}
    />
  );
}
