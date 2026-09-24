import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";
import type { CatalogObject, NebulaStyle, NebulaVisual } from "../../data/catalog";
import { bakeVertex } from "../shaders";

/** Procedural nebula appearance by type (normalised coords, edge at r = 1). */
const fragment = /* glsl */ `
uniform float uStyle;   // 0 emission 1 planetary 2 remnant 3 dark 4 pillars
uniform vec3 uA;
uniform vec3 uB;
uniform float uSeed;
uniform float uLayer;
varying vec2 vUv;

float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise2(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
float fbm2(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { v += a * vnoise2(p); p = p * 2.03 + 7.3; a *= 0.5; }
  return v;
}
float ridged(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * (1.0 - abs(vnoise2(p) * 2.0 - 1.0)); p = p * 2.1 + 3.7; a *= 0.5; }
  return v;
}
float capsule(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  vec2 q = p * 2.2 + uSeed + uLayer * 5.3;
  vec2 warp = vec2(fbm2(q), fbm2(q + 5.2));
  float n = fbm2(q + warp * 1.6);
  float mask = smoothstep(1.0, 0.55, r);
  vec3 col = vec3(0.0);

  if (uStyle < 0.5) {                      // emission
    float gas = smoothstep(0.35, 0.85, n) * mask;
    float core = exp(-r / 0.22) * 0.8;
    float oiii = smoothstep(0.45, 0.8, fbm2(q * 1.3 + 9.0)) * exp(-r / 0.45);
    float dust = smoothstep(0.55, 0.8, ridged(q * 0.9 + 2.0)) * 0.8;
    col = uA * (gas * 1.1 + core * 0.4) + uB * oiii * 0.9;
    col *= 1.0 - dust * mask;
    col += vec3(1.0) * step(0.997, hash2(floor(vUv * 420.0))) * mask * 0.8;
  } else if (uStyle < 1.5) {               // planetary nebula
    float ring = exp(-pow((r - 0.5) / 0.14, 2.0)) * (0.6 + 0.8 * n);
    float inner = exp(-r / 0.3) * 0.6;
    float halo = exp(-pow((r - 0.72) / 0.18, 2.0)) * 0.25 * n;
    float knots = step(0.8, fbm2(p * 22.0 + uSeed)) * exp(-pow((r - 0.4) / 0.08, 2.0));
    col = uB * inner + mix(uB, uA, smoothstep(0.35, 0.65, r)) * ring + uA * (halo + knots * 0.6);
    col += vec3(1.0) * exp(-r / 0.015) * 1.5;
  } else if (uStyle < 2.5) {               // supernova remnant
    vec2 e = p * vec2(1.0, 1.3);
    float body = smoothstep(0.9, 0.3, length(e));
    float fil = pow(ridged(q * 1.6), 3.0) * body;
    float sync = exp(-length(e) / 0.35) * 0.7;
    col = uA * fil * 1.4 + uB * sync;
    col += vec3(0.9, 0.95, 1.0) * exp(-r / 0.02) * 1.2;
  } else if (uStyle < 3.5) {               // dark nebula against a glowing curtain
    float curtain = (0.35 + 0.65 * smoothstep(-0.9, 0.9, p.y)) * (0.5 + n) * mask;
    float neck = capsule(p, vec2(0.0, -1.0), vec2(0.05, 0.05), 0.28, 0.16);
    float head = length((p - vec2(-0.12, 0.2)) * vec2(1.0, 1.35)) - 0.26;
    float snout = capsule(p, vec2(-0.12, 0.2), vec2(-0.42, -0.08), 0.12, 0.08);
    float d = min(min(neck, head), snout) + (fbm2(p * 9.0) - 0.5) * 0.06;
    float dark = smoothstep(0.02, -0.03, d);
    float rim = exp(-abs(d) / 0.02) * 0.6;
    col = uA * curtain * (1.0 - dark * 0.96) + uA * rim * 0.5;
  } else {                                 // pillars of creation
    vec3 gas = mix(uB * 0.4, uA, smoothstep(-0.8, 0.9, p.y)) * (0.35 + 0.9 * n) * mask;
    float d = 1e3;
    d = min(d, capsule(p, vec2(-0.45, -1.05), vec2(-0.32, 0.55), 0.17, 0.08));
    d = min(d, capsule(p, vec2(0.05, -1.05), vec2(0.1, 0.05), 0.12, 0.07));
    d = min(d, capsule(p, vec2(0.45, -1.05), vec2(0.5, -0.3), 0.11, 0.06));
    d += (fbm2(p * 7.0 + uSeed) - 0.5) * 0.09;
    // Pillars rise out of the bottom of the cloud and dissolve into it.
    float base = smoothstep(-1.0, -0.55, p.y) * mask;
    float pillar = smoothstep(0.02, -0.05, d) * base;
    // Rim light from above: the edges facing the young stars glow softly.
    float rim = exp(-abs(d) / 0.045) * (0.25 + 0.6 * smoothstep(-0.8, 0.6, p.y)) * base * (0.6 + 0.8 * fbm2(p * 11.0));
    vec3 dust = mix(vec3(0.12, 0.07, 0.04), vec3(0.3, 0.18, 0.1), fbm2(p * 6.0 + 3.0)) * (0.5 + fbm2(p * 14.0));
    col = gas * (1.0 - pillar) + dust * pillar + vec3(1.0, 0.8, 0.55) * rim * 0.45;
    col += vec3(1.0) * step(0.997, hash2(floor(vUv * 380.0))) * 0.8;
  }

  gl_FragColor = vec4(col * 0.8, 1.0);
}
`;

const STYLE: Record<NebulaStyle, number> = { emission: 0, planetary: 1, remnant: 2, dark: 3, pillars: 4 };
const cache = new Map<string, WebGLRenderTarget>();
const quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

function bakeNebula(gl: WebGLRenderer, key: string, visual: NebulaVisual, layer: number): Texture {
  const hit = cache.get(key);
  if (hit) return hit.texture;
  const target = new WebGLRenderTarget(512, 512, {
    colorSpace: SRGBColorSpace,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
  let seed = 0;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) % 1000;
  const material = new ShaderMaterial({
    vertexShader: bakeVertex,
    fragmentShader: fragment,
    uniforms: {
      uStyle: { value: STYLE[visual.style] },
      uA: { value: new Color(visual.colorA) },
      uB: { value: new Color(visual.colorB) },
      uSeed: { value: seed / 53 },
      uLayer: { value: layer },
    },
    depthTest: false,
  });
  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const prev = gl.getRenderTarget();
  gl.setRenderTarget(target);
  gl.render(scene, quadCamera);
  gl.setRenderTarget(prev);
  material.dispose();
  geometry.dispose();
  cache.set(key, target);
  return target.texture;
}

/** Nebulae as a few overlapping camera-facing layers — cheap, with a hint of depth when orbiting. */
export function Nebulae({ objects }: { objects: CatalogObject[] }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  const sprites = useMemo(() => {
    const out: { sprite: Sprite; size: number; base: number }[] = [];
    for (const o of objects) {
      const v = o.visual;
      if (v?.type !== "nebula") continue;
      // Shapes that must read clearly get a single layer.
      const layers = v.style === "pillars" || v.style === "dark" || v.style === "planetary" ? 1 : 3;
      for (let i = 0; i < layers; i++) {
        const material = new SpriteMaterial({
          map: bakeNebula(gl, `${o.id}:${i}`, v, i),
          blending: AdditiveBlending,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
          rotation: i * 1.9,
        });
        const sprite = new Sprite(material);
        const s = o.extent * (1 - i * 0.18);
        sprite.scale.set(s * (v.aspect ?? 1), s, 1);
        sprite.position.copy(o.position);
        if (i > 0) {
          sprite.position.x += (i - 1.5) * o.extent * 0.08;
          sprite.position.y += i * o.extent * 0.05;
          sprite.position.z -= i * o.extent * 0.1;
        }
        sprite.raycast = () => {};
        sprite.renderOrder = -2;
        out.push({ sprite, size: o.extent, base: layers > 1 ? 0.7 : 1 });
      }
    }
    return out;
  }, [objects, gl]);

  useEffect(() => () => sprites.forEach((s) => s.sprite.material.dispose()), [sprites]);

  useFrame(() => {
    for (const s of sprites) {
      const d = camera.position.distanceTo(s.sprite.position);
      // Fade when the camera is inside the cloud so it never floods the screen.
      const t = Math.min(1, Math.max(0, (d - s.size * 0.25) / (s.size * 0.6)));
      s.sprite.material.opacity = s.base * t * t;
      s.sprite.visible = t > 0.001;
    }
  });

  return (
    <group>
      {sprites.map((s, i) => (
        <primitive key={i} object={s.sprite} />
      ))}
    </group>
  );
}
