import { useEffect, useState, type ReactNode } from "react";
import { getDevice, useGraphicsStore, type GraphicsValues, type Power, type Preset, type ToneMap } from "../state/graphicsStore";
import { usePerfStore } from "../state/perfStore";
import { useUiStore } from "../state/uiStore";
import { useIsMobile } from "./useMedia";
import { Icon } from "./Icon";
import { formatNumber } from "./format";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line px-4 py-3">
      <h3 className="label-caps mb-1">{title}</h3>
      <div className="divide-y divide-white/[0.04]">{children}</div>
    </section>
  );
}

function Row({ label, hint, children, stacked = false }: { label: string; hint?: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={`py-2.5 ${stacked ? "space-y-2" : "flex items-center justify-between gap-4"}`}>
      <div className="min-w-0">
        <div className="text-[14px] text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] leading-snug text-ink-faint">{hint}</div>}
      </div>
      <div className={stacked ? "" : "shrink-0"}>{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="toggle" data-on={on} onClick={() => onChange(!on)} />;
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={v === value} data-on={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="scale-slider flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-14 text-right text-[13px] text-ink-dim tabular-nums">{format(value)}</span>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const times = (v: number) => `${formatNumber(v, 2)}×`;

/** Live renderer readout, handy while tuning. */
function LiveStats() {
  const fps = usePerfStore((s) => s.fps);
  const ms = usePerfStore((s) => s.frameMs);
  const ratio = usePerfStore((s) => s.pixelRatio);
  const calls = usePerfStore((s) => s.drawCalls);
  const showFps = useGraphicsStore((s) => s.showFps);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  if (!showFps) return <p className="text-[12px] text-ink-faint">Turn on the performance overlay to see live numbers here.</p>;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
      <dt className="text-ink-faint">Frame rate</dt>
      <dd className="text-right text-ink tabular-nums">
        {formatNumber(fps, 0)} fps · {formatNumber(ms, 1)} ms
      </dd>
      <dt className="text-ink-faint">Render size</dt>
      <dd className="text-right text-ink tabular-nums">
        {Math.round(size.w * ratio)} × {Math.round(size.h * ratio)}
      </dd>
      <dt className="text-ink-faint">Pixel ratio</dt>
      <dd className="text-right text-ink tabular-nums">{formatNumber(ratio, 2)}</dd>
      <dt className="text-ink-faint">Draw calls</dt>
      <dd className="text-right text-ink tabular-nums">{calls}</dd>
    </dl>
  );
}

const PRESET_OPTIONS: [Exclude<Preset, "custom">, string][] = [
  ["auto", "Auto"],
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
  ["ultra", "Ultra"],
];

function Body() {
  const g = useGraphicsStore();
  const set = g.set;
  const device = getDevice();
  const bind =
    <K extends keyof GraphicsValues>(key: K) =>
    (v: GraphicsValues[K]) =>
      set(key, v);

  return (
    <>
      <section className="px-4 pb-3">
        <Segmented label="Quality preset" value={g.preset === "custom" ? null : g.preset} options={PRESET_OPTIONS} onChange={(p) => g.applyPreset(p)} />
        <p className="mt-2 text-[12px] leading-snug text-ink-faint">
          {g.preset === "custom" ? "Custom settings. " : g.preset === "auto" ? `Auto picked ${device.tier} for this device. ` : ""}
          Detected: <span className="text-ink-dim">{device.gpu}</span> · {device.cores} threads
          {device.memoryGb ? ` · ${device.memoryGb}+ GB` : ""} · {device.screen}. {device.reason}.
        </p>
        {device.software && (
          <p className="mt-2 rounded-md border border-[#f2c26b]/30 px-2.5 py-2 text-[12px] leading-snug text-warn">
            The browser is drawing without the GPU. Turn on “Use hardware acceleration” in its settings for a far smoother experience.
          </p>
        )}
      </section>

      <Section title="Display">
        <Row label="Resolution" hint="Share of the screen's pixels rendered. Lower is faster and softer." stacked>
          <Slider label="Resolution" value={g.resolutionScale} min={0.5} max={1} step={0.05} onChange={bind("resolutionScale")} format={pct} />
        </Row>
        <Row label="Pixel density limit" hint="Caps rendering on high-density (Retina, phone) screens." stacked>
          <Segmented
            label="Pixel density limit"
            value={g.maxPixelRatio}
            options={[
              [1, "1×"],
              [1.25, "1.25×"],
              [1.5, "1.5×"],
              [1.75, "1.75×"],
              [2.5, "Max"],
            ]}
            onChange={bind("maxPixelRatio")}
          />
        </Row>
        <Row label="Adaptive resolution" hint="Drops resolution briefly when the frame rate dips.">
          <Toggle label="Adaptive resolution" on={g.adaptiveResolution} onChange={bind("adaptiveResolution")} />
        </Row>
        {g.adaptiveResolution && (
          <Row label="Target frame rate" stacked>
            <Segmented
              label="Target frame rate"
              value={g.targetFps}
              options={[
                [30, "30"],
                [45, "45"],
                [50, "50"],
                [55, "55"],
                [60, "60"],
              ]}
              onChange={bind("targetFps")}
            />
          </Row>
        )}
        <Row label="VSync" hint="Off renders as fast as possible. The browser still shows frames at the display's refresh rate; this mainly trims input lag.">
          <Toggle label="VSync" on={g.vsync} onChange={bind("vsync")} />
        </Row>
        <Row label="Frame-rate cap" hint="A lower cap saves battery and keeps laptops cool." stacked>
          <Segmented
            label="Frame-rate cap"
            value={g.fpsCap}
            options={[
              [0, "Off"],
              [30, "30"],
              [45, "45"],
              [60, "60"],
              [120, "120"],
            ]}
            onChange={bind("fpsCap")}
          />
        </Row>
        <Row label="Anti-aliasing (MSAA)" hint="Smoother edges on planets and lines. Costly on integrated graphics.">
          <Toggle label="Anti-aliasing" on={g.antialias} onChange={bind("antialias")} />
        </Row>
        <Row label="GPU preference" hint="On laptops with two GPUs, asks for the faster or the more frugal one." stacked>
          <Segmented<Power>
            label="GPU preference"
            value={g.powerPreference}
            options={[
              ["high-performance", "Performance"],
              ["default", "Default"],
              ["low-power", "Battery"],
            ]}
            onChange={bind("powerPreference")}
          />
        </Row>
      </Section>

      <Section title="Image">
        <Row label="Tone mapping" hint="How bright light is compressed to the screen." stacked>
          <Segmented<ToneMap>
            label="Tone mapping"
            value={g.toneMapping}
            options={[
              ["aces", "Filmic"],
              ["agx", "AgX"],
              ["neutral", "Neutral"],
              ["none", "None"],
            ]}
            onChange={bind("toneMapping")}
          />
        </Row>
        <Row label="Exposure" stacked>
          <Slider label="Exposure" value={g.exposure} min={0.5} max={2} step={0.05} onChange={bind("exposure")} format={times} />
        </Row>
        <Row label="Texture filtering" hint="Anisotropic filtering keeps textures sharp at grazing angles." stacked>
          <Segmented
            label="Texture filtering"
            value={g.anisotropy}
            options={[
              [1, "Off"],
              [2, "2×"],
              [4, "4×"],
              [8, "8×"],
              [16, "16×"],
            ]}
            onChange={bind("anisotropy")}
          />
        </Row>
        <Row label="High-resolution sky" hint="Loads the 8K star map on large, sharp screens (about 20 MB).">
          <Toggle label="High-resolution sky" on={g.hiResTextures} onChange={bind("hiResTextures")} />
        </Row>
      </Section>

      <Section title="Stars">
        <Row label="Star size" stacked>
          <Slider label="Star size" value={g.starSize} min={0.5} max={2} step={0.05} onChange={bind("starSize")} format={times} />
        </Row>
        <Row label="Star brightness" stacked>
          <Slider label="Star brightness" value={g.starBrightness} min={0.4} max={2.5} step={0.05} onChange={bind("starBrightness")} format={times} />
        </Row>
        <Row label="Twinkle" hint="Real stars only twinkle through an atmosphere; this is for the look.">
          <Toggle label="Twinkle" on={g.twinkle} onChange={bind("twinkle")} />
        </Row>
        {g.twinkle && (
          <Row label="Twinkle strength" stacked>
            <Slider label="Twinkle strength" value={g.twinkleStrength} min={0.1} max={1} step={0.05} onChange={bind("twinkleStrength")} format={pct} />
          </Row>
        )}
        <Row label="Diffraction spikes" hint="The four-point sparkle telescopes put on bright stars.">
          <Toggle label="Diffraction spikes" on={g.spikes} onChange={bind("spikes")} />
        </Row>
        <Row label="Star glow" hint="A soft halo in each bright star's own colour, like bloom in a camera. Drawn per star, so it stays cheap.">
          <Toggle label="Star glow" on={g.starGlow} onChange={bind("starGlow")} />
        </Row>
        {g.starGlow && (
          <Row label="Glow strength" stacked>
            <Slider label="Glow strength" value={g.glowStrength} min={0.2} max={2.5} step={0.05} onChange={bind("glowStrength")} format={times} />
          </Row>
        )}
      </Section>

      <Section title="Galaxy">
        <Row label="Milky Way particles" hint="Stars in the 3D model of our galaxy (Stars & Galaxy view, zoomed out)." stacked>
          <Segmented
            label="Milky Way particles"
            value={g.galaxyParticles}
            options={[
              [30_000, "30k"],
              [80_000, "80k"],
              [160_000, "160k"],
              [300_000, "300k"],
            ]}
            onChange={bind("galaxyParticles")}
          />
        </Row>
        <Row label="Dust lanes" hint="Dark clouds that block starlight along the spiral arms.">
          <Toggle label="Dust lanes" on={g.dust} onChange={bind("dust")} />
        </Row>
        <Row label="Glowing gas" hint="Pink star-forming regions and blue reflection nebulae.">
          <Toggle label="Glowing gas" on={g.nebulae} onChange={bind("nebulae")} />
        </Row>
      </Section>

      <Section title="Performance">
        <Row label="Performance overlay" hint="Frame rate and render size in the corner.">
          <Toggle label="Performance overlay" on={g.showFps} onChange={bind("showFps")} />
        </Row>
        <div className="py-2.5">
          <LiveStats />
        </div>
      </Section>

      <div className="border-t border-line px-4 py-3">
        <button type="button" className="btn w-full !justify-center border border-line" onClick={g.reset}>
          Reset to automatic
        </button>
      </div>
    </>
  );
}

/** Graphics settings: a side panel on desktop, a full-screen sheet on phones. */
export function Settings() {
  const open = useUiStore((s) => s.settingsOpen);
  const mobile = useIsMobile();
  const close = () => useUiStore.getState().setSettings(false);
  if (!open) return null;

  const header = (
    <header className="flex items-center justify-between px-4 pt-3.5 pb-3">
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">Graphics</h2>
        <p className="text-[12px] text-ink-faint">Changes apply instantly and are saved on this device.</p>
      </div>
      <button type="button" className="btn -mr-1.5" onClick={close} aria-label="Close settings">
        <Icon name="close" size={14} />
      </button>
    </header>
  );

  if (mobile) {
    return (
      <div
        role="dialog"
        aria-label="Graphics settings"
        className="panel safe-top safe-bottom animate-panel-in fixed inset-0 z-50 flex flex-col !rounded-none !bg-[#0b0d12]"
      >
        {header}
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          <Body />
        </div>
      </div>
    );
  }
  return (
    <aside
      role="dialog"
      aria-label="Graphics settings"
      className="panel thin-scroll animate-panel-in fixed top-20 right-4 z-40 max-h-[calc(100vh-6rem)] w-[380px] overflow-y-auto"
    >
      {header}
      <Body />
    </aside>
  );
}

/** Small corner readout, when enabled in Settings. */
export function PerfOverlay() {
  const show = useGraphicsStore((s) => s.showFps);
  const fps = usePerfStore((s) => s.fps);
  const ms = usePerfStore((s) => s.frameMs);
  const ratio = usePerfStore((s) => s.pixelRatio);
  if (!show) return null;
  const tone = fps >= 50 ? "text-live" : fps >= 28 ? "text-warn" : "text-[#ff8a7a]";
  return (
    <div className="pointer-events-none fixed top-[3.3rem] left-2 z-30 rounded-md bg-black/60 px-2 py-1 font-mono text-[11px] text-ink-dim tabular-nums md:top-[4.4rem] md:left-1/2 md:-translate-x-1/2">
      <span className={tone}>{formatNumber(fps, 0)} fps</span> · {formatNumber(ms, 1)} ms · {formatNumber(ratio, 2)}×
    </div>
  );
}
