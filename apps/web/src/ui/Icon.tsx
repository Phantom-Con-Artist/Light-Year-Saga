const PATHS = {
  play: "M7 5l12 7-12 7z",
  pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  faster: "M4 6l8 6-8 6zM12 6l8 6-8 6z",
  slower: "M20 6l-8 6 8 6zM12 6l-8 6 8 6z",
  reverse: "M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4",
  now: "M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
  search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5L20 20",
  close: "M6 6l12 12M18 6L6 18",
  home: "M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM2 12h3M19 12h3",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  focus: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  const filled = name === "play" || name === "pause" || name === "faster" || name === "slower";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
