"use client";

import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { SeedMascot } from "@/components/reflections/PeaceDecor";
import { SunDoodle, CloudDoodle } from "@/components/home/HomeDecor";
import { Reveal } from "@/components/home/Reveal";
import { SmoothScroll } from "@/components/home/SmoothScroll";
import { Bounce } from "@/components/home/motion-kit";
import { SceneTasks } from "@/components/home/scenes/SceneTasks";
import { SceneCalendar } from "@/components/home/scenes/SceneCalendar";
import { SceneEvent } from "@/components/home/scenes/SceneEvent";
import { SceneReflect } from "@/components/home/scenes/SceneReflect";
import { SceneDashboard } from "@/components/home/scenes/SceneDashboard";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;
const MARIGOLD = "#FFB400";
const GRASS = "#7FB800";

export default function HomePage() {
  return (
    <SmoothScroll>
      <HomeContent />
    </SmoothScroll>
  );
}

function HomeContent() {
  const reduce = useReducedMotion();

  // Hero parallax: sun + headline drift at different speeds as you scroll away.
  const { scrollY } = useScroll();
  const heroTextY = useTransform(scrollY, [0, 700], [0, reduce ? 0 : 120]);
  const sunY = useTransform(scrollY, [0, 700], [0, reduce ? 0 : -60]);
  const sunScale = useTransform(scrollY, [0, 700], [1, reduce ? 1 : 1.25]);
  const heroFade = useTransform(scrollY, [0, 500], [1, reduce ? 1 : 0]);

  return (
    <div className="peace-surface font-marker relative overflow-x-hidden">
      {/* ---- HERO (Scene 0) ---- */}
      <header className="relative z-30 px-5 md:px-8 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <SeedMascot className="w-9 h-9" />
          <span className="text-lg font-bold tracking-tight" style={MARKER}>
            Leadership OS
          </span>
        </div>
        <nav className="flex items-center gap-2 md:gap-3">
          <Link
            href="/login"
            className="inline-flex items-center min-h-[44px] px-4 rounded-full text-sm font-semibold text-black/70 hover:text-black hover:bg-black/[0.04] transition-colors"
            style={MARKER}
          >
            Sign In
          </Link>
          <Bounce>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-5 rounded-full text-sm font-semibold text-black shadow-md transition-[filter] hover:brightness-105"
              style={{ background: MARIGOLD, ...MARKER }}
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </Bounce>
        </nav>
      </header>

      <section className="relative z-10 h-[92vh] flex flex-col items-center justify-center text-center px-5">
        {/* soft clouds behind hero */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <CloudDoodle className="absolute top-[16%] left-[6%] w-24 md:w-36 opacity-70 animate-soft-bob" />
          <CloudDoodle className="absolute top-[26%] right-[8%] w-20 md:w-28 opacity-60 animate-soft-bob" />
        </div>

        <motion.div style={{ y: sunY, scale: sunScale }} className="w-24 md:w-36">
          <SunDoodle className="w-full animate-soft-bob" />
        </motion.div>

        <motion.div style={{ y: heroTextY, opacity: heroFade }} className="relative z-10">
          <p className="mt-5 text-lg text-black/60" style={MARKER}>
            hi! welcome to
          </p>
          <h1 className="text-5xl md:text-8xl font-bold tracking-tight leading-[1.02] mt-1" style={MARKER}>
            your leadership,
            <br />
            <span style={{ color: GRASS }}>a happy little home.</span>
          </h1>
          <p className="mt-5 text-lg md:text-xl text-black/60 max-w-xl mx-auto leading-relaxed">
            Tasks, calendar, reflections, and analytics for student leaders who
            do it all. Scroll to see how it works.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Bounce>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-8 py-3 rounded-full text-black font-semibold shadow-md transition-[filter] hover:brightness-105"
                style={{ background: GRASS, ...MARKER }}
              >
                Get Started <ArrowRight className="w-5 h-5" />
              </Link>
            </Bounce>
          </div>
        </motion.div>

        {/* scroll cue */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-black/40 text-sm font-semibold"
          style={MARKER}
          animate={reduce ? undefined : { y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
        >
          scroll to begin ↓
        </motion.div>
      </section>

      {/* ---- CINEMATIC SCROLL SCENES — real app features (Level 1) ---- */}
      <SceneTasks />
      <SceneCalendar />
      <SceneEvent />
      <SceneReflect />
      <SceneDashboard />

      {/* ---- CTA (Scene 5) ---- */}
      <section className="relative z-10 px-5 md:px-8 pt-16 pb-24 max-w-6xl mx-auto">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-white border border-black/5 shadow-sm px-6 py-14 md:py-16 text-center max-w-2xl mx-auto">
            <div
              className="absolute inset-0 opacity-[0.06] pointer-events-none bg-gradient-to-br from-[#FFB400] to-[#7FB800]"
              aria-hidden="true"
            />
            <div className="relative">
              <SeedMascot className="w-16 h-16 mx-auto mb-4 animate-soft-bob" />
              <h2 className="text-3xl md:text-4xl font-bold" style={MARKER}>
                Ready to grow, one day at a time?
              </h2>
              <p className="mt-3 text-black/60 max-w-md mx-auto">
                Join student leaders who use Leadership OS to plan events, build
                community, and make a real impact on campus.
              </p>
              <Bounce>
                <Link
                  href="/login"
                  className="mt-7 inline-flex items-center justify-center gap-2 min-h-[44px] px-8 py-3 rounded-full text-black font-semibold shadow-md transition-[filter] hover:brightness-105"
                  style={{ background: MARIGOLD, ...MARKER }}
                >
                  Get Started — it&apos;s free <ArrowRight className="w-5 h-5" />
                </Link>
              </Bounce>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---- Footer ---- */}
      <footer className="relative z-10 border-t border-black/[0.06] py-8 px-5 md:px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <SeedMascot className="w-6 h-6" />
            <span className="text-sm text-black/50">&copy; 2026 Leadership OS</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-sm text-black/50 hover:text-black transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-black/50 hover:text-black transition-colors">
              Terms
            </Link>
            <a
              href="mailto:studentleadershipdashboard@gmail.com"
              className="inline-flex items-center gap-1 text-sm text-black/50 hover:text-black transition-colors"
            >
              <Heart className="w-3.5 h-3.5" aria-hidden="true" /> Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
