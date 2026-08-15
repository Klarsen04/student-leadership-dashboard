"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar, CheckSquare, Target, BookOpen, TrendingUp, Flame, Zap, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useTimeBudget } from "@/lib/useTimeBudget";
import { useCalendars } from "@/lib/useCalendars";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { SeedMascot } from "@/components/reflections/PeaceDecor";
import { Stagger, StaggerItem, Pop } from "@/components/home/motion-kit";
import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/home/Reveal";
import { ApppagesBar } from "@/components/home/apppages-helpers";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;
const CREAM = "#FFFAF5";
const GRASS = "#7FB800";

interface DailyEntry {
  date: string;
  tasksCompleted: number;
  reflections: number;
  events: number;
}

interface AnalyticsData {
  eventsByCalendar: Record<string, number>;
  hoursByCalendar: Record<string, number>;
  totalEvents: number;
  tasksCompleted: number;
  tasksPending: number;
  taskStreak: number;
  reflectionStreak: number;
  reflectionCount: number;
  wellness: { date: string; type: string; energy: number | null; mood: number | null }[];
  daily?: DailyEntry[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");
  const { budgets, setBudget } = useTimeBudget();
  const { calendars } = useCalendars();
  const reduce = useReducedMotion();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/analytics?period=week").then((r) => r.ok ? r.json() : null),
      fetch("/api/analytics?period=month").then((r) => r.ok ? r.json() : null),
    ]).then(([weekData, monthData]) => {
      if (weekData) {
        setData({ ...weekData, daily: monthData?.daily || [] });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 relative z-20" style={{ background: CREAM, color: "#1a1a1a" }}>
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="space-y-2">
            <div className="h-9 w-40 rounded-2xl bg-black/[0.06] animate-pulse" />
            <div className="h-5 w-32 rounded-full bg-black/[0.06] animate-pulse" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-3xl bg-white border border-black/5 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 rounded-3xl bg-white border border-black/5 animate-pulse" />
            <div className="h-64 rounded-3xl bg-white border border-black/5 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.hoursPerWeek, 0);

  const saveBudget = (cal: string) => {
    const hours = parseFloat(budgetValue);
    if (!isNaN(hours) && hours > 0) {
      const currentForCal = budgets.find((b) => b.calendar === cal)?.hoursPerWeek || 0;
      const newTotal = totalBudgeted - currentForCal + hours;
      if (newTotal > 168) return;
      setBudget(cal, hours);
    }
    setEditingBudget(null);
    setBudgetValue("");
  };

  return (
    <div className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 relative z-20" style={{ background: CREAM, color: "#1a1a1a" }}>
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-center gap-3">
          <Pop>
            <SeedMascot className="w-11 h-11 shrink-0 animate-soft-bob" />
          </Pop>
          <motion.div
            initial={reduce ? false : { opacity: 0, x: -16 }}
            animate={reduce ? undefined : { opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.1 }}
          >
            <h1 className="text-3xl font-bold tracking-tight" style={MARKER}>
              <span style={{ color: GRASS }}>Analytics</span>
            </h1>
            <p className="text-black/55 text-sm mt-0.5">Your weekly overview</p>
          </motion.div>
        </div>

        {/* Streaks & Key Metrics */}
        <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4" gap={0.08}>
          <StaggerItem>
            <MetricCard
              icon={<Flame className="w-5 h-5" />}
              value={data.taskStreak}
              label="Day task streak"
              gradient="from-[#FF8A3D] to-[#FF4D4D]"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              icon={<BookOpen className="w-5 h-5" />}
              value={data.reflectionStreak}
              label="Day reflection streak"
              gradient="from-[#7FB800] to-[#4CA80B]"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              icon={<CheckSquare className="w-5 h-5" />}
              value={data.tasksCompleted}
              label="Tasks done"
              gradient="from-[#5BC0EB] to-[#3D9BE9]"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              icon={<Calendar className="w-5 h-5" />}
              value={data.totalEvents}
              label="Events"
              gradient="from-[#FFB400] to-[#FF8A3D]"
            />
          </StaggerItem>
        </Stagger>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Time Budget */}
          <Reveal className="h-full">
          <PodCard>
            <CardTitle icon={<Zap className="w-4 h-4 text-white" />} gradient="from-[#FFB400] to-[#FF8A3D]">
              Time Budget
            </CardTitle>
            <div className="space-y-4">
              <p className="text-xs text-black/50">
                Set weekly hour goals per calendar. Click to set your target.
              </p>
              {calendars.length === 0 ? (
                <p className="text-sm text-black/50 py-4">Create a calendar to start tracking time</p>
              ) : (
                <div className="space-y-4">
                  {Array.from(new Set([
                    ...calendars.map((c) => c.name),
                    ...Object.keys(data.hoursByCalendar),
                    ...budgets.map((b) => b.calendar),
                  ])).map((cal) => {
                    const actual = data.hoursByCalendar[cal] || 0;
                    const budget = budgets.find((b) => b.calendar === cal);
                    const target = budget?.hoursPerWeek || 0;
                    const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
                    const isOver = target > 0 && actual > target;

                    return (
                      <div key={cal}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-semibold text-black/80">{cal}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${isOver ? "text-rose-500" : "text-black/70"}`}>
                              {actual}h
                            </span>
                            {target > 0 && (
                              <span className="text-xs text-black/40">/ {target}h</span>
                            )}
                            {editingBudget === cal ? (
                              <form
                                onSubmit={(e) => { e.preventDefault(); saveBudget(cal); }}
                                className="flex items-center gap-1"
                              >
                                <input
                                  autoFocus
                                  type="number"
                                  step="0.5"
                                  value={budgetValue}
                                  onChange={(e) => setBudgetValue(e.target.value)}
                                  className="h-6 w-16 text-xs rounded-lg border border-black/15 bg-[#FFFAF5] px-2 text-black focus:outline-none focus:ring-1 focus:ring-[#FFB400]/60"
                                  placeholder="hrs"
                                  onBlur={() => saveBudget(cal)}
                                />
                              </form>
                            ) : (
                              <button
                                onClick={() => { setEditingBudget(cal); setBudgetValue(target ? String(target) : ""); }}
                                className="text-[10px] font-semibold text-[#4CA80B] hover:text-[#3f7d1f] underline transition-colors"
                              >
                                {target > 0 ? "edit" : "set goal"}
                              </button>
                            )}
                          </div>
                        </div>
                        <ApppagesBar
                          pct={pct}
                          className={isOver ? "bg-gradient-to-r from-rose-400 to-red-500" : "bg-gradient-to-r from-[#FFB400] to-[#7FB800]"}
                        />
                      </div>
                    );
                  })}
                  {totalBudgeted > 0 && (
                    <div className="pt-3 border-t border-black/[0.06] text-xs text-black/50 flex justify-between">
                      <span>Total budgeted</span>
                      <span className={totalBudgeted > 168 ? "text-rose-500" : ""}>{totalBudgeted}h / 168h</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </PodCard>
          </Reveal>

          {/* Progress */}
          <Reveal className="h-full" delay={0.08}>
          <PodCard>
            <CardTitle icon={<Target className="w-4 h-4 text-white" />} gradient="from-[#FF6B4A] to-[#FF4D8D]">
              Progress
            </CardTitle>
            <div className="space-y-5">
              {/* Task stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#FFFAF5] border border-black/5 p-3 text-center">
                  <p className="text-2xl font-bold text-[#4CA80B]" style={MARKER}>
                    <AnimatedCounter value={data.tasksCompleted} />
                  </p>
                  <p className="text-xs text-black/50 mt-0.5">Completed</p>
                </div>
                <div className="rounded-2xl bg-[#FFFAF5] border border-black/5 p-3 text-center">
                  <p className="text-2xl font-bold text-[#FFB400]" style={MARKER}>
                    <AnimatedCounter value={data.tasksPending} />
                  </p>
                  <p className="text-xs text-black/50 mt-0.5">Pending</p>
                </div>
              </div>

              {/* Events by calendar */}
              {Object.keys(data.eventsByCalendar).length > 0 && (
                <div className="pt-4 border-t border-black/[0.06]">
                  <p className="text-xs font-bold uppercase tracking-wider text-black/40 mb-3">Events by Calendar</p>
                  <div className="space-y-2">
                    {Object.entries(data.eventsByCalendar)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cal, count]) => {
                        const maxCount = Math.max(...Object.values(data.eventsByCalendar));
                        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        return (
                          <div key={cal} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-black/80">{cal}</span>
                              <span className="font-bold text-[#4CA80B]">{count}</span>
                            </div>
                            <ApppagesBar
                              pct={pct}
                              heightClass="h-1.5"
                              className="bg-gradient-to-r from-[#FFB400] to-[#7FB800]"
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </PodCard>
          </Reveal>
        </div>

        {/* Wellness Trends */}
        {data.wellness.length > 0 && (
          <Reveal>
          <PodCard>
            <CardTitle icon={<TrendingUp className="w-4 h-4 text-white" />} gradient="from-[#7FB800] to-[#4CA80B]">
              Wellness Trends
            </CardTitle>
            <div className="space-y-3">
              {data.wellness.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-4 text-sm p-2 rounded-2xl hover:bg-black/[0.03] transition-colors">
                  <span className="text-black/50 w-20 shrink-0 font-medium">
                    {format(new Date(entry.date), "MMM d")}
                  </span>
                  <div className="flex-1 flex items-center gap-6">
                    {entry.energy && (
                      <WellnessBar label="Energy" value={entry.energy} gradient="from-[#7FB800] to-[#4CA80B]" />
                    )}
                    {entry.mood && (
                      <WellnessBar label="Mood" value={entry.mood} gradient="from-[#5BC0EB] to-[#8B5CF6]" />
                    )}
                  </div>
                  <span className="text-[10px] text-black/50 capitalize px-2 py-0.5 rounded-full bg-black/[0.04]">{entry.type}</span>
                </div>
              ))}
            </div>
          </PodCard>
          </Reveal>
        )}

        {data.daily && data.daily.length > 0 && (
          <Reveal>
            <ProductivityChart daily={data.daily} completed={data.tasksCompleted} pending={data.tasksPending} />
          </Reveal>
        )}
      </div>
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

function CardTitle({ children, icon, gradient }: { children: React.ReactNode; icon: React.ReactNode; gradient: string }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-bold mb-4" style={MARKER}>
      <div className={`w-8 h-8 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
        {icon}
      </div>
      {children}
    </h2>
  );
}

function MetricCard({ icon, value, label, gradient }: { icon: React.ReactNode; value: number; label: string; gradient: string }) {
  return (
    <div className="rounded-3xl bg-white border border-black/5 p-4 shadow-sm group hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold" style={MARKER}>
            <AnimatedCounter value={value} />
          </p>
          <p className="text-xs text-black/50">{label}</p>
        </div>
      </div>
    </div>
  );
}

function WellnessBar({ label, value, gradient }: { label: string; value: number; gradient: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-black/50 w-12">{label}</span>
      <div className="w-20">
        <ApppagesBar pct={value * 10} heightClass="h-2" className={`bg-gradient-to-r ${gradient}`} />
      </div>
      <span className="text-xs font-bold w-4 text-black/70">{value}</span>
    </div>
  );
}

function ProductivityChart({ daily, completed, pending }: { daily: DailyEntry[]; completed: number; pending: number }) {
  // Completion rate of your current tasks — naturally 0–100 (finish everything
  // and it reads 100%). The arrow still shows the week-over-week trend.
  const totalTasks = completed + pending;
  const productivityScore = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
  const thisWeek = daily.slice(-7).reduce((sum, d) => sum + d.tasksCompleted, 0);
  const lastWeek = daily.slice(-14, -7).reduce((sum, d) => sum + d.tasksCompleted, 0);
  const trending = thisWeek >= lastWeek;

  const chartData = daily.map((d) => ({
    date: format(new Date(d.date), "MMM d"),
    tasksCompleted: d.tasksCompleted,
  }));

  return (
    <PodCard>
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-lg font-bold" style={MARKER}>
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-[#FFB400] to-[#7FB800] flex items-center justify-center shadow-sm">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          Task Completions (30 Days)
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-black/50">Productivity Score</span>
          <span className={`text-lg font-bold ${trending ? "text-[#4CA80B]" : "text-rose-500"}`} style={MARKER}>
            {productivityScore}%
          </span>
          {trending ? (
            <ArrowUpRight className="w-4 h-4 text-[#4CA80B]" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
          )}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="taskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFB400" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#7FB800" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(0,0,0,0.4)', fontSize: 11 }}
              stroke="rgba(0,0,0,0.1)"
              tickLine={false}
              axisLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fill: 'rgba(0,0,0,0.4)', fontSize: 11 }}
              stroke="rgba(0,0,0,0.1)"
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '12px',
                color: '#1a1a1a',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}
              labelStyle={{ color: 'rgba(0,0,0,0.5)' }}
            />
            <Area
              type="monotone"
              dataKey="tasksCompleted"
              stroke="#FFB400"
              strokeWidth={2.5}
              fill="url(#taskGradient)"
              name="Tasks Completed"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </PodCard>
  );
}
