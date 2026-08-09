"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { gsap, useGSAP } from "@/lib/gsap";
import { HeartFlower, RainbowArc } from "@/components/reflections/PeaceDecor";
import { SceneShell, SceneCaptions, MARKER, BG_SOFT, type PaletteKey } from "./sceneKit";

// the app's real reflection pods
const PODS: { emoji: string; label: string; c: PaletteKey }[] = [
  { emoji: "🌱", label: "Essentials", c: "grass" },
  { emoji: "💛", label: "Friends", c: "marigold" },
  { emoji: "⭐", label: "Self-esteem", c: "sky" },
  { emoji: "🧭", label: "Getting Unstuck", c: "coral" },
];
const QUESTIONS = ["What went well today?", "What challenged you?", "One thing you're grateful for?"];
const CAPTIONS = ["Pick a pod.", "Three gentle questions.", "Notice how you feel.", "Watch yourself grow."];

/**
 * SCENE 4 — Reflect (cinematic). Four pods fan across the whole viewport; one is
 * chosen and swells to center while the rest fall away. Three big questions
 * sweep through one at a time, mood/energy meters fill wide, then everything
 * gives way to a full-width MEADOW: a rainbow arc rises and a row of
 * heart-flowers blooms up from the bottom of the screen — the payoff of
 * showing up for yourself. The meadow then lifts to hand off to the Dashboard.
 */
export function SceneReflect() {
  const root = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      if (reduce) return;
      const q = gsap.utils.selector(root);

      gsap.set(q(".rf-pod"), { opacity: 0, scale: 0, y: 60 });
      gsap.set(q(".rf-question"), { opacity: 0, y: 50 });
      gsap.set(q(".rf-wellness"), { opacity: 0, scale: 0.8 });
      gsap.set(q(".rf-meter-fill"), { scaleX: 0, transformOrigin: "left center" });
      gsap.set(q(".rf-arc"), { opacity: 0, y: 80 });
      gsap.set(q(".rf-flower"), { opacity: 0, scaleY: 0, transformOrigin: "bottom center" });
      gsap.set(q(".rf-done"), { opacity: 0, scale: 0.6 });
      gsap.set(q(".sc-caption"), { opacity: 0, y: 30 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=3800",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });
      const cap = (i: number) => {
        tl.to(q(`.sc-caption[data-i="${i}"]`), { opacity: 1, y: 0, duration: 0.4 });
        tl.to({}, { duration: 0.35 });
        tl.to(q(`.sc-caption[data-i="${i}"]`), { opacity: 0, y: -24, duration: 0.3 });
      };

      // 0 — pods fan in big
      tl.to(q(".rf-pod"), { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: "back.out(1.8)", stagger: 0.12 });
      cap(0);

      // 1 — choose "Essentials" (index 0); others fall away; chosen swells center
      tl.to(q('.rf-pod:not([data-i="0"])'), { opacity: 0, scale: 0.4, y: 60, duration: 0.5, stagger: 0.04, ease: "power2.in" });
      tl.to(q('.rf-pod[data-i="0"]'), { scale: 1.4, y: -20, duration: 0.5, ease: "back.out(1.4)" }, "<");

      // 2 — three big questions sweep through
      QUESTIONS.forEach((_, i) => {
        tl.to(q(`.rf-question[data-i="${i}"]`), { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" });
        tl.to({}, { duration: 0.3 });
        tl.to(q(`.rf-question[data-i="${i}"]`), { opacity: 0, y: -40, duration: 0.35, ease: "power2.in" });
      });
      cap(1);

      // 3 — mood/energy meters fill wide
      tl.to(q('.rf-pod[data-i="0"]'), { opacity: 0, scale: 0.5, duration: 0.4 });
      tl.to(q(".rf-wellness"), { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.6)" });
      tl.to(q(".rf-meter-fill"), { scaleX: 1, duration: 0.7, stagger: 0.15, ease: "power2.out" });
      cap(2);

      // 4 — bloom: meadow rises (rainbow arc + full-width heart-flower row)
      tl.to(q(".rf-wellness"), { opacity: 0, y: -40, duration: 0.5, ease: "power2.in" });
      tl.to(q(".rf-arc"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, ">-0.2");
      tl.to(q(".rf-flower"), { opacity: 1, scaleY: 1, duration: 0.7, ease: "back.out(1.4)", stagger: 0.06 }, "<0.1");
      tl.to(q(".rf-done"), { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" });
      cap(3);

      // transition out — meadow lifts + fades (hands off to Dashboard)
      tl.to({}, { duration: 0.3 });
      tl.to([q(".rf-arc"), q(".rf-flower"), q(".rf-done")], { y: -70, opacity: 0, duration: 0.6, ease: "power2.in", stagger: 0.02 });
    },
    { scope: root, dependencies: [reduce] }
  );

  return (
    <SceneShell ref={root} label="Reflect and grow" className="scene-reflect">
      <SceneCaptions kicker="Reflect & grow" captions={CAPTIONS} kickerClass="text-[#5a8a00]" />

      {/* pods — big, fanned across the viewport */}
      <div className="rf-pods absolute inset-x-0 top-[34%] flex items-center justify-center gap-6 md:gap-12 px-6">
        {PODS.map((p, i) => (
          <div key={p.label} data-i={i} className="rf-pod flex flex-col items-center gap-3">
            <span className={`w-24 h-24 md:w-40 md:h-40 rounded-[2rem] flex items-center justify-center text-5xl md:text-7xl shadow-xl ${BG_SOFT[p.c]}`}>
              {p.emoji}
            </span>
            <span className="text-sm md:text-xl font-black text-black/70" style={MARKER}>
              {p.label}
            </span>
          </div>
        ))}
      </div>

      {/* questions — big, stacked, one at a time */}
      <div className="absolute inset-x-0 top-[42%] px-6">
        {QUESTIONS.map((query, i) => (
          <p
            key={i}
            data-i={i}
            className="rf-question absolute inset-x-0 text-center text-3xl md:text-6xl font-black text-black leading-tight px-6"
            style={MARKER}
          >
            {query}
          </p>
        ))}
      </div>

      {/* wellness meters — wide */}
      <div className="rf-wellness absolute inset-x-0 top-[40%] mx-auto w-[86vw] max-w-[640px] space-y-6">
        {[
          { label: "Mood", bar: "bg-[#FFB400]", w: "w-4/5" },
          { label: "Energy", bar: "bg-[#7FB800]", w: "w-[65%]" },
        ].map((m) => (
          <div key={m.label}>
            <p className="text-lg md:text-2xl font-black text-black/70 mb-2" style={MARKER}>
              {m.label}
            </p>
            <div className="h-6 md:h-9 rounded-full bg-black/[0.06] overflow-hidden">
              <div className={`rf-meter-fill h-full rounded-full ${m.w} ${m.bar}`} />
            </div>
          </div>
        ))}
      </div>

      {/* meadow bloom — full-width rainbow arc + heart-flower row */}
      <div className="rf-arc absolute inset-x-0 bottom-[18%] h-[22vh] px-0" aria-hidden="true">
        <RainbowArc className="w-full h-full" />
      </div>
      <div className="absolute inset-x-0 bottom-[10%] flex items-end justify-center gap-3 md:gap-6 px-6" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="rf-flower">
            <HeartFlower className="w-9 h-24 md:w-14 md:h-40" delay={i * 0.3} />
          </span>
        ))}
      </div>
      <p className="rf-done absolute inset-x-0 top-[30%] text-center text-4xl md:text-7xl font-black text-[#7FB800]" style={MARKER}>
        You did it 🌱
      </p>
    </SceneShell>
  );
}
