"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { MapPin, Users, PartyPopper } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { SceneShell, SceneCaptions, MARKER, BG, TEXT, type PaletteKey } from "./sceneKit";

const CAPTIONS = [
  "Every event starts empty.",
  "Set the budget.",
  "Watch it split itself.",
  "People gather.",
  "And it goes live.",
];

// budget categories — count up from 0 as the scene plays
const BUDGET: { label: string; value: number; c: PaletteKey }[] = [
  { label: "Food", value: 260, c: "marigold" },
  { label: "Decor", value: 140, c: "pink" },
  { label: "Vendors", value: 120, c: "sky" },
  { label: "Supplies", value: 80, c: "grass" },
];
const TOTAL = BUDGET.reduce((s, b) => s + b.value, 0); // 600
const AVATAR_COLORS: PaletteKey[] = ["marigold", "sky", "coral", "grass", "pink", "violet"];

/**
 * SCENE 3 — Event (flagship). A scroll-controlled HORIZONTAL journey: the whole
 * viewport becomes a track the user travels along. An empty event board fills
 * the screen, a $600 budget lands and SPLITS into four category bars that grow
 * and count up, attendee avatars pour in and a headcount ticks upward, then the
 * board flips to a giant "LIVE" event card. The master timeline scrubs the
 * track horizontally while each beat plays — one continuous coordinated scene.
 */
export function SceneEvent() {
  const root = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      if (reduce) return;
      const q = gsap.utils.selector(root);

      // 4 panels wide; travel the track from panel 0 -> 3.
      gsap.set(q(".ev-fields"), { opacity: 0, y: 40 });
      gsap.set(q(".ev-pin"), { opacity: 0, scale: 0, rotate: -30 });
      gsap.set(q(".ev-total"), { opacity: 0, scale: 0.4 });
      gsap.set(q(".ev-bar-fill"), { scaleX: 0, transformOrigin: "left center" });
      gsap.set(q(".ev-bar-row"), { opacity: 0, x: -40 });
      gsap.set(q(".ev-avatar"), { opacity: 0, scale: 0, y: 30 });
      gsap.set(q(".ev-live-card"), { opacity: 0, scale: 0.6, rotateY: 40 });
      gsap.set(q(".ev-live-badge"), { opacity: 0, scale: 0 });
      gsap.set(q(".sc-caption"), { opacity: 0, y: 30 });

      const cap = (i: number, last = false) => {
        tl.to(q(`.sc-caption[data-i="${i}"]`), { opacity: 1, y: 0, duration: 0.4 });
        tl.to({}, { duration: 0.3 });
        if (!last) tl.to(q(`.sc-caption[data-i="${i}"]`), { opacity: 0, y: -24, duration: 0.3 });
      };

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=4200",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      // travel to PANEL 0 — empty board; title/date/location fields fly in
      tl.to(q(".ev-fields"), { opacity: 1, y: 0, duration: 0.6, stagger: 0.12, ease: "power3.out" });
      tl.to(q(".ev-pin"), { opacity: 1, scale: 1, rotate: 0, duration: 0.5, ease: "back.out(2)" }, ">-0.2");
      cap(0);

      // travel to PANEL 1 — the $600 total lands
      tl.to(q(".ev-track"), { xPercent: -25, duration: 1, ease: "power1.inOut" });
      tl.to(q(".ev-total"), { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.8)" }, "<0.3");
      // count the total up 0 -> 600
      tl.to(
        { v: 0 },
        {
          v: TOTAL,
          duration: 0.6,
          ease: "power1.out",
          onUpdate: function () {
            const el = q(".ev-total-num")[0] as HTMLElement | undefined;
            if (el) el.textContent = "$" + Math.round(this.targets()[0].v);
          },
        },
        "<"
      );
      cap(1);

      // travel to PANEL 2 — the budget splits into 4 growing, counting bars
      tl.to(q(".ev-track"), { xPercent: -50, duration: 1, ease: "power1.inOut" });
      tl.to(q(".ev-bar-row"), { opacity: 1, x: 0, duration: 0.5, stagger: 0.12, ease: "power2.out" }, "<0.2");
      BUDGET.forEach((b, i) => {
        tl.to(q(`.ev-bar-fill[data-i="${i}"]`), { scaleX: b.value / TOTAL, duration: 0.6, ease: "power2.out" }, i === 0 ? ">-0.1" : "<0.1");
        tl.to(
          { v: 0 },
          {
            v: b.value,
            duration: 0.6,
            ease: "power1.out",
            onUpdate: function () {
              const el = q(`.ev-bar-num[data-i="${i}"]`)[0] as HTMLElement | undefined;
              if (el) el.textContent = "$" + Math.round(this.targets()[0].v);
            },
          },
          "<"
        );
      });
      cap(2);

      // travel to PANEL 3 — attendees pour in, headcount ticks up
      tl.to(q(".ev-track"), { xPercent: -75, duration: 1, ease: "power1.inOut" });
      tl.to(q(".ev-avatar"), { opacity: 1, scale: 1, y: 0, duration: 0.4, stagger: 0.04, ease: "back.out(2)" }, "<0.2");
      tl.to(
        { v: 0 },
        {
          v: 342,
          duration: 0.9,
          ease: "power2.out",
          onUpdate: function () {
            const el = q(".ev-count-num")[0] as HTMLElement | undefined;
            if (el) el.textContent = String(Math.round(this.targets()[0].v));
          },
        },
        "<"
      );
      cap(3);

      // FINALE — the whole track clears and the board flips into a giant LIVE card
      tl.to(q(".ev-track"), { opacity: 0, scale: 0.9, duration: 0.5, ease: "power2.in" });
      tl.to(q(".ev-live-card"), { opacity: 1, scale: 1, rotateY: 0, duration: 0.8, ease: "back.out(1.3)" }, ">-0.2");
      tl.to(q(".ev-live-badge"), { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2.5)" }, ">-0.3");
      tl.to(q(".ev-live-badge"), { scale: 1.08, duration: 0.35, yoyo: true, repeat: 3, ease: "sine.inOut" });
      cap(4, true);
    },
    { scope: root, dependencies: [reduce] }
  );

  return (
    <SceneShell ref={root} label="Plan an event from scratch" className="scene-event">
      <SceneCaptions kicker="Bring an event to life" captions={CAPTIONS} kickerClass="text-[#c98a00]" />

      {/* the horizontal track — 4 full-viewport panels the user travels along */}
      <div className="ev-track absolute inset-0 flex items-center" style={{ width: "400%" }}>
        {/* PANEL 0 — empty board + fields */}
        <div className="relative w-screen h-full flex items-center justify-center px-6">
          <div className="relative w-[86vw] max-w-[860px] aspect-[16/10] rounded-[2rem] bg-white border-2 border-dashed border-black/10 shadow-xl flex flex-col justify-center gap-5 px-8 md:px-14">
            <div className="ev-fields text-4xl md:text-7xl font-black text-black" style={MARKER}>
              Spring Formal
            </div>
            <div className="ev-fields flex items-center gap-3 text-lg md:text-2xl font-bold text-black/60" style={MARKER}>
              <span className="px-4 py-1.5 rounded-full bg-[#5BC0EB]/15">Sat · Apr 18</span>
              <span className="px-4 py-1.5 rounded-full bg-[#7FB800]/15">8:00 PM</span>
            </div>
            <div className="ev-fields text-lg md:text-2xl font-bold text-black/50 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-[#FF6B4A]" /> Memorial Hall
            </div>
            {/* location pin lands with a bounce */}
            <span className="ev-pin absolute -top-6 right-10 md:right-20 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shadow-2xl bg-[#FF6B4A]">
              <MapPin className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </span>
          </div>
        </div>

        {/* PANEL 1 — the big budget total */}
        <div className="relative w-screen h-full flex items-center justify-center px-6">
          <div className="ev-total text-center">
            <p className="text-lg md:text-2xl font-bold uppercase tracking-[0.3em] text-black/40">Budget</p>
            <p className="ev-total-num text-[24vw] md:text-[16vw] leading-none font-black text-[#7FB800]" style={MARKER}>
              $0
            </p>
            <p className="text-lg md:text-2xl font-bold text-black/50" style={MARKER}>
              to make it happen
            </p>
          </div>
        </div>

        {/* PANEL 2 — budget splits into counting bars */}
        <div className="relative w-screen h-full flex items-center justify-center px-6">
          <div className="w-[86vw] max-w-[820px] space-y-5 md:space-y-7">
            {BUDGET.map((b, i) => (
              <div key={b.label} data-i={i} className="ev-bar-row">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xl md:text-3xl font-black text-black" style={MARKER}>
                    {b.label}
                  </span>
                  <span data-i={i} className={`ev-bar-num text-xl md:text-3xl font-black ${TEXT[b.c]}`}>
                    $0
                  </span>
                </div>
                <div className="h-6 md:h-9 rounded-full bg-black/[0.06] overflow-hidden">
                  <div data-i={i} className={`ev-bar-fill h-full w-full rounded-full ${BG[b.c]}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL 3 — attendees gather + headcount */}
        <div className="relative w-screen h-full flex flex-col items-center justify-center px-6">
          <div className="flex items-center gap-3 mb-6 text-black/50">
            <Users className="w-7 h-7 md:w-9 md:h-9 text-[#B084F5]" />
            <span className="text-lg md:text-2xl font-bold uppercase tracking-[0.2em]">Going</span>
          </div>
          <p className="ev-count-num text-[26vw] md:text-[18vw] leading-none font-black text-[#B084F5]" style={MARKER}>
            0
          </p>
          <div className="mt-6 grid grid-cols-10 md:grid-cols-14 gap-2 md:gap-3 max-w-[820px]">
            {Array.from({ length: 42 }).map((_, i) => (
              <span
                key={i}
                className={`ev-avatar w-7 h-7 md:w-10 md:h-10 rounded-full shadow-sm ${BG[AVATAR_COLORS[i % 6]]}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* FINALE — giant LIVE event card (fixed, flips in over the track) */}
      <div className="ev-live-card absolute w-[86vw] max-w-[820px] aspect-[16/10] rounded-[2rem] shadow-2xl overflow-hidden [perspective:1000px]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#FFB400,#FF6B4A)]" />
        <div className="relative h-full flex flex-col justify-between p-8 md:p-12 text-white">
          <div className="flex items-center justify-between">
            <span className="ev-live-badge inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black font-black text-sm md:text-lg shadow-lg" style={MARKER}>
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B3B] animate-pulse" /> LIVE
            </span>
            <PartyPopper className="w-10 h-10 md:w-14 md:h-14" />
          </div>
          <div>
            <p className="text-5xl md:text-8xl font-black leading-none" style={MARKER}>
              Spring Formal
            </p>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-lg md:text-2xl font-bold text-white/90" style={MARKER}>
              <span>Sat · Apr 18</span>
              <span>342 going</span>
              <span>$600 budget</span>
            </div>
          </div>
        </div>
      </div>
    </SceneShell>
  );
}
