"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { Clock } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { SceneShell, SceneCaptions, SceneProgress, MARKER, BG, type PaletteKey } from "./sceneKit";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI"];
const CAPTIONS = ["A blank week.", "Classes settle in.", "Events find their slots.", "Always know what's next."];

// [dayIndex, rowStart(0-8), rowSpan, colorKey, label, isClass]
const BLOCKS: [number, number, number, PaletteKey, string, boolean][] = [
  [0, 1, 2, "sky", "Bio 210", true],
  [2, 1, 2, "sky", "Bio 210", true],
  [4, 1, 2, "sky", "Bio 210", true],
  [1, 4, 2, "marigold", "RA Mtg", false],
  [3, 5, 3, "coral", "Formal Prep", false],
  [4, 6, 2, "grass", "Study Grp", false],
];

/**
 * SCENE 2 — Calendar (cinematic). A full-bleed week grid draws itself line by
 * line across the entire viewport. Recurring class blocks grow into their
 * columns, one-off events pop in, and a LARGE "Next up" banner sweeps in from
 * the right. Then the whole grid compresses down into a single horizontal
 * timeline ribbon — handing off to the Event scene, which travels along it.
 */
export function SceneCalendar() {
  const root = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      if (reduce) return;
      const q = gsap.utils.selector(root);

      gsap.set(q(".cal-frame"), { opacity: 0, scale: 0.94 });
      gsap.set(q(".cal-col-bg"), { scaleY: 0, transformOrigin: "top center" });
      gsap.set(q(".cal-daylabel"), { opacity: 0, y: -16 });
      gsap.set(q(".cal-gridline"), { scaleX: 0, transformOrigin: "left center" });
      gsap.set(q(".cal-class"), { opacity: 0, scaleY: 0.3, transformOrigin: "top center" });
      gsap.set(q(".cal-event"), { opacity: 0, scale: 0.4, y: -30 });
      gsap.set(q(".cal-nextup"), { opacity: 0, x: 140, scale: 0.9 });
      gsap.set(q(".cal-ribbon"), { opacity: 0, scaleX: 0.4 });
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

      // 0 — frame + column beds + gridlines draw in across the viewport
      tl.to(q(".cal-frame"), { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" });
      tl.to(q(".cal-daylabel"), { opacity: 1, y: 0, duration: 0.4, stagger: 0.05 }, "<");
      tl.to(q(".cal-col-bg"), { scaleY: 1, duration: 0.5, stagger: 0.05, ease: "power2.out" }, "<");
      tl.to(q(".cal-gridline"), { scaleX: 1, duration: 0.5, stagger: 0.02, ease: "power1.out" }, "<0.2");
      cap(0);
      prog(0);

      // 1 — recurring class blocks grow into place
      tl.to(q(".cal-class"), { opacity: 1, scaleY: 1, duration: 0.55, ease: "back.out(1.4)", stagger: 0.08 });
      cap(1);
      prog(1);

      // 2 — one-off events pop into their slots
      tl.to(q(".cal-event"), { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: "back.out(2)", stagger: 0.12 });
      cap(2);
      prog(2);

      // 3 — the big "next up" banner sweeps in
      tl.to(q(".cal-nextup"), { opacity: 1, x: 0, scale: 1, duration: 0.6, ease: "power3.out" });
      cap(3);
      prog(3);

      // transition out — the whole grid compresses into a horizontal ribbon
      tl.to({}, { duration: 0.3 });
      tl.to(q(".cal-nextup"), { opacity: 0, x: 120, duration: 0.4, ease: "power2.in" });
      tl.to(q(".cal-frame"), { scaleY: 0.12, opacity: 0, y: 40, duration: 0.6, ease: "power3.inOut" });
      tl.to(q(".cal-ribbon"), { opacity: 1, scaleX: 1, duration: 0.6, ease: "power3.out" }, "<0.15");
    },
    { scope: root, dependencies: [reduce] }
  );

  return (
    <SceneShell ref={root} label="See your whole week" className="scene-calendar">
      <SceneCaptions kicker="See your whole week" captions={CAPTIONS} />
      <SceneProgress steps={4} />

      {/* full-bleed week frame */}
      <div className="cal-frame relative w-[92vw] max-w-[1200px]">
        <div className="grid grid-cols-5 gap-2 md:gap-4 mb-3">
          {DAYS.map((d) => (
            <div key={d} className="cal-daylabel text-center text-sm md:text-xl font-black text-black/50" style={MARKER}>
              {d}
            </div>
          ))}
        </div>

        <div className="relative grid grid-cols-5 gap-2 md:gap-4" style={{ height: "62vh", maxHeight: 560 }}>
          {DAYS.map((d, col) => (
            <div key={d} className="relative">
              <div className="cal-col-bg absolute inset-0 rounded-2xl bg-white border border-black/5 shadow-sm" />
              {Array.from({ length: 8 }).map((_, r) => (
                <div
                  key={r}
                  className="cal-gridline absolute left-2 right-2 h-px bg-black/[0.06]"
                  style={{ top: `${(r / 8) * 100}%` }}
                />
              ))}
              {BLOCKS.filter((b) => b[0] === col).map((b, i) => (
                <div
                  key={i}
                  className={`${b[5] ? "cal-class" : "cal-event"} absolute left-1.5 right-1.5 rounded-xl px-2 py-1.5 text-xs md:text-base font-bold text-white overflow-hidden shadow-md ${BG[b[3]]}`}
                  style={{ top: `${(b[1] / 8) * 100}%`, height: `${(b[2] / 8) * 100}%` }}
                >
                  {b[4]}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* big next-up banner */}
        <div className="cal-nextup absolute -right-2 md:-right-8 top-[22%] bg-white rounded-3xl shadow-2xl border border-black/5 px-5 py-4 md:px-7 md:py-5 flex items-center gap-4 max-w-[220px] md:max-w-[300px]">
          <span className="w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shrink-0 bg-[#FFB400]/15 text-[#c98a00]">
            <Clock className="w-6 h-6 md:w-8 md:h-8" />
          </span>
          <div>
            <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-black/40">Next up</p>
            <p className="text-base md:text-2xl font-black text-black leading-tight" style={MARKER}>
              RA Mtg
            </p>
            <p className="text-xs md:text-sm text-black/50 font-semibold">in 30 min · Room 214</p>
          </div>
        </div>
      </div>

      {/* the compressed timeline ribbon (transition target into Event scene) */}
      <div
        className="cal-ribbon absolute left-[6vw] right-[6vw] h-3 md:h-4 rounded-full bg-[linear-gradient(90deg,#5BC0EB,#FFB400,#FF6B4A)]"
        aria-hidden="true"
      />
    </SceneShell>
  );
}
