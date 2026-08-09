"use client";

import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Site-wide-ish smooth scroll for the marketing homepage. Scoped to the
 * public landing page (NOT the authenticated app, whose layout scrolls inside
 * an overflow container). Honors prefers-reduced-motion by rendering children
 * plainly with native scroll.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;

  return (
    <ReactLenis root options={{ lerp: 0.09, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}
