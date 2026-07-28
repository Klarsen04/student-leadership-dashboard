"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { format, startOfWeek, addDays, addWeeks, isToday, isSameWeek } from "date-fns";
import { Plus, Check, Trash2, Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
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
import { TAPES, DayTabs, CassetteDisplay } from "@/components/tasks/TapeShelf";

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

  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), weekOffset);
  const selectedDate = addDays(weekStart, selectedDay);
  const isCurrentWeek = isSameWeek(new Date(), weekStart, { weekStartsOn: 0 });
  const noteKey = `leadership-os-note-${format(selectedDate, "yyyy-MM-dd")}`;
  const tape = TAPES[selectedDay];

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
    return t.dueDate.slice(0, 10) < today;
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
        body: JSON.stringify({ title: newTaskTitle, dueDate, priority: "medium" }),
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
      setTasks((prev) => [...prev, {
        ...task,
        dueDate: task.dueDate || dueDate + "T00:00:00.000Z",
        createdAt: task.createdAt || new Date().toISOString(),
        status: task.status || status,
      }]);
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
      <div className="h-full min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">Loading your tapes...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 flex flex-col overflow-hidden transition-all duration-700"
      style={{ background: tape.gradientBg }}
    >
      {/* Header */}
      <header className="flex items-center justify-between shrink-0 mb-4 lg:mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-1.5 rounded-md hover:bg-black/5 text-foreground/50 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-foreground/50 font-medium min-w-[100px] text-center">
            {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}
          </span>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="p-1.5 rounded-md hover:bg-black/5 text-foreground/50 hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => { setWeekOffset(0); setSelectedDay(new Date().getDay()); }}
              className="text-xs px-2 py-0.5 rounded-full bg-foreground text-background hover:opacity-90 ml-1"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-foreground/70 font-serif text-xl" style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif" }}>
            Task Tape
          </span>
        </div>
      </header>

      {/* Main two-panel layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(300px,0.85fr)_minmax(400px,1.1fr)] gap-6 lg:gap-10">
        {/* Left panel: Cassette + Focus */}
        <section className="flex flex-col gap-4 order-1 lg:order-none">
          {/* Cassette display */}
          <div className="flex-1 min-h-[250px] lg:min-h-[350px] relative">
            <CassetteDisplay selectedDay={selectedDay} />
          </div>

          {/* Focus Session Button */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            {focusRunning ? (
              <div className="flex flex-col items-center gap-2">
                <div className="text-3xl font-mono font-bold text-foreground">
                  {formatTimer(focusTime - focusElapsed)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFocusRunning(false)}
                    className="h-12 flex items-center gap-2.5 px-7 rounded-full bg-foreground text-background font-medium shadow-lg hover:opacity-90 transition-opacity"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                  <button
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
                    className="h-12 w-12 flex items-center justify-center rounded-full border border-black/10 hover:bg-black/5 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                {focusTask && (
                  <p className="text-xs text-foreground/40">
                    Focusing on: {focusTask.title}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5">
                <button
                  onClick={() => {
                    if (focusTask && focusTask.status === "todo") {
                      updateTaskStatus(focusTask, "in_progress");
                    }
                    setFocusRunning(true);
                  }}
                  className="h-13 flex items-center gap-2.5 py-3.5 px-7 rounded-full bg-foreground text-background font-medium shadow-lg hover:opacity-90 transition-opacity"
                >
                  <Play className="w-4 h-4" />
                  Start Focus Session
                </button>
                <p className="text-xs text-foreground/35">
                  or press play on any task to begin
                </p>
                {/* Timer presets */}
                <div className="flex items-center gap-1.5">
                  {[15, 25, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => { setFocusTime(mins * 60); setFocusElapsed(0); }}
                      className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                        focusTime === mins * 60
                          ? "bg-foreground/10 text-foreground font-semibold"
                          : "text-foreground/40 hover:text-foreground/60"
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
                {/* Focus task selector */}
                <select
                  value={focusTask?.id || ""}
                  onChange={(e) => setFocusTask(tasks.find((t) => t.id === e.target.value) || null)}
                  className="text-xs text-foreground/50 bg-transparent border-0 focus:outline-none cursor-pointer text-center"
                >
                  <option value="">No task selected</option>
                  {[...todoTasks, ...inProgressTasks].map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* Right panel: Day tabs + Kanban + Notes */}
        <section className="flex flex-col order-2 lg:order-none min-w-0">
          {/* Day tabs */}
          <DayTabs selectedDay={selectedDay} onSelectDay={setSelectedDay} />

          {/* Day header with stats */}
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2
                className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground"
                style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif" }}
              >
                {tape.day}
              </h2>
              <p className="mt-1 text-sm text-foreground/40">
                {totalDayTasks} {totalDayTasks === 1 ? "task" : "tasks"} · {doneTasks.length} done
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-foreground">{completionPercent}%</p>
              <p className="text-xs text-foreground/40 uppercase tracking-wider">Complete</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-black/5 mb-5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${completionPercent}%`, backgroundColor: tape.accent }}
            />
          </div>

          {/* Overdue */}
          {overdueTasks.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-red-600">Overdue</span>
                <span className="text-xs text-red-400">· {overdueTasks.length}</span>
              </div>
              <div className="space-y-1">
                {overdueTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-lg bg-white/60 p-2">
                    <button
                      onClick={() => updateTaskStatus(task, "done")}
                      className="w-5 h-5 rounded-full border-2 border-red-300 hover:border-red-500 shrink-0 transition-colors"
                    />
                    <span className="text-sm text-foreground/80 truncate flex-1">{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kanban columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
            <KanbanColumn
              title="To Do"
              count={todoTasks.length}
              accent={tape.accent}
              dotColor="bg-foreground/60"
              tasks={todoTasks}
              onStatusChange={updateTaskStatus}
              onPriorityChange={updateTaskPriority}
              onDelete={setDeleteTarget}
              onEdit={setEditTarget}
              onDrop={handleDrop}
              onStartFocus={(task) => { setFocusTask(task); setFocusRunning(true); if (task.status === "todo") updateTaskStatus(task, "in_progress"); }}
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
              title="In Progress"
              count={inProgressTasks.length}
              accent={tape.accent}
              dotColor="bg-amber-500"
              tasks={inProgressTasks}
              onStatusChange={updateTaskStatus}
              onPriorityChange={updateTaskPriority}
              onDelete={setDeleteTarget}
              onEdit={setEditTarget}
              onDrop={handleDrop}
              onStartFocus={(task) => { setFocusTask(task); setFocusRunning(true); }}
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
              title="Done"
              count={doneTasks.length}
              accent={tape.accent}
              dotColor="bg-green-500"
              tasks={doneTasks}
              onStatusChange={updateTaskStatus}
              onPriorityChange={updateTaskPriority}
              onDelete={setDeleteTarget}
              onEdit={setEditTarget}
              onDrop={handleDrop}
              onStartFocus={() => {}}
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

          {/* Thoughts of the Day */}
          <div className="mt-4 p-5 rounded-3xl bg-white/60 border border-black/5 shadow-sm relative">
            <label className="text-[11px] font-semibold text-foreground/35 uppercase tracking-wider">
              Thoughts of the Day
            </label>
            <textarea
              value={dailyNote}
              onChange={(e) => saveDailyNote(e.target.value)}
              placeholder="What made today feel like today..."
              className="w-full mt-2 bg-transparent text-sm text-foreground/80 leading-relaxed resize-none focus:outline-none min-h-[80px] placeholder:text-foreground/25"
            />
          </div>
        </section>
      </main>

      {/* Full Add Task Dialog */}
      <Dialog open={showFullAdd} onOpenChange={setShowFullAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>Add a detailed task for {tape.day}</DialogDescription>
          </DialogHeader>
          <AddTaskForm
            defaultDate={format(selectedDate, "yyyy-MM-dd")}
            onSaved={() => { setShowFullAdd(false); fetchTasks(); }}
          />
        </DialogContent>
      </Dialog>

      {/* Floating Add Button */}
      <button
        onClick={() => setShowFullAdd(true)}
        className="fixed bottom-6 right-6 h-12 px-5 rounded-full bg-foreground text-background shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 font-medium text-sm z-50"
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
  accent,
  dotColor,
  tasks,
  onStatusChange,
  onPriorityChange,
  onDelete,
  onEdit,
  onDrop,
  onStartFocus,
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
  accent: string;
  dotColor: string;
  tasks: Task[];
  onStatusChange: (task: Task, status: string) => void;
  onPriorityChange: (task: Task, priority: string) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDrop: (taskId: string, status: string) => void;
  onStartFocus: (task: Task) => void;
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
      {/* Column header */}
      <div className="flex items-center justify-between pb-2.5 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className="text-xs font-semibold text-foreground/55 uppercase tracking-wider">{title}</span>
        </div>
        <span className="min-w-[22px] py-0.5 px-2 rounded-full text-[11px] font-semibold text-foreground/40 text-center bg-black/5">
          {count}
        </span>
      </div>

      {/* Column body */}
      <div
        className={`flex-1 p-2.5 rounded-2xl border bg-black/[0.03] flex flex-col min-h-[200px] transition-all ${
          dragOver ? "ring-2 ring-black/10 bg-black/[0.06] scale-[1.01]" : "border-black/5"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const taskId = e.dataTransfer.getData("text/plain");
          if (taskId) onDrop(taskId, columnStatus);
        }}
      >
        <div className="flex-1 overflow-auto pr-0.5 space-y-2">
          {tasks.length === 0 && !dragOver && addingTo !== columnStatus && (
            <p className="text-[11px] text-foreground/25 text-center py-6">
              {columnStatus === "todo" ? "No tasks yet" : columnStatus === "in_progress" ? "No tape playing" : "Nothing finished yet"}
            </p>
          )}

          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              accent={accent}
              onStatusChange={onStatusChange}
              onPriorityChange={onPriorityChange}
              onDelete={onDelete}
              onEdit={onEdit}
              onStartFocus={onStartFocus}
              nextStatus={nextStatus}
              prevStatus={prevStatus}
            />
          ))}
        </div>

        {/* Add task button */}
        {addingTo === columnStatus ? (
          <form onSubmit={(e) => { e.preventDefault(); onQuickAdd(columnStatus); }} className="flex gap-2 mt-2">
            <Input
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task name..."
              className="h-8 text-sm bg-white/80 border-black/10"
              onBlur={() => { if (!newTaskTitle) setAddingTo(null); }}
            />
            <Button size="sm" type="submit" className="h-8 px-2" disabled={!newTaskTitle.trim()}>
              <Plus className="w-3 h-3" />
            </Button>
          </form>
        ) : (
          <button
            onClick={() => { setAddingTo(columnStatus); setNewTaskTitle(""); }}
            className="h-10 mt-2 border-2 border-dashed border-black/10 flex rounded-xl justify-center items-center gap-2 text-foreground/40 text-xs font-medium hover:bg-black/[0.03] hover:border-black/15 hover:text-foreground/60 transition-all w-full"
          >
            <Plus className="w-3.5 h-3.5" />
            Add a task
          </button>
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  accent,
  onStatusChange,
  onDelete,
  onPriorityChange,
  onEdit,
  onStartFocus,
  nextStatus,
  prevStatus,
}: {
  task: Task;
  accent: string;
  onStatusChange: (task: Task, status: string) => void;
  onDelete: (task: Task) => void;
  onPriorityChange: (task: Task, priority: string) => void;
  onEdit: (task: Task) => void;
  onStartFocus: (task: Task) => void;
  nextStatus: string | null;
  prevStatus: string | null;
}) {
  const isDone = task.status === "done";
  const priorities = ["low", "medium", "high", "urgent"];

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group relative p-3 rounded-xl bg-white/80 border border-black/5 shadow-sm transition-all duration-200 hover:shadow-md hover:bg-white cursor-grab active:cursor-grabbing active:scale-[0.97] ${
        isDone ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={() => {
            if (isDone && prevStatus) onStatusChange(task, prevStatus);
            else if (nextStatus) onStatusChange(task, nextStatus);
          }}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            isDone
              ? "border-transparent text-white"
              : "border-black/25 hover:border-black/50"
          }`}
          style={isDone ? { backgroundColor: accent } : undefined}
        >
          {isDone && <Check className="w-3 h-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => onEdit(task)} className="text-left w-full">
            <p className={`text-sm font-medium leading-tight line-clamp-2 ${isDone ? "line-through text-foreground/40" : "text-foreground"}`}>
              {task.title}
            </p>
          </button>
          <div className="flex items-center justify-between mt-2.5 pl-0">
            <div className="flex items-center gap-1.5">
              {task.hours && (
                <span className="text-[11px] text-foreground/35">{task.hours * 60} min</span>
              )}
              {task.recurrence && (
                <RotateCcw className="w-3 h-3 text-foreground/30" />
              )}
              <button
                onClick={() => {
                  const idx = priorities.indexOf(task.priority);
                  onPriorityChange(task, priorities[(idx + 1) % priorities.length]);
                }}
                className="hover:opacity-70"
              >
                <PriorityDot priority={task.priority} />
              </button>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!isDone && (
                <button
                  onClick={() => onStartFocus(task)}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
                  title="Start focus session"
                >
                  <Play className="w-3.5 h-3.5 text-foreground/50" />
                </button>
              )}
              <button
                onClick={() => onDelete(task)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-black/5 text-foreground/40 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
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
        <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" />
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
            <button type="button" onClick={() => setForm({ ...form, dueDate: "" })} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          )}
        </div>
        <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Priority</label>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full h-10 border rounded-md px-3 text-sm bg-background">
            {TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Hours</label>
          <Input type="number" step="0.5" min="0" max="24" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="e.g. 2" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Repeat</label>
        <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })} className="w-full h-10 border rounded-md px-3 text-sm bg-background">
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

function EditTaskForm({ task, onSaved, onCancel }: { task: Task; onSaved: (updated: Partial<Task> & { id: string }) => void; onCancel: () => void }) {
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
        <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details..." className="w-full h-20 border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div>
        <label className="text-sm font-medium">Due date</label>
        <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Priority</label>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full h-10 border rounded-md px-3 text-sm bg-background">
            {TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Hours</label>
          <Input type="number" step="0.5" min="0" max="24" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="e.g. 2" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving || !form.title}>{saving ? "Saving..." : "Save Changes"}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
