/** Minimal TerraDairy mark — abstract leaf + milk droplet for small sizes. */
export function TerraDairyLogoMark({
  className = "h-9 w-9",
}: {
  className?: string;
}) {
  return (
    <div
      className={`relative shrink-0 rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-emerald-600 shadow-[0_2px_8px_rgba(13,148,136,0.28)] ring-1 ring-inset ring-white/25 dark:shadow-[0_2px_12px_rgba(0,0,0,0.45)] dark:ring-white/15 ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="absolute inset-0 m-auto h-[20px] w-[20px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Milk droplet — primary mark, sized for legibility at 36px */}
        <path
          d="M12 3.6c-2.45 3.85-4.35 6.35-4.35 9.55a4.35 4.35 0 0 0 8.7 0c0-3.2-1.9-5.7-4.35-9.55-.42-.62-1.28-.62-1.7 0Z"
          fill="white"
          fillOpacity="0.95"
        />
        {/* Leaf accent — slightly smaller so the droplet reads first */}
        <path
          d="M16.1 9c1.15.48 1.85 1.35 1.7 2.65-.12.9-.72 1.55-1.45 1.85.25-1.1.18-2.45-.25-4.5Z"
          fill="white"
          fillOpacity="0.78"
        />
        <path
          d="M16.1 9c.42 2.05.5 3.4.25 4.5"
          stroke="white"
          strokeOpacity="0.5"
          strokeWidth="0.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function TerraDairyBrandText() {
  return (
    <div className="min-w-0 leading-none">
      <div className="font-bold text-[15px] tracking-tight text-foreground">
        TerraDairy
      </div>
      <div className="text-[11px] muted mt-1 tracking-wide">Smart farm OS</div>
    </div>
  );
}
