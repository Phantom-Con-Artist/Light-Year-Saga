import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three";

/**
 * Real surface maps (Solar System Scope, CC BY 4.0 — based on NASA mission
 * data). Loaded in the background; bodies show their baked procedural surface
 * until the image arrives.
 */
export interface BodyTextures {
  map: string;
  /** Night-side city lights. */
  night?: string;
  /** Cloud layer (greyscale = coverage). */
  clouds?: string;
  /** Ocean mask for sun glint (white = water). */
  ocean?: string;
  /** Ring radial profile (RGBA, inner edge on the left). */
  ring?: string;
}

const T = (f: string) => `/textures/planets/${f}`;

export const BODY_TEXTURES: Record<string, BodyTextures> = {
  sun: { map: T("sun.jpg") },
  mercury: { map: T("mercury.jpg") },
  venus: { map: T("venus.jpg") },
  earth: { map: T("earth_day.jpg"), night: T("earth_night.jpg"), clouds: T("earth_clouds.jpg"), ocean: T("earth_ocean.jpg") },
  moon: { map: T("moon.jpg") },
  mars: { map: T("mars.jpg") },
  jupiter: { map: T("jupiter.jpg") },
  saturn: { map: T("saturn.jpg"), ring: T("saturn_ring.png") },
  uranus: { map: T("uranus.jpg") },
  neptune: { map: T("neptune.jpg") },
};

export const TEXTURE_CREDIT = "Planet maps: Solar System Scope (CC BY 4.0), from NASA data";

const loader = new TextureLoader();
const cache = new Map<string, Promise<Texture>>();

/** Load (once) and cache a texture. `data` maps (masks) skip sRGB decoding. */
export function loadTexture(url: string, anisotropy: number, data = false): Promise<Texture> {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((tex) => {
      tex.colorSpace = data ? NoColorSpace : SRGBColorSpace;
      tex.wrapS = RepeatWrapping;
      tex.minFilter = LinearMipmapLinearFilter;
      tex.magFilter = LinearFilter;
      tex.anisotropy = anisotropy;
      return tex;
    });
    cache.set(url, p);
  }
  return p;
}

/** The texture once it has loaded, else null. */
export function useRealTexture(url: string | undefined, data = false): Texture | null {
  const gl = useThree((s) => s.gl);
  const [tex, setTex] = useState<Texture | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    loadTexture(url, Math.min(8, gl.capabilities.getMaxAnisotropy()), data).then(
      (t) => live && setTex(t),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [url, gl, data]);
  return url ? tex : null;
}
