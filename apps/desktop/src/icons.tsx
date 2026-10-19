const paths = {
  play: <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="4" y="3" width="2.75" height="10" rx="0.75" fill="currentColor" stroke="none" />
      <rect x="9.25" y="3" width="2.75" height="10" rx="0.75" fill="currentColor" stroke="none" />
    </>
  ),
  prev: <path d="M12 3.5v9L5.5 8zM3.75 3.5v9" />,
  next: <path d="M4 3.5v9L10.5 8zM12.25 3.5v9" />,
  heart: <path d="M8 13.5S2 10 2 6.1A3 3 0 0 1 8 4.5a3 3 0 0 1 6 1.6C14 10 8 13.5 8 13.5z" />,
  volume: <path d="M2.5 6h2.5l3.5-3v10L5 10H2.5zM11 5.5a3.5 3.5 0 0 1 0 5M12.75 3.75a6 6 0 0 1 0 8.5" />,
  lyrics: <path d="M2.5 4h11M2.5 8h7M2.5 12h9" />,
  search: <path d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM10.75 10.75 14 14" />,
};

export function Icon({ name, filled = false }: { name: keyof typeof paths; filled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
