import { useSyncExternalStore } from "react";

function mediaHook(query: string) {
  const subscribe = (cb: () => void) => {
    const m = window.matchMedia(query);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
  };
  const get = () => window.matchMedia(query).matches;
  return () => useSyncExternalStore(subscribe, get, () => false);
}

/** Phone-sized layout (below Tailwind's `md`). */
export const useIsMobile = mediaHook("(max-width: 767px)");

/** Primary input is a finger, so hints say "pinch" rather than "scroll". */
export const useIsTouch = mediaHook("(pointer: coarse)");

export const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;
