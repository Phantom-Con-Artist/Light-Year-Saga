import { create } from "zustand";

/** Live renderer stats for the FPS readout (only collected while it is shown). */
interface PerfState {
  fps: number;
  frameMs: number;
  pixelRatio: number;
  drawCalls: number;
  primitives: number;
  tick: (now: number, pixelRatio: number, drawCalls: number, primitives: number) => void;
}

let frames = 0;
let windowStart = 0;

export const usePerfStore = create<PerfState>()((set) => ({
  fps: 0,
  frameMs: 0,
  pixelRatio: 1,
  drawCalls: 0,
  primitives: 0,
  tick: (now, pixelRatio, drawCalls, primitives) => {
    frames++;
    if (windowStart === 0) windowStart = now;
    const elapsed = now - windowStart;
    if (elapsed < 500) return;
    set({ fps: (frames * 1000) / elapsed, frameMs: elapsed / frames, pixelRatio, drawCalls, primitives });
    frames = 0;
    windowStart = now;
  },
}));
