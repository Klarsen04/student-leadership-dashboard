"use client";

// One-time "signature entrance" for the Task Tape SHELF view.
//
// Plays once per browser session on first load of the shelf, then never again.
// The rendered DOM is ALWAYS the finished shelf (final positions) — the
// entrance is applied purely as GSAP `from` tweens inside useGSAP (a layout
// effect), so:
//   - there is no hydration mismatch (JSX never branches on "did it play"),
//   - there is no layout shift / flash (initial states are set before paint),
//   - reduced-motion and repeat visits render the static shelf with NO entrance.
//
// Presentation only: this touches nothing but transform/opacity of decorative
// shelf elements. Task CRUD, drag, focus timer, day nav, the tape-open 3D
// animation and the board are all untouched.
import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { gsap, useGSAP } from "@/lib/gsap";

// Session-scoped so it plays once per tab session, then normal.
const SESSION_KEY = "pp-intro-seen-tasks";

function hasSeen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return true; // storage blocked → behave as "already seen" (no entrance)
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Choreographs the shelf assembling itself: a soft logo + headline reveal,
 * then the day-tape spines slide up and stack onto the shelf one-by-one with a
 * springy overshoot. Gate this by mounting only the shelf view; pass
 * `enabled` = shelf visible & data loaded.
 *
 * Selectors expected inside `rootRef`:
 *   .intro-logo      — the Task Tape logo/wordmark cluster
 *   .intro-headline  — the "PLAY. PLAN. DONE." headline + subtitle
 *   .intro-spine     — each day-tape spine button (both desktop + mobile)
 */
export function useShelfIntro(
  rootRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const reduce = useReducedMotion();
  const playedRef = useRef(false);

  useGSAP(
    () => {
      if (!enabled || reduce) return;
      if (playedRef.current || hasSeen()) return;
      const root = rootRef.current;
      if (!root) return;

      // Only animate the shelf that is actually on screen (desktop OR mobile
      // markup — the other is display:none and reported by offsetParent null).
      const spines = gsap.utils
        .toArray<HTMLElement>(root.querySelectorAll(".intro-spine"))
        .filter((el) => el.offsetParent !== null);
      if (spines.length === 0) return; // nothing to reveal → skip, stay unseen

      playedRef.current = true;
      markSeen();

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          // Hand control cleanly back to the DOM / framer hover states.
          gsap.set([root.querySelectorAll(".intro-spine")], { clearProps: "transform,opacity" });
        },
      });

      // 1) Soft logo + headline reveal.
      tl.from(root.querySelectorAll(".intro-logo"), {
        y: -10,
        opacity: 0,
        duration: 0.45,
      });
      tl.from(
        root.querySelectorAll(".intro-headline"),
        { y: 18, opacity: 0, duration: 0.5 },
        "-=0.25",
      );

      // 2) Spines slide up from below the shelf line and stack in, springy.
      tl.from(
        spines,
        {
          yPercent: 120,
          opacity: 0,
          rotate: (i: number) => (i % 2 === 0 ? -4 : 4),
          scale: 0.96,
          transformOrigin: "bottom center",
          duration: 0.6,
          ease: "back.out(1.5)",
          stagger: 0.09,
        },
        "-=0.15",
      );

      return () => {
        tl.kill();
      };
    },
    { scope: rootRef, dependencies: [enabled, reduce] },
  );
}
