"use client";

import Link from "next/link";
import {
  CheckSquare,
  Calendar,
  BookOpen,
  BarChart3,
  ArrowRight,
  Heart,
} from "lucide-react";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { RainbowArc, HeartFlower, SeedMascot } from "@/components/reflections/PeaceDecor";
import { SunDoodle, CloudDoodle, StarBloom } from "@/components/home/HomeDecor";
import { Reveal } from "@/components/home/Reveal";
import { SmoothScroll } from "@/components/home/SmoothScroll";
import { Bounce } from "@/components/home/motion-kit";
import { gsap, useGSAP } from "@/lib/gsap";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

// ---- palette (MARIGOLD/GRASS used for accent buttons; surface via .peace-surface) ----
const MARIGOLD = "#FFB400";
const GRASS = "#7FB800";

const FEATURES = [
  {
    icon: CheckSquare,
    title: "Tasks",
    tagline: "A cassette-tape task board — one spine for each day of your week.",
    accent: "from-[#FFB400] to-[#FF8A3D]",
  },
  {
    icon: Calendar,
    title: "Calendar",
    tagline: "Day, week, and month views with class schedules and a friendly next-up nudge.",
    accent: "from-[#5BC0EB] to-[#3D9BE9]",
  },
  {
    icon: BookOpen,
    title: "Reflections",
    tagline: "Gentle guided pods — pause, notice how you feel, and grow a little each day.",
    accent: "from-[#7FB800] to-[#4CA80B]",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    tagline: "See where your energy goes with soft charts, streaks, and completion trends.",
    accent: "from-[#FF6B4A] to-[#FF4D8D]",
  },
] as const;

export default function HomePage() {
  return (
    <SmoothScroll>
      <HomeContent />
    </SmoothScroll>
  );
}

function HomeContent() {
  const reduce = useReducedMotion();

  // Scroll-linked parallax: clouds drift up, blooms drift down as you scroll.
  const { scrollY } = useScroll();
  const cloudY = useTransform(scrollY, [0, 600], [0, reduce ? 0 : -80]);
  const bloomY = useTransform(scrollY, [0, 600], [0, reduce ? 0 : 60]);

  // GSAP: draw the rainbow arc band-by-band when it scrolls into view.
  const rainbowRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (reduce) return;
      const paths = rainbowRef.current?.querySelectorAll("path");
      if (!paths || !paths.length) return;
      paths.forEach((p) => {
        const len = (p as SVGPathElement).getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      });
      gsap.to(paths, {
        strokeDashoffset: 0,
        duration: 1.1,
        ease: "power2.out",
        stagger: 0.12,
        scrollTrigger: { trigger: rainbowRef.current, start: "top 85%" },
      });
    },
    { scope: rainbowRef, dependencies: [reduce] }
  );

  return (
    <div className="peace-surface min-h-screen relative overflow-x-hidden">
      {/* Soft floating decor (all decorative) — parallax on scroll */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.div style={{ y: cloudY }} className="absolute inset-0">
          <CloudDoodle className="absolute top-24 left-[4%] w-24 md:w-32 opacity-80 animate-soft-bob" />
          <CloudDoodle className="absolute top-40 right-[6%] w-20 md:w-28 opacity-70 animate-soft-bob" />
        </motion.div>
        <motion.div style={{ y: bloomY }} className="absolute inset-0">
          <StarBloom className="absolute top-[52%] left-[3%] w-8 md:w-12 opacity-70" color="#FF6B4A" />
          <StarBloom className="absolute top-[68%] right-[5%] w-8 md:w-12 opacity-70" color="#5BC0EB" />
        </motion.div>
      </div>

      {/* Header */}
      <header className="relative z-20 px-5 md:px-8 py-4 flex items-center justify-between max-w-6xl mx-auto">
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
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-5 rounded-full text-sm font-semibold text-black shadow-md hover:brightness-105 hover:-translate-y-0.5 active:translate-y-0 transition-all"
            style={{ background: MARIGOLD, ...MARKER }}
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-20 max-w-6xl mx-auto px-5 md:px-8">
        <section className="text-center pt-10 md:pt-16 pb-4">
          <motion.div
            className="mx-auto w-20 md:w-28"
            initial={reduce ? false : { opacity: 0, scale: 0.7, y: -8 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 140, damping: 12 }}
          >
            <SunDoodle className="w-full animate-soft-bob" />
          </motion.div>

          <Reveal delay={0.05}>
            <p className="mt-4 text-lg text-black/60" style={MARKER}>
              hi! welcome to
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1
              className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mt-1"
              style={MARKER}
            >
              your leadership,
              <br />
              <span style={{ color: GRASS }}>a happy little home.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 text-lg md:text-xl text-black/60 max-w-xl mx-auto leading-relaxed">
              Tasks, calendar, reflections, and analytics for student leaders who
              do it all — in one warm, friendly space.
            </p>
          </Reveal>
          <Reveal delay={0.22}>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Bounce>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-8 py-3 rounded-full text-black font-semibold shadow-md transition-[filter]"
                  style={{ background: GRASS, ...MARKER }}
                >
                  Get Started <ArrowRight className="w-5 h-5" />
                </Link>
              </Bounce>
              <Bounce>
                <Link
                  href="#features"
                  className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-full font-semibold text-black/70 bg-white border border-black/10 shadow-sm hover:text-black transition-colors"
                  style={MARKER}
                >
                  Take a peek
                </Link>
              </Bounce>
            </div>
          </Reveal>
        </section>

        {/* Rainbow divider — GSAP draws it band-by-band on scroll-in */}
        <div
          ref={rainbowRef}
          className="relative w-[130%] -mx-[15%] h-20 md:h-28 mt-8 mb-2 pointer-events-none"
          aria-hidden="true"
        >
          <RainbowArc className="absolute inset-0 w-full h-full" />
        </div>

        {/* Features */}
        <section id="features" className="scroll-mt-20 pt-6 md:pt-10">
          <Reveal>
            <div className="text-center max-w-xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold" style={MARKER}>
                Everything you need to lead well
              </h2>
              <p className="mt-3 text-black/60">
                Four gentle tools for the student who juggles clubs, classes, and
                everything in between.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 mt-8 max-w-3xl mx-auto">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal key={f.title} delay={i * 0.08} as="div">
                  <div className="group h-full rounded-3xl bg-white border border-black/5 p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.accent} flex items-center justify-center text-white shadow-sm mb-4 group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-semibold" style={MARKER}>
                      {f.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-black/55 leading-relaxed">
                      {f.tagline}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Flower row */}
        <div
          className="flex items-end justify-center gap-6 md:gap-10 mt-16 opacity-90 pointer-events-none"
          aria-hidden="true"
        >
          {[0, 0.4, 0.8, 1.2, 1.6].map((d, i) => (
            <HeartFlower key={i} delay={d} className="w-8 h-16 md:w-10 md:h-20" />
          ))}
        </div>

        {/* CTA */}
        <section className="pt-10 pb-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-white border border-black/5 shadow-sm px-6 py-12 md:py-14 text-center max-w-2xl mx-auto">
              <div
                className="absolute inset-0 opacity-[0.06] pointer-events-none"
                style={{ background: `linear-gradient(135deg, ${MARIGOLD}, ${GRASS})` }}
                aria-hidden="true"
              />
              <div className="relative">
                <SeedMascot className="w-16 h-16 mx-auto mb-4" />
                <h2 className="text-2xl md:text-3xl font-bold" style={MARKER}>
                  Ready to grow, one day at a time?
                </h2>
                <p className="mt-3 text-black/60 max-w-md mx-auto">
                  Join student leaders who use Leadership OS to stay organized,
                  reflect gently, and make a real impact on campus.
                </p>
                <Link
                  href="/login"
                  className="mt-7 inline-flex items-center justify-center gap-2 min-h-[44px] px-8 py-3 rounded-full text-black font-semibold shadow-md hover:brightness-105 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  style={{ background: MARIGOLD, ...MARKER }}
                >
                  Get Started — it&apos;s free <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-20 border-t border-black/[0.06] py-8 px-5 md:px-8">
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
