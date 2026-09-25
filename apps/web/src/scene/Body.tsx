import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  Color,
  DataTexture,
  DoubleSide,
  Quaternion,
  RGBAFormat,
  SRGBColorSpace,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Group,
  type Mesh,
} from "three";
import type { SpaceObject } from "../domain/types";
import { OBJECTS_BY_ID } from "../data/solarSystem";
import { currentRate, useTimeStore } from "../state/timeStore";
import { selectObject, useSelectionStore } from "../state/selectionStore";
import { layerOn, useSolarStore } from "../state/solarStore";
import { getRenderPosition, getRenderRadius, isPresent, setBodyOrientation, syncRenderPositions } from "./renderRegistry";
import { cloudFragment, ringFragment, ringVertex, surfaceFragment, surfaceUniforms, surfaceVertex } from "./shaders";
import { ATMOSPHERES, createAtmosphere, presetFromColor } from "./atmosphere";
import { BODY_TEXTURES, useRealTexture } from "./realTextures";
import { getBakedSurface } from "./bake";
import { BodyLabel } from "./BodyLabel";
import { bodyQuaternion, facingQuaternion, forwardUpQuaternion, poleFrame, primeMeridian, type PoleFrame } from "../astronomy/orientation";
import { satellitePosition } from "../astronomy/satellites";
import { SpacecraftMesh } from "./solar/SpacecraftModels";

/** Visual cap on spin so fast-forwarding doesn't strobe (degrees per real second). */
const MAX_SPIN_DEG = 50;
const DEG = Math.PI / 180;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const ECLIPTIC_NORTH = new Vector3(0, 1, 0);

const SPHERE_HI = new SphereGeometry(1, 64, 48);
const SPHERE_LO = new SphereGeometry(1, 32, 24);

/** A 1×1 texture in the body's base colour, shown until its surface is baked. */
function flatTexture(color: string): DataTexture {
  const c = new Color(color);
  const t = new DataTexture(new Uint8Array([c.r * 255, c.g * 255, c.b * 255, 255]), 1, 1, RGBAFormat);
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * How a body's surface meets light: relief strength, roughness, regolith
 * (Lommel–Seeliger) for airless worlds, limb darkening for cloud decks.
 */
function surfaceModel(obj: SpaceObject) {
  const { style, atmosphere } = obj.visual;
  if (obj.type === "star" || obj.visual.model) return {};
  if (obj.id === "earth") return { bump: 0.6, rough: 0.9 };
  if (obj.id === "mars") return { bump: 1.6, airless: 0.35 };
  if (style === "banded" || style === "cloudy" || (style === "ice" && obj.type === "planet")) return { minnaert: 0.85 };
  if (atmosphere) return { minnaert: 0.9, bump: 0.4 };
  // Airless rock and ice: cratered regolith.
  return { bump: obj.id === "moon" || obj.id === "mercury" ? 3 : style === "ice" ? 1.4 : 2.2, airless: 1 };
}

const wrap180 = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
const tmpA = { x: 0, y: 0, z: 0 };
const tmpB = { x: 0, y: 0, z: 0 };

export function Body({ obj }: { obj: SpaceObject }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const group = useRef<Group>(null!);
  const spin = useRef<Group>(null!);
  const tilt = useRef<Group>(null!);
  const surface = useRef<Mesh>(null);
  const clouds = useRef<Mesh>(null);
  const lastSimTime = useRef<number | null>(null);
  const spinState = useRef({ offset: 0, lastW: Number.NaN, angle: 0 });
  const baked = useRef(false);
  const radius = getRenderRadius(obj.id);
  const { visual, physical } = obj;
  const major = obj.type === "planet" || obj.type === "star" || obj.id === "moon";
  const isModel = !!visual.model;

  // Orientation frames: the body's own IAU pole, or for moons the parent's.
  const frame = useMemo<PoleFrame | null>(() => (physical.rotation ? poleFrame(physical.rotation) : null), [physical.rotation]);
  const parentFrame = useMemo<PoleFrame | null>(() => {
    const p = obj.parentId ? OBJECTS_BY_ID.get(obj.parentId) : undefined;
    return p?.physical.rotation ? poleFrame(p.physical.rotation) : null;
  }, [obj.parentId]);
  const locked = obj.type === "moon" && physical.tidallyLocked !== false;

  const placeholder = useMemo(() => flatTexture(visual.colorA), [visual.colorA]);
  const surfaceMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: surfaceVertex,
        fragmentShader: surfaceFragment,
        uniforms: {
          uMap: { value: placeholder },
          uAtmo: { value: new Color(visual.atmosphere ?? "#000000") },
          uHasAtmo: { value: visual.atmosphere ? 1 : 0 },
          uHighlight: { value: 0 },
          uLightPos: { value: new Vector3() },
          uEmissive: { value: new Color(0, 0, 0) },
          uNight: { value: null },
          uNightGain: { value: 0 },
          uOcean: { value: null },
          uOceanGain: { value: 0 },
          ...surfaceUniforms(surfaceModel(obj)),
        },
      }),
    [placeholder, visual.atmosphere, obj],
  );
  useEffect(() => () => surfaceMat.dispose(), [surfaceMat]);

  // Real surface maps replace the baked placeholder as they arrive.
  const files = BODY_TEXTURES[obj.id];
  const map = useRealTexture(files?.map);
  const night = useRealTexture(files?.night);
  const ocean = useRealTexture(files?.ocean, true);
  const cloudMap = useRealTexture(files?.clouds, true);
  const ringMap = useRealTexture(files?.ring);
  useEffect(() => {
    const u = surfaceMat.uniforms;
    if (map) {
      u.uMap.value = map;
      baked.current = true;
    }
    if (night) {
      u.uNight.value = night;
      u.uNightGain.value = 1.4;
    }
    if (ocean) {
      u.uOcean.value = ocean;
      u.uOceanGain.value = 0.55;
    }
  }, [surfaceMat, map, night, ocean]);

  // Clouds shade the ground under them.
  useEffect(() => {
    if (!cloudMap) return;
    surfaceMat.uniforms.uClouds.value = cloudMap;
    surfaceMat.uniforms.uCloudShadow.value = 0.35;
  }, [surfaceMat, cloudMap]);

  const cloudMat = useMemo(
    () =>
      cloudMap
        ? new ShaderMaterial({
            vertexShader: surfaceVertex,
            fragmentShader: cloudFragment,
            uniforms: { uMap: { value: cloudMap }, uLightPos: { value: new Vector3() } },
            transparent: true,
            depthWrite: false,
          })
        : null,
    [cloudMap],
  );
  useEffect(() => () => cloudMat?.dispose(), [cloudMat]);

  // Scattering atmosphere (Rayleigh + Mie), tuned from each world's measured optical depths.
  const atmosphere = useMemo(() => {
    const preset = ATMOSPHERES[obj.id] ?? (visual.atmosphere ? presetFromColor(visual.atmosphere) : null);
    return preset ? createAtmosphere(preset) : null;
  }, [obj.id, visual.atmosphere]);
  useEffect(() => () => atmosphere?.material.dispose(), [atmosphere]);

  const ringMat = useMemo(
    () =>
      visual.rings
        ? new ShaderMaterial({
            vertexShader: ringVertex,
            fragmentShader: ringFragment,
            uniforms: {
              uColor: { value: new Color(visual.rings.color) },
              uInner: { value: visual.rings.innerRadii * radius },
              uOuter: { value: visual.rings.outerRadii * radius },
              uPlanetCenter: { value: new Vector3() },
              uPlanetRadius: { value: radius },
              uRingMap: { value: null },
              uHasRingMap: { value: 0 },
            },
            side: DoubleSide,
            transparent: true,
            depthWrite: false,
          })
        : null,
    [visual.rings, radius],
  );

  useEffect(() => {
    if (!ringMat || !ringMap) return;
    ringMat.uniforms.uRingMap.value = ringMap;
    ringMat.uniforms.uHasRingMap.value = 1;
  }, [ringMat, ringMap]);

  const toParent = useMemo(() => new Vector3(), []);
  const worldQ = useMemo(() => new Quaternion(), []);
  const axis = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    const time = useTimeStore.getState();
    const { timeMs } = time;
    syncRenderPositions(timeMs);
    const sel = useSelectionStore.getState();
    const selected = obj.id === sel.selectedId;
    const visible = isPresent(obj.id) && (selected || layerOn(obj, useSolarStore.getState()));
    group.current.visible = visible;
    if (!visible) {
      lastSimTime.current = timeMs;
      return;
    }
    const pos = getRenderPosition(obj.id);
    group.current.position.copy(pos);
    atmosphere?.update(pos, radius, ORIGIN, camera.position);
    if (ringMat) ringMat.uniforms.uPlanetCenter.value.copy(pos);

    // Bake the procedural surface only once someone comes close.
    if (!baked.current && !isModel && (selected || camera.position.distanceTo(pos) < radius * (major ? 1e4 : 400))) {
      surfaceMat.uniforms.uMap.value = getBakedSurface(gl, obj).texture;
      baked.current = true;
    }

    const days = (timeMs - J2000_MS) / 86_400_000;
    if (isModel) {
      // Stations fly nose-first with their belly to Earth; probes point their dish at Earth; JWST and Parker face the Sun.
      if (obj.ephemeris.kind === "tle") {
        const id = obj.ephemeris.satellite;
        const a = satellitePosition(id, timeMs, tmpA);
        const b = satellitePosition(id, timeMs + 10_000, tmpB);
        if (a && b) {
          up.set(a.x, a.z, -a.y);
          axis.set(b.x - a.x, b.z - a.z, -(b.y - a.y));
          forwardUpQuaternion(axis, up, spin.current.quaternion);
        }
      } else {
        const sunward = visual.model === "jwst" || visual.model === "parker";
        axis.copy(sunward ? ORIGIN : getRenderPosition("earth")).sub(pos);
        forwardUpQuaternion(axis, ECLIPTIC_NORTH, spin.current.quaternion);
      }
    } else if (locked && obj.parentId) {
      // Tidally locked: longitude 0 faces the parent.
      toParent.copy(getRenderPosition(obj.parentId)).sub(pos);
      const pole = frame?.pole ?? parentFrame?.pole ?? ECLIPTIC_NORTH;
      facingQuaternion(pole, toParent, spin.current.quaternion);
    } else if (frame && physical.rotation) {
      // IAU model; when time runs too fast to follow, spin at a capped rate and ease back after.
      const s = spinState.current;
      const w = primeMeridian(physical.rotation, days);
      const rate = currentRate(time) * (physical.rotation.wDot / 86400);
      if (Math.abs(rate) > MAX_SPIN_DEG && !Number.isNaN(s.lastW)) {
        s.offset = wrap180(s.offset + Math.sign(rate) * MAX_SPIN_DEG * delta - (w - s.lastW));
      } else {
        s.offset = wrap180(s.offset) * Math.exp(-delta * 1.5);
      }
      s.lastW = w;
      bodyQuaternion(frame, w + s.offset, spin.current.quaternion);
    } else if (physical.rotationPeriodHours && lastSimTime.current !== null) {
      const simSeconds = (timeMs - lastSimTime.current) / 1000;
      const dAngle = (2 * Math.PI * simSeconds) / (physical.rotationPeriodHours * 3600);
      const cap = MAX_SPIN_DEG * DEG * delta;
      spinState.current.angle += Math.max(-cap, Math.min(cap, dAngle));
      spin.current.quaternion.setFromAxisAngle(ECLIPTIC_NORTH, spinState.current.angle);
    }
    lastSimTime.current = timeMs;
    worldQ.copy(tilt.current.quaternion).multiply(spin.current.quaternion);
    setBodyOrientation(obj.id, worldQ);

    if (!isModel) {
      const target = selected ? 1 : obj.id === sel.hoveredId ? 0.6 : 0;
      const u = surfaceMat.uniforms.uHighlight;
      u.value += (target - u.value) * Math.min(1, delta * 8);
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectObject(obj.id);
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    useSelectionStore.getState().hoverObject(obj.id);
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    useSelectionStore.getState().hoverObject(null);
    document.body.style.cursor = "";
  };

  const shape = visual.shape ?? [1, 1, 1];
  // Bodies without an IAU model keep their catalogue axial tilt.
  const tiltRad = !frame && !locked && !isModel ? -(physical.axialTiltDeg ?? 0) * DEG : 0;

  return (
    <group ref={group}>
      <group ref={tilt} rotation={[0, 0, tiltRad]}>
        <group ref={spin}>
          {isModel ? (
            <group onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
              <SpacecraftMesh kind={visual.model!} size={radius} />
            </group>
          ) : (
            <mesh
              ref={surface}
              scale={[radius * shape[0], radius * shape[1], radius * shape[2]]}
              geometry={major || radius > 0.3 ? SPHERE_HI : SPHERE_LO}
              material={surfaceMat}
              onClick={onClick}
              onPointerOver={onOver}
              onPointerOut={onOut}
            />
          )}
          {cloudMat && <mesh ref={clouds} scale={radius * 1.006} geometry={SPHERE_HI} material={cloudMat} renderOrder={1} raycast={() => null} />}
        </group>
        {ringMat && visual.rings && (
          <RingPlane frame={frame} ringMat={ringMat} inner={visual.rings.innerRadii * radius} outer={visual.rings.outerRadii * radius} />
        )}
      </group>
      {atmosphere && <mesh scale={radius * atmosphere.scale} geometry={SPHERE_HI} material={atmosphere.material} renderOrder={3} raycast={() => null} />}
      <BodyLabel obj={obj} radius={radius} />
    </group>
  );
}

const ORIGIN = new Vector3();

/** Rings lie in the planet's equatorial plane. */
function RingPlane({ frame, ringMat, inner, outer }: { frame: PoleFrame | null; ringMat: ShaderMaterial; inner: number; outer: number }) {
  const quat = useMemo(() => (frame ? bodyQuaternion(frame, 0, new Quaternion()) : new Quaternion()), [frame]);
  return (
    <group quaternion={quat}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={ringMat} renderOrder={2} raycast={() => null}>
        <ringGeometry args={[inner, outer, 128, 1]} />
      </mesh>
    </group>
  );
}
