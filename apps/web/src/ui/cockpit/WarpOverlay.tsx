import { useEffect, useRef } from "react";
import { flight } from "../../state/flightStore";

const STREAKS = 150;

/**
 * Hyperspace streaks drawn on a 2D canvas over the scene while the camera
 * travels. Costs nothing when idle (the canvas is cleared once and skipped).
 */
export function WarpOverlay({ strength }: { strength: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strengthRef = useRef(strength);
  strengthRef.current = strength;

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const streaks = Array.from({ length: STREAKS }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), v: 0.4 + Math.random() }));
    let raf = 0;
    let last = performance.now();
    let idle = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = flight.speed * strengthRef.current;
      if (s < 0.03) {
        if (!idle) ctx.clearRect(0, 0, c.width, c.height);
        idle = true;
      } else {
        idle = false;
        const w = c.width;
        const h = c.height;
        const cx = w / 2;
        const cy = h / 2;
        const maxR = Math.hypot(cx, cy);
        ctx.clearRect(0, 0, w, h);
        ctx.lineCap = "round";
        for (const st of streaks) {
          st.r += dt * st.v * (0.6 + s * 2.4);
          if (st.r > 1) {
            st.r = 0.02 + Math.random() * 0.1;
            st.a = Math.random() * Math.PI * 2;
          }
          const r0 = st.r * st.r * maxR;
          const len = (0.04 + s * 0.22) * maxR * st.r;
          const cos = Math.cos(st.a);
          const sin = Math.sin(st.a);
          ctx.strokeStyle = `rgba(200, 225, 255, ${Math.min(0.55, s * 0.6) * st.r})`;
          ctx.lineWidth = 1 + st.r * 1.5;
          ctx.beginPath();
          ctx.moveTo(cx + cos * r0, cy + sin * r0);
          ctx.lineTo(cx + cos * (r0 + len), cy + sin * (r0 + len));
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-[4] h-full w-full" aria-hidden="true" />;
}
