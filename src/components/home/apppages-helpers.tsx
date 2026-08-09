"use client";

// Helpers scoped to the authenticated app pages (dashboard/analytics/settings).
// Named with an `apppages` prefix to avoid collisions with other agents' files.
import { motion, useReducedMotion } from "motion/react";

/**
 * A progress/meter bar whose fill grows from 0 to `pct`% on mount.
 * Falls back to a static bar under prefers-reduced-motion.
 */
export function ApppagesBar({
  pct,
  className,
  heightClass = "h-2.5",
  trackClass = "bg-black/[0.06]",
  delay = 0,
}: {
  pct: number;
  className: string;
  heightClass?: string;
  trackClass?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const width = `${Math.max(0, Math.min(100, pct))}%`;

  if (reduce) {
    return (
      <div className={`${heightClass} ${trackClass} rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full ${className}`} style={{ width }} />
      </div>
    );
  }

  return (
    <div className={`${heightClass} ${trackClass} rounded-full overflow-hidden`}>
      <motion.div
        className={`h-full rounded-full ${className}`}
        initial={{ width: 0 }}
        animate={{ width }}
        transition={{ type: "spring", stiffness: 90, damping: 20, delay }}
      />
    </div>
  );
}
