"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { format, isPast, endOfWeek } from "date-fns";
import {
  CheckSquare,
  Clock,
  Target,
  TrendingUp,
  Flame,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { PriorityDot } from "@/components/PriorityDot";
import { useSemester } from "@/lib/useSemester";
import { SeedMascot } from "@/components/reflections/PeaceDecor";
import { Stagger, StaggerItem, Bounce } from "@/components/home/motion-kit";
import { NumberTicker } from "@/components/ui/number-ticker";
import { motion, useReducedMotion } from "motion/react";
import { useFirstVisit } from "@/lib/useFirstVisit";
import { gsap, useGSAP } from "@/lib/gsap";
import Link from "next/link";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;
const CREAM = "#FFFAF5";
const GRASS = "#7FB800";

interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
  role: string;
  status: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { getInfo } = useSemester();
  const semester = getInfo();

  // One-time cinematic "signature entrance" — plays once per browser session on
  // first load (never under prefers-reduced-motion). `intro` gates both the
  // markup (plain GSAP-driven divs vs. the normal framer Stagger) and the
  // timeline below, so no element is ever animated by two libraries at once.
  const firstVisit = useFirstVisit("dashboard");
  const intro = firstVisit && !loading;
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!intro || !scope.current) return;
      const q = gsap.utils.selector(scope);

      // Initial hidden states (set in a layout effect, before paint — no flash).
      gsap.set(q(".intro-mascot"), { scale: 0, opacity: 0 });
      gsap.set(q(".intro-word"), { opacity: 0, y: 14 });
      gsap.set(q(".intro-chip"), { opacity: 0, scale: 0.8 });
      gsap.set(q(".intro-stat"), { opacity: 0, y: 30, scale: 0.85 });
      gsap.set(q(".intro-card"), { opacity: 0, y: 40 });

      // The dashboard "builds itself" (~2s): mascot pops, greeting words stagger,
      // stat cards fly/scale into place (their NumberTickers count up in parallel),
      // then the two big cards rise and settle.
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(q(".intro-mascot"), { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.7)" });
      tl.to(q(".intro-word"), { opacity: 1, y: 0, duration: 0.4, stagger: 0.09 }, "-=0.2");
      tl.to(q(".intro-chip"), { opacity: 1, scale: 1, duration: 0.35 }, "-=0.25");
      tl.to(q(".intro-stat"), { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: "back.out(1.4)" }, "-=0.1");
      tl.to(q(".intro-card"), { opacity: 1, y: 0, duration: 0.55, stagger: 0.14 }, "-=0.2");
    },
    { scope, dependencies: [intro] }
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const taskRes = await fetch("/api/tasks?status=todo");
      if (taskRes.ok) {
        const data = await taskRes.json();
        setTasks(data.tasks || data);
      }
    } catch {
      toast.error("Failed to load tasks");
    }
    setLoading(false);
  };

  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && isPast(new Date(t.dueDate))
  );
  const upcomingTasks = tasks
    .filter((t) => {
      if (!t.dueDate) return true;
      const d = new Date(t.dueDate);
      return !isPast(d) && d <= weekEnd;
    })
    .slice(0, 5);

  if (loading) {
    return (
      <div
        className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 relative z-20"
        style={{ background: CREAM, color: "#1a1a1a" }}
      >
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="space-y-2">
            <div className="h-9 w-72 rounded-2xl bg-black/[0.06] animate-pulse" />
            <div className="h-5 w-40 rounded-full bg-black/[0.06] animate-pulse" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-3xl bg-white border border-black/5 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 rounded-3xl bg-white border border-black/5 animate-pulse" />
            <div className="h-64 rounded-3xl bg-white border border-black/5 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 relative z-20"
      style={{ background: CREAM, color: "#1a1a1a" }}
    >
      <div
        ref={scope}
        className={`max-w-6xl mx-auto space-y-8 ${intro ? "" : "animate-fade-in"}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <SeedMascot className={`intro-mascot w-11 h-11 shrink-0 ${intro ? "" : "animate-soft-bob"}`} />
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={MARKER}>
                {intro ? (
                  <>
                    <span className="intro-word inline-block">Good</span>{" "}
                    <span className="intro-word inline-block">{getTimeOfDay()},</span>{" "}
                    <span className="intro-word inline-block" style={{ color: GRASS }}>
                      {session?.user?.name?.split(" ")[0]}
                    </span>
                  </>
                ) : (
                  <>
                    Good {getTimeOfDay()},{" "}
                    <span style={{ color: GRASS }}>
                      {session?.user?.name?.split(" ")[0]}
                    </span>
                  </>
                )}
              </h1>
              <p className={`text-black/55 mt-1 ${intro ? "intro-word" : ""}`}>
                {format(new Date(), "EEEE, MMMM d")} · {getMotivation(tasks.length, overdueTasks.length)}
              </p>
            </div>
          </div>
          <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-black/10 bg-white text-xs ${intro ? "intro-chip" : ""}`}>
            <span className="text-black/50">{semester.name}</span>
            <span className="font-semibold text-black/70">Week {semester.weekNumber}/{semester.totalWeeks}</span>
            {semester.isExamPeriod && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">EXAMS</span>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <IntroGroup intro={intro} className="grid grid-cols-2 md:grid-cols-3 gap-4" gap={0.09}>
          <IntroItem intro={intro} cls="intro-stat">
            <StatCard>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#5BC0EB] to-[#3D9BE9] flex items-center justify-center text-white shadow-sm">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={MARKER}><NumberTicker value={tasks.length} /></p>
                  <p className="text-xs text-black/50">Pending Tasks</p>
                </div>
              </div>
            </StatCard>
          </IntroItem>
          <IntroItem intro={intro} cls="intro-stat">
            <StatCard>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF6B4A] to-[#FF4D8D] flex items-center justify-center text-white shadow-sm">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={MARKER}><NumberTicker value={overdueTasks.length} /></p>
                  <p className="text-xs text-black/50">Overdue</p>
                </div>
              </div>
            </StatCard>
          </IntroItem>
          <IntroItem intro={intro} cls="intro-stat">
            <StatCard>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#7FB800] to-[#4CA80B] flex items-center justify-center text-white shadow-sm">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={MARKER}><NumberTicker value={upcomingTasks.length} /></p>
                  <p className="text-xs text-black/50">This Week</p>
                </div>
              </div>
            </StatCard>
          </IntroItem>
        </IntroGroup>

        <IntroGroup intro={intro} className="grid grid-cols-1 lg:grid-cols-2 gap-6" gap={0.1}>
          {/* Priority Tasks */}
          <IntroItem intro={intro} cls="intro-card">
          <PodCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-lg font-bold" style={MARKER}>
                <Target className="w-5 h-5 text-[#3D9BE9]" />
                Priority Tasks
              </h2>
              <Link href="/tasks" className="text-sm font-semibold text-black/50 hover:text-black transition-colors" style={MARKER}>
                View all
              </Link>
            </div>
            {overdueTasks.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-rose-500 uppercase mb-2 tracking-wider">
                  Overdue
                </p>
                {overdueTasks.slice(0, 3).map((task, i) => (
                  <TaskRow key={task.id} task={task} overdue index={i} />
                ))}
              </div>
            )}
            {upcomingTasks.length > 0 ? (
              <div>
                {overdueTasks.length > 0 && (
                  <p className="text-xs font-bold text-black/40 uppercase mb-2 tracking-wider">
                    Upcoming
                  </p>
                )}
                {upcomingTasks.map((task, i) => (
                  <TaskRow key={task.id} task={task} index={i} />
                ))}
              </div>
            ) : overdueTasks.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <SeedMascot className="w-12 h-12 mb-3" />
                <p className="text-black/50 text-sm">
                  No pending tasks. Add some from the Tasks page.
                </p>
              </div>
            ) : null}
          </PodCard>
          </IntroItem>

          {/* Streaks & Quick Actions */}
          <IntroItem intro={intro} cls="intro-card">
          <PodCard>
            <h2 className="flex items-center gap-2 text-lg font-bold mb-4" style={MARKER}>
              <Flame className="w-5 h-5 text-[#FF8A3D]" />
              Streaks & Actions
            </h2>
            <div className="space-y-4">
              <StreakBadges />
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/[0.06]">
                <QuickAction href="/tasks" icon={<CheckSquare className="w-5 h-5 text-[#3D9BE9]" />} label="New Task" />
                <QuickAction href="/calendar" icon={<Calendar className="w-5 h-5 text-[#8B5CF6]" />} label="Calendar" />
                <QuickAction href="/reflections" icon={<Clock className="w-5 h-5 text-[#4CA80B]" />} label="Reflect" />
                <QuickAction href="/analytics" icon={<TrendingUp className="w-5 h-5 text-[#FFB400]" />} label="Analytics" />
              </div>
            </div>
          </PodCard>
          </IntroItem>
        </IntroGroup>
      </div>
    </div>
  );
}

/**
 * Group + item wrappers that swap presentation based on the one-time intro.
 * During the intro, GSAP drives plain divs (tagged with `cls`); otherwise the
 * normal framer-motion Stagger/StaggerItem reveal is used. No node is ever
 * animated by both libraries.
 */
function IntroGroup({
  intro,
  className,
  gap,
  children,
}: {
  intro: boolean;
  className: string;
  gap: number;
  children: React.ReactNode;
}) {
  if (intro) return <div className={className}>{children}</div>;
  return (
    <Stagger className={className} gap={gap}>
      {children}
    </Stagger>
  );
}

function IntroItem({
  intro,
  cls,
  children,
}: {
  intro: boolean;
  cls: string;
  children: React.ReactNode;
}) {
  if (intro) return <div className={cls}>{children}</div>;
  return <StaggerItem>{children}</StaggerItem>;
}

function StatCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white border border-black/5 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
      {children}
    </div>
  );
}

function PodCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white border border-black/5 p-6 shadow-sm">
      {children}
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Bounce className="h-full" lift={-4} scale={1.04}>
      <Link
        href={href}
        className="block h-full rounded-2xl bg-[#FFFAF5] border border-black/5 p-3 text-center group hover:shadow-sm transition-shadow"
      >
        <div className="mx-auto mb-2 w-fit group-hover:scale-110 transition-transform">{icon}</div>
        <p className="text-xs font-semibold text-black/70">{label}</p>
      </Link>
    </Bounce>
  );
}

function TaskRow({ task, overdue, index = 0 }: { task: any; overdue?: boolean; index?: number }) {
  const reduce = useReducedMotion();
  let dayIndex: number | undefined;
  if (task.dueDate) {
    const dateStr = task.dueDate.slice(0, 10);
    const [y, m, d] = dateStr.split("-").map(Number);
    const localDate = new Date(y, m - 1, d);
    dayIndex = localDate.getDay();
  }
  const href = dayIndex !== undefined ? `/tasks?day=${dayIndex}` : "/tasks";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: -10 }}
      animate={reduce ? undefined : { opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: index * 0.05 }}
    >
      <Link
        href={href}
        className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-2xl hover:bg-black/[0.03] transition-colors cursor-pointer"
      >
        <PriorityDot priority={task.priority} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${overdue ? "text-rose-500 font-medium" : "text-black/80"}`}>
            {task.title}
          </p>
        </div>
        {task.dueDate && (
          <span className={`text-xs ${overdue ? "text-rose-500" : "text-black/40"}`}>
            {format(new Date(task.dueDate), "MMM d")}
          </span>
        )}
      </Link>
    </motion.div>
  );
}

function StreakBadges() {
  const [streaks, setStreaks] = useState<{ taskStreak: number; reflectionStreak: number } | null>(null);

  useEffect(() => {
    fetch("/api/analytics?period=week")
      .then((r) => r.json())
      .then((d) => setStreaks({ taskStreak: d.taskStreak || 0, reflectionStreak: d.reflectionStreak || 0 }))
      .catch(() => {});
  }, []);

  if (!streaks) return null;

  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border ${streaks.taskStreak >= 7 ? "border-orange-300 bg-orange-50" : "border-black/10 bg-[#FFFAF5]"}`}>
        <Flame className={`w-4 h-4 ${streaks.taskStreak >= 7 ? "text-orange-500" : "text-black/40"}`} />
        <div>
          <p className="text-sm font-bold" style={MARKER}>{streaks.taskStreak}d</p>
          <p className="text-[10px] text-black/50">Tasks</p>
        </div>
      </div>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border ${streaks.reflectionStreak >= 7 ? "border-green-300 bg-green-50" : "border-black/10 bg-[#FFFAF5]"}`}>
        <Target className={`w-4 h-4 ${streaks.reflectionStreak >= 7 ? "text-[#4CA80B]" : "text-black/40"}`} />
        <div>
          <p className="text-sm font-bold" style={MARKER}>{streaks.reflectionStreak}d</p>
          <p className="text-[10px] text-black/50">Reflections</p>
        </div>
      </div>
    </div>
  );
}


function getMotivation(pending: number, overdue: number): string {
  if (overdue > 3) return "Let's tackle those overdue items first";
  if (overdue > 0) return `${overdue} overdue — you've got this`;
  if (pending === 0) return "All clear — great work!";
  if (pending <= 3) return "Light day ahead — stay focused";
  return `${pending} tasks on deck — one at a time`;
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
