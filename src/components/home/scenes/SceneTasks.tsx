"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { gsap, useGSAP } from "@/lib/gsap";
import { SceneShell, SceneCaptions, SceneProgress, MARKER, BG, type PaletteKey } from "./sceneKit";

// the app's real 7-day cassette shelf, one spine per day
const DAYS: { day: string; n: string; c: PaletteKey }[] = [
  { day: "SUN", n: "007", c: "violet" },
  { day: "MON", n: "001", c: "marigold" },
  { day: "TUE", n: "002", c: "coral" },
  { day: "WED", n: "003", c: "sky" },
  { day: "THU", n: "004", c: "grass" },
  { day: "FRI", n: "005", c: "pink" },
  { day: "SAT", n: "006", c: "blue" },
];

const CAPTIONS = [
  "Seven days. Seven tapes.",
  "Pick a day.",
  "Pop it open.",
  "Your whole board, dealt.",
];

const COLS = [
  { title: "To do", cards: ["Book the venue", "Draft the agenda", "DM co-leads"] },
  { title: "Doing", cards: ["Design the flyer", "Line up vendors"] },
  { title: "Done", cards: ["Reserve the AV", "Confirm the RAs"] },
];

/**
 * SCENE 1 — Tasks (cinematic). A wall of seven day-spines sweeps up and fills
 * the viewport. The chosen tape (Wed) scales up until it DOMINATES the screen,
 * its reels spin, then it unspools — the cassette blows apart and a full-width
 * Kanban board assembles in its place, cards dealing in. Finally the three
 * columns slide apart to hand off to the Calendar scene.
 */
export function SceneTasks() {
  const root = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      if (reduce) return;
      const q = gsap.utils.selector(root);

      gsap.set(q(".tk-spine"), { yPercent: 140, opacity: 0, rotate: 3 });
      gsap.set(q(".tk-hero"), { opacity: 0, scale: 0.2, rotate: -14 });
      gsap.set(q(".tk-reel"), { rotate: 0 });
      gsap.set(q(".tk-board"), { opacity: 0 });
      gsap.set(q(".tk-col"), { opacity: 0, y: 80, scale: 0.9 });
      gsap.set(q(".tk-card"), { opacity: 0, x: -60, scale: 0.85 });
      gsap.set(q(".sc-caption"), { opacity: 0, y: 30 });
      gsap.set(q(".sc-progress-fill"), { scaleY: 0 });

      const steps = 4;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=3600",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });
      const prog = (i: number) =>
        tl.to(q(`.sc-progress-fill[data-i="${i}"]`), { scaleY: 1, duration: 0.3 }, "<");
      const cap = (i: number) => {
        tl.to(q(`.sc-caption[data-i="${i}"]`), { opacity: 1, y: 0, duration: 0.4 });
        tl.to({}, { duration: 0.35 });
        if (i < steps - 1)
          tl.to(q(`.sc-caption[data-i="${i}"]`), { opacity: 0, y: -24, duration: 0.3 });
      };

      // 0 — the seven spines sweep up as a full-width wall
      tl.to(q(".tk-spine"), {
        yPercent: 0,
        opacity: 1,
        rotate: 0,
        duration: 0.9,
        ease: "back.out(1.4)",
        stagger: 0.07,
      });
      cap(0);
      prog(0);

      // 1 — the chosen tape (Wed) lifts + the others fall away
      tl.to(q('.tk-spine[data-i="3"]'), { yPercent: -12, scale: 1.12, duration: 0.5, ease: "power2.out" });
      tl.to(q('.tk-spine:not([data-i="3"])'), { yPercent: 60, opacity: 0, duration: 0.5, stagger: 0.03 }, "<");
      cap(1);
      prog(1);

      // 2 — the chosen tape becomes the GIANT hero cassette, reels spinning
      tl.to(q('.tk-spine[data-i="3"]'), { opacity: 0, scale: 0.5, duration: 0.35, ease: "power2.in" });
      tl.to(q(".tk-hero"), { opacity: 1, scale: 1, rotate: 0, duration: 0.8, ease: "back.out(1.4)" }, ">-0.15");
      tl.to(q(".tk-reel"), { rotate: 360, duration: 1.1, ease: "none" }, "<0.2");
      cap(2);
      prog(2);

      // 3 — the cassette unspools: it blows apart and the Kanban assembles
      tl.to(q(".tk-hero"), { opacity: 0, scale: 1.6, filter: "blur(6px)", duration: 0.5, ease: "power2.in" });
      tl.to(q(".tk-board"), { opacity: 1, duration: 0.3 }, ">-0.25");
      tl.to(q(".tk-col"), { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.5)", stagger: 0.12 }, "<");
      tl.to(q(".tk-card"), { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: "back.out(1.6)", stagger: 0.07 }, ">-0.3");
      cap(3);
      prog(3);

      // transition out — columns slide apart, board recedes (hands off to Calendar)
      tl.to({}, { duration: 0.3 });
      tl.to(q('.tk-col[data-i="0"]'), { xPercent: -60, opacity: 0, duration: 0.5, ease: "power2.in" });
      tl.to(q('.tk-col[data-i="2"]'), { xPercent: 60, opacity: 0, duration: 0.5, ease: "power2.in" }, "<");
      tl.to(q('.tk-col[data-i="1"]'), { yPercent: 40, opacity: 0, scale: 0.85, duration: 0.5, ease: "power2.in" }, "<0.05");
    },
    { scope: root, dependencies: [reduce] }
  );

  return (
    <SceneShell ref={root} label="Plan your week with tasks" className="scene-tasks">
      <SceneCaptions kicker="Plan your week" captions={CAPTIONS} />
      <SceneProgress steps={4} />

      {/* full-width wall of day-spines */}
      <div className="tk-shelf absolute inset-0 flex items-end justify-center gap-2 md:gap-4 px-4 pb-[8vh]">
        {DAYS.map((d, i) => (
          <div
            key={d.day}
            data-i={i}
            className={`tk-spine relative w-[12.5vw] max-w-[120px] h-[56vh] max-h-[520px] rounded-2xl shadow-2xl flex flex-col items-center justify-between py-5 text-white ${BG[d.c]}`}
          >
            <span className="text-xs font-black tracking-widest opacity-80">{d.n}</span>
            <span className="text-lg md:text-2xl font-black [writing-mode:vertical-rl] rotate-180" style={MARKER}>
              {d.day}
            </span>
            <span className="w-7 h-7 rounded-full bg-white/30" />
          </div>
        ))}
      </div>

      {/* the GIANT hero cassette (Wed) */}
      <div
        className="tk-hero absolute w-[86vw] max-w-[900px] aspect-[16/10] rounded-[2rem] shadow-2xl flex items-center justify-center bg-[#5BC0EB]"
        aria-hidden="true"
      >
        <span className="absolute top-6 left-8 text-white text-lg md:text-2xl font-black tracking-widest" style={MARKER}>
          WED · 003
        </span>
        <span className="absolute top-6 right-8 text-white/80 text-sm font-bold">TASKS</span>
        <div className="w-[72%] h-[52%] rounded-2xl bg-white/95 flex items-center justify-around px-10 shadow-inner">
          {/* two spinning reels */}
          {[0, 1].map((r) => (
            <span
              key={r}
              className="tk-reel relative w-24 h-24 md:w-32 md:h-32 rounded-full border-[10px] border-[#5BC0EB] flex items-center justify-center"
            >
              <span className="absolute w-3 h-3 rounded-full bg-[#5BC0EB] z-10" />
              {["rotate-0", "rotate-[60deg]", "rotate-[120deg]"].map((rot) => (
                <span
                  key={rot}
                  className={`absolute w-1.5 h-8 md:h-11 rounded-full bg-[#5BC0EB]/60 ${rot}`}
                />
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* the full-width Kanban board */}
      <div className="tk-board absolute inset-x-0 top-[30%] bottom-[8%] px-4 md:px-10">
        <div className="h-full max-w-[1200px] mx-auto grid grid-cols-3 gap-4 md:gap-8">
          {COLS.map((col, ci) => (
            <div
              key={col.title}
              data-i={ci}
              className="tk-col rounded-3xl bg-white border border-black/5 shadow-lg p-4 md:p-6 flex flex-col"
            >
              <p className="text-base md:text-2xl font-black text-black/70 mb-4" style={MARKER}>
                {col.title}
              </p>
              <div className="space-y-3">
                {col.cards.map((t) => (
                  <div
                    key={t}
                    className="tk-card rounded-2xl bg-[#FFFAF5] border border-black/5 px-4 py-3 text-sm md:text-lg font-semibold text-black/80 shadow-sm"
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SceneShell>
  );
}
