"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { MapPin, Calendar, Check } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

const CAPTIONS = [
  "An empty idea…",
  "Give it a name.",
  "Pick a time.",
  "Find a place.",
  "Gather your people.",
  "It's official. ✨",
];

/**
 * SCENE 1 — Plan an event. Pinned, scroll-scrubbed. A large empty event board
 * assembles itself piece by piece as the user scrolls: title flies in, date
 * chip clicks in, a location pin travels across the viewport and drops, avatars
 * pop in with a counting attendee number, then a CONFIRMED stamp lands and the
 * finished card lifts away.
 */
export function SceneEvent() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const countRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (reduce) return;
      const q = gsap.utils.selector(root);

      // initial states (set in JS so reduced-motion fallback shows final DOM)
      gsap.set(q(".ev-board"), { scale: 0.85, opacity: 0 });
      gsap.set(q(".ev-title"), { y: -120, opacity: 0 });
      gsap.set(q(".ev-date"), { x: -220, opacity: 0 });
      gsap.set(q(".ev-pin"), { x: "60vw", y: -80, opacity: 0, rotate: -25 });
      gsap.set(q(".ev-loc-label"), { opacity: 0, y: 10 });
      gsap.set(q(".ev-avatar"), { scale: 0, opacity: 0, y: 24 });
      gsap.set(q(".ev-stamp"), { scale: 2.4, opacity: 0, rotate: 18 });
      gsap.set(q(".ev-caption"), { opacity: 0, y: 14 });

      const counter = { v: 0 };
      const setCount = () => {
        if (countRef.current) countRef.current.textContent = String(Math.round(counter.v));
      };

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=2600",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      const showCap = (i: number) =>
        tl.to(q(`.ev-caption[data-i="${i}"]`), { opacity: 1, y: 0, duration: 0.4 }, "<");
      const hideCap = (i: number) =>
        tl.to(q(`.ev-caption[data-i="${i}"]`), { opacity: 0, y: -12, duration: 0.3 });

      // 0 — board appears
      tl.to(q(".ev-board"), { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.5)" });
      showCap(0);
      tl.to({}, { duration: 0.4 });
      hideCap(0);

      // 1 — title flies in
      tl.to(q(".ev-title"), { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" });
      showCap(1);
      tl.to({}, { duration: 0.3 });
      hideCap(1);

      // 2 — date chip clicks in
      tl.to(q(".ev-date"), { x: 0, opacity: 1, duration: 0.6, ease: "back.out(2)" });
      showCap(2);
      tl.to({}, { duration: 0.3 });
      hideCap(2);

      // 3 — location pin travels across the viewport and drops
      tl.to(q(".ev-pin"), { x: 0, opacity: 1, rotate: 0, duration: 0.9, ease: "power2.inOut" });
      tl.to(q(".ev-pin"), { y: 0, duration: 0.45, ease: "bounce.out" });
      tl.to(q(".ev-loc-label"), { opacity: 1, y: 0, duration: 0.35 }, "<0.1");
      showCap(3);
      tl.to({}, { duration: 0.3 });
      hideCap(3);

      // 4 — attendees pop in + counter ticks 0 -> 128
      tl.to(q(".ev-avatar"), {
        scale: 1,
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: "back.out(2.2)",
        stagger: 0.08,
      });
      tl.to(counter, { v: 128, duration: 0.9, ease: "power1.out", onUpdate: setCount }, "<");
      showCap(4);
      tl.to({}, { duration: 0.3 });
      hideCap(4);

      // 5 — CONFIRMED stamp lands, board turns green, status flips
      tl.to(q(".ev-stamp"), { scale: 1, opacity: 1, rotate: -8, duration: 0.5, ease: "back.out(3)" });
      tl.to(q(".ev-board"), { borderColor: "#7FB800", boxShadow: "0 20px 60px rgba(127,184,0,0.28)", duration: 0.4 }, "<");
      tl.to(q(".ev-status-draft"), { opacity: 0, y: -8, duration: 0.25 }, "<");
      tl.to(q(".ev-status-live"), { opacity: 1, y: 0, duration: 0.3 }, ">-0.1");
      showCap(5);
      tl.to({}, { duration: 0.5 });

      // 6 — finished card lifts + tilts away (hand-off)
      tl.to(q(".ev-board-wrap"), {
        scale: 0.7,
        y: -60,
        rotateX: 12,
        rotateZ: -4,
        opacity: 0.9,
        duration: 0.8,
        ease: "power2.in",
      });
      hideCap(5);
    },
    { scope: root, dependencies: [reduce] }
  );

  return (
    <section
      ref={root}
      className="scene-event relative h-screen w-full flex items-center justify-center overflow-hidden"
      aria-label="Plan an event"
    >
      {/* captions */}
      <div className="pointer-events-none absolute top-[14%] left-0 right-0 text-center px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/40">Plan an event</p>
        <div className="relative h-10 mt-2">
          {CAPTIONS.map((c, i) => (
            <p
              key={i}
              data-i={i}
              className="ev-caption absolute inset-x-0 text-2xl md:text-3xl font-bold text-black"
              style={MARKER}
            >
              {c}
            </p>
          ))}
        </div>
      </div>

      {/* the event board */}
      <div className="ev-board-wrap relative" style={{ perspective: 1000 }}>
        <div
          className="ev-board relative w-[86vw] max-w-[520px] rounded-[2rem] bg-white border-2 border-black/10 shadow-xl p-6 md:p-8"
        >
          {/* header row */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="ev-title text-3xl md:text-4xl font-bold text-black leading-tight" style={MARKER}>
              Spring Formal
            </h3>
            <div className="relative h-7 w-16 shrink-0">
              <span className="ev-status-draft absolute right-0 top-0 text-xs font-bold px-2.5 py-1 rounded-full bg-black/[0.06] text-black/50">
                Draft
              </span>
              <span className="ev-status-live absolute right-0 top-0 text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700" style={{ opacity: 0 }}>
                Live
              </span>
            </div>
          </div>

          {/* date + location */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <span className="ev-date inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-[#5BC0EB]/15 text-[#2b7fb0]">
              <Calendar className="w-4 h-4" /> Apr 18
            </span>
            <span className="ev-loc-label inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-[#FF6B4A]/15 text-[#c23b1f]">
              <MapPin className="w-4 h-4" /> Grand Hall
            </span>
          </div>

          {/* attendees */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex -space-x-2">
              {["#FFB400", "#7FB800", "#5BC0EB", "#FF6B4A", "#B084F5"].map((c, i) => (
                <span
                  key={i}
                  className="ev-avatar w-9 h-9 rounded-full border-2 border-white shadow-sm"
                  style={{ background: c }}
                />
              ))}
            </div>
            <p className="text-sm text-black/60">
              <span ref={countRef} className="font-bold text-black">
                128
              </span>{" "}
              going
            </p>
          </div>

          {/* confirmed stamp */}
          <div
            className="ev-stamp absolute -right-3 -bottom-3 w-24 h-24 rounded-full border-4 border-green-500 flex items-center justify-center bg-white/90"
            aria-hidden="true"
          >
            <span className="flex flex-col items-center text-green-600">
              <Check className="w-6 h-6" strokeWidth={3} />
              <span className="text-[9px] font-black tracking-widest">CONFIRMED</span>
            </span>
          </div>
        </div>

        {/* the traveling location pin (starts far right, drops onto board) */}
        <div className="ev-pin absolute -top-8 left-1/2 -ml-4 text-[#FF6B4A]" aria-hidden="true">
          <MapPin className="w-10 h-10 fill-[#FF6B4A]/20" strokeWidth={2.5} />
        </div>
      </div>
    </section>
  );
}
