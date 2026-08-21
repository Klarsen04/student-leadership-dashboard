"use client";

import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { SeedMascot, HeartFlower } from "@/components/reflections/PeaceDecor";
import confetti from "canvas-confetti";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;
const GRASS = "#7FB800";
const MARIGOLD = "#FFB400";

/**
 * Post-save confirmation page. Reached via router.push("/reflections/saved")
 * after a reflection is created. Warm PeacePod styling, a celebratory burst,
 * and clear onward paths (home + history).
 */
export default function ReflectionSavedPage() {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const timer = setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: [MARIGOLD, GRASS, "#FF6B4A", "#5BC0EB"],
        disableForReducedMotion: true,
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [reduce]);

  return (
    <div className="peace-surface min-h-screen -m-4 md:-m-8 p-4 md:p-8 flex flex-col items-center justify-center relative z-20 overflow-hidden">
      {/* soft flower row */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-end justify-center gap-6 md:gap-10 opacity-90" aria-hidden="true">
        {[0, 0.4, 0.8, 1.2, 1.6].map((d, i) => (
          <HeartFlower key={i} delay={d} className="w-8 h-16 md:w-12 md:h-24" />
        ))}
      </div>

      <div className="relative text-center max-w-lg mx-auto">
        <div
          className="w-24 h-24 rounded-full mx-auto flex items-center justify-center shadow-md mb-6 animate-soft-bob"
          style={{ background: `linear-gradient(135deg, ${MARIGOLD}, ${GRASS})` }}
        >
          <SeedMascot className="w-16 h-16" />
        </div>

        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-black/50" style={MARKER}>
          <Sparkles className="w-4 h-4" /> saved to your journal
        </p>
        <h1 className="text-4xl md:text-5xl font-bold mt-2 text-black" style={MARKER}>
          Reflection saved!
        </h1>
        <p className="mt-4 text-black/60 leading-relaxed">
          Nicely done — you showed up for yourself today. One reflection at a
          time, you&apos;re growing. 🌱
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/reflections"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-8 py-3 rounded-full text-black font-semibold shadow-md hover:brightness-105 hover:-translate-y-0.5 active:translate-y-0 transition-all"
            style={{ background: GRASS, ...MARKER }}
          >
            <ArrowLeft className="w-5 h-5" /> Back to Reflections
          </Link>
          <Link
            href="/reflections/history"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 rounded-full font-semibold text-black/70 bg-white border border-black/10 shadow-sm hover:-translate-y-0.5 hover:text-black transition-all"
            style={MARKER}
          >
            <BookOpen className="w-5 h-5" /> View my reflections
          </Link>
        </div>

        <Link
          href="/reflections"
          className="mt-5 inline-block text-sm font-semibold text-black/45 hover:text-black transition-colors"
          style={MARKER}
        >
          reflect again →
        </Link>
      </div>
    </div>
  );
}
