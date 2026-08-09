"use client";

// Extra hand-drawn PeacePod-style decor for the marketing homepage.
// Pure inline SVG so they scale + theme cleanly. All decorative (aria-hidden).

/** A cheerful marigold sun with rays — floats gently in the hero. */
export function SunDoodle({ className = "" }: { className?: string }) {
  const rays = Array.from({ length: 8 });
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" aria-hidden="true">
      <g>
        {rays.map((_, i) => {
          const angle = (i * 360) / rays.length;
          return (
            <line
              key={i}
              x1="60"
              y1="14"
              x2="60"
              y2="2"
              stroke="#FFB400"
              strokeWidth="6"
              strokeLinecap="round"
              transform={`rotate(${angle} 60 60)`}
            />
          );
        })}
      </g>
      <circle cx="60" cy="60" r="30" fill="#FFD93D" />
      <circle cx="60" cy="60" r="30" stroke="#FFB400" strokeWidth="4" />
      <circle cx="50" cy="55" r="3.5" fill="#7a5b00" />
      <circle cx="70" cy="55" r="3.5" fill="#7a5b00" />
      <path d="M50 68 Q60 78 70 68" stroke="#7a5b00" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** A small puffy cloud doodle. */
export function CloudDoodle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 70" className={className} fill="none" aria-hidden="true">
      <path
        d="M35 55 C18 55 12 40 26 34 C24 18 46 14 52 26 C58 12 84 14 84 30 C102 26 112 44 96 54 C92 56 42 56 35 55 Z"
        fill="#ffffff"
        stroke="#e7d9c6"
        strokeWidth="3"
      />
    </svg>
  );
}

/** A tiny five-petal flower for scattered accents. */
export function StarBloom({ className = "", color = "#FF6B4A" }: { className?: string; color?: string }) {
  const petals = Array.from({ length: 5 });
  return (
    <svg viewBox="0 0 60 60" className={className} fill="none" aria-hidden="true">
      <g>
        {petals.map((_, i) => (
          <ellipse
            key={i}
            cx="30"
            cy="14"
            rx="8"
            ry="13"
            fill={color}
            transform={`rotate(${(i * 360) / petals.length} 30 30)`}
          />
        ))}
      </g>
      <circle cx="30" cy="30" r="8" fill="#FFD93D" />
    </svg>
  );
}
