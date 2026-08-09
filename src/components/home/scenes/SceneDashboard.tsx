"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { gsap, useGSAP } from "@/lib/gsap";
import { SceneShell, SceneCaptions, MARKER } from "./sceneKit";

const CAPTIONS = ["Tasks. Calendar. Reflections.", "All in one calm home."];

/**
 * SCENE 5 — It all comes together (payoff). A big device frame fills the
 * viewport; dashboard panels fly in from all four screen edges and assemble
 * into a live dashboard, chart bars grow, a member count ticks up, then the
 * whole frame settles with a soft glow. The cinematic finale.
 */
export function SceneDashboard() {
  const root = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      if (reduce) return;
      const q = gsap.utils.selector(root);

      gsap.set(q(".db-frame"), { opacity: 0, scale: 0.88 });
      gsap.set(q(".db-panel-cal"), { x: "-80vw", y: -80, opacity: 0, rotate: -10 });
      gsap.set(q(".db-panel-tasks"), { x: "-80vw", opacity: 0, rotate: 8 });
      gsap.set(q(".db-panel-chart"), { x: "80vw", opacity: 0, rotate: 10 });
      gsap.set(q(".db-panel-stats"), { y: "70vh", opacity: 0 });
      gsap.set(q(".db-bar"), { scaleY: 0, transformOrigin: "bottom center" });
      gsap.set(q(".sc-caption"), { opacity: 0, y: 30 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=3200",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });
      const cap = (i: number, last = false) => {
        tl.to(q(`.sc-caption[data-i="${i}"]`), { opacity: 1, y: 0, duration: 0.4 });
        tl.to({}, { duration: 0.35 });
        if (!last) tl.to(q(`.sc-caption[data-i="${i}"]`), { opacity: 0, y: -24, duration: 0.3 });
      };

      // frame fades in
      tl.to(q(".db-frame"), { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" });
      cap(0);

      // panels fly in from all edges
      tl.to(q(".db-panel-cal"), { x: 0, y: 0, opacity: 1, rotate: 0, duration: 0.8, ease: "power3.out" });
      tl.to(q(".db-panel-tasks"), { x: 0, opacity: 1, rotate: 0, duration: 0.8, ease: "power3.out" }, "<0.12");
      tl.to(q(".db-panel-chart"), { x: 0, opacity: 1, rotate: 0, duration: 0.8, ease: "power3.out" }, "<0.12");
      tl.to(q(".db-panel-stats"), { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, "<0.12");

      // chart bars grow + member count ticks up
      tl.to(q(".db-bar"), { scaleY: 1, duration: 0.5, stagger: 0.07, ease: "back.out(1.6)" }, ">-0.25");
      tl.to(
        { v: 0 },
        {
          v: 12,
          duration: 0.8,
          ease: "power2.out",
          onUpdate: function () {
            const el = q(".db-stat-num")[0] as HTMLElement | undefined;
            if (el) el.textContent = String(Math.round(this.targets()[0].v));
          },
        },
        "<"
      );
      cap(1, true);

      // whole frame settles + glows
      tl.to(q(".db-frame"), {
        boxShadow: "0 40px 120px rgba(127,184,0,0.28)",
        scale: 1.03,
        duration: 0.6,
        ease: "power2.inOut",
      });
    },
    { scope: root, dependencies: [reduce] }
  );

  return (
    <SceneShell ref={root} label="It all comes together" className="scene-dashboard">
      <SceneCaptions kicker="It all comes together" captions={CAPTIONS} />

      {/* big device frame */}
      <div className="db-frame relative w-[92vw] max-w-[1100px] aspect-[16/10] rounded-[2rem] bg-white border border-black/10 shadow-2xl p-3 md:p-5">
        <div className="w-full h-full rounded-[1.5rem] bg-[#FFFAF5] p-3 md:p-5 grid grid-cols-3 grid-rows-3 gap-3 md:gap-5">
          {/* calendar panel */}
          <div className="db-panel-cal col-span-2 row-span-2 rounded-3xl bg-white border border-black/5 shadow-sm p-4 md:p-6">
            <p className="text-sm md:text-xl font-black text-black/70 mb-3" style={MARKER}>
              April
            </p>
            <div className="grid grid-cols-7 gap-1.5 md:gap-2">
              {Array.from({ length: 28 }).map((_, i) => (
                <span
                  key={i}
                  className={`aspect-square rounded-md md:rounded-lg ${i === 17 ? "bg-[#7FB800]" : "bg-black/[0.05]"}`}
                />
              ))}
            </div>
          </div>
          {/* chart panel */}
          <div className="db-panel-chart col-span-1 row-span-2 rounded-3xl bg-white border border-black/5 shadow-sm p-4 md:p-6 flex flex-col">
            <p className="text-sm md:text-xl font-black text-black/70 mb-3" style={MARKER}>
              Activity
            </p>
            <div className="flex-1 flex items-end gap-2">
              {[45, 70, 40, 85, 60, 92].map((h, i) => (
                <span
                  key={i}
                  className="db-bar flex-1 rounded-t-lg bg-[linear-gradient(to_top,#5BC0EB,#7FB800)]"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          {/* tasks panel */}
          <div className="db-panel-tasks col-span-2 row-span-1 rounded-3xl bg-white border border-black/5 shadow-sm p-4 md:p-6">
            <p className="text-sm md:text-xl font-black text-black/70 mb-2" style={MARKER}>
              Today
            </p>
            <div className="space-y-2">
              {["Confirm venue", "Send invites"].map((t) => (
                <div key={t} className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full border-2 border-[#7FB800] shrink-0" />
                  <span className="text-sm md:text-lg font-semibold text-black/70">{t}</span>
                </div>
              ))}
            </div>
          </div>
          {/* stat tile */}
          <div className="db-panel-stats col-span-1 row-span-1">
            <div className="h-full rounded-3xl text-white p-4 md:p-6 flex flex-col justify-center shadow-md bg-[linear-gradient(135deg,#FFB400,#FF6B4A)]">
              <span className="db-stat-num text-3xl md:text-5xl font-black leading-none" style={MARKER}>
                0
              </span>
              <span className="text-xs md:text-base opacity-90 font-semibold mt-1">day streak</span>
            </div>
          </div>
        </div>
      </div>
    </SceneShell>
  );
}
