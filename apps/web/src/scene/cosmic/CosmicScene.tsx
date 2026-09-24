import { useCallback, useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
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
import { useScreenPicking } from "../common/picking";
import { ScreenLabel } from "../ScreenLabel";

const ORIGIN = new Vector3();
/** Opening/overview shot: far enough out to see the cosmic web of real galaxies. */
const HOME_MLY = 750;
const LOCAL_GROUP_MLY = 9;
const MIN_MLY = 0.08;
const MAX_MLY = 160_000;

const OBJECTS = CATALOG.filter((o) => o.level === "cosmic");
const GALAXIES = OBJECTS.filter((o) => o.kind === "galaxy" && o.id !== "milky-way-cosmic");
const MARKER_KINDS: CatalogObject["kind"][] = ["galaxy", "quasar", "cluster"];

const labelRange = (o: CatalogObject) => {
  if (o.id === "observable-universe") return -1; // labelled on its shell instead
  if (o.kind === "quasar") return 40_000;
  if (o.kind === "void" || o.kind === "structure" || o.kind === "cluster") return o.framing * 25;
  return Math.max(o.extent * 180, 6);
};

/* ------------------------------------------------ 2MRS real galaxy survey */

const surveyVertex = /* glsl */ `
attribute float aType;
uniform float uScale;
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // ~80,000 ly galaxy × focal length / distance.
  float px = 0.08 * 1087.0 * uScale / max(-mv.z, 1e-3);
  gl_PointSize = clamp(px, 1.3, 3.0);
  vAlpha = uOpacity * min(1.0, 0.5 + px * px * 0.3);
  // Early types (ellipticals, T <= 0) golden; spirals blue-white.
  vColor = aType <= 0.0 ? vec3(1.0, 0.82, 0.58) : vec3(0.72, 0.8, 1.0);
}
`;
const surveyFragment = /* glsl */ `
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

function SurveyGalaxies() {
  const camera = useThree((s) => s.camera);
  const [points, setPoints] = useState<Points | null>(null);

  useEffect(() => {
    let cancelled = false;
    let made: Points | null = null;
    fetch("/data/galaxies-2mrs.bin")
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (cancelled) return;
        const raw = new Float32Array(buf);
        const n = raw.length / 5;
        const pos = new Float32Array(n * 3);
        const type = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          pos[i * 3] = raw[i * 5];
          pos[i * 3 + 1] = raw[i * 5 + 1];
          pos[i * 3 + 2] = raw[i * 5 + 2];
          type[i] = raw[i * 5 + 3];
        }
        const g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(pos, 3));
        g.setAttribute("aType", new BufferAttribute(type, 1));
        const m = new ShaderMaterial({
          vertexShader: surveyVertex,
          fragmentShader: surveyFragment,
          uniforms: { uScale: { value: 1 }, uOpacity: { value: 0 } },
          transparent: true,
          blending: AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
        made = new Points(g, m);
        made.frustumCulled = false;
        made.raycast = () => {};
        setPoints(made);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      made?.geometry.dispose();
      (made?.material as ShaderMaterial | undefined)?.dispose();
    };
  }, []);

  useFrame(({ size }, delta) => {
    if (!points) return;
    const u = (points.material as ShaderMaterial).uniforms;
    u.uScale.value = size.height / 900;
    // Fade in on load; hide when inside the Local Group, where the survey is empty.
    const target = smoothstep(4, 25, camera.position.length());
    u.uOpacity.value += (target - u.uOpacity.value) * Math.min(1, delta * 2);
  });

  return points ? <primitive object={points} /> : null;
}

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
  useEffect(() => () => {
    mesh.geometry.dispose();
    (mesh.material as ShaderMaterial).dispose();
  }, [mesh]);
  return <primitive object={mesh} />;
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
  useEffect(() => () => {
    mesh.geometry.dispose();
    (mesh.material as ShaderMaterial).dispose();
  }, [mesh]);
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
        if (o.kind === "cluster") return <Glow key={o.id} obj={o} color="#ffd9a0" scale={o.extent * 1.4} opacity={0.35} />;
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

/** Millions of light-years: the Local Group, famous galaxies, 43k real 2MRS galaxies, voids and quasars. */
export function CosmicScene() {
  return (
    <>
      <MilkyWayDisk />
      <SurveyGalaxies />
      <GalaxyDisks objects={GALAXIES} unitScale={1} />
      <Structures />
      <CatalogLayer objects={OBJECTS} labelRange={labelRange} markerKinds={MARKER_KINDS} />
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
