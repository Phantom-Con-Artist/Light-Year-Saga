const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

const nf = (digits: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function formatNumber(n: number, digits = 0): string {
  return nf(digits).format(n);
}

/** 5.972e24 → "5.972 × 10²⁴" */
export function formatScientific(n: number, digits = 3): string {
  const [mantissa, exp] = n.toExponential(digits).split("e");
  const e = String(Number(exp))
    .split("")
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join("");
  return `${mantissa} × 10${e}`;
}

export function formatDuration(hours: number): string {
  const abs = Math.abs(hours);
  if (abs < 48) return `${formatNumber(abs, 2)} h`;
  const days = abs / 24;
  if (days < 1000) return `${formatNumber(days, 2)} d`;
  return `${formatNumber(days / 365.25, 2)} yr`;
}

export function formatDays(days: number): string {
  if (days < 1000) return `${formatNumber(days, 1)} days`;
  return `${formatNumber(days / 365.25, 2)} years`;
}

export function formatLightTime(seconds: number): string {
  if (seconds < 60) return `${formatNumber(seconds, 2)} s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatUtc(ms: number): { date: string; time: string } {
  const iso = new Date(ms).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
}
