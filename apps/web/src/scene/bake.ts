import {
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import type { SpaceObject, SurfaceStyle, VisualDefinition } from "../domain/types";
import { bakeFragment, bakeVertex } from "./shaders";

const STYLE_INDEX: Record<SurfaceStyle, number> = {
  rocky: 0,
  cloudy: 1,
  terran: 2,
  banded: 3,
  ice: 4,
  star: 5,
  clouds: 6,
  "terran-clear": 7,
};

const quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

function seedFromId(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h / 97;
}

/**
 * Renders a body's procedural surface once into an equirectangular texture.
 * This moves all the noise evaluation out of the per-frame shaders.
 */
function bakeSurface(
  gl: WebGLRenderer,
  id: string,
  visual: Pick<VisualDefinition, "style" | "colorA" | "colorB">,
  width: number,
): WebGLRenderTarget {
  const target = new WebGLRenderTarget(width, width / 2, {
    colorSpace: SRGBColorSpace,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
  target.texture.wrapS = RepeatWrapping;
  target.texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());

  const material = new ShaderMaterial({
    vertexShader: bakeVertex,
    fragmentShader: bakeFragment,
    uniforms: {
      uColorA: { value: new Color(visual.colorA) },
      uColorB: { value: new Color(visual.colorB) },
      uStyle: { value: STYLE_INDEX[visual.style] },
      uSeed: { value: seedFromId(id) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));

  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  gl.render(scene, quadCamera);
  gl.setRenderTarget(previous);

  material.dispose();
  geometry.dispose();
  return target;
}

/** Texture width by body importance / typical on-screen size. */
function bakeWidthFor(type: string, style: SurfaceStyle): number {
  if (type === "star" || style === "banded" || style === "terran") return 2048;
  // Moons, dwarf planets and small bodies are rarely seen large.
  return type === "planet" ? 1024 : 512;
}

const cache = new Map<string, WebGLRenderTarget>();

/**
 * Baked surface for a catalogued object. Cached for the app's lifetime —
 * bodies are permanent, and this keeps StrictMode double-renders from re-baking.
 */
export function getBakedSurface(gl: WebGLRenderer, obj: SpaceObject): WebGLRenderTarget {
  let target = cache.get(obj.id);
  if (!target) {
    target = bakeSurface(gl, obj.id, obj.visual, bakeWidthFor(obj.type, obj.visual.style));
    cache.set(obj.id, target);
  }
  return target;
}

/** Bake (and cache) a surface for a body outside the Solar System catalogue. */
export function getBakedCustom(
  gl: WebGLRenderer,
  key: string,
  visual: Pick<VisualDefinition, "style" | "colorA" | "colorB">,
  width = 1024,
): WebGLRenderTarget {
  let target = cache.get(key);
  if (!target) {
    target = bakeSurface(gl, key, visual, width);
    cache.set(key, target);
  }
  return target;
}
