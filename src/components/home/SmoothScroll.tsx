"use client";

import { ReactLenis, type LenisRef } from "lenis/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

/**
 * Smooth scroll for the marketing homepage, wired to GSAP ScrollTrigger so the
 * pinned scroll scenes stay perfectly aligned. Lenis's RAF is driven by GSAP's
 * ticker and every Lenis scroll calls ScrollTrigger.update() — the canonical
 * Lenis + ScrollTrigger integration. Honors prefers-reduced-motion (native
 * scroll, no smoothing) so the scenes fall back to their static composed state.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    if (reduce) return;
    const update = (time: number) => lenisRef.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    const onScroll = () => ScrollTrigger.update();
    lenisRef.current?.lenis?.on("scroll", onScroll);
    return () => {
      gsap.ticker.remove(update);
      lenisRef.current?.lenis?.off("scroll", onScroll);
    };
  }, [reduce]);

  if (reduce) return <>{children}</>;

  return (
    <ReactLenis root ref={lenisRef} options={{ lerp: 0.09, smoothWheel: true, autoRaf: false }}>
      {children}
    </ReactLenis>
  );
}
