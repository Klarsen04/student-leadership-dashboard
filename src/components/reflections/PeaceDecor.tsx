"use client";

// Hand-drawn-style decorative SVGs for the PeacePod-inspired reflection page.
// Pure inline SVG (no external assets) so they theme + scale cleanly.

/** A soft rainbow arc, echoing PeacePod's hero divider. */
export function RainbowArc({ className = "" }: { className?: string }) {
  const bands = ["#FF6B4A", "#FFB400", "#FFD93D", "#7FB800", "#5BC0EB"];
  return (
    <svg
      viewBox="0 0 600 140"
      className={className}
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {bands.map((c, i) => {
        // Nested quadratic arcs: each inner band starts further in and crests lower.
        const x0 = 6 + i * 22;
        const x1 = 594 - i * 22;
        const crest = 12 + i * 28;
        return (
          <path
            key={c}
            d={`M ${x0} 140 Q 300 ${crest} ${x1} 140`}
            stroke={c}
            strokeWidth="12"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/** A single heart-topped flower, like the ones lining PeacePod's grassy path. */
export function HeartFlower({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  return (
    <svg viewBox="0 0 60 120" className={className} fill="none" aria-hidden="true">
      <path d="M30 120 L30 46" stroke="#3f7d1f" strokeWidth="5" strokeLinecap="round" />
      <path d="M30 78 C20 70 14 76 22 84" stroke="#3f7d1f" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M30 66 C40 58 46 64 38 72" stroke="#3f7d1f" strokeWidth="4" strokeLinecap="round" fill="none" />
      <g
        style={{
          transformOrigin: "30px 34px",
          animation: `peaceSway 4s ease-in-out ${delay}s infinite`,
        }}
      >
        <path
          d="M30 48 C30 40 20 28 12 34 C4 40 8 52 30 62 C52 52 56 40 48 34 C40 28 30 40 30 48 Z"
          fill="#FF6B4A"
        />
      </g>
    </svg>
  );
}

/** The little smiling seed/leaf mascot from PeacePod. */
export function SeedMascot({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
      <path
        d="M40 8 C64 8 72 30 72 46 C72 64 58 74 40 74 C22 74 8 64 8 46 C8 30 16 8 40 8 Z"
        fill="#7FB800"
      />
      <circle cx="30" cy="42" r="3.5" fill="#1f3d0a" />
      <circle cx="50" cy="42" r="3.5" fill="#1f3d0a" />
      <path d="M28 54 Q40 64 52 54" stroke="#1f3d0a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
