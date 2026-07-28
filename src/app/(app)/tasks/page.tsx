"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { format, startOfWeek, addDays, addWeeks, isToday, isSameWeek } from "date-fns";
import { Plus, Check, Trash2, Play, Pause, RotateCcw, Timer, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PriorityDot } from "@/components/PriorityDot";
import { TASK_PRIORITIES } from "@/lib/utils";
import { TapeShelf, TAPES } from "@/components/tasks/TapeShelf";

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  role: string;
  hours: number | null;
  recurrence: string | null;
  goal: { id: string; title: string } | null;
  createdAt: string;
}

const DAY_THEMES = [
  { name: "Sunday", short: "Sun", gradient: "from-rose-500/10 to-rose-500/5", accent: "bg-rose-500", accentLight: "bg-rose-500/10 text-rose-400", border: "border-rose-500/20", tabActive: "bg-rose-500 text-white shadow-rose-500/30 shadow-lg", ring: "ring-rose-500/30" },
  { name: "Monday", short: "Mon", gradient: "from-purple-500/10 to-purple-500/5", accent: "bg-purple-500", accentLight: "bg-purple-500/10 text-purple-400", border: "border-purple-500/20", tabActive: "bg-purple-500 text-white shadow-purple-500/30 shadow-lg", ring: "ring-purple-500/30" },
  { name: "Tuesday", short: "Tue", gradient: "from-pink-500/10 to-pink-500/5", accent: "bg-pink-500", accentLight: "bg-pink-500/10 text-pink-400", border: "border-pink-500/20", tabActive: "bg-pink-500 text-white shadow-pink-500/30 shadow-lg", ring: "ring-pink-500/30" },
  { name: "Wednesday", short: "Wed", gradient: "from-emerald-500/10 to-emerald-500/5", accent: "bg-emerald-500", accentLight: "bg-emerald-500/10 text-emerald-400", border: "border-emerald-500/20", tabActive: "bg-emerald-500 text-white shadow-emerald-500/30 shadow-lg", ring: "ring-emerald-500/30" },
  { name: "Thursday", short: "Thu", gradient: "from-amber-500/10 to-amber-500/5", accent: "bg-amber-500", accentLight: "bg-amber-500/10 text-amber-400", border: "border-amber-500/20", tabActive: "bg-amber-500 text-white shadow-amber-500/30 shadow-lg", ring: "ring-amber-500/30" },
  { name: "Friday", short: "Fri", gradient: "from-orange-500/10 to-orange-500/5", accent: "bg-orange-500", accentLight: "bg-orange-500/10 text-orange-400", border: "border-orange-500/20", tabActive: "bg-orange-500 text-white shadow-orange-500/30 shadow-lg", ring: "ring-orange-500/30" },
  { name: "Saturday", short: "Sat", gradient: "from-blue-500/10 to-blue-500/5", accent: "bg-blue-500", accentLight: "bg-blue-500/10 text-blue-400", border: "border-blue-500/20", tabActive: "bg-blue-500 text-white shadow-blue-500/30 shadow-lg", ring: "ring-blue-500/30" },
];

export default function TasksPage() {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(() => {
    const dayParam = searchParams.get("day");
    if (dayParam !== null) {
      const parsed = parseInt(dayParam);
      if (parsed >= 0 && parsed <= 6) return parsed;
    }
    return new Date().getDay();
  });
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [editTarget, setEditTarget] = useState<Task | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showFullAdd, setShowFullAdd] = useState(false);
  const [focusTime, setFocusTime] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusElapsed, setFocusElapsed] = useState(0);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [dailyNote, setDailyNote] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [shelfExpanded, setShelfExpanded] = useState(true);

  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), weekOffset);
  const selectedDate = addDays(weekStart, selectedDay);
  const theme = DAY_THEMES[selectedDay];
  const isCurrentWeek = isSameWeek(new Date(), weekStart, { weekStartsOn: 0 });
  const noteKey = `leadership-os-note-${format(selectedDate, "yyyy-MM-dd")}`;

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks?limit=100");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTasks(data.tasks || data);
    } catch {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/tasks/generate", { method: "POST" }).then(() => fetchTasks()).catch(() => fetchTasks());
  }, [fetchTasks]);

  useEffect(() => {
    const saved = localStorage.getItem(noteKey);
    setDailyNote(saved || "");
  }, [noteKey]);

  const saveDailyNote = (value: string) => {
    setDailyNote(value);
    localStorage.setItem(noteKey, value);
  };

  useEffect(() => {
    if (focusRunning) {
      intervalRef.current = setInterval(() => {
        setFocusElapsed((prev) => {
          if (prev >= focusTime) {
            setFocusRunning(false);
            toast.success("Focus session complete!");
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [focusRunning, focusTime]);

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const overdueTasks = tasks.filter((t) => {
    if (t.status === "done") return false;
    if (!t.dueDate) return false;
    const taskDate = t.dueDate.slice(0, 10);
    return taskDate < today;
  });

  const dayTasks = tasks.filter((t) => {
    if (!t.dueDate) return true;
    const taskDate = t.dueDate.slice(0, 10);
    if (taskDate < today && t.status !== "done") return false;
    return taskDate === selectedDateStr;
  });

  const todoTasks = dayTasks.filter((t) => t.status === "todo");
  const inProgressTasks = dayTasks.filter((t) => t.status === "in_progress");
  const doneTasks = dayTasks.filter((t) => t.status === "done");
  const totalDayTasks = dayTasks.length;
  const completionPercent = totalDayTasks > 0 ? Math.round((doneTasks.length / totalDayTasks) * 100) : 0;

  // Compute task counts per day for the tape shelf progress indicators
  const taskCounts: Record<number, { total: number; done: number }> = {};
  for (let i = 0; i <= 6; i++) {
    const dayDate = format(addDays(weekStart, i), "yyyy-MM-dd");
    const dayTasksForCount = tasks.filter((t) => {
      if (!t.dueDate) return false;
      return t.dueDate.slice(0, 10) === dayDate;
    });
    taskCounts[i] = {
      total: dayTasksForCount.length,
      done: dayTasksForCount.filter((t) => t.status === "done").length,
    };
  }

  const updateTaskStatus = async (task: Task, newStatus: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch {
      toast.error("Failed to update task");
    }
  };

  const updateTaskPriority = async (task: Task, priority: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, priority }),
      });
      if (!res.ok) throw new Error();
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, priority } : t));
    } catch {
      toast.error("Failed to update priority");
    }
  };

  const handleDrop = (taskId: string, newStatus: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== newStatus) {
      updateTaskStatus(task, newStatus);
    }
  };

  const quickAddTask = async (status: string) => {
    if (!newTaskTitle.trim()) return;
    const dueDate = format(selectedDate, "yyyy-MM-dd");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle,
          dueDate,
          priority: "medium",
        }),
      });
      if (!res.ok) throw new Error();
      const task = await res.json();
      if (status !== "todo") {
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: task.id, status }),
        });
        task.status = status;
      }
      const newTask = {
        ...task,
        dueDate: task.dueDate || dueDate + "T00:00:00.000Z",
        createdAt: task.createdAt || new Date().toISOString(),
        status: task.status || status,
      };
      setTasks((prev) => [...prev, newTask]);
      setNewTaskTitle("");
      setAddingTo(null);
      toast.success("Task added");
    } catch {
      toast.error("Failed to add task");
    }
  };

  const deleteTask = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/tasks?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Tape shelf skeleton */}
        <div className="flex items-end justify-center gap-2 h-64 px-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted/50 animate-pulse rounded-sm"
              style={{ width: i === 0 ? 80 : 36, height: `${180 + Math.random() * 40}px` }}
            />
          ))}
        </div>
        <div className="text-center space-y-2">
          <div className="h-9 w-40 mx-auto rounded-lg bg-muted animate-pulse" />
          <div className="h-5 w-64 mx-auto rounded bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-muted/50 border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header with branding */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight uppercase text-muted-foreground" style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", letterSpacing: "0.1em" }}>
            Task Tape
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Week navigation */}
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground font-medium min-w-[100px] text-center">
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d")}
          </span>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => { setWeekOffset(0); setSelectedDay(new Date().getDay()); }}
              className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 ml-1"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Tape Shelf - Collapsible */}
      <div className="relative">
        <button
          onClick={() => setShelfExpanded(!shelfExpanded)}
          className="absolute -top-1 right-0 z-20 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={shelfExpanded ? "Collapse shelf" : "Expand shelf"}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${shelfExpanded ? "" : "-rotate-90"}`} />
        </button>

        <div className={`transition-all duration-500 overflow-hidden ${shelfExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
          <TapeShelf
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            taskCounts={taskCounts}
          />
        </div>

        {/* Compact day tabs fallback when shelf is collapsed */}
        {!shelfExpanded && (
          <div className="flex items-center justify-center gap-1.5 py-2">
            {DAY_THEMES.map((day, idx) => {
              const dayDate = addDays(weekStart, idx);
              const isActive = idx === selectedDay;
              const isCurrentDay = isToday(dayDate);
              return (
                <button
                  key={day.name}
                  onClick={() => setSelectedDay(idx)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? day.tabActive + " shadow-sm scale-105"
                      : isCurrentDay
                      ? "bg-muted ring-2 " + day.ring + " text-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Completion Bar */}
      <div className="flex items-center justify-between max-w-md mx-auto">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${theme.accent}`}
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <span className="ml-3 text-sm font-bold text-muted-foreground">
          {completionPercent}%
          <span className="text-[10px] ml-0.5 uppercase tracking-wider">complete</span>
        </span>
      </div>

      {/* Task counts summary */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {totalDayTasks} {totalDayTasks === 1 ? "task" : "tasks"} · {doneTasks.length} done
        </p>
      </div>

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-destructive">
              Overdue
            </h3>
            <span className="text-xs text-destructive/70">· {overdueTasks.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {overdueTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-background p-3"
              >
                <button
                  onClick={() => updateTaskStatus(task, "done")}
                  className="w-4 h-4 rounded-full border-2 border-destructive/40 hover:border-destructive shrink-0 transition-colors"
                  style={{ width: 18, height: 18 }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">{task.title}</p>
                  <p className="text-[10px] text-destructive/70">
                    Due {task.dueDate ? format(new Date(task.dueDate), "MMM d") : ""}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteTarget(task)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KanbanColumn
          title="TO DO"
          count={todoTasks.length}
          theme={theme}
          tasks={todoTasks}
          onStatusChange={updateTaskStatus}
          onPriorityChange={updateTaskPriority}
          onDelete={setDeleteTarget}
          onEdit={setEditTarget}
          onDrop={handleDrop}
          addingTo={addingTo}
          setAddingTo={setAddingTo}
          columnStatus="todo"
          newTaskTitle={newTaskTitle}
          setNewTaskTitle={setNewTaskTitle}
          onQuickAdd={quickAddTask}
          nextStatus="in_progress"
          prevStatus={null}
        />

        <KanbanColumn
          title="IN PROGRESS"
          count={inProgressTasks.length}
          theme={theme}
          tasks={inProgressTasks}
          onStatusChange={updateTaskStatus}
          onPriorityChange={updateTaskPriority}
          onDelete={setDeleteTarget}
          onEdit={setEditTarget}
          onDrop={handleDrop}
          addingTo={addingTo}
          setAddingTo={setAddingTo}
          columnStatus="in_progress"
          newTaskTitle={newTaskTitle}
          setNewTaskTitle={setNewTaskTitle}
          onQuickAdd={quickAddTask}
          nextStatus="done"
          prevStatus="todo"
        />

        <KanbanColumn
          title="DONE"
          count={doneTasks.length}
          theme={theme}
          tasks={doneTasks}
          onStatusChange={updateTaskStatus}
          onPriorityChange={updateTaskPriority}
          onDelete={setDeleteTarget}
          onEdit={setEditTarget}
          onDrop={handleDrop}
          addingTo={addingTo}
          setAddingTo={setAddingTo}
          columnStatus="done"
          newTaskTitle={newTaskTitle}
          setNewTaskTitle={setNewTaskTitle}
          onQuickAdd={quickAddTask}
          nextStatus={null}
          prevStatus="in_progress"
        />
      </div>

      {/* Bottom Section: Focus Timer + Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        {/* Focus Timer */}
        <div className={`rounded-2xl border p-6 bg-gradient-to-br ${theme.gradient}`}>
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Focus Session
            </h3>
          </div>

          {/* Task selector */}
          <div className="mb-4">
            <select
              value={focusTask?.id || ""}
              onChange={(e) => {
                const t = tasks.find((task) => task.id === e.target.value);
                setFocusTask(t || null);
              }}
              className="w-full h-8 text-xs border border-input rounded-lg px-2 bg-background/50 text-foreground"
            >
              <option value="">No task (free focus)</option>
              {[...todoTasks, ...inProgressTasks].map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            {focusTask && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Focusing on: <span className="font-medium text-foreground">{focusTask.title}</span>
              </p>
            )}
          </div>

          <div className="text-center">
            <div className="text-4xl font-mono font-bold mb-4">
              {formatTimer(focusTime - focusElapsed)}
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (!focusRunning && focusTask && focusTask.status === "todo") {
                    updateTaskStatus(focusTask, "in_progress");
                  }
                  setFocusRunning(!focusRunning);
                }}
                className={theme.accent + " hover:opacity-90 text-white"}
              >
                {focusRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                {focusRunning ? "Pause" : "Start"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (focusElapsed > 60 && focusTask) {
                    const hoursSpent = Math.round((focusElapsed / 3600) * 10) / 10;
                    const currentHours = focusTask.hours || 0;
                    fetch("/api/tasks", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: focusTask.id, hours: currentHours + hoursSpent }),
                    }).then(() => {
                      setTasks((prev) => prev.map((t) => t.id === focusTask.id ? { ...t, hours: currentHours + hoursSpent } : t));
                      toast.success(`Logged ${hoursSpent}h to "${focusTask.title}"`);
                    });
                  }
                  setFocusRunning(false);
                  setFocusElapsed(0);
                }}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              {[15, 25, 45, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => { setFocusTime(mins * 60); setFocusElapsed(0); setFocusRunning(false); }}
                  className={`text-xs px-2 py-1 rounded-full transition-colors ${
                    focusTime === mins * 60
                      ? theme.accentLight + " font-semibold"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
            {focusElapsed > 0 && (
              <p className="text-[10px] text-muted-foreground mt-2">
                {Math.round(focusElapsed / 60)}m focused{focusTask ? ` on "${focusTask.title}"` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Thoughts of the Day */}
        <div className={`rounded-2xl border p-6 bg-gradient-to-br ${theme.gradient}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm">✨</span>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Thoughts of the Day
            </h3>
          </div>
          <textarea
            value={dailyNote}
            onChange={(e) => saveDailyNote(e.target.value)}
            placeholder="What's on your mind today..."
            className="w-full h-24 bg-background/50 border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-offset-0 placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Full Add Task Dialog */}
      <Dialog open={showFullAdd} onOpenChange={setShowFullAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>Add a detailed task for {theme.name}</DialogDescription>
          </DialogHeader>
          <AddTaskForm
            defaultDate={format(selectedDate, "yyyy-MM-dd")}
            onSaved={() => {
              setShowFullAdd(false);
              fetchTasks();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Floating Add Button */}
      <button
        onClick={() => setShowFullAdd(true)}
        className={`fixed bottom-6 right-6 h-12 px-5 rounded-full ${theme.accent} text-white shadow-lg shadow-purple-500/20 hover:scale-110 hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-200 flex items-center justify-center gap-2 font-medium text-sm`}
      >
        <Plus className="w-5 h-5" />
        Add Task
      </button>

      {/* Edit Task Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update task details</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <EditTaskForm
              task={editTarget}
              onSaved={(updated) => {
                setTasks((prev) => prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t));
                setEditTarget(null);
              }}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete task?"
        description={`"${deleteTarget?.title}" will be permanently deleted.`}
        onConfirm={deleteTask}
      />
    </div>
  );
}

function KanbanColumn({
  title,
  count,
  theme,
  tasks,
  onStatusChange,
  onPriorityChange,
  onDelete,
  onEdit,
  onDrop,
  addingTo,
  setAddingTo,
  columnStatus,
  newTaskTitle,
  setNewTaskTitle,
  onQuickAdd,
  nextStatus,
  prevStatus,
}: {
  title: string;
  count: number;
  theme: typeof DAY_THEMES[0];
  tasks: Task[];
  onStatusChange: (task: Task, status: string) => void;
  onPriorityChange: (task: Task, priority: string) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDrop: (taskId: string, status: string) => void;
  addingTo: string | null;
  setAddingTo: (s: string | null) => void;
  columnStatus: string;
  newTaskTitle: string;
  setNewTaskTitle: (s: string) => void;
  onQuickAdd: (status: string) => void;
  nextStatus: string | null;
  prevStatus: string | null;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`w-2 h-2 rounded-full ${theme.accent}`} />
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">· {count}</span>
      </div>

      <div
        className={`flex-1 rounded-2xl border bg-card/50 backdrop-blur-sm p-3 space-y-2 min-h-[200px] transition-all duration-200 ${theme.border} ${dragOver ? "ring-2 ring-purple-500/30 bg-purple-500/5 scale-[1.01]" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const taskId = e.dataTransfer.getData("text/plain");
          if (taskId) onDrop(taskId, columnStatus);
        }}
      >
        {tasks.length === 0 && addingTo !== columnStatus && !dragOver && (
          <p className="text-xs text-muted-foreground/60 text-center py-8 italic">
            {columnStatus === "todo" ? "No items pending" : columnStatus === "in_progress" ? "Nothing in progress" : "Nothing finished yet"}
          </p>
        )}
        {dragOver && tasks.length === 0 && (
          <p className="text-xs text-primary/60 text-center py-8 italic">
            Drop here
          </p>
        )}

        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            theme={theme}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            onDelete={onDelete}
            onEdit={onEdit}
            nextStatus={nextStatus}
            prevStatus={prevStatus}
          />
        ))}

        {/* Inline Add */}
        {addingTo === columnStatus ? (
          <form
            onSubmit={(e) => { e.preventDefault(); onQuickAdd(columnStatus); }}
            className="flex gap-2"
          >
            <Input
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task name..."
              className="h-8 text-sm bg-background"
              onBlur={() => { if (!newTaskTitle) setAddingTo(null); }}
            />
            <Button size="sm" type="submit" className="h-8 px-2" disabled={!newTaskTitle.trim()}>
              <Plus className="w-3 h-3" />
            </Button>
          </form>
        ) : (
          <button
            onClick={() => { setAddingTo(columnStatus); setNewTaskTitle(""); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full px-2 py-1.5 rounded-lg hover:bg-muted/50"
          >
            <Plus className="w-3 h-3" />
            Add a task
          </button>
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  theme,
  onStatusChange,
  onDelete,
  onPriorityChange,
  onEdit,
  nextStatus,
  prevStatus,
}: {
  task: Task;
  theme: typeof DAY_THEMES[0];
  onStatusChange: (task: Task, status: string) => void;
  onDelete: (task: Task) => void;
  onPriorityChange: (task: Task, priority: string) => void;
  onEdit: (task: Task) => void;
  nextStatus: string | null;
  prevStatus: string | null;
}) {
  const isDone = task.status === "done";
  const priorities = ["low", "medium", "high", "urgent"];

  const cyclePriority = () => {
    const currentIdx = priorities.indexOf(task.priority);
    const nextIdx = (currentIdx + 1) % priorities.length;
    onPriorityChange(task, priorities[nextIdx]);
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group relative rounded-xl border border-border bg-card/80 backdrop-blur-sm p-3 transition-all duration-200 hover:bg-accent hover:border-border hover:shadow-lg hover:shadow-black/10 cursor-grab active:cursor-grabbing active:opacity-70 active:scale-[0.96] ${
        isDone ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <button
          onClick={() => {
            if (isDone && prevStatus) onStatusChange(task, prevStatus);
            else if (nextStatus) onStatusChange(task, nextStatus);
          }}
          className={`mt-0.5 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            isDone
              ? theme.accent + " border-transparent text-white"
              : "border-muted-foreground/30 hover:border-current " + theme.accentLight.split(" ")[1]
          }`}
          style={{ width: 18, height: 18 }}
        >
          {isDone && <Check className="w-2.5 h-2.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <button
            onClick={() => onEdit(task)}
            className="text-left w-full"
          >
            <p className={`text-sm font-medium leading-tight hover:underline ${isDone ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </p>
          </button>
          <div className="flex items-center gap-1.5 mt-1.5">
            <button
              onClick={cyclePriority}
              className="flex items-center gap-1 hover:opacity-70 transition-opacity"
              title={`Priority: ${task.priority} (click to change)`}
            >
              <PriorityDot priority={task.priority} />
              <span className="text-[10px] text-muted-foreground capitalize">{task.priority}</span>
            </button>
            {task.recurrence && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title={`Repeats ${task.recurrence}`}>
                <RotateCcw className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(task)}
          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function AddTaskForm({ onSaved, defaultDate }: { onSaved: () => void; defaultDate: string }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: defaultDate,
    priority: "medium",
    hours: "",
    recurrence: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          hours: form.hours ? parseFloat(form.hours) : null,
          recurrence: form.recurrence || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Task created");
      onSaved();
    } catch {
      toast.error("Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Title *</label>
        <Input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="What needs to be done?"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional details..."
          className="w-full h-20 border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Due date</label>
          {form.dueDate && (
            <button
              type="button"
              onClick={() => setForm({ ...form, dueDate: "" })}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <Input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Tasks without a date show on every day
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="w-full h-10 border rounded-md px-3 text-sm bg-background"
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Hours</label>
          <Input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
            placeholder="e.g. 2"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Repeat</label>
        <select
          value={form.recurrence}
          onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
          className="w-full h-10 border rounded-md px-3 text-sm bg-background"
        >
          <option value="">None</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={saving || !form.title}>
        {saving ? "Saving..." : "Create Task"}
      </Button>
    </form>
  );
}

function EditTaskForm({
  task,
  onSaved,
  onCancel,
}: {
  task: Task;
  onSaved: (updated: Partial<Task> & { id: string }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || "",
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
    priority: task.priority,
    hours: task.hours ? String(task.hours) : "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          title: form.title,
          description: form.description || null,
          dueDate: form.dueDate || null,
          priority: form.priority,
          hours: form.hours ? parseFloat(form.hours) : null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Task updated");
      onSaved({
        id: task.id,
        title: form.title,
        description: form.description || null,
        dueDate: form.dueDate ? form.dueDate + "T00:00:00.000Z" : null,
        hours: form.hours ? parseFloat(form.hours) : null,
        priority: form.priority,
      });
    } catch {
      toast.error("Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Title *</label>
        <Input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional details..."
          className="w-full h-20 border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Due date</label>
        <Input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="w-full h-10 border rounded-md px-3 text-sm bg-background"
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Hours</label>
          <Input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
            placeholder="e.g. 2"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving || !form.title}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
