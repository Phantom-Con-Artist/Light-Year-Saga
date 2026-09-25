import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Graphics settings. "Auto" picks a preset from a one-off look at the device
 * (GPU name, cores, memory, screen); every value can then be overridden in
 * Settings, which switches the preset to "Custom". Persisted per browser.
 */

export type Tier = "low" | "medium" | "high" | "ultra";
export type Preset = "auto" | Tier | "custom";
export type ToneMap = "aces" | "agx" | "neutral" | "none";
export type Power = "high-performance" | "low-power" | "default";

export interface GraphicsValues {
  /** Render resolution as a fraction of the display's (after the pixel-ratio cap). */
  resolutionScale: number;
  /** Upper bound on device pixels per CSS pixel. */
  maxPixelRatio: number;
  /** Lower resolution automatically when the frame rate drops. */
  adaptiveResolution: boolean;
  /** Frame rate adaptive resolution tries to hold. */
  targetFps: number;
  /** On: frames are paced by the display. Off: render as fast as the GPU allows. */
  vsync: boolean;
  /** 0 = no cap. */
  fpsCap: number;
  antialias: boolean;
  powerPreference: Power;
  toneMapping: ToneMap;
  exposure: number;
  anisotropy: number;
  /** Load the 8K sky map on large, high-density screens. */
  hiResTextures: boolean;

  starSize: number;
  starBrightness: number;
  twinkle: boolean;
  twinkleStrength: number;
  /** Four-point diffraction spikes on bright stars. */
  spikes: boolean;
  /** Soft halo around bright stars (a cheap bloom). */
  starGlow: boolean;
  glowStrength: number;

  /** Stars in the 3D Milky Way point cloud. */
  galaxyParticles: number;
  /** Dark dust lanes (absorbing sprites). */
  dust: boolean;
  /** Glowing gas clouds and star-forming regions. */
  nebulae: boolean;

  showFps: boolean;
}

export const PRESETS: Record<Tier, GraphicsValues> = {
  low: {
    resolutionScale: 1,
    maxPixelRatio: 1,
    adaptiveResolution: true,
    targetFps: 30,
    vsync: true,
    fpsCap: 30,
    antialias: false,
    powerPreference: "default",
    toneMapping: "aces",
    exposure: 1,
    anisotropy: 2,
    hiResTextures: false,
    starSize: 1,
    starBrightness: 1,
    twinkle: true,
    twinkleStrength: 0.35,
    spikes: false,
    starGlow: true,
    glowStrength: 0.8,
    galaxyParticles: 30_000,
    dust: false,
    nebulae: true,
    showFps: false,
  },
  medium: {
    resolutionScale: 1,
    maxPixelRatio: 1.25,
    adaptiveResolution: true,
    targetFps: 50,
    vsync: true,
    fpsCap: 0,
    antialias: false,
    powerPreference: "high-performance",
    toneMapping: "aces",
    exposure: 1,
    anisotropy: 4,
    hiResTextures: false,
    starSize: 1,
    starBrightness: 1,
    twinkle: true,
    twinkleStrength: 0.5,
    spikes: true,
    starGlow: true,
    glowStrength: 1,
    galaxyParticles: 80_000,
    dust: true,
    nebulae: true,
    showFps: false,
  },
  high: {
    resolutionScale: 1,
    maxPixelRatio: 1.75,
    adaptiveResolution: true,
    targetFps: 55,
    vsync: true,
    fpsCap: 0,
    antialias: true,
    powerPreference: "high-performance",
    toneMapping: "aces",
    exposure: 1,
    anisotropy: 8,
    hiResTextures: true,
    starSize: 1,
    starBrightness: 1,
    twinkle: true,
    twinkleStrength: 0.5,
    spikes: true,
    starGlow: true,
    glowStrength: 1,
    galaxyParticles: 160_000,
    dust: true,
    nebulae: true,
    showFps: false,
  },
  ultra: {
    resolutionScale: 1,
    maxPixelRatio: 2.5,
    adaptiveResolution: false,
    targetFps: 60,
    vsync: true,
    fpsCap: 0,
    antialias: true,
    powerPreference: "high-performance",
    toneMapping: "aces",
    exposure: 1,
    anisotropy: 16,
    hiResTextures: true,
    starSize: 1,
    starBrightness: 1,
    twinkle: true,
    twinkleStrength: 0.5,
    spikes: true,
    starGlow: true,
    glowStrength: 1.1,
    galaxyParticles: 300_000,
    dust: true,
    nebulae: true,
    showFps: false,
  },
};

/* ------------------------------------------------------------ device probe */

export interface DeviceInfo {
  gpu: string;
  software: boolean;
  mobile: boolean;
  cores: number;
  memoryGb: number | null;
  screen: string;
  maxTextureSize: number;
  tier: Tier;
  reason: string;
}

function readGpu(): { gpu: string; maxTextureSize: number } {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return { gpu: "No WebGL", maxTextureSize: 0 };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { gpu, maxTextureSize };
  } catch {
    return { gpu: "Unknown", maxTextureSize: 4096 };
  }
}

/** Shorten "ANGLE (AMD, AMD Radeon(TM) Graphics (0x000015D8) Direct3D11 vs_5_0 ps_5_0, D3D11)". */
function cleanGpuName(raw: string): string {
  const angle = raw.match(/^ANGLE \((?:[^,]+,\s*)?(.+?)(?:\s*\(0x[0-9A-Fa-f]+\))?(?:\s+Direct3D.*|\s*,\s*(?:D3D|OpenGL|Vulkan|Metal).*)?\)$/);
  return (angle ? angle[1] : raw).replace(/\s+/g, " ").trim();
}

const TIERS: Tier[] = ["low", "medium", "high", "ultra"];
const step = (t: Tier, by: number): Tier => TIERS[Math.min(TIERS.length - 1, Math.max(0, TIERS.indexOf(t) + by))];

function detect(): DeviceInfo {
  const { gpu: raw, maxTextureSize } = readGpu();
  const gpu = cleanGpuName(raw);
  const g = raw.toLowerCase();
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = navigator.hardwareConcurrency || 4;
  const memoryGb = nav.deviceMemory ?? null;
  const mobile = window.matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 900;
  const software = /swiftshader|llvmpipe|software|microsoft basic render/.test(g);
  const screenLabel = `${Math.round(screen.width * devicePixelRatio)}×${Math.round(screen.height * devicePixelRatio)}`;

  let tier: Tier;
  let reason: string;
  if (software) {
    tier = "low";
    reason = "Software rendering: hardware acceleration looks off in this browser";
  } else if (mobile) {
    const strong = /apple gpu|adreno \(tm\) (7\d\d|8\d\d)|mali-g(7[1-9]|[89]\d|\d{3})|immortalis|xclipse/.test(g);
    tier = strong ? "medium" : "low";
    reason = strong ? "Recent phone or tablet GPU" : "Phone or tablet";
  } else if (/rtx|radeon rx|radeon pro|arc\(tm\) a|arc a\d|apple m\d (pro|max|ultra)|geforce gtx 1[0-9]{3}|rx \d{4}/.test(g)) {
    tier = "high";
    reason = "Dedicated graphics";
  } else if (/apple m\d|iris xe|radeon\(tm\) \d{3}m|radeon 7\d0m|radeon 8\d0m/.test(g)) {
    tier = "medium";
    reason = "Capable integrated graphics";
  } else if (/radeon|vega|iris|intel/.test(g)) {
    tier = "medium";
    reason = "Integrated graphics";
  } else {
    tier = "medium";
    reason = "Unrecognised GPU";
  }
  if (!software && ((memoryGb !== null && memoryGb <= 4) || cores <= 4)) {
    tier = step(tier, -1);
    reason += " · limited memory or cores";
  }
  return { gpu, software, mobile, cores, memoryGb, screen: screenLabel, maxTextureSize, tier, reason };
}

let device: DeviceInfo | null = null;
export function getDevice(): DeviceInfo {
  device ??= detect();
  return device;
}

/* ------------------------------------------------------------------ store */

interface GraphicsState extends GraphicsValues {
  preset: Preset;
  applyPreset: (p: Exclude<Preset, "custom">) => void;
  set: <K extends keyof GraphicsValues>(key: K, value: GraphicsValues[K]) => void;
  reset: () => void;
}

const valuesFor = (p: Exclude<Preset, "custom">): GraphicsValues => PRESETS[p === "auto" ? getDevice().tier : p];

export const useGraphicsStore = create<GraphicsState>()(
  persist(
    (set) => ({
      preset: "auto",
      ...valuesFor("auto"),
      applyPreset: (p) => set({ preset: p, ...valuesFor(p) }),
      set: (key, value) => set({ [key]: value, preset: "custom" } as Partial<GraphicsState>),
      reset: () => set({ preset: "auto", ...valuesFor("auto") }),
    }),
    {
      name: "lys.graphics.v1",
      // "Auto" re-detects on every visit (new GPU, different browser settings).
      merge: (saved, current) => {
        const s = saved as Partial<GraphicsState> | undefined;
        if (!s || s.preset === "auto" || !s.preset) return current;
        if (s.preset !== "custom") return { ...current, preset: s.preset, ...valuesFor(s.preset) };
        return { ...current, ...s };
      },
    },
  ),
);

/** Current settings without subscribing (for per-frame reads). */
export const graphics = () => useGraphicsStore.getState();
