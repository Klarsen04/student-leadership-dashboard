"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format, isPast, endOfWeek } from "date-fns";
import {
  CheckSquare,
  Clock,
  Target,
  TrendingUp,
  Flame,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriorityDot } from "@/components/PriorityDot";
import { useSemester } from "@/lib/useSemester";
import Link from "next/link";

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
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <div className="h-9 w-72 rounded-lg bg-muted animate-pulse" />
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted/50 border border-border animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 rounded-xl bg-muted/50 border border-border animate-pulse" />
          <div className="h-64 rounded-xl bg-muted/50 border border-border animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Good {getTimeOfDay()},{" "}
            <span className="gradient-text">
              {session?.user?.name?.split(" ")[0]}
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), "EEEE, MMMM d")} · {getMotivation(tasks.length, overdueTasks.length)}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card/50 text-xs">
          <span className="text-muted-foreground">{semester.name}</span>
          <span className="font-medium">Week {semester.weekNumber}/{semester.totalWeeks}</span>
          {semester.isExamPeriod && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-medium">EXAMS</span>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tasks.length}</p>
              <p className="text-xs text-muted-foreground">Pending Tasks</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overdueTasks.length}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcomingTasks.length}</p>
              <p className="text-xs text-muted-foreground">This Week</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Task */}
      <QuickAddTask onAdded={fetchData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" />
                Priority Tasks
              </CardTitle>
              <Link href="/tasks">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {overdueTasks.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-rose-400 uppercase mb-2 tracking-wider">
                  Overdue
                </p>
                {overdueTasks.slice(0, 3).map((task) => (
                  <TaskRow key={task.id} task={task} overdue />
                ))}
              </div>
            )}
            {upcomingTasks.length > 0 ? (
              <div>
                {overdueTasks.length > 0 && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 tracking-wider">
                    Upcoming
                  </p>
                )}
                {upcomingTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            ) : overdueTasks.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-muted/50 border border-border flex items-center justify-center mb-3">
                  <CheckSquare className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">
                  No pending tasks. Add some from the Tasks page.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Streaks & Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              Streaks & Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StreakBadges />
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <Link href="/tasks" className="stat-card text-center group">
                <CheckSquare className="w-5 h-5 text-blue-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-medium">New Task</p>
              </Link>
              <Link href="/goals" className="stat-card text-center group">
                <Target className="w-5 h-5 text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-medium">Set Goal</p>
              </Link>
              <Link href="/reflections" className="stat-card text-center group">
                <Clock className="w-5 h-5 text-emerald-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-medium">Reflect</p>
              </Link>
              <Link href="/analytics" className="stat-card text-center group">
                <TrendingUp className="w-5 h-5 text-amber-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-medium">Analytics</p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TaskRow({ task, overdue }: { task: any; overdue?: boolean }) {
  let dayIndex: number | undefined;
  if (task.dueDate) {
    const dateStr = task.dueDate.slice(0, 10);
    const [y, m, d] = dateStr.split("-").map(Number);
    const localDate = new Date(y, m - 1, d);
    dayIndex = localDate.getDay();
  }
  const href = dayIndex !== undefined ? `/tasks?day=${dayIndex}` : "/tasks";

  return (
    <Link
      href={href}
      className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg hover:bg-accent transition-colors cursor-pointer"
    >
      <PriorityDot priority={task.priority} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${overdue ? "text-rose-400" : ""}`}>
          {task.title}
        </p>
      </div>
      {task.dueDate && (
        <span className={`text-xs ${overdue ? "text-rose-400" : "text-muted-foreground"}`}>
          {format(new Date(task.dueDate), "MMM d")}
        </span>
      )}
    </Link>
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
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${streaks.taskStreak >= 7 ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-muted/30"}`}>
        <Flame className={`w-4 h-4 ${streaks.taskStreak >= 7 ? "text-orange-400" : "text-muted-foreground"}`} />
        <div>
          <p className="text-sm font-bold">{streaks.taskStreak}d</p>
          <p className="text-[10px] text-muted-foreground">Tasks</p>
        </div>
      </div>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${streaks.reflectionStreak >= 7 ? "border-purple-500/30 bg-purple-500/5" : "border-border bg-muted/30"}`}>
        <Target className={`w-4 h-4 ${streaks.reflectionStreak >= 7 ? "text-purple-400" : "text-muted-foreground"}`} />
        <div>
          <p className="text-sm font-bold">{streaks.reflectionStreak}d</p>
          <p className="text-[10px] text-muted-foreground">Reflections</p>
        </div>
      </div>
    </div>
  );
}

function QuickAddTask({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), dueDate: today, priority: "medium" }),
      });
      if (!res.ok) throw new Error();
      setTitle("");
      toast.success("Task added");
      onAdded();
    } catch {
      toast.error("Failed to add task");
    } finally {
      setAdding(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Quick add a task for today..."
        className="flex-1 h-11 px-4 rounded-xl border border-border bg-card/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
      />
      <Button type="submit" disabled={adding || !title.trim()} size="lg" className="h-11 px-4">
        <Plus className="w-4 h-4" />
      </Button>
    </form>
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
