"use client";

// Shared toolkit for the cinematic homepage scenes.
// Every scene is a full-viewport, pinned, scroll-scrubbed GSAP timeline. This
// kit standardises the big-typography caption system, the scene chrome, and the
// helpers that make scenes hand off to each other instead of ending in blank
// space. Keep the actual choreography in each scene file.

import { forwardRef, type ReactNode } from "react";

export const MARKER = {
  fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif",
} as const;

// PeacePod palette, shared so scene objects stay on-brand.
export const PALETTE = {
  marigold: "#FFB400",
  grass: "#7FB800",
  sky: "#5BC0EB",
  coral: "#FF6B4A",
  pink: "#FF4D8D",
  violet: "#B084F5",
  blue: "#3D9BE9",
  cream: "#FFFAF5",
  gold: "#FFD93D",
} as const;

export type PaletteKey = keyof typeof PALETTE;

/*
  CSP-safe colour classes. The homepage is statically prerendered under a strict
  `style-src 'self' 'nonce'` CSP, which strips React's SSR inline `style` colours
  (they compute to black). Utility classes compile into the stylesheet served
  from 'self', so they render correctly. These maps hold LITERAL class strings so
  the Tailwind scanner can see and emit them (dynamic `bg-[${x}]` would be purged).
*/
export const BG: Record<PaletteKey, string> = {
  marigold: "bg-[#FFB400]",
  grass: "bg-[#7FB800]",
  sky: "bg-[#5BC0EB]",
  coral: "bg-[#FF6B4A]",
  pink: "bg-[#FF4D8D]",
  violet: "bg-[#B084F5]",
  blue: "bg-[#3D9BE9]",
  cream: "bg-[#FFFAF5]",
  gold: "bg-[#FFD93D]",
};
export const TEXT: Record<PaletteKey, string> = {
  marigold: "text-[#FFB400]",
  grass: "text-[#7FB800]",
  sky: "text-[#5BC0EB]",
  coral: "text-[#FF6B4A]",
  pink: "text-[#FF4D8D]",
  violet: "text-[#B084F5]",
  blue: "text-[#3D9BE9]",
  cream: "text-[#FFFAF5]",
  gold: "text-[#FFD93D]",
};
export const BG_SOFT: Record<PaletteKey, string> = {
  marigold: "bg-[#FFB400]/15",
  grass: "bg-[#7FB800]/15",
  sky: "bg-[#5BC0EB]/15",
  coral: "bg-[#FF6B4A]/15",
  pink: "bg-[#FF4D8D]/15",
  violet: "bg-[#B084F5]/15",
  blue: "bg-[#3D9BE9]/15",
  cream: "bg-[#FFFAF5]/15",
  gold: "bg-[#FFD93D]/15",
};

/**
 * Full-viewport pinned scene shell. Gives every scene the same overflow
 * clipping, centering and a stable stacking context. `label` is the a11y
 * section name. The ref is the pin trigger.
 */
export const SceneShell = forwardRef<
  HTMLElement,
  { children: ReactNode; className?: string; label: string; id?: string }
>(function SceneShell({ children, className = "", label, id }, ref) {
  return (
    <section
      ref={ref}
      id={id}
      aria-label={label}
      className={`font-marker relative h-screen w-full overflow-hidden flex items-center justify-center ${className}`}
    >
      {children}
    </section>
  );
});

/**
 * Big cinematic caption stack. Captions are absolutely stacked and revealed one
 * at a time by the scene timeline (targets `.sc-caption[data-i]`). Kicker is the
 * small always-on section eyebrow. Sits high in the scene, above the visual.
 */
export function SceneCaptions({
  kicker,
  captions,
  kickerClass = "text-black/35",
}: {
  kicker: string;
  captions: string[];
  /** Tailwind text-colour class for the eyebrow (CSP-safe, no inline style). */
  kickerClass?: string;
}) {
  return (
    <div className="pointer-events-none absolute top-[9%] left-0 right-0 text-center px-6 z-20">
      <p className={`text-xs md:text-sm font-bold uppercase tracking-[0.28em] ${kickerClass}`}>
        {kicker}
      </p>
      <div className="relative h-16 md:h-20 mt-3">
        {captions.map((c, i) => (
          <p
            key={i}
            data-i={i}
            className="sc-caption absolute inset-x-0 text-3xl md:text-6xl font-black tracking-tight text-black leading-[1.05]"
            style={MARKER}
          >
            {c}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * Progress rail — a slim vertical dot column on the right that fills as the
 * scene plays. Decorative; gives the user a sense of "how far through this
 * scene am I". Targets `.sc-progress-fill`.
 */
export function SceneProgress({ steps }: { steps: number }) {
  return (
    <div
      className="pointer-events-none absolute right-5 md:right-8 top-1/2 -translate-y-1/2 z-20 hidden sm:flex flex-col gap-2"
      aria-hidden="true"
    >
      {Array.from({ length: steps }).map((_, i) => (
        <span
          key={i}
          className="relative w-1.5 h-8 rounded-full bg-black/[0.08] overflow-hidden"
        >
          <span
            data-i={i}
            className="sc-progress-fill absolute inset-x-0 bottom-0 top-0 rounded-full bg-black/40 origin-bottom scale-y-0"
          />
        </span>
      ))}
    </div>
  );
}
