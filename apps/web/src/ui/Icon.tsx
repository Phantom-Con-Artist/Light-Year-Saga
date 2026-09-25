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
  book: "M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9M9 8h5",
  sound: "M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  soundOff: "M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6",
  rocket: "M12 3c3.5 2 5 5.5 5 9l-2.5 3h-5L7 12c0-3.5 1.5-7 5-9zM12 9.5a1.5 1.5 0 1 1 0 .01M9.5 15l-2 4 3-1.5M14.5 15l2 4-3-1.5",
  next: "M9 5l7 7-7 7",
  prev: "M15 5l-7 7 7 7",
  back: "M10 6l-6 6 6 6M4 12h16",
  menu: "M4 7h16M4 12h16M4 17h16",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  clock: "M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM12 8v4l3 2",
  settings:
    "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  constellation: "M4 18l5-7 5 3 6-9M4 18h.01M9 11h.01M14 14h.01M20 5h.01",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  ruler: "M4 16l12-12 4 4-12 12zM8 12l2 2M11 9l2 2M14 6l2 2",
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
