"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar, CheckSquare, Target, BookOpen, TrendingUp, Flame, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useTimeBudget } from "@/lib/useTimeBudget";
import { useCalendars } from "@/lib/useCalendars";

interface AnalyticsData {
  eventsByCalendar: Record<string, number>;
  hoursByCalendar: Record<string, number>;
  totalEvents: number;
  tasksCompleted: number;
  tasksPending: number;
  taskStreak: number;
  reflectionStreak: number;
  reflectionCount: number;
  goalsActive: number;
  goalsProgress: number;
  wellness: { date: string; type: string; energy: number | null; mood: number | null }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [loading, setLoading] = useState(true);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");
  const { budgets, setBudget } = useTimeBudget();
  const { calendars } = useCalendars();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [period]);

  if (loading || !data) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Analytics</h1>
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      </div>
    );
  }

  const saveBudget = (cal: string) => {
    const hours = parseFloat(budgetValue);
    if (!isNaN(hours) && hours > 0) {
      setBudget(cal, hours);
    }
    setEditingBudget(null);
    setBudgetValue("");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Your {period === "week" ? "weekly" : "monthly"} overview
          </p>
        </div>
        <div className="flex border rounded-lg p-1">
          <Button
            variant={period === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => setPeriod("week")}
          >
            Week
          </Button>
          <Button
            variant={period === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => setPeriod("month")}
          >
            Month
          </Button>
        </div>
      </div>

      {/* Streaks & Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="text-orange-500"><Flame className="w-5 h-5" /></div>
            <div>
              <p className="text-xl font-bold">{data.taskStreak}</p>
              <p className="text-xs text-muted-foreground">Day task streak</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="text-purple-500"><BookOpen className="w-5 h-5" /></div>
            <div>
              <p className="text-xl font-bold">{data.reflectionStreak}</p>
              <p className="text-xs text-muted-foreground">Day reflection streak</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="text-primary"><CheckSquare className="w-5 h-5" /></div>
            <div>
              <p className="text-xl font-bold">{data.tasksCompleted}</p>
              <p className="text-xs text-muted-foreground">Tasks done</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="text-primary"><Calendar className="w-5 h-5" /></div>
            <div>
              <p className="text-xl font-bold">{data.totalEvents}</p>
              <p className="text-xs text-muted-foreground">Events</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Time Budget: Planned vs Actual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Time Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Set weekly hour goals per calendar. Click a bar to set your target.
            </p>
            {calendars.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Create a calendar to start tracking time</p>
            ) : (
              <div className="space-y-3">
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
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{cal}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${isOver ? "text-destructive" : ""}`}>
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
                              className="text-[10px] text-muted-foreground hover:text-foreground underline"
                            >
                              {target > 0 ? "edit" : "set goal"}
                            </button>
                          )}
                        </div>
                      </div>
                      {target > 0 ? (
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isOver ? "bg-destructive" : "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      ) : (
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: "100%" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Goals Progress</span>
                <span className="text-sm text-muted-foreground">{data.goalsProgress}%</span>
              </div>
              <Progress value={data.goalsProgress} />
              <p className="text-xs text-muted-foreground mt-1">{data.goalsActive} active goal{data.goalsActive !== 1 ? "s" : ""}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg border text-center">
                <p className="text-2xl font-bold text-green-600">{data.tasksCompleted}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <p className="text-2xl font-bold text-amber-600">{data.tasksPending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
            {/* Events by calendar count */}
            {Object.keys(data.eventsByCalendar).length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Events by Calendar</p>
                <div className="space-y-1">
                  {Object.entries(data.eventsByCalendar)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cal, count]) => (
                      <div key={cal} className="flex items-center justify-between text-sm">
                        <span>{cal}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Wellness from Reflections */}
      {data.wellness.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Wellness Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.wellness.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground w-20 shrink-0">
                    {format(new Date(entry.date), "MMM d")}
                  </span>
                  <div className="flex-1 flex items-center gap-6">
                    {entry.energy && (
                      <WellnessBar label="Energy" value={entry.energy} color="bg-green-500" />
                    )}
                    {entry.mood && (
                      <WellnessBar label="Mood" value={entry.mood} color="bg-blue-500" />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize">{entry.type}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WellnessBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground w-12">{label}</span>
      <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 10}%` }} />
      </div>
      <span className="text-xs font-medium w-4">{value}</span>
    </div>
  );
}
