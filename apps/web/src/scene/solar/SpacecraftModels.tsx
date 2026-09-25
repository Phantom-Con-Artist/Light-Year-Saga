import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  DoubleSide,
  FrontSide,
  BackSide,
  Group,
  LatheGeometry,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  type Material,
} from "three";
import type { SpacecraftModel } from "../../domain/types";

/**
 * Spacecraft built from primitives, in metres, then scaled to the display
 * size. Axes: +Z is the "business end" — velocity for stations, the
 * high-gain antenna (towards Earth) for deep-space probes, the sunshield or
 * heat shield (towards the Sun) for JWST and Parker. Solar arrays turn to
 * face the Sun.
 */

/* ------------------------------------------------------------ materials */

function cellTexture(front: string, line: string, cols: number, rows: number): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = front;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = line;
  g.lineWidth = 1.5;
  for (let i = 1; i < cols; i++) {
    const x = (i / cols) * c.width;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, c.height);
    g.stroke();
  }
  for (let j = 1; j < rows; j++) {
    const y = (j / rows) * c.height;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(c.width, y);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

let mats: Record<string, Material> | null = null;
function M() {
  if (mats) return mats;
  const std = (color: string, metalness = 0.1, roughness = 0.6, extra: Partial<MeshStandardMaterial> = {}) =>
    Object.assign(new MeshStandardMaterial({ color, metalness, roughness }), extra);
  mats = {
    white: std("#e9e7e2", 0.05, 0.7),
    cream: std("#dcd6c4", 0.05, 0.75),
    grey: std("#8a8f96", 0.6, 0.45),
    dark: std("#2b2d31", 0.4, 0.6),
    silver: std("#c9ccd1", 0.8, 0.3),
    gold: std("#c89a3c", 0.9, 0.3),
    mirror: std("#e2b24a", 1, 0.18),
    sunshield: std("#c9b3d9", 0.7, 0.35, { side: DoubleSide }),
    blanketFront: std("#ffffff", 0.3, 0.45, { map: cellTexture("#1b2a4a", "#44557a", 16, 4), side: FrontSide }),
    blanketBack: std("#c78a3a", 0.5, 0.55, { side: BackSide }),
    panelFront: std("#ffffff", 0.3, 0.45, { map: cellTexture("#15203c", "#3a4a70", 8, 4), side: FrontSide }),
    panelBack: std("#9aa0a8", 0.5, 0.5, { side: BackSide }),
    radiator: std("#f4f4f2", 0.05, 0.85, { side: DoubleSide }),
    heatShield: std("#f2f0ea", 0.0, 0.9),
    boom: std("#9a9ea4", 0.5, 0.5),
  };
  return mats;
}

/* ------------------------------------------------------------ primitives */

type V3 = [number, number, number];

function Box({ p = [0, 0, 0], s, r, m }: { p?: V3; s: V3; r?: V3; m: Material }) {
  return (
    <mesh position={p} rotation={r} material={m}>
      <boxGeometry args={s} />
    </mesh>
  );
}

/** Cylinder of radius `rad` and length `len` along an axis ("x" | "y" | "z"). */
function Cyl({ p = [0, 0, 0], rad, len, axis = "z", m, seg = 20, rad2 }: { p?: V3; rad: number; len: number; axis?: "x" | "y" | "z"; m: Material; seg?: number; rad2?: number }) {
  const r: V3 = axis === "z" ? [Math.PI / 2, 0, 0] : axis === "x" ? [0, 0, Math.PI / 2] : [0, 0, 0];
  return (
    <mesh position={p} rotation={r} material={m}>
      <cylinderGeometry args={[rad2 ?? rad, rad, len, seg]} />
    </mesh>
  );
}

/** A flat panel with a cell pattern on the front and a coloured back. Lies in XY, facing +Z. */
function Panel({ p = [0, 0, 0], w, h, r, front, back }: { p?: V3; w: number; h: number; r?: V3; front: Material; back: Material }) {
  return (
    <group position={p} rotation={r}>
      <mesh material={front}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh material={back}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  );
}

const dishGeometries = new Map<string, LatheGeometry>();
/** Parabolic dish of diameter `d`, opening toward +Z. */
function Dish({ p = [0, 0, 0], d, depth = 0.25, m }: { p?: V3; d: number; depth?: number; m: Material }) {
  const key = `${d}-${depth}`;
  let g = dishGeometries.get(key);
  if (!g) {
    const pts: Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const r = (i / 12) * (d / 2);
      pts.push(new Vector2(r, depth * d * (r / (d / 2)) ** 2));
    }
    g = new LatheGeometry(pts, 32);
    dishGeometries.set(key, g);
  }
  return (
    <mesh position={p} rotation={[Math.PI / 2, 0, 0]} geometry={g}>
      <primitive object={m} attach="material" />
    </mesh>
  );
}

/* ------------------------------------------------------------ sun tracking */

const wp = new Vector3();
const wq = new Quaternion();
const sunLocal = new Vector3();

/** Rotates its children about the local X axis so panels lying in XY face the Sun. */
function SunTracker({ children, p = [0, 0, 0] }: { children: ReactNode; p?: V3 }) {
  const g = useRef<Group>(null!);
  useFrame(() => {
    const parent = g.current.parent;
    if (!parent) return;
    parent.getWorldPosition(wp);
    parent.getWorldQuaternion(wq);
    sunLocal.copy(wp).negate().applyQuaternion(wq.invert());
    // Panel normal (0,0,1) rotated by θ about X is (0, −sinθ, cosθ): point it at the Sun's YZ projection.
    g.current.rotation.x = Math.atan2(-sunLocal.y, sunLocal.z);
  });
  return (
    <group ref={g} position={p}>
      {children}
    </group>
  );
}

/* ------------------------------------------------------------ models */

function ISS() {
  const m = M();
  const wings: ReactNode[] = [];
  // Eight solar array wings on four outboard truss segments (P6, P4, S4, S6), each with two blankets.
  for (const x of [-44, -31, 31, 44]) {
    for (const side of [1, -1]) {
      const y0 = side * 3;
      const center = y0 + side * 17;
      wings.push(
        <group key={`${x}${side}`}>
          <Box p={[x, center, 0]} s={[0.35, 34, 0.35]} m={m.boom} />
          <Panel p={[x - 2.6, center, 0]} w={4.6} h={34} front={m.blanketFront} back={m.blanketBack} />
          <Panel p={[x + 2.6, center, 0]} w={4.6} h={34} front={m.blanketFront} back={m.blanketBack} />
          {/* Newer roll-out arrays (iROSA) mounted over the old wings at an angle. */}
          {!(x === -44 && side === -1) && !(x === 44 && side === 1) && (
            <Panel p={[x, y0 + side * 10.5, 1.2]} r={[side * 0.18, 0, 0]} w={6} h={19} front={m.panelFront} back={m.panelBack} />
          )}
        </group>,
      );
    }
  }
  return (
    <group>
      {/* Integrated truss, mounted over Destiny. */}
      <group position={[0, 4.5, 9]}>
        <Box s={[100, 2.4, 2.4]} m={m.grey} />
        <Box p={[0, 1.4, 0]} s={[100, 0.25, 2.8]} m={m.dark} />
        {/* Main radiators, edge-on to the Sun. */}
        {[-13, 13].map((x) => (
          <group key={x} position={[x, 0, -2]}>
            {[0, 1, 2].map((k) => (
              <Box key={k} p={[0, -0.6 * k, -4 - k * 8]} s={[11, 0.12, 7.5]} r={[0.25, 0, 0]} m={m.radiator} />
            ))}
          </group>
        ))}
        {/* Photovoltaic radiators near the arrays. */}
        {[-37.5, 37.5].map((x) => (
          <Box key={x} p={[x, -4, 0]} s={[3.4, 7, 0.1]} m={m.radiator} />
        ))}
        {/* Canadarm2 */}
        <Box p={[-8, 2.4, 1]} s={[17, 0.35, 0.35]} r={[0, 0, 0.35]} m={m.white} />
        {/* Solar arrays rotate about the truss to follow the Sun. */}
        <SunTracker p={[0, 0, 0]}>{wings}</SunTracker>
      </group>

      {/* US orbital segment, front to back along +Z. */}
      <Cyl p={[0, 0, 24.5]} rad={1.9} len={4} m={m.white} />
      <Cyl p={[0, 0, 18]} rad={2.2} len={7.2} m={m.white} />
      <Cyl p={[7, 0, 18]} rad={2.25} len={7} axis="x" m={m.white} />
      <Cyl p={[-8.5, 0, 18]} rad={2.2} len={11} axis="x" m={m.white} />
      <Box p={[-16, 0, 18]} s={[4, 1.2, 5]} m={m.grey} />
      <Cyl p={[-9, 3.4, 18]} rad={2.2} len={4.2} axis="y" m={m.white} />
      <Cyl p={[0, 0, 10.2]} rad={2.15} len={8.5} m={m.white} />
      <Cyl p={[0, 0, 3.2]} rad={2.3} len={5.5} m={m.white} />
      <Cyl p={[-5.5, 0, 3.2]} rad={2.2} len={6.7} axis="x" m={m.white} />
      <Cyl p={[-5.5, -2.8, 3.2]} rad={1.5} len={1.5} axis="y" m={m.dark} rad2={1.1} />
      <Cyl p={[3.9, 0, 3.2]} rad={1.6} len={3} axis="x" m={m.white} />

      {/* Russian orbital segment. */}
      <Cyl p={[0, 0, -6.8]} rad={2.05} len={12.6} m={m.cream} />
      <Cyl p={[0, 0, -19.5]} rad={2.1} len={13} m={m.cream} rad2={1.5} />
      <Cyl p={[0, -7, -16]} rad={2.1} len={12} axis="y" m={m.cream} />
      <Cyl p={[0, 3.5, -16]} rad={1.3} len={4} axis="y" m={m.cream} />
      <Box p={[0, 0, -16]} s={[29.7, 0.08, 3]} m={m.panelFront} />
      <Panel p={[-8.5, 0, -18]} r={[-Math.PI / 2, 0, 0]} w={10.7} h={3} front={m.panelFront} back={m.panelBack} />
      <Panel p={[8.5, 0, -18]} r={[-Math.PI / 2, 0, 0]} w={10.7} h={3} front={m.panelFront} back={m.panelBack} />
      {/* Docked Soyuz / Progress. */}
      {[
        [0, 0, -29],
        [0, 7.3, -16],
      ].map((p, k) => (
        <group key={k} position={p as V3} rotation={k === 1 ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
          <Cyl rad={1.35} len={7} m={m.cream} />
          <Panel p={[0, 0, 1]} r={[-Math.PI / 2, 0, 0]} w={10.6} h={1.1} front={m.panelFront} back={m.panelBack} />
        </group>
      ))}
    </group>
  );
}

function Tiangong() {
  const m = M();
  const wing = (x: number) => (
    <SunTracker key={x} p={[x, 0, 0]}>
      <Box p={[0, 13, 0]} s={[0.25, 26, 0.25]} m={m.boom} />
      <Panel p={[0, 16, 0]} w={4.4} h={27} front={m.panelFront} back={m.panelBack} />
      <Panel p={[0, -16, 0]} w={4.4} h={27} front={m.panelFront} back={m.panelBack} />
    </SunTracker>
  );
  return (
    <group>
      <Cyl p={[0, 0, -4]} rad={2.1} len={16.6} m={m.white} rad2={1.4} />
      <Cyl p={[9, 0, 6]} rad={2.1} len={17.9} axis="x" m={m.white} />
      <Cyl p={[-9, 0, 6]} rad={2.1} len={17.9} axis="x" m={m.white} />
      {wing(-17)}
      {wing(17)}
      <Panel p={[-6, 0, -9]} r={[-Math.PI / 2, 0, 0]} w={9} h={2.8} front={m.panelFront} back={m.panelBack} />
      <Panel p={[6, 0, -9]} r={[-Math.PI / 2, 0, 0]} w={9} h={2.8} front={m.panelFront} back={m.panelBack} />
    </group>
  );
}

function Hubble() {
  const m = M();
  return (
    <group>
      <Cyl rad={2.1} len={13.2} m={m.silver} seg={28} />
      <Cyl p={[0, 0, 6.8]} rad={2.15} len={0.4} m={m.dark} />
      <Box p={[0, 1.9, 7.6]} s={[3.6, 0.1, 3.6]} r={[0.9, 0, 0]} m={m.silver} />
      <Cyl p={[0, 0, -6.2]} rad={2.2} len={1.2} m={m.grey} />
      <SunTracker>
        <Box s={[12.2, 0.2, 0.2]} m={m.boom} />
        <Panel p={[-4.9, 0, 0]} w={7.1} h={2.6} front={m.panelFront} back={m.panelBack} />
        <Panel p={[4.9, 0, 0]} w={7.1} h={2.6} front={m.panelFront} back={m.panelBack} />
      </SunTracker>
      <Box p={[0, 3.3, -1]} s={[0.12, 2.6, 0.12]} m={m.boom} />
      <Dish p={[0, 4.6, -1]} d={1.3} m={m.white} />
      <Box p={[0, -3.3, -1]} s={[0.12, 2.6, 0.12]} m={m.boom} />
      <Dish p={[0, -4.6, -1]} d={1.3} m={m.white} />
    </group>
  );
}

const sunshieldGeometry = (() => {
  const s = new Shape();
  const pts: [number, number][] = [
    [0, 7],
    [7.5, 5.5],
    [10.5, 0],
    [7.5, -5.5],
    [0, -7],
    [-7.5, -5.5],
    [-10.5, 0],
    [-7.5, 5.5],
  ];
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return new ShapeGeometry(s);
})();

const hexShape = (() => {
  const s = new Shape();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * 0.72;
    const y = Math.sin(a) * 0.72;
    if (k) s.lineTo(x, y);
    else s.moveTo(x, y);
  }
  s.closePath();
  return new ShapeGeometry(s);
})();

function JWST() {
  const m = M();
  // 18 hexagonal segments: two rings around a missing centre.
  const segments: [number, number][] = [];
  const dx = 1.3;
  const dy = 1.3 * Math.sqrt(3) / 2;
  for (let q = -2; q <= 2; q++)
    for (let r = -2; r <= 2; r++) {
      const s = -q - r;
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      if (ring === 0 || ring > 2) continue;
      segments.push([dx * (q + r / 2), dy * r * 1.15]);
    }
  return (
    <group>
      {/* Five sunshield layers, the hot side facing the Sun (+Z). */}
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh key={k} geometry={sunshieldGeometry} material={m.sunshield} position={[0, 0, 0.25 * k]} scale={1 - k * 0.025} />
      ))}
      <Box p={[0, 0, 1.9]} s={[3, 3, 1.4]} m={m.dark} />
      <Panel p={[0, -3.2, 2]} r={[-0.3, 0, 0]} w={2.5} h={5.9} front={m.panelFront} back={m.panelBack} />
      <Dish p={[1.4, 0, 2.8]} d={0.6} m={m.white} />
      {/* Optical telescope on the cold side, looking square to the Sun line. */}
      <group position={[0, 1, -3.4]} rotation={[-Math.PI / 2 + 0.2, 0, 0]}>
        {segments.map(([x, y], i) => (
          <mesh key={i} geometry={hexShape} material={m.mirror} position={[x, y, 0]} />
        ))}
        <mesh material={m.dark} position={[0, 0, -0.3]}>
          <boxGeometry args={[6.6, 6.6, 0.5]} />
        </mesh>
        {[0, 1, 2].map((k) => {
          const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
          return <Box key={k} p={[Math.cos(a) * 1.8, Math.sin(a) * 1.8, 3.6]} r={[-Math.sin(a) * 0.45, Math.cos(a) * 0.45, 0]} s={[0.08, 0.08, 7.3]} m={m.boom} />;
        })}
        <Cyl p={[0, 0, 7.2]} rad={0.37} len={0.3} m={m.mirror} />
      </group>
    </group>
  );
}

/** Voyager and Pioneer share a layout: big dish over a small bus, booms for RTGs and magnetometer. */
function Voyager({ pioneer = false }: { pioneer?: boolean }) {
  const m = M();
  const dish = pioneer ? 2.74 : 3.66;
  return (
    <group>
      <Dish p={[0, 0, 0.2]} d={dish} depth={0.2} m={m.white} />
      <Cyl p={[0, 0, -0.35]} rad={pioneer ? 0.7 : 0.9} len={0.45} m={m.gold} seg={pioneer ? 6 : 10} />
      <Box p={[0, 0, 0.9]} s={[0.05, 0.05, 1.2]} m={m.boom} />
      {/* RTG boom */}
      <Box p={[-1.8, 0, -0.35]} s={[2.4, 0.06, 0.06]} m={m.boom} />
      {[0, 1, 2].map((k) => (
        <Cyl key={k} p={[-1.2 - k * 0.5, 0, -0.35]} rad={0.2} len={0.42} axis="x" m={m.dark} seg={8} />
      ))}
      {/* Science boom and scan platform */}
      <Box p={[1.4, 0, -0.35]} s={[2.2, 0.06, 0.06]} m={m.boom} />
      <Box p={[2.5, 0, -0.35]} s={[0.5, 0.4, 0.35]} m={m.grey} />
      {/* Magnetometer boom */}
      <Box p={[0, -(pioneer ? 3.6 : 7), -0.4]} s={[0.04, pioneer ? 6.6 : 13, 0.04]} m={m.boom} />
    </group>
  );
}

function NewHorizons() {
  const m = M();
  return (
    <group>
      <mesh material={m.gold} position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.7, 3]} />
      </mesh>
      <Dish p={[0, 0, 0.05]} d={2.1} depth={0.18} m={m.white} />
      <Cyl p={[-1.6, 0, -0.35]} rad={0.25} len={1.1} axis="x" m={m.dark} seg={10} />
    </group>
  );
}

function Cassini() {
  const m = M();
  return (
    <group>
      <Dish p={[0, 0, 0.3]} d={4} depth={0.22} m={m.white} />
      <Cyl p={[0, 0, -1.4]} rad={0.9} len={3.2} m={m.gold} seg={12} />
      <Cyl p={[0, 0, -3.4]} rad={0.6} len={1} m={m.dark} rad2={0.3} />
      <Cyl p={[1.2, 0, -1.2]} rad={0.65} len={0.4} axis="x" m={m.white} seg={16} />
      <Box p={[0, -5.6, -0.8]} s={[0.05, 11, 0.05]} m={m.boom} />
      {[-1, 1].map((s) => (
        <Cyl key={s} p={[s * 0.9, 0.3, -2.9]} rad={0.2} len={1.1} m={m.dark} seg={8} />
      ))}
    </group>
  );
}

function Juno() {
  const m = M();
  return (
    <group>
      <mesh material={m.gold} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.75, 1.75, 1.2, 6]} />
      </mesh>
      <Dish p={[0, 0, 0.7]} d={2.5} depth={0.18} m={m.white} />
      {[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2;
        return (
          <group key={k} rotation={[0, 0, a]}>
            <Panel p={[6.2, 0, 0]} w={8.9} h={2.7} front={m.panelFront} back={m.panelBack} />
          </group>
        );
      })}
    </group>
  );
}

function Clipper() {
  const m = M();
  return (
    <group>
      <Cyl p={[0, 0, -1.2]} rad={0.8} len={3} m={m.silver} seg={16} />
      <Dish p={[0, 0, 0.5]} d={3} depth={0.2} m={m.white} />
      <SunTracker p={[0, 0, -1.8]}>
        {[-1, 1].map((s) => (
          <Panel key={s} p={[s * 8.6, 0, 0]} w={14.2} h={4.1} front={m.panelFront} back={m.panelBack} />
        ))}
      </SunTracker>
    </group>
  );
}

function Parker() {
  const m = M();
  return (
    <group>
      <Cyl p={[0, 0, 0.8]} rad={1.15} len={0.12} m={m.heatShield} seg={32} />
      <Box p={[0, 0, 0.3]} s={[0.1, 0.1, 0.8]} m={m.boom} />
      <mesh material={m.gold} position={[0, 0, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 1.1, 6]} />
      </mesh>
      {[-1, 1].map((s) => (
        <Panel key={s} p={[s * 0.95, 0, -0.4]} r={[0, s * 0.9, 0]} w={0.7} h={0.5} front={m.panelFront} back={m.panelBack} />
      ))}
    </group>
  );
}

/** Model extent (m) from its centre, to scale it to the display size. */
const EXTENT: Record<SpacecraftModel, number> = {
  iss: 55,
  tiangong: 30,
  hubble: 7.5,
  jwst: 11,
  voyager: 13,
  pioneer: 7,
  "new-horizons": 1.8,
  cassini: 11,
  juno: 10.5,
  clipper: 15.5,
  parker: 1.5,
};

export function SpacecraftMesh({ kind, size }: { kind: SpacecraftModel; size: number }) {
  const body = useMemo(() => {
    switch (kind) {
      case "iss":
        return <ISS />;
      case "tiangong":
        return <Tiangong />;
      case "hubble":
        return <Hubble />;
      case "jwst":
        return <JWST />;
      case "voyager":
        return <Voyager />;
      case "pioneer":
        return <Voyager pioneer />;
      case "new-horizons":
        return <NewHorizons />;
      case "cassini":
        return <Cassini />;
      case "juno":
        return <Juno />;
      case "clipper":
        return <Clipper />;
      case "parker":
        return <Parker />;
    }
  }, [kind]);
  return <group scale={size / EXTENT[kind]}>{body}</group>;
}
