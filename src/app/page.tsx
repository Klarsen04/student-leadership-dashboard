import Link from "next/link";
import {
  ArrowUpRight,
  CheckSquare,
  CalendarDays,
  NotebookPen,
  LineChart,
} from "lucide-react";
import { AuroraCanvas } from "@/components/home/AuroraCanvas";
import { AnimatedHeadline } from "@/components/home/AnimatedHeadline";
import { Reveal } from "@/components/home/Reveal";

const features = [
  {
    key: "tasks",
    n: "01",
    title: "Tasks",
    icon: CheckSquare,
    lead: "A board that thinks in days.",
    body: "Kanban columns, priorities, and a focus timer laid out as a shelf of daily tapes. Drag what matters to the top and let the rest wait.",
    span: "lg:col-span-7",
  },
  {
    key: "calendar",
    n: "02",
    title: "Calendar",
    icon: CalendarDays,
    lead: "Every role, one grid.",
    body: "Day, week, and month views with side-by-side conflict detection, class blocks, and a Next Up banner counting down to whatever is next.",
    span: "lg:col-span-5",
  },
  {
    key: "reflections",
    n: "03",
    title: "Reflections",
    icon: NotebookPen,
    lead: "Room to think out loud.",
    body: "Daily, weekly, and monthly entries with wellness check-ins and gratitude prompts. A quiet PeacePod for the days that need one.",
    span: "lg:col-span-5",
  },
  {
    key: "analytics",
    n: "04",
    title: "Analytics",
    icon: LineChart,
    lead: "See where the hours go.",
    body: "Streaks, completion trends, and time budgets rendered as clean charts, so effort turns into evidence you can actually read.",
    span: "lg:col-span-7",
  },
] as const;

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#05060c] text-white antialiased">
      {/* ================= HERO ================= */}
      <section className="relative isolate min-h-[100svh] overflow-hidden">
        <AuroraCanvas />
        {/* grain / grid overlay for texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]"
        />

        <div className="relative z-10 flex min-h-[100svh] flex-col">
          {/* Header */}
          <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
            <Link
              href="/"
              className="group inline-flex items-center gap-2.5"
              aria-label="Leadership OS home"
            >
              <span className="relative grid h-8 w-8 place-items-center rounded-md border border-white/15 bg-white/5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-gradient-to-br from-violet-300 to-teal-200" />
              </span>
              <span className="text-[15px] font-medium tracking-tight">
                Leadership OS
              </span>
            </Link>
            <nav className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center rounded-lg px-4 text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white px-5 text-sm font-semibold text-black transition-all hover:bg-white/90"
              >
                Get started
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </nav>
          </header>

          {/* Hero body — asymmetric, bottom-weighted composition */}
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-6 pb-16 pt-10 sm:pb-24">
            <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
                  The operating system for student leaders
                </div>
                <AnimatedHeadline
                  lines={["Run every role", "from one calm", "command center."]}
                  accentLine={2}
                />
              </div>

              <div className="lg:col-span-4 lg:pb-2">
                <p className="max-w-md text-pretty text-base leading-relaxed text-white/60 sm:text-lg">
                  Clubs, classes, and commitments pull in every direction.
                  Leadership OS gathers your tasks, calendar, reflections, and
                  analytics into a single focused surface.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href="/login"
                    className="group inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 px-6 text-sm font-semibold text-white shadow-[0_0_40px_-8px_rgba(139,92,246,0.7)] transition-all hover:shadow-[0_0_55px_-6px_rgba(139,92,246,0.9)]"
                  >
                    Start free
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                  <Link
                    href="#features"
                    className="inline-flex min-h-[44px] items-center text-sm font-medium text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline"
                  >
                    Tour the workspace
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section
        id="features"
        className="relative border-t border-white/10 bg-[#05060c] px-6 py-24 sm:py-32"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
            <Reveal className="lg:col-span-8">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-300/80">
                The workspace
              </p>
              <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                Four surfaces, built to work
                <span className="text-white/40"> the way you already lead.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1} className="lg:col-span-4">
              <p className="text-white/55 lg:text-right">
                No feature bloat. Each area does one job well and hands off
                cleanly to the next.
              </p>
            </Reveal>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-12">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal
                  key={f.key}
                  delay={(i % 2) * 0.08}
                  className={f.span}
                >
                  <article className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-8 transition-colors duration-300 hover:border-white/20 sm:p-10">
                    {/* accent wash on hover */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-500/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                    />
                    <div className="relative flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Icon
                          className="h-5 w-5 text-teal-300"
                          aria-hidden="true"
                        />
                        <h3 className="text-lg font-semibold tracking-tight">
                          {f.title}
                        </h3>
                      </div>
                      <span className="font-mono text-xs text-white/30">
                        {f.n}
                      </span>
                    </div>
                    <div className="relative mt-10">
                      <p className="text-xl font-medium tracking-tight text-white sm:text-2xl">
                        {f.lead}
                      </p>
                      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
                        {f.body}
                      </p>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="relative overflow-hidden border-t border-white/10 px-6 py-28 sm:py-36">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 -z-0 h-72 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.28),transparent_65%)]"
        />
        <Reveal className="relative mx-auto max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-300/80">
            Get started
          </p>
          <h2 className="mt-5 max-w-3xl text-balance text-4xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
            Lead with a little less chaos.
          </h2>
          <p className="mt-6 max-w-xl text-lg text-white/60">
            Create an account and bring every role you carry into one place. It
            is free to start.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="group inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-white px-7 text-base font-semibold text-black transition-transform hover:-translate-y-0.5"
            >
              Get started free
              <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[48px] items-center rounded-xl border border-white/15 px-7 text-base font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
            >
              Sign in
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 place-items-center rounded border border-white/15 bg-white/5">
              <span className="h-2 w-2 rounded-[2px] bg-gradient-to-br from-violet-300 to-teal-200" />
            </span>
            <span className="text-sm text-white/50">© 2026 Leadership OS</span>
          </div>
          <div className="flex items-center gap-7">
            <Link
              href="/privacy"
              className="text-sm text-white/50 transition-colors hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-white/50 transition-colors hover:text-white"
            >
              Terms
            </Link>
            <a
              href="mailto:studentleadershipdashboard@gmail.com"
              className="text-sm text-white/50 transition-colors hover:text-white"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
