"use client";

// PeacePod micro-interaction presets — shared so nav + tasks feel like one system.
// Everything here is presentation-only and reduced-motion aware via useMicro().
import { useReducedMotion, type Transition } from "motion/react";

/** Snappy spring for taps/hovers on buttons + pills. */
export const SPRING: Transition = { type: "spring", stiffness: 400, damping: 20 };
/** Softer spring for entrances + indicators. */
export const SOFT_SPRING: Transition = { type: "spring", stiffness: 260, damping: 22 };

/**
 * Reduced-motion-aware micro-interaction props.
 * Spread the returned objects onto `motion` elements. When the user prefers
 * reduced motion, every helper returns `{}` so nothing animates.
 */
export function useMicro() {
  const reduce = useReducedMotion();

  return {
    reduce,
    /** Gentle lift + bounce for cards / spines / CTAs. */
    bounce: reduce
      ? {}
      : { whileHover: { y: -3, scale: 1.03 }, whileTap: { scale: 0.96 }, transition: SPRING },
    /** Subtle press for icon buttons / small controls (no lift). */
    press: reduce ? {} : { whileTap: { scale: 0.9 }, transition: SPRING },
    /** Springy scale for pills / tabs. */
    pop: reduce ? {} : { whileHover: { scale: 1.06 }, whileTap: { scale: 0.94 }, transition: SPRING },
  };
}
