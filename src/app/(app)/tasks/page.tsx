"use client";

import { useEffect, useState } from "react";
import { format, isPast } from "date-fns";
import { Plus, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PriorityDot } from "@/components/PriorityDot";
import { ROLES, TASK_PRIORITIES } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  role: string;
  goal: { id: string; title: string } | null;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const fetchTasks = async () => {
    const params = new URLSearchParams();
    if (filterRole) params.set("role", filterRole);
    if (filterStatus) params.set("status", filterStatus);
    try {
      const res = await fetch(`/api/tasks?${params}`);
      if (!res.ok) throw new Error("Failed to load tasks");
      const data = await res.json();
      setTasks(data.tasks || data);
    } catch (err) {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filterRole, filterStatus]);

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(newStatus === "done" ? "Task completed!" : "Task reopened");
      fetchTasks();
    } catch {
      toast.error("Failed to update task");
    }
  };

  const deleteTask = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/tasks?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Task deleted");
      fetchTasks();
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground text-sm">
            {todoTasks.length} pending, {doneTasks.length} completed
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Task</DialogTitle>
            </DialogHeader>
            <AddTaskForm
              onSaved={() => {
                setShowAdd(false);
                fetchTasks();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filterStatus === "" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterStatus("")}
        >
          All
        </Button>
        <Button
          variant={filterStatus === "todo" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterStatus("todo")}
        >
          To Do
        </Button>
        <Button
          variant={filterStatus === "done" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterStatus("done")}
        >
          Done
        </Button>
        <div className="w-px bg-border mx-1" />
        {ROLES.map((role) => (
          <Button
            key={role}
            variant={filterRole === role ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterRole(filterRole === role ? "" : role)}
          >
            {role}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No tasks yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const overdue =
              task.status === "todo" && task.dueDate && isPast(new Date(task.dueDate));
            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors ${
                  overdue ? "border-destructive/30" : ""
                }`}
              >
                <button
                  onClick={() => toggleTask(task)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    task.status === "done"
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/30 hover:border-primary"
                  }`}
                >
                  {task.status === "done" && <Check className="w-3 h-3" />}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      task.status === "done" ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {task.role}
                    </Badge>
                    {task.dueDate && (
                      <span
                        className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {format(new Date(task.dueDate), "MMM d")}
                      </span>
                    )}
                    <PriorityDot priority={task.priority} />
                  </div>
                </div>

                <button
                  onClick={() => setDeleteTarget(task)}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

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

function AddTaskForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "medium",
    role: "Student",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
          <label className="text-sm font-medium">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full h-10 border rounded-md px-3 text-sm bg-background"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={saving || !form.title}>
        {saving ? "Saving..." : "Create Task"}
      </Button>
    </form>
  );
}
