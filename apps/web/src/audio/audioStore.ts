import { create } from "zustand";

/**
 * Ambient audio: a soundtrack playlist while exploring, and a spaceship-hum
 * loop layered underneath while inside the Voyage cockpit.
 * Browsers block autoplay, so nothing starts until the first user gesture.
 */

const SOUNDTRACK = ["/audio/weightless-wonder-1.mp3", "/audio/weightless-wonder-2.mp3"];
const COCKPIT = ["/audio/cockpit-ambience-2.mp3", "/audio/cockpit-ambience-1.mp3"];
const MUSIC_VOLUME = 0.45;
const COCKPIT_VOLUME = 0.3;
const FADE_MS = 1800;
const PREF_KEY = "lys.audio.muted";

function readMuted(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

interface AudioState {
  muted: boolean;
  unlocked: boolean;
  cockpit: boolean;
  toggleMute: () => void;
  setCockpit: (on: boolean) => void;
  unlock: () => void;
}

let music: HTMLAudioElement | null = null;
let hum: HTMLAudioElement | null = null;
let trackIndex = 0;
const fades = new Map<HTMLAudioElement, number>();

function fadeTo(el: HTMLAudioElement, target: number, ms = FADE_MS) {
  const prev = fades.get(el);
  if (prev) cancelAnimationFrame(prev);
  const start = el.volume;
  const t0 = performance.now();
  if (target > 0 && el.paused) void el.play().catch(() => {});
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    el.volume = Math.min(1, Math.max(0, start + (target - start) * k));
    if (k < 1) fades.set(el, requestAnimationFrame(step));
    else {
      fades.delete(el);
      if (target === 0) el.pause();
    }
  };
  fades.set(el, requestAnimationFrame(step));
}

function ensureElements() {
  if (music) return;
  music = new Audio(SOUNDTRACK[trackIndex]);
  music.preload = "auto";
  music.volume = 0;
  // Playlist: advance to the next track when one ends.
  music.addEventListener("ended", () => {
    trackIndex = (trackIndex + 1) % SOUNDTRACK.length;
    music!.src = SOUNDTRACK[trackIndex];
    void music!.play().catch(() => {});
  });

  hum = new Audio(COCKPIT[0]);
  hum.loop = true;
  hum.preload = "auto";
  hum.volume = 0;
}

function apply(s: Pick<AudioState, "muted" | "unlocked" | "cockpit">) {
  if (!s.unlocked) return;
  ensureElements();
  const musicTarget = s.muted ? 0 : s.cockpit ? MUSIC_VOLUME * 0.55 : MUSIC_VOLUME;
  const humTarget = s.muted || !s.cockpit ? 0 : COCKPIT_VOLUME;
  fadeTo(music!, musicTarget);
  fadeTo(hum!, humTarget);
}

export const useAudioStore = create<AudioState>()((set, get) => ({
  muted: readMuted(),
  unlocked: false,
  cockpit: false,
  toggleMute: () => {
    const muted = !get().muted;
    try {
      localStorage.setItem(PREF_KEY, muted ? "1" : "0");
    } catch {
      /* storage unavailable: preference just won't persist */
    }
    set({ muted });
    apply(get());
  },
  setCockpit: (cockpit) => {
    set({ cockpit });
    apply(get());
  },
  unlock: () => {
    if (get().unlocked) return;
    set({ unlocked: true });
    apply(get());
  },
}));

/** Call once at startup: the first click/key press unlocks audio. */
export function installAudioUnlock(): () => void {
  const unlock = () => useAudioStore.getState().unlock();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}
