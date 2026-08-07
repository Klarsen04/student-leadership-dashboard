"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar, CheckSquare, Target, BookOpen, TrendingUp, Flame, Zap, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTimeBudget } from "@/lib/useTimeBudget";
import { useCalendars } from "@/lib/useCalendars";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-2">
          <div className="h-9 w-40 rounded-lg bg-muted animate-pulse" />
          <div className="h-5 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted/50 border border-border animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 rounded-xl bg-muted/50 border border-border animate-pulse" />
          <div className="h-64 rounded-xl bg-muted/50 border border-border animate-pulse" />
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
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="gradient-text">Analytics</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Your weekly overview</p>
      </div>

      {/* Streaks & Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Flame className="w-5 h-5" />}
          value={data.taskStreak}
          label="Day task streak"
          gradient="from-orange-500 to-red-500"
        />
        <MetricCard
          icon={<BookOpen className="w-5 h-5" />}
          value={data.reflectionStreak}
          label="Day reflection streak"
          gradient="from-purple-500 to-violet-500"
        />
        <MetricCard
          icon={<CheckSquare className="w-5 h-5" />}
          value={data.tasksCompleted}
          label="Tasks done"
          gradient="from-blue-500 to-cyan-500"
        />
        <MetricCard
          icon={<Calendar className="w-5 h-5" />}
          value={data.totalEvents}
          label="Events"
          gradient="from-emerald-500 to-teal-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Time Budget */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              Time Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Set weekly hour goals per calendar. Click to set your target.
            </p>
            {calendars.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Create a calendar to start tracking time</p>
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
                        <span className="text-sm font-medium">{cal}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isOver ? "text-rose-400" : "text-foreground"}`}>
                            {actual}h
                          </span>
                          {target > 0 && (
                            <span className="text-xs text-muted-foreground">/ {target}h</span>
                          )}
                          {editingBudget === cal ? (
                            <form
                              onSubmit={(e) => { e.preventDefault(); saveBudget(cal); }}
                              className="flex items-center gap-1"
                            >
                              <Input
                                autoFocus
                                type="number"
                                step="0.5"
                                value={budgetValue}
                                onChange={(e) => setBudgetValue(e.target.value)}
                                className="h-6 w-16 text-xs"
                                placeholder="hrs"
                                onBlur={() => saveBudget(cal)}
                              />
                            </form>
                          ) : (
                            <button
                              onClick={() => { setEditingBudget(cal); setBudgetValue(target ? String(target) : ""); }}
                              className="text-[10px] text-purple-400 hover:text-purple-300 underline transition-colors"
                            >
                              {target > 0 ? "edit" : "set goal"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${isOver ? "bg-gradient-to-r from-rose-500 to-red-500" : "bg-gradient-to-r from-purple-500 to-blue-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {totalBudgeted > 0 && (
                  <div className="pt-3 border-t border-border text-xs text-muted-foreground flex justify-between">
                    <span>Total budgeted</span>
                    <span className={totalBudgeted > 168 ? "text-rose-400" : ""}>{totalBudgeted}h / 168h</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Task stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="stat-card text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  <AnimatedCounter value={data.tasksCompleted} />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
              </div>
              <div className="stat-card text-center">
                <p className="text-2xl font-bold text-amber-400">
                  <AnimatedCounter value={data.tasksPending} />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
              </div>
            </div>

            {/* Events by calendar */}
            {Object.keys(data.eventsByCalendar).length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Events by Calendar</p>
                <div className="space-y-2">
                  {Object.entries(data.eventsByCalendar)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cal, count]) => {
                      const maxCount = Math.max(...Object.values(data.eventsByCalendar));
                      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      return (
                        <div key={cal} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{cal}</span>
                            <span className="font-bold text-purple-300">{count}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500/60 to-blue-500/60 transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Wellness Trends */}
      {data.wellness.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              Wellness Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.wellness.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-4 text-sm p-2 rounded-lg hover:bg-accent transition-colors">
                  <span className="text-muted-foreground w-20 shrink-0 font-medium">
                    {format(new Date(entry.date), "MMM d")}
                  </span>
                  <div className="flex-1 flex items-center gap-6">
                    {entry.energy && (
                      <WellnessBar label="Energy" value={entry.energy} gradient="from-emerald-500 to-teal-500" />
                    )}
                    {entry.mood && (
                      <WellnessBar label="Mood" value={entry.mood} gradient="from-blue-500 to-purple-500" />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize px-2 py-0.5 rounded-full bg-white/[0.05]">{entry.type}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.daily && data.daily.length > 0 && <ProductivityChart daily={data.daily} />}
    </div>
  );
}

function MetricCard({ icon, value, label, gradient }: { icon: React.ReactNode; value: number; label: string; gradient: string }) {
  return (
    <div className="stat-card group">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">
            <AnimatedCounter value={value} />
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

function WellnessBar({ label, value, gradient }: { label: string; value: number; gradient: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground w-12">{label}</span>
      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700`}
          style={{ width: `${value * 10}%` }}
        />
      </div>
      <span className="text-xs font-bold w-4">{value}</span>
    </div>
  );
}

function ProductivityChart({ daily }: { daily: DailyEntry[] }) {
  const thisWeek = daily.slice(-7).reduce((sum, d) => sum + d.tasksCompleted, 0);
  const lastWeek = daily.slice(-14, -7).reduce((sum, d) => sum + d.tasksCompleted, 0);
  const productivityScore = lastWeek > 0 ? Math.round((thisWeek / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;
  const trending = thisWeek >= lastWeek;

  const chartData = daily.map((d) => ({
    date: format(new Date(d.date), "MMM d"),
    tasksCompleted: d.tasksCompleted,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            Task Completions (30 Days)
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Productivity Score</span>
            <span className={`text-lg font-bold ${trending ? "text-emerald-400" : "text-rose-400"}`}>
              {productivityScore}%
            </span>
            {trending ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="taskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }}
                stroke="hsl(230 20% 18%)"
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }}
                stroke="hsl(230 20% 18%)"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(230 25% 12%)',
                  border: '1px solid hsl(230 20% 20%)',
                  borderRadius: '8px',
                  color: 'hsl(215 20% 85%)',
                }}
                labelStyle={{ color: 'hsl(215 20% 70%)' }}
              />
              <Area
                type="monotone"
                dataKey="tasksCompleted"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#taskGradient)"
                name="Tasks Completed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
