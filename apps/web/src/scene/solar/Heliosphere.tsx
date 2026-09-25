import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Line,
  Mesh,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import { renderDistance } from "../../astronomy/scale";
import { currentRate, useTimeStore } from "../../state/timeStore";
import { useSolarStore } from "../../state/solarStore";
import { useSelectionStore } from "../../state/selectionStore";
import { graphics } from "../../state/graphicsStore";
import { ScreenLabel } from "../ScreenLabel";

/**
 * The heliosphere as a small physical model, all in AU and days:
 *
 * - Solar wind leaves the Sun radially: 400 km/s near the ecliptic, 750 km/s
 *   at high latitudes (the solar-minimum pattern Ulysses measured).
 * - At the termination shock it drops to subsonic speed; beyond, in the
 *   heliosheath, it follows the potential flow of a point source in a
 *   uniform stream. The dividing streamline of that flow, a Rankine
 *   half-body r = b / cos(θ/2), is the heliopause, with its nose b fitted to
 *   the Voyager crossings.
 * - Outside, the interstellar wind (26 km/s from Ophiuchus/Scorpius, IBEX)
 *   flows around the heliopause along the same field.
 * - The interplanetary magnetic field is wound into Parker spirals by the
 *   Sun's 25.4-day rotation.
 *
 * Particles move in simulated time: at "real time" the wind barely moves;
 * speed the clock up to watch it flow. Shapes are mapped into the scene with
 * the same distance compression as everything else.
 */

const AU_PER_DAY_PER_KMS = 86400 / 149_597_870.7;
const V_SLOW = 400 * AU_PER_DAY_PER_KMS;
const V_FAST = 750 * AU_PER_DAY_PER_KMS;
/** Heliopause nose distance (AU): Voyager 1 crossed 121.6 AU about 35° from the nose. */
const B = 115;
/** Flow speed far down the heliotail. */
const U_SHEATH = 150 * AU_PER_DAY_PER_KMS;
const U_ISM = 26 * AU_PER_DAY_PER_KMS;
const TAIL_AU = 420;
const SOLAR_ROTATION_DAYS = 25.38;

/** Where the interstellar wind comes from: ecliptic longitude 255.7°, latitude 5.1° (IBEX). */
const NOSE = (() => {
  const l = (255.7 * Math.PI) / 180;
  const b = (5.1 * Math.PI) / 180;
  return new Vector3(Math.cos(b) * Math.cos(l), Math.sin(b), -Math.cos(b) * Math.sin(l)).normalize();
})();

/** Heliopause radius (AU) at angle θ from the nose. */
const heliopause = (cosT: number) => B / Math.sqrt((1 + cosT) / 2);
/** Termination shock radius (AU): 90 AU at the nose, stretched tailward. */
const terminationShock = (cosT: number) => 90 * (1 + 0.8 * (1 - cosT) / 2);

/** Scene position of a heliocentric point given in render-axis AU. */
function toScene(p: Vector3, out: Vector3): Vector3 {
  const r = p.length();
  return r === 0 ? out.set(0, 0, 0) : out.copy(p).multiplyScalar(renderDistance(r) / r);
}

/* ------------------------------------------------------------ surfaces */

const surfaceVertex = /* glsl */ `
attribute float aTheta;
varying vec3 vN;
varying vec3 vView;
varying float vTheta;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  vTheta = aTheta;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const surfaceFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFlow;
uniform float uTailFade;
varying vec3 vN;
varying vec3 vView;
varying float vTheta;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 4.0);
  // Faint streaks drifting from the nose towards the tail.
  float streak = 0.88 + 0.12 * sin(vTheta * 24.0 - uFlow);
  float tail = 1.0 - smoothstep(uTailFade - 0.5, uTailFade, vTheta);
  float a = (0.015 + rim) * streak * tail * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

function surfaceOfRevolution(radius: (cosT: number) => number, thetaMax: number, rings = 72, segs = 64): BufferGeometry {
  const u = new Vector3(0, 1, 0).cross(NOSE).normalize();
  const v = new Vector3().crossVectors(NOSE, u).normalize();
  const pos: number[] = [];
  const theta: number[] = [];
  const idx: number[] = [];
  const p = new Vector3();
  const s = new Vector3();
  for (let i = 0; i <= rings; i++) {
    const t = (i / rings) * thetaMax;
    const r = radius(Math.cos(t));
    for (let j = 0; j <= segs; j++) {
      const f = (j / segs) * Math.PI * 2;
      p.copy(NOSE)
        .multiplyScalar(Math.cos(t))
        .addScaledVector(u, Math.sin(t) * Math.cos(f))
        .addScaledVector(v, Math.sin(t) * Math.sin(f))
        .multiplyScalar(r);
      toScene(p, s);
      pos.push(s.x, s.y, s.z);
      theta.push(t);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j;
      const b = a + segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aTheta", new BufferAttribute(new Float32Array(theta), 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function surfaceMaterial(color: string, tailFade: number) {
  return new ShaderMaterial({
    vertexShader: surfaceVertex,
    fragmentShader: surfaceFragment,
    uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: 0 }, uFlow: { value: 0 }, uTailFade: { value: tailFade } },
    side: DoubleSide,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

/* ------------------------------------------------------------ particles */

const particleVertex = /* glsl */ `
attribute float aKind;   // 0 supersonic wind, 1 heliosheath, 2 interstellar
uniform float uPixelRatio;
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (aKind < 0.5 ? 1.3 : 1.7) * uPixelRatio;
  vColor = aKind < 0.5 ? vec3(1.0, 0.93, 0.72) : aKind < 1.5 ? vec3(1.0, 0.62, 0.32) : vec3(0.55, 0.62, 1.0);
  vAlpha = uOpacity * (aKind < 0.5 ? 0.22 : aKind < 1.5 ? 0.6 : 0.45);
}
`;
const particleFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(c)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

interface Wind {
  n: number;
  pos: Float32Array; // AU, render axes
  dir: Float32Array; // initial direction (unit)
  speed: Float32Array;
  kind: Float32Array; // 0 wind, 1 sheath
  ism: number; // how many trailing entries are interstellar particles
}

const rnd = Math.random;

function randomDir(out: Vector3): Vector3 {
  const z = rnd() * 2 - 1;
  const a = rnd() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return out.set(s * Math.cos(a), z, s * Math.sin(a));
}

const tmp = new Vector3();
const vel = new Vector3();

/** Potential flow of a point source (strength fitted so the dividing streamline has nose b) in a uniform stream. */
function flow(p: Vector3, u: number, out: Vector3): Vector3 {
  const r2 = p.lengthSq();
  const r = Math.sqrt(r2);
  out.copy(NOSE).multiplyScalar(-u);
  return out.addScaledVector(p, (u * B * B) / (r2 * r));
}

function spawnWind(w: Wind, k: number) {
  randomDir(tmp);
  w.dir[k * 3] = tmp.x;
  w.dir[k * 3 + 1] = tmp.y;
  w.dir[k * 3 + 2] = tmp.z;
  // Fast wind from the polar coronal holes, slow wind near the equator.
  w.speed[k] = Math.abs(tmp.y) > 0.42 ? V_FAST : V_SLOW;
  const r0 = 0.05 + rnd() * 0.2;
  w.pos[k * 3] = tmp.x * r0;
  w.pos[k * 3 + 1] = tmp.y * r0;
  w.pos[k * 3 + 2] = tmp.z * r0;
  w.kind[k] = 0;
}

const SIDE_U = new Vector3(0, 1, 0).cross(NOSE).normalize();
const SIDE_V = new Vector3().crossVectors(NOSE, SIDE_U);

function spawnIsm(w: Wind, k: number, anywhere: boolean) {
  const u = SIDE_U;
  const v = SIDE_V;
  const rad = Math.sqrt(rnd()) * 520;
  const a = rnd() * Math.PI * 2;
  const along = anywhere ? 650 - rnd() * 1300 : 650;
  tmp.copy(NOSE).multiplyScalar(along).addScaledVector(u, rad * Math.cos(a)).addScaledVector(v, rad * Math.sin(a));
  // Keep out of the heliosphere.
  const r = tmp.length();
  if (r < heliopause(tmp.dot(NOSE) / r) * 1.05) tmp.multiplyScalar((heliopause(tmp.dot(NOSE) / r) * 1.1) / r);
  w.pos[k * 3] = tmp.x;
  w.pos[k * 3 + 1] = tmp.y;
  w.pos[k * 3 + 2] = tmp.z;
  w.kind[k] = 2;
}

const p = new Vector3();
const d = new Vector3();

/** Advance particle k by dt days. */
function step(w: Wind, k: number, dt: number) {
  p.set(w.pos[k * 3], w.pos[k * 3 + 1], w.pos[k * 3 + 2]);
  const ism = w.kind[k] === 2;
  if (ism) {
    p.addScaledVector(flow(p, U_ISM, vel), dt);
    const r = p.length();
    const c = p.dot(NOSE) / r;
    const hp = heliopause(c);
    if (r < hp) p.multiplyScalar((hp * 1.01) / r);
    if (p.dot(NOSE) < -700) spawnIsm(w, k, false);
    else store(w, k);
    return;
  }
  let r = p.length();
  const c = p.dot(NOSE) / Math.max(r, 1e-9);
  if (w.kind[k] === 0) {
    d.set(w.dir[k * 3], w.dir[k * 3 + 1], w.dir[k * 3 + 2]);
    p.addScaledVector(d, w.speed[k] * dt);
    r = p.length();
    if (r >= terminationShock(c)) w.kind[k] = 1;
  } else {
    p.addScaledVector(flow(p, U_SHEATH, vel), dt);
    r = p.length();
    const hp = heliopause(p.dot(NOSE) / r);
    if (r > hp * 0.985) p.multiplyScalar((hp * 0.985) / r);
  }
  if (r > TAIL_AU || -p.dot(NOSE) > TAIL_AU * 0.9) spawnWind(w, k);
  else store(w, k);
}

function store(w: Wind, k: number) {
  w.pos[k * 3] = p.x;
  w.pos[k * 3 + 1] = p.y;
  w.pos[k * 3 + 2] = p.z;
}

function createWind(count: number, ismCount: number): Wind {
  const n = count + ismCount;
  const w: Wind = {
    n,
    pos: new Float32Array(n * 3),
    dir: new Float32Array(n * 3),
    speed: new Float32Array(n),
    kind: new Float32Array(n),
    ism: ismCount,
  };
  // Warm start: give each particle a random age and play it forward, so the bubble starts full.
  for (let k = 0; k < count; k++) {
    spawnWind(w, k);
    let age = rnd() * 3650;
    const reach = terminationShock(0.5) / w.speed[k];
    if (age < reach) {
      step(w, k, age);
      continue;
    }
    step(w, k, reach * 0.999);
    age -= reach;
    while (age > 0 && w.kind[k] !== 0) {
      const dt = Math.min(age, 25);
      step(w, k, dt);
      age -= dt;
    }
  }
  for (let k = count; k < n; k++) spawnIsm(w, k, true);
  return w;
}

/* ------------------------------------------------------------ Parker spiral */

/** Field lines in the ecliptic from 0.05 to 6 AU; the pattern rotates rigidly with the Sun. */
function parkerSpirals(arms = 4): Group {
  const group = new Group();
  const material = new ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aFade;
      varying float vFade;
      void main() { vFade = aFade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vFade;
      void main() {
        gl_FragColor = vec4(vec3(0.55, 0.75, 1.0) * vFade * uOpacity, 1.0);
        #include <colorspace_fragment>
      }`,
    uniforms: { uOpacity: { value: 0 } },
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const omega = (2 * Math.PI) / SOLAR_ROTATION_DAYS; // rad/day
  const s = new Vector3();
  for (let k = 0; k < arms; k++) {
    const phi0 = (k / arms) * Math.PI * 2;
    const pos: number[] = [];
    const fade: number[] = [];
    for (let i = 0; i <= 600; i++) {
      const r = 0.05 * Math.pow(6 / 0.05, i / 600);
      // A parcel at r left the Sun r/v days ago, when the Sun was turned back by Ω r / v.
      const phi = phi0 - (omega * r) / V_SLOW;
      p.set(Math.cos(phi) * r, 0, -Math.sin(phi) * r);
      toScene(p, s);
      pos.push(s.x, s.y, s.z);
      fade.push(Math.min(1, r * 4) * (1 - Math.min(1, r / 6)));
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("aFade", new BufferAttribute(new Float32Array(fade), 1));
    const line = new Line(g, material);
    line.frustumCulled = false;
    line.raycast = () => {};
    group.add(line);
  }
  group.userData.material = material;
  return group;
}

/* ------------------------------------------------------------ component */

const NOSE_LABEL = (au: number) => NOSE.clone().multiplyScalar(renderDistance(au));

export function Heliosphere() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  const parts = useMemo(() => {
    const thetaMax = 2 * Math.acos(B / 380);
    const hp = new Mesh(surfaceOfRevolution(heliopause, thetaMax), surfaceMaterial("#7fb0ff", thetaMax));
    const ts = new Mesh(surfaceOfRevolution(terminationShock, Math.PI), surfaceMaterial("#ffb070", Math.PI + 1));
    for (const m of [hp, ts]) {
      m.frustumCulled = false;
      m.raycast = () => {};
    }
    const tier = graphics().galaxyParticles;
    const count = tier >= 160_000 ? 9000 : tier >= 80_000 ? 6000 : 3500;
    const wind = createWind(count, Math.round(count * 0.3));
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(wind.n * 3), 3));
    g.setAttribute("aKind", new BufferAttribute(wind.kind, 1));
    const particles = new Points(
      g,
      new ShaderMaterial({
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        uniforms: { uPixelRatio: { value: 1 }, uOpacity: { value: 0 } },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    particles.frustumCulled = false;
    particles.raycast = () => {};
    const spirals = parkerSpirals();
    return { hp, ts, wind, particles, spirals };
  }, []);

  useEffect(
    () => () => {
      for (const m of [parts.hp, parts.ts]) {
        m.geometry.dispose();
        (m.material as ShaderMaterial).dispose();
      }
      parts.particles.geometry.dispose();
      (parts.particles.material as ShaderMaterial).dispose();
      parts.spirals.children.forEach((c) => (c as Line).geometry.dispose());
      (parts.spirals.userData.material as ShaderMaterial).dispose();
    },
    [parts],
  );

  const lastTime = useMemo(() => ({ ms: Number.NaN, visible: 0, spiral: 0 }), []);
  const scene = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    const { hp, ts, wind, particles, spirals } = parts;
    const time = useTimeStore.getState();
    const on = useSolarStore.getState().heliosphere || useSelectionStore.getState().selectedId === "heliosphere";
    // The bubble is ~120 AU across: show it once the camera pulls back past the planets.
    const dist = camera.position.length();
    const zoomFade = Math.min(1, Math.max(0, (dist - 480) / 500));
    const target = on ? zoomFade : 0;
    lastTime.visible += (target - lastTime.visible) * Math.min(1, delta * 3);
    const o = lastTime.visible;

    const hpU = (hp.material as ShaderMaterial).uniforms;
    const tsU = (ts.material as ShaderMaterial).uniforms;
    hpU.uOpacity.value = o * 0.45;
    tsU.uOpacity.value = o * 0.22;
    const days = time.timeMs / 86_400_000;
    hpU.uFlow.value = (days * 0.02) % (Math.PI * 2);
    tsU.uFlow.value = (days * 0.05) % (Math.PI * 2);
    hp.visible = ts.visible = o > 0.01;

    // Parker spirals: shown closer in, faded when time runs too fast to follow the rotation.
    const rate = Math.abs(currentRate(time)) / 86400; // sim days per real second
    const turnPerSecond = (rate / SOLAR_ROTATION_DAYS) * 360;
    const spiralTarget = on && dist > 40 && dist < 700 && turnPerSecond < 120 ? 1 : 0;
    lastTime.spiral += (spiralTarget - lastTime.spiral) * Math.min(1, delta * 3);
    (spirals.userData.material as ShaderMaterial).uniforms.uOpacity.value = lastTime.spiral * 0.3;
    spirals.visible = lastTime.spiral > 0.01;
    spirals.rotation.y = ((days % SOLAR_ROTATION_DAYS) / SOLAR_ROTATION_DAYS) * Math.PI * 2;

    // Advance the wind in simulated time.
    const dtDays = Number.isNaN(lastTime.ms) ? 0 : Math.abs(time.timeMs - lastTime.ms) / 86_400_000;
    lastTime.ms = time.timeMs;
    const pu = (particles.material as ShaderMaterial).uniforms;
    pu.uOpacity.value = o;
    pu.uPixelRatio.value = Math.min(gl.getPixelRatio(), 1.5);
    particles.visible = o > 0.01;
    if (!particles.visible || dtDays === 0) return;
    // A few substeps at most: this runs on the CPU every frame.
    const sub = Math.min(3, Math.ceil(dtDays / 10));
    const h = Math.min(dtDays, 120) / sub;
    for (let s = 0; s < sub; s++) for (let k = 0; k < wind.n; k++) step(wind, k, h);
    const out = particles.geometry.getAttribute("position") as BufferAttribute;
    const arr = out.array as Float32Array;
    for (let k = 0; k < wind.n; k++) {
      p.set(wind.pos[k * 3], wind.pos[k * 3 + 1], wind.pos[k * 3 + 2]);
      toScene(p, scene);
      arr[k * 3] = scene.x;
      arr[k * 3 + 1] = scene.y;
      arr[k * 3 + 2] = scene.z;
    }
    out.needsUpdate = true;
    (particles.geometry.getAttribute("aKind") as BufferAttribute).needsUpdate = true;
  });

  // Positions for the particle buffer on the first frame, before any time passes.
  useEffect(() => {
    const out = parts.particles.geometry.getAttribute("position") as BufferAttribute;
    const arr = out.array as Float32Array;
    const s = new Vector3();
    for (let k = 0; k < parts.wind.n; k++) {
      p.set(parts.wind.pos[k * 3], parts.wind.pos[k * 3 + 1], parts.wind.pos[k * 3 + 2]);
      toScene(p, s);
      arr.set([s.x, s.y, s.z], k * 3);
    }
    out.needsUpdate = true;
  }, [parts]);

  const labelOpacity = () => (useSolarStore.getState().heliosphere ? Math.min(1, Math.max(0, (camera.position.length() - 650) / 300)) : 0);

  return (
    <group>
      <primitive object={parts.ts} />
      <primitive object={parts.hp} />
      <primitive object={parts.particles} />
      <primitive object={parts.spirals} />
      <ScreenLabel position={NOSE_LABEL(80)} text="Termination shock" className="region-label" opacity={labelOpacity} />
      <ScreenLabel position={SIDE_U.clone().multiplyScalar(renderDistance(heliopause(0)))} text="Heliopause" className="region-label" opacity={labelOpacity} />
      <ScreenLabel position={NOSE.clone().multiplyScalar(-renderDistance(200))} text="Heliotail" className="region-label" opacity={labelOpacity} />
      <ScreenLabel position={NOSE_LABEL(420)} text="Interstellar wind blows in from here (Ophiuchus)" className="region-label region-label--dim" opacity={labelOpacity} />
    </group>
  );
}

