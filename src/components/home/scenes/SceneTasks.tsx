"use client";

import { useRef } from "react";
import Image from "next/image";
import { useReducedMotion } from "motion/react";
import { gsap, useGSAP } from "@/lib/gsap";
import { SceneShell, SceneCaptions, SceneProgress, MARKER } from "./sceneKit";

// the app's REAL 7-day cassette shelf — same spine/cassette art as the Tasks page
const DAYS = [
  { day: "Sunday", spine: "/tasktape/sunday-spine.png", cassette: "/tasktape/sunday-cassette.png" },
  { day: "Monday", spine: "/tasktape/monday-spine.png", cassette: "/tasktape/monday-cassette.png" },
  { day: "Tuesday", spine: "/tasktape/tuesday-spine.png", cassette: "/tasktape/tuesday-cassette.png" },
  { day: "Wednesday", spine: "/tasktape/wednesday-spine.png", cassette: "/tasktape/wednesday-cassette.png" },
  { day: "Thursday", spine: "/tasktape/thursday-spine.png", cassette: "/tasktape/thursday-cassette.png" },
  { day: "Friday", spine: "/tasktape/friday-spine.png", cassette: "/tasktape/friday-cassette.png" },
  { day: "Saturday", spine: "/tasktape/saturday-spine.png", cassette: "/tasktape/saturday-cassette.png" },
];
const CHOSEN = 3; // Wednesday

const CAPTIONS = [
  "Seven days. Seven tapes.",
  "Pick a day.",
  "Pop the tape open.",
  "Your whole day, on the board.",
];

// generic student-leadership tasks (real app task board: To do / Doing / Done)
const COLS = [
  { title: "To do", cards: ["Prep 1:1s with residents", "Draft weekly newsletter", "Submit programming form"] },
  { title: "Doing", cards: ["Plan floor study break", "Review duty schedule"] },
  { title: "Done", cards: ["Post office hours", "Check in with co-RA"] },
];

/**
 * SCENE 1 — Tasks (cinematic), using the app's REAL cassette-tape art. A wall of
 * the seven day-tape spines sweeps up and fills the viewport. The chosen tape
 * (Wednesday) lifts as the others fall away, then blows up into the giant real
 * cassette image which the timeline "opens" — dissolving into the full-width
 * To-do / Doing / Done board, cards dealing in. Columns slide apart to hand off
 * to the Calendar scene.
 */
export function SceneTasks() {
  const root = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      if (reduce) return;
      const q = gsap.utils.selector(root);

      gsap.set(q(".tk-spine"), { yPercent: 140, opacity: 0, rotate: 3 });
      gsap.set(q(".tk-hero"), { opacity: 0, scale: 0.3, rotate: -10 });
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
      const prog = (i: number) => tl.to(q(`.sc-progress-fill[data-i="${i}"]`), { scaleY: 1, duration: 0.3 }, "<");
      const cap = (i: number) => {
        tl.to(q(`.sc-caption[data-i="${i}"]`), { opacity: 1, y: 0, duration: 0.4 });
        tl.to({}, { duration: 0.35 });
        if (i < steps - 1) tl.to(q(`.sc-caption[data-i="${i}"]`), { opacity: 0, y: -24, duration: 0.3 });
      };

      // 0 — the seven spines sweep up as a full-width wall
      tl.to(q(".tk-spine"), { yPercent: 0, opacity: 1, rotate: 0, duration: 0.9, ease: "back.out(1.4)", stagger: 0.07 });
      cap(0);
      prog(0);

      // 1 — the chosen tape lifts + the others fall away
      tl.to(q(`.tk-spine[data-i="${CHOSEN}"]`), { yPercent: -12, scale: 1.12, duration: 0.5, ease: "power2.out" });
      tl.to(q(`.tk-spine:not([data-i="${CHOSEN}"])`), { yPercent: 60, opacity: 0, duration: 0.5, stagger: 0.03 }, "<");
      cap(1);
      prog(1);

      // 2 — the chosen tape becomes the GIANT real cassette
      tl.to(q(`.tk-spine[data-i="${CHOSEN}"]`), { opacity: 0, scale: 0.5, duration: 0.35, ease: "power2.in" });
      tl.to(q(".tk-hero"), { opacity: 1, scale: 1, rotate: 0, duration: 0.8, ease: "back.out(1.4)" }, ">-0.15");
      tl.to(q(".tk-hero"), { scale: 1.05, duration: 0.5, ease: "sine.inOut" }, ">");
      cap(2);
      prog(2);

      // 3 — the cassette opens: it dissolves and the board assembles
      tl.to(q(".tk-hero"), { opacity: 0, scale: 1.5, filter: "blur(6px)", duration: 0.5, ease: "power2.in" });
      tl.to(q(".tk-board"), { opacity: 1, duration: 0.3 }, ">-0.25");
      tl.to(q(".tk-col"), { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.5)", stagger: 0.12 }, "<");
      tl.to(q(".tk-card"), { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: "back.out(1.6)", stagger: 0.07 }, ">-0.3");
      cap(3);
      prog(3);

      // transition out — columns slide apart (hands off to Calendar)
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

      {/* full-width wall of REAL day-tape spines */}
      <div className="tk-shelf absolute inset-0 flex items-end justify-center gap-1.5 md:gap-3 px-4 pb-[8vh]">
        {DAYS.map((d, i) => (
          <div
            key={d.day}
            data-i={i}
            className="tk-spine relative w-[12vw] max-w-[110px] h-[54vh] max-h-[500px] drop-shadow-2xl"
          >
            <Image
              src={d.spine}
              alt={`${d.day} task tape`}
              fill
              sizes="110px"
              className="object-contain object-bottom"
              priority={i === CHOSEN}
            />
          </div>
        ))}
      </div>

      {/* the GIANT real cassette (Wednesday) */}
      <div className="tk-hero absolute w-[86vw] max-w-[820px] aspect-[3/2]" aria-hidden="true">
        <Image src={DAYS[CHOSEN].cassette} alt="" fill sizes="820px" className="object-contain drop-shadow-2xl" />
      </div>

      {/* the full-width To do / Doing / Done board */}
      <div className="tk-board absolute inset-x-0 top-[28%] bottom-[8%] px-4 md:px-10">
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
