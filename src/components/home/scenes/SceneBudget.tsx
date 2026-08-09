"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { gsap, useGSAP } from "@/lib/gsap";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

const CATS = [
  { label: "Food", amount: 260, color: "#FFB400" },
  { label: "Decorations", amount: 140, color: "#FF6B4A" },
  { label: "Vendors", amount: 130, color: "#B084F5" },
  { label: "Supplies", amount: 70, color: "#5BC0EB" },
];
const TOTAL = 600;
const CAPTIONS = ["$600 to work with.", "Split it with intention.", "Every dollar accounted for."];

/**
 * SCENE 3 — Budget. Pinned, scrubbed. A giant $600 lifts, four category bars
 * grow from zero with their own counting $ amounts, a "remaining" figure counts
 * 600 -> 0, then the bars snap together into one unified stacked allocation bar.
 */
export function SceneBudget() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const remainRef = useRef<HTMLSpanElement>(null);
  const catRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useGSAP(
    () => {
      if (reduce) return;
      const q = gsap.utils.selector(root);

      gsap.set(q(".bg-cat"), { opacity: 0, y: 20 });
      gsap.set(q(".bg-bar-fill"), { scaleX: 0, transformOrigin: "left center" });
      gsap.set(q(".bg-caption"), { opacity: 0, y: 14 });
      gsap.set(q(".bg-stacked"), { opacity: 0, y: 30 });

      const remaining = { v: TOTAL };
      const setRemain = () => {
        if (remainRef.current) remainRef.current.textContent = "$" + Math.round(remaining.v);
      };
      const catVals = CATS.map(() => ({ v: 0 }));

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
        tl.to(q(`.bg-caption[data-i="${i}"]`), { opacity: 1, y: 0, duration: 0.4 });
        tl.to({}, { duration: 0.3 });
        tl.to(q(`.bg-caption[data-i="${i}"]`), { opacity: 0, y: -12, duration: 0.3 });
      };

      // 0 — big number in
      tl.from(q(".bg-total"), { scale: 0.5, opacity: 0, duration: 0.7, ease: "back.out(1.6)" });
      cap(0);

      // 1 — number lifts, category rows reveal
      tl.to(q(".bg-total"), { scale: 0.62, y: -30, duration: 0.6, ease: "power2.inOut" });
      tl.to(q(".bg-cat"), { opacity: 1, y: 0, duration: 0.5, stagger: 0.12, ease: "power2.out" }, "<");
      cap(1);

      // 2 — bars grow, each amount counts up, remaining counts down to 0
      CATS.forEach((c, i) => {
        tl.to(q(`.bg-bar-fill[data-i="${i}"]`), { scaleX: 1, duration: 0.6, ease: "power2.out" }, i === 0 ? ">" : "<0.15");
        tl.to(
          catVals[i],
          {
            v: c.amount,
            duration: 0.6,
            ease: "power1.out",
            onUpdate: () => {
              const el = catRefs.current[i];
              if (el) el.textContent = "$" + Math.round(catVals[i].v);
            },
          },
          "<"
        );
        tl.to(remaining, { v: remaining.v - c.amount, duration: 0.6, ease: "power1.out", onUpdate: setRemain }, "<");
      });
      cap(2);

      // 3 — the four bars snap together into one unified allocation bar
      tl.to(q(".bg-rows"), { opacity: 0, y: -20, duration: 0.5, ease: "power2.in" });
      tl.to(q(".bg-stacked"), { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.4)" }, ">-0.1");
      tl.from(q(".bg-stacked-seg"), { scaleX: 0, transformOrigin: "left center", duration: 0.5, stagger: 0.08, ease: "power2.out" }, "<");
    },
    { scope: root, dependencies: [reduce] }
  );

  return (
    <section
      ref={root}
      className="scene-budget relative h-screen w-full flex items-center justify-center overflow-hidden"
      aria-label="Budget"
    >
      <div className="pointer-events-none absolute top-[14%] left-0 right-0 text-center px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/40">Every dollar has a home</p>
        <div className="relative h-10 mt-2">
          {CAPTIONS.map((c, i) => (
            <p key={i} data-i={i} className="bg-caption absolute inset-x-0 text-2xl md:text-3xl font-bold text-black" style={MARKER}>
              {c}
            </p>
          ))}
        </div>
      </div>

      <div className="w-[90vw] max-w-[560px]">
        {/* big total + remaining */}
        <div className="text-center">
          <p className="bg-total text-7xl md:text-8xl font-black text-black leading-none" style={MARKER}>
            $600
          </p>
          <p className="mt-2 text-sm text-black/50">
            remaining <span ref={remainRef} className="font-bold text-[#7FB800]">$0</span>
          </p>
        </div>

        {/* category rows */}
        <div className="bg-rows mt-8 space-y-3">
          {CATS.map((c, i) => (
            <div key={c.label} className="bg-cat">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-semibold text-black/70">{c.label}</span>
                <span
                  ref={(el) => {
                    catRefs.current[i] = el;
                  }}
                  className="font-bold text-black"
                >
                  ${c.amount}
                </span>
              </div>
              <div className="h-4 rounded-full bg-black/[0.06] overflow-hidden">
                <div
                  className="bg-bar-fill h-full rounded-full"
                  data-i={i}
                  style={{ width: `${(c.amount / TOTAL) * 100}%`, background: c.color }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* unified stacked allocation bar */}
        <div className="bg-stacked mt-4">
          <div className="flex h-8 rounded-full overflow-hidden shadow-sm">
            {CATS.map((c) => (
              <div
                key={c.label}
                className="bg-stacked-seg h-full"
                style={{ width: `${(c.amount / TOTAL) * 100}%`, background: c.color }}
                title={`${c.label}: $${c.amount}`}
              />
            ))}
          </div>
          <p className="text-center mt-2 text-sm font-semibold text-[#7FB800]" style={MARKER}>
            Fully allocated ✓
          </p>
        </div>
      </div>
    </section>
  );
}
