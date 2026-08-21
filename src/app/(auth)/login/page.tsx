"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { RainbowArc, HeartFlower, SeedMascot } from "@/components/reflections/PeaceDecor";
import { SunDoodle, CloudDoodle } from "@/components/home/HomeDecor";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

// ---- palette (accent buttons; surface via .peace-surface class) ----
const GRASS = "#7FB800";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const reduce = useReducedMotion();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isRegister) {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(isRegister ? "Account created but sign-in failed. Try signing in." : "Invalid email or password");
      setLoading(false);
      return;
    }

    window.location.href = callbackUrl;
  }

  return (
    <div className="peace-surface min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-10">
      {/* Soft floating decor (all decorative) */}
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
        {/* Rainbow arc across the top */}
        <div className="relative w-[130%] -mx-[15%] h-16 md:h-20 -mt-2 mb-2 pointer-events-none" aria-hidden="true">
          <RainbowArc className="absolute inset-0 w-full h-full" />
        </div>

        {/* Logo */}
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
            {isRegister ? "Let's get you set up" : "Welcome back!"}
          </h1>
          <p className="mt-1.5 text-black/55 text-sm" style={MARKER}>
            {isRegister ? "Create your Leadership OS account" : "Sign in to your happy little home"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mb-5">
          {isRegister && (
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-black/60 mb-1.5">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 bg-[#FFFAF5] border border-black/10 rounded-2xl text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-[#FFB400]/60 focus:border-[#FFB400]/60 transition-all"
                placeholder="Your name"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-black/60 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full min-h-[44px] px-4 py-2.5 bg-[#FFFAF5] border border-black/10 rounded-2xl text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-[#FFB400]/60 focus:border-[#FFB400]/60 transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-black/60">
                Password
              </label>
              {/* Only offered when signing in: on the create-account tab there's
                  nothing to recover yet. */}
              {!isRegister && (
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-black/45 hover:text-black transition-colors"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full min-h-[44px] px-4 py-2.5 pr-11 bg-[#FFFAF5] border border-black/10 rounded-2xl text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-[#FFB400]/60 focus:border-[#FFB400]/60 transition-all"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-black/40 hover:text-black hover:bg-black/[0.04] transition-colors"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-2xl bg-rose-50 border border-rose-200">
              <p className="text-rose-600 text-sm font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] py-3 px-4 rounded-full text-black font-semibold shadow-md hover:brightness-105 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ background: GRASS, ...MARKER }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Loading...
              </span>
            ) : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="text-center mb-5">
          <button
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            className="text-sm font-semibold text-black/60 hover:text-black transition-colors"
            style={MARKER}
          >
            {isRegister ? "Already have an account? Sign in" : "Don't have an account? Create one"}
          </button>
        </div>

        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-black/10" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white text-black/40 text-xs">or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-1">
          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="flex items-center justify-center gap-2.5 min-h-[44px] bg-[#FFFAF5] border border-black/10 py-2.5 px-4 rounded-full hover:bg-black/[0.03] hover:-translate-y-0.5 transition-all font-semibold text-sm text-black/70"
            style={MARKER}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
        </div>

        <div className="text-center mt-6 pt-4 border-t border-black/[0.08]">
          <p className="text-xs text-black/45">
            By continuing, you agree to our{" "}
            <a href="/terms" className="font-semibold text-black/60 hover:text-black transition-colors">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="font-semibold text-black/60 hover:text-black transition-colors">
              Privacy Policy
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
