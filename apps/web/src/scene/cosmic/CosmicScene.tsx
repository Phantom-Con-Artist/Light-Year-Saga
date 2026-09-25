import { useCallback, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type PerspectiveCamera,
} from "three";
import { CATALOG, getCatalogObject, type CatalogObject } from "../../data/catalog";
import { GALACTIC_ROTATION } from "../../astronomy/galactic";
import { selectObject } from "../../state/selectionStore";
import { useViewStore } from "../../state/viewStore";
import { bakeGalaxy } from "../interstellar/Galaxy";
import { smoothstep } from "../interstellar/visibility";
import { FlightRig, type RigTarget } from "../common/FlightRig";
import { CatalogLayer } from "../common/CatalogLayer";
import { GalaxyDisks, radialGlowTexture } from "../common/GalaxyDisks";
import { SkyPhotos } from "../common/SkyPhotos";
import { useScreenPicking } from "../common/picking";
import { ScreenLabel } from "../ScreenLabel";
import { StructureOutline } from "./CosmicWeb";
import { CosmicWeb, ModelledGalaxies, PointGalaxyLabel, PointGalaxyPicking } from "./PointGalaxies";
import { useCosmicStore } from "../../state/cosmicStore";
import { useGraphicsStore } from "../../state/graphicsStore";
import { GalaxyClouds } from "../common/GalaxyClouds";
import { createProceduralGalaxy, galaxyBudget, updateProceduralGalaxy } from "../interstellar/galaxyPoints";
import { isPointGalaxyId, pointGalaxyInfo, pointGalaxyPosition } from "../../data/cosmic/cosmicPoints";

const ORIGIN = new Vector3();
/** Opening/overview shot: far enough out to see the cosmic web of real galaxies. */
const HOME_MLY = 750;
const LOCAL_GROUP_MLY = 9;
const MIN_MLY = 0.08;
const MAX_MLY = 160_000;

const OBJECTS = CATALOG.filter((o) => o.level === "cosmic");
const GALAXIES = OBJECTS.filter((o) => o.kind === "galaxy" && o.id !== "milky-way-cosmic");
const MARKER_KINDS: CatalogObject["kind"][] = ["galaxy", "quasar"];
const STRUCTURES = OBJECTS.filter((o) => o.structureIndex !== undefined || o.superclusterIndex !== undefined);
const OTHER_OBJECTS = OBJECTS.filter((o) => !STRUCTURES.includes(o));
const structureNames = () => (useCosmicStore.getState().structureNames ? 1 : 0);

const labelRange = (o: CatalogObject) => {
  if (o.id === "observable-universe") return -1; // labelled on its shell instead
  if (o.kind === "quasar") return 40_000;
  // Structures: names appear at the scale where each one reads as a whole.
  if (o.kind === "group") return o.framing * 7;
  if (o.kind === "supercluster") return o.framing * 5;
  if (o.kind === "cluster" && o.structureIndex !== undefined) return o.framing * 14;
  if (o.kind === "void" || o.kind === "structure" || o.kind === "cluster") return o.framing * 25;
  return Math.max(o.extent * 180, 6);
};

/* ------------------------------------------------------------- Milky Way */

const mwFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uGain;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uMap, vUv).rgb * uGain;
  gl_FragColor = vec4(c / (1.0 + c * 0.4), 1.0);
  #include <colorspace_fragment>
}
`;
const uvVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

function MilkyWayDisk() {
  const gl = useThree((s) => s.gl);
  const mw = getCatalogObject("milky-way-cosmic")!;
  const mesh = useMemo(() => {
    const m = new Mesh(
      new PlaneGeometry(0.12, 0.12),
      new ShaderMaterial({
        vertexShader: uvVertex,
        fragmentShader: mwFragment,
        uniforms: { uMap: { value: bakeGalaxy(gl).texture }, uGain: { value: 2.2 } },
        side: DoubleSide,
        transparent: true,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    m.matrixAutoUpdate = false;
    m.matrix.copy(new Matrix4().copy(GALACTIC_ROTATION).setPosition(mw.position));
    m.frustumCulled = false;
    m.raycast = () => {};
    return m;
  }, [gl, mw]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as ShaderMaterial).dispose();
    },
    [mesh],
  );
  return <primitive object={mesh} />;
}

/** The Milky Way from outside, as the same GPU point cloud as the Stars & Galaxy view (at 1/10 the budget). */
function MilkyWayPoints() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const mw = getCatalogObject("milky-way-cosmic")!;
  const particles = useGraphicsStore((g) => g.galaxyParticles);
  const galaxy = useMemo(() => {
    const b = galaxyBudget(particles, false, true);
    return createProceduralGalaxy({ stars: Math.round(b.stars / 10), glow: Math.round(b.glow / 2), dust: 0, gas: Math.round(b.gas / 2) }, null);
  }, [particles]);
  useEffect(() => () => galaxy.dispose(), [galaxy]);
  const matrix = useMemo(() => new Matrix4().makeTranslation(mw.position.x, mw.position.y, mw.position.z).multiply(GALACTIC_ROTATION).multiply(new Matrix4().makeScale(1e-6, 1e-6, 1e-6)), [mw]);
  useFrame(({ size, gl, clock }) => {
    const g = useGraphicsStore.getState();
    updateProceduralGalaxy(galaxy, {
      focal: size.height / 2 / Math.tan((camera.fov * Math.PI) / 360),
      pixelRatio: gl.getPixelRatio(),
      opacity: 1,
      exposure: 1,
      time: clock.elapsedTime,
      twinkle: 0,
      starSize: g.starSize,
      starBrightness: g.starBrightness,
      unit: 1e6,
      maxSprite: 48,
      glowGain: 1.3,
    });
  });
  return (
    <group matrixAutoUpdate={false} matrix={matrix}>
      <primitive object={galaxy.glow} />
      <primitive object={galaxy.gas} />
      <primitive object={galaxy.stars} />
    </group>
  );
}

/* -------------------------------------- clusters, voids, quasars, the edge */

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
  float rim = pow(1.0 - abs(dot(vN, vView)), 3.0);
  gl_FragColor = vec4(uColor * rim * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;

function Shell({ obj, color, opacity, inside = false }: { obj: CatalogObject; color: string; opacity: number; inside?: boolean }) {
  const mesh = useMemo(() => {
    const m = new Mesh(
      new SphereGeometry(obj.extent / 2, 64, 32),
      new ShaderMaterial({
        vertexShader: shellVertex,
        fragmentShader: shellFragment,
        uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: opacity } },
        side: inside ? BackSide : DoubleSide,
        transparent: true,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    m.position.copy(obj.position);
    m.frustumCulled = false;
    m.raycast = () => {};
    return m;
  }, [obj, color, opacity, inside]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as ShaderMaterial).dispose();
    },
    [mesh],
  );
  // Zoomed in on a single galaxy, a structure hundreds of Mly across would only
  // paint over it — hide it until the view is wide enough to take it in.
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3 } | null;
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const zoom = controls ? camera.position.distanceTo(controls.target) : Infinity;
    const k = inside ? 1 : smoothstep(obj.extent * 0.02, obj.extent * 0.2, zoom);
    (mesh.material as ShaderMaterial).uniforms.uOpacity.value = opacity * k;
    mesh.visible = k > 0.001;
  });
  return <primitive object={mesh} />;
}

function Glow({ obj, color, scale, opacity }: { obj: CatalogObject; color: string; scale: number; opacity: number }) {
  const sprite = useMemo(() => {
    const s = new Sprite(
      new SpriteMaterial({
        map: radialGlowTexture(),
        color,
        opacity,
        blending: AdditiveBlending,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    s.position.copy(obj.position);
    s.scale.setScalar(scale);
    s.raycast = () => {};
    return s;
  }, [obj, color, scale, opacity]);
  useEffect(() => () => sprite.material.dispose(), [sprite]);
  return <primitive object={sprite} />;
}

function Structures() {
  const camera = useThree((s) => s.camera);
  const edge = getCatalogObject("observable-universe")!;
  const edgeLabelAt = useMemo(() => new Vector3(0, 0.35, 1).normalize().multiplyScalar(edge.extent / 2), [edge]);
  return (
    <>
      <ScreenLabel
        position={edgeLabelAt}
        text="Edge of the observable universe · 46.5 billion ly"
        className="catalog-label"
        accent={edge.accent}
        withDot
        opacity={() => smoothstep(12_000, 40_000, camera.position.length())}
        onClick={() => selectObject(edge.id)}
      />
      {OBJECTS.map((o) => {
        if (o.kind === "void") return <Shell key={o.id} obj={o} color="#5a6cff" opacity={0.35} />;
        if (o.id === "observable-universe") return <Shell key={o.id} obj={o} color="#ff9ec7" opacity={0.6} inside />;
        if (o.kind === "cluster") return <Glow key={o.id} obj={o} color="#ffd9a0" scale={o.extent * 1.6} opacity={0.16} />;
        if (o.kind === "structure") return <Glow key={o.id} obj={o} color="#ffcf8a" scale={o.extent * 2} opacity={0.25} />;
        if (o.kind === "quasar") return <Glow key={o.id} obj={o} color="#cfeaff" scale={o.framing * 0.15} opacity={0.9} />;
        return null;
      })}
    </>
  );
}

/* ----------------------------------------------------------------- scene */

function Picking() {
  useScreenPicking(selectObject);
  return null;
}

function Rig() {
  const home = useMemo<RigTarget>(() => ({ position: () => ORIGIN, distance: HOME_MLY, minDistance: MIN_MLY }), []);
  const resolve = useCallback((id: string): RigTarget | null => {
    if (isPointGalaxyId(id)) {
      const info = pointGalaxyInfo(id);
      const p = info && pointGalaxyPosition(id);
      if (!info || !p) return null;
      const d = Math.max((info.diameterLy ?? 100_000) / 1e6, 0.03);
      return { position: () => p, distance: d * 3, minDistance: d * 0.2 };
    }
    const c = getCatalogObject(id);
    if (!c || c.level !== "cosmic") return null;
    return { position: () => c.position, distance: c.framing, direction: c.viewDirection, minDistance: Math.min(c.framing * 0.05, MIN_MLY) };
  }, []);

  // Zooming out of the Milky Way lands in the Local Group; tabs/search open on the cosmic web.
  const fromStars = useViewStore.getState().fromLevel === "interstellar";
  const entry = fromStars
    ? { fromDistance: 0.35, target: { position: () => ORIGIN, distance: LOCAL_GROUP_MLY, minDistance: MIN_MLY } }
    : { fromDistance: 6_000, target: home };

  return (
    <FlightRig
      resolve={resolve}
      home={home}
      entry={entry}
      clip={(d) => [Math.max(1e-5, d * 1e-4), 4e5]}
      edgeIn={{
        atEdge: (d, target) => target.lengthSq() < 1e-4 && d <= MIN_MLY * 1.1,
        onTrigger: (dir) => {
          selectObject(null);
          useViewStore.getState().goTo("interstellar", { direction: dir });
        },
      }}
      onDistance={(camera) => useViewStore.getState().setCameraDistance(camera.position.length())}
    />
  );
}

/**
 * Millions of light-years: famous galaxies, 43,700 real galaxies with their
 * groups, clusters and superclusters, voids, quasars and the edge.
 */
export function CosmicScene() {
  const pointClouds = useGraphicsStore((g) => g.pointClouds);
  return (
    <>
      {pointClouds ? <MilkyWayPoints /> : <MilkyWayDisk />}
      <ModelledGalaxies />
      <CosmicWeb />
      <StructureOutline />
      {pointClouds ? <GalaxyClouds objects={GALAXIES} unitScale={1} pointSlot /> : <GalaxyDisks objects={GALAXIES} unitScale={1} />}
      <PointGalaxyLabel />
      <PointGalaxyPicking />
      <SkyPhotos objects={GALAXIES} mode="sky" />
      <Structures />
      <CatalogLayer objects={OTHER_OBJECTS} labelRange={labelRange} markerKinds={MARKER_KINDS} />
      <CatalogLayer objects={STRUCTURES} labelRange={labelRange} markerKinds={[]} opacity={structureNames} />
      <Picking />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        rotateSpeed={0.5}
        zoomSpeed={5}
        panSpeed={0.6}
        minDistance={MIN_MLY}
        maxDistance={MAX_MLY}
      />
      <Rig />
    </>
  );
}
