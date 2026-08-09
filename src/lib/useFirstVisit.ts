"use client";

import { useEffect, useState } from "react";

/**
 * Returns true only the FIRST time a given key is seen this browser session,
 * so a page's cinematic "signature entrance" plays once per session and then
 * the page loads normally on repeat visits. Uses sessionStorage (clears when
 * the tab closes). Always returns false when prefers-reduced-motion is set.
 *
 * Returns `null` on the very first render (before the effect runs) so callers
 * can avoid a flash — treat null as "not yet decided".
 */
export function useFirstVisit(key: string): boolean {
  // start false so SSR + reduced-motion never animate; decide in effect
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const storageKey = `intro:${key}`;
    if (!sessionStorage.getItem(storageKey)) {
      sessionStorage.setItem(storageKey, "1");
      setPlay(true);
    }
  }, [key]);

  return play;
}
