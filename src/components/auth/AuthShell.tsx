"use client";

// The login screen's frame — floating decor, rainbow arc, mascot, white card —
// pulled out so the two password-recovery screens are visibly the same place
// rather than a plain form bolted onto the side of the app.
//
// `/login` still renders its own copy: it has a mode toggle and OAuth buttons
// woven through the same markup, and rewriting it to fit a shell was more risk
// than the duplication is worth.

import { motion, useReducedMotion } from "motion/react";
import { RainbowArc, HeartFlower, SeedMascot } from "@/components/reflections/PeaceDecor";
import { SunDoodle, CloudDoodle } from "@/components/home/HomeDecor";

export const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;
export const GRASS = "#7FB800";

/** Shared field styling, so a recovery input matches the sign-in one exactly. */
export const FIELD =
  "w-full min-h-[44px] px-4 py-2.5 bg-[#FFFAF5] border border-black/10 rounded-2xl text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-[#FFB400]/60 focus:border-[#FFB400]/60 transition-all";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="peace-surface min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <CloudDoodle className="absolute top-16 left-[6%] w-24 md:w-32 opacity-80 animate-soft-bob" />
        <CloudDoodle className="absolute top-28 right-[8%] w-20 md:w-28 opacity-70 animate-soft-bob" />
        <SunDoodle className="absolute bottom-10 right-[10%] w-16 md:w-24 opacity-80 animate-soft-bob" />
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-6 md:gap-10 opacity-90">
          {[0, 0.4, 0.8, 1.2, 1.6].map((d, i) => (
            <HeartFlower key={i} delay={d} className="w-7 h-14 md:w-9 md:h-18" />
          ))}
        </div>
      </div>

      <motion.div
        className="relative z-20 w-full max-w-md rounded-[2rem] bg-white border border-black/5 shadow-md p-8"
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
      >
        <div className="relative w-[130%] -mx-[15%] h-16 md:h-20 -mt-2 mb-2 pointer-events-none" aria-hidden="true">
          <RainbowArc className="absolute inset-0 w-full h-full" />
        </div>

        <div className="text-center mb-7">
          <motion.div
            className="mx-auto w-14 h-14"
            initial={reduce ? false : { opacity: 0, scale: 0.7, y: -6 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 140, damping: 12, delay: 0.1 }}
          >
            <SeedMascot className="w-14 h-14 animate-soft-bob" />
          </motion.div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight" style={MARKER}>
            {title}
          </h1>
          <p className="mt-1.5 text-black/55 text-sm" style={MARKER}>
            {subtitle}
          </p>
        </div>

        {children}
      </motion.div>
    </div>
  );
}

/** The app's pill button, in the one accent the auth screens use. */
export function AuthButton({
  children,
  loading,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className="w-full min-h-[44px] py-3 px-4 rounded-full text-black font-semibold shadow-md hover:brightness-105 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
      style={{ background: GRASS, ...MARKER }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/** Errors are announced, not just coloured — the form is often reached in a hurry. */
export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 rounded-2xl bg-rose-50 border border-rose-200" role="alert">
      <p className="text-rose-600 text-sm font-medium">{children}</p>
    </div>
  );
}
