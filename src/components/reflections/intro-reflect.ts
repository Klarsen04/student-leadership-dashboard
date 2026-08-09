"use client";

// One-time cinematic "signature entrance" for the Reflections welcome screen.
// Two pieces, both presentation-only:
//   1. useIntroReflect(key) — a session-once gate (mirrors the documented
//      useFirstVisit): true only the first time this browser session, and
//      never under prefers-reduced-motion.
//   2. playIntroReflect(scope) — the GSAP timeline that assembles the welcome
//      screen (rainbow draws in, hero title words pop + stagger, pod cards fan
//      into place). Called from a useGSAP scope so it auto-reverts/cleans up.
import { useEffect, useLayoutEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { gsap } from "@/lib/gsap";

// useLayoutEffect on the client (flip before first paint → no flash), a no-op
// useEffect on the server (avoids the SSR warning). Initial render is `false`
// on both server and client, so there's no hydration mismatch.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Returns true only the first time this browser session that `key` is seen,
 * and always false under reduced motion. The key is marked seen immediately,
 * so remounts within the session (tab switch, flow → back, navigation) never
 * replay the entrance.
 */
export function useIntroReflect(key: string): boolean {
  const reduce = useReducedMotion();
  const [play, setPlay] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (reduce) return;
    try {
      const storageKey = `pp-intro-seen:${key}`;
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
      setPlay(true);
    } catch {
      // sessionStorage unavailable (private mode etc.) — render normally.
    }
    // Mount-only: the gate is decided once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Never animate under reduced motion, even if state was set on a prior pass.
  return play && !reduce;
}

/**
 * Build + play the entrance timeline within `scope`. Targets are addressed by
 * class so the welcome screen keeps its normal layout — only opacity/transform
 * animate, so repeat/reduced renders (which never call this) have no layout
 * shift. Returns the timeline for useGSAP cleanup.
 */
export function playIntroReflect(scope: HTMLElement): gsap.core.Timeline {
  const q = gsap.utils.selector(scope);

  const arcPaths = q(".ir-arc path");
  const words = q(".ir-title-word");
  const cards = q(".ir-card");

  // --- initial hidden states (position preserved; transform/opacity only) ---
  arcPaths.forEach((p) => {
    const path = p as unknown as SVGPathElement;
    const len = path.getTotalLength?.() ?? 700;
    gsap.set(p, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
  });
  gsap.set([q(".ir-eyebrow"), q(".ir-sub"), q(".ir-cta"), q(".ir-podhead")], {
    opacity: 0,
    y: 16,
  });
  gsap.set(words, { opacity: 0, y: 24, scale: 0.6 });
  gsap.set(cards, {
    opacity: 0,
    y: 30,
    scale: 0.9,
    // slight fan: outer cards tilt more, all settle to 0
    rotate: (i: number, _t: unknown, arr: ArrayLike<unknown>) =>
      (i - (arr.length - 1) / 2) * 4,
    transformOrigin: "50% 80%",
  });

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  // 1 — rainbow draws in overhead
  tl.to(arcPaths, {
    strokeDashoffset: 0,
    duration: 0.7,
    stagger: 0.07,
    ease: "power1.inOut",
  });

  // 2 — hero assembles: eyebrow, title words pop + stagger, subtitle, CTA
  tl.to(q(".ir-eyebrow"), { opacity: 1, y: 0, duration: 0.4 }, "-=0.45");
  tl.to(
    words,
    { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.09, ease: "back.out(1.7)" },
    "-=0.2"
  );
  tl.to(q(".ir-sub"), { opacity: 1, y: 0, duration: 0.4 }, "-=0.2");
  tl.to(q(".ir-cta"), { opacity: 1, y: 0, duration: 0.45, ease: "back.out(1.6)" }, "-=0.25");

  // 3 — pod picker heading, then cards fan/stagger into place
  tl.to(q(".ir-podhead"), { opacity: 1, y: 0, duration: 0.4 }, "-=0.1");
  tl.to(
    cards,
    {
      opacity: 1,
      y: 0,
      scale: 1,
      rotate: 0,
      duration: 0.6,
      stagger: 0.06,
      ease: "back.out(1.4)",
      clearProps: "transform,opacity",
    },
    "-=0.15"
  );

  return tl;
}
