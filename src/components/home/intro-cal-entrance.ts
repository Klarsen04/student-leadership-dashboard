"use client";

// One-time "signature entrance" for the Calendar tab — a light "the week draws
// itself" choreography that echoes the home SceneCalendar / SceneDashboard style
// in the warm PeacePod palette. Presentation-only: it never touches calendar
// state, layout math, collision detection, or CRUD.
//
// Gated to play at most ONCE per browser session (sessionStorage) and NEVER
// under prefers-reduced-motion. On a repeat visit or reduced motion it is a
// complete no-op, so the page renders in its normal final state with no layout
// shift. Self-contained here to keep the giant calendar page surgical.
import { useEffect, useState, type RefObject } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const SESSION_KEY = "intro:calendar";

/**
 * Runs the calendar's cinematic entrance once, scoped to `root`. Targets are
 * opt-in marker classes added in the calendar page:
 *   .intro-cal-title  — the month title block (reveals down)
 *   .intro-cal-tabs   — the view-tab pill bar (slides in)
 *   .intro-cal-grid   — the time-grid card (settles + fades up)
 *   .intro-cal-col    — the day-header columns (draw in, staggered)
 * Missing targets (e.g. Month view has no day columns) are simply skipped by
 * GSAP, so the timeline is safe across every view.
 */
export function useIntroCalEntrance(root: RefObject<HTMLElement | null>) {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // reduced motion: never animate
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return; // already played this session
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      return; // storage unavailable — treat as repeat visit, render normally
    }
    setPlay(true);
  }, []);

  useGSAP(
    () => {
      if (!play || !root.current) return;
      const q = gsap.utils.selector(root);

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // 1) Month title reveals gently downward.
      tl.from(q(".intro-cal-title"), { opacity: 0, y: -10, duration: 0.5 });

      // 2) View-tab pills slide up into place.
      tl.from(q(".intro-cal-tabs"), { opacity: 0, y: 8, duration: 0.4 }, "<0.12");

      // 3) The time-grid card settles + fades up ("the canvas arrives").
      tl.from(
        q(".intro-cal-grid"),
        { opacity: 0, y: 16, scale: 0.985, transformOrigin: "top center", duration: 0.55 },
        "<0.08"
      );

      // 4) Day columns draw in one after another ("the week draws itself").
      tl.from(
        q(".intro-cal-col"),
        { opacity: 0, y: -8, duration: 0.4, stagger: 0.05 },
        "<0.15"
      );
      // Existing event/class blocks keep their own framer-motion pop-in, so we
      // intentionally do not re-animate them here (avoids double-driving them).
    },
    { scope: root, dependencies: [play] }
  );
}
