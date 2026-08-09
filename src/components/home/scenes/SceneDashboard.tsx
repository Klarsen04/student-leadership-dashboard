"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { gsap, useGSAP } from "@/lib/gsap";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;
const CAPTIONS = ["Events. People. Budgets.", "All in one calm home."];

/**
 * SCENE 4 — It all comes together (payoff). Pinned, scrubbed. Dashboard panels
 * fly in from off-screen edges and assemble into a live dashboard inside a
 * device frame, which then settles and glows.
 */
export function SceneDashboard() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      if (reduce) return;
      const q = gsap.utils.selector(root);

      gsap.set(q(".db-frame"), { opacity: 0, scale: 0.9 });
      gsap.set(q(".db-panel-cal"), { x: "-70vw", y: -60, opacity: 0, rotate: -8 });
      gsap.set(q(".db-panel-tasks"), { x: "-70vw", opacity: 0, rotate: 6 });
      gsap.set(q(".db-panel-chart"), { x: "70vw", opacity: 0, rotate: 8 });
      gsap.set(q(".db-panel-stats"), { y: "60vh", opacity: 0 });
      gsap.set(q(".db-caption"), { opacity: 0, y: 14 });
      gsap.set(q(".db-bar"), { scaleY: 0, transformOrigin: "bottom center" });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=2400",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      const cap = (i: number) => {
        tl.to(q(`.db-caption[data-i="${i}"]`), { opacity: 1, y: 0, duration: 0.4 });
        tl.to({}, { duration: 0.3 });
        tl.to(q(`.db-caption[data-i="${i}"]`), { opacity: 0, y: -12, duration: 0.3 });
      };

      // frame fades in
      tl.to(q(".db-frame"), { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" });
      cap(0);

      // panels fly in from edges, staggered
      tl.to(q(".db-panel-cal"), { x: 0, y: 0, opacity: 1, rotate: 0, duration: 0.7, ease: "power3.out" });
      tl.to(q(".db-panel-tasks"), { x: 0, opacity: 1, rotate: 0, duration: 0.7, ease: "power3.out" }, "<0.15");
      tl.to(q(".db-panel-chart"), { x: 0, opacity: 1, rotate: 0, duration: 0.7, ease: "power3.out" }, "<0.15");
      tl.to(q(".db-panel-stats"), { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, "<0.15");

      // chart bars grow inside the chart panel
      tl.to(q(".db-bar"), { scaleY: 1, duration: 0.5, stagger: 0.06, ease: "back.out(1.6)" }, ">-0.2");
      cap(1);

      // whole frame settles + glows
      tl.to(q(".db-frame"), {
        boxShadow: "0 30px 90px rgba(127,184,0,0.22)",
        scale: 1.02,
        duration: 0.5,
        ease: "power2.inOut",
      });
    },
    { scope: root, dependencies: [reduce] }
  );

  return (
    <section
      ref={root}
      className="scene-dashboard relative h-screen w-full flex items-center justify-center overflow-hidden"
      aria-label="It all comes together"
    >
      <div className="pointer-events-none absolute top-[12%] left-0 right-0 text-center px-6 z-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/40">It all comes together</p>
        <div className="relative h-10 mt-2">
          {CAPTIONS.map((c, i) => (
            <p key={i} data-i={i} className="db-caption absolute inset-x-0 text-2xl md:text-4xl font-bold text-black" style={MARKER}>
              {c}
            </p>
          ))}
        </div>
      </div>

      {/* device frame */}
      <div className="db-frame relative w-[92vw] max-w-[860px] aspect-[16/10] rounded-[1.5rem] bg-white border border-black/10 shadow-xl p-3 md:p-4">
        <div className="w-full h-full rounded-[1rem] bg-[#FFFAF5] p-3 md:p-4 grid grid-cols-3 grid-rows-3 gap-3">
          {/* calendar panel */}
          <div className="db-panel-cal col-span-2 row-span-2 rounded-2xl bg-white border border-black/5 shadow-sm p-3">
            <p className="text-xs font-bold text-black/60 mb-2" style={MARKER}>April</p>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 28 }).map((_, i) => (
                <span
                  key={i}
                  className={`aspect-square rounded-[4px] ${i === 17 ? "bg-[#7FB800]" : "bg-black/[0.05]"}`}
                />
              ))}
            </div>
          </div>
          {/* chart panel */}
          <div className="db-panel-chart col-span-1 row-span-2 rounded-2xl bg-white border border-black/5 shadow-sm p-3 flex flex-col">
            <p className="text-xs font-bold text-black/60 mb-2" style={MARKER}>Activity</p>
            <div className="flex-1 flex items-end gap-1.5">
              {[45, 70, 40, 85, 60, 92].map((h, i) => (
                <span key={i} className="db-bar flex-1 rounded-t bg-gradient-to-t from-[#5BC0EB] to-[#7FB800]" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          {/* tasks panel */}
          <div className="db-panel-tasks col-span-2 row-span-1 rounded-2xl bg-white border border-black/5 shadow-sm p-3">
            <p className="text-xs font-bold text-black/60 mb-1.5" style={MARKER}>Today</p>
            <div className="space-y-1.5">
              {["Confirm venue", "Send invites"].map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-[#7FB800]" />
                  <span className="h-2 rounded bg-black/10 flex-1" />
                </div>
              ))}
            </div>
          </div>
          {/* stat tiles */}
          <div className="db-panel-stats col-span-1 row-span-1 grid grid-cols-1 gap-2">
            <div className="rounded-xl bg-gradient-to-br from-[#FFB400] to-[#FF8A3D] text-white p-2 flex flex-col justify-center">
              <span className="text-lg font-black leading-none" style={MARKER}>342</span>
              <span className="text-[9px] opacity-90">members</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
