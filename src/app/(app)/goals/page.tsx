"use client";

import { useEffect, useState } from "react";
import { format, isPast } from "date-fns";
import { Plus, Target, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useGoalCategories } from "@/lib/useGoalCategories";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  targetDate: string | null;
  progress: number;
  status: string;
  tasks: { id: string; title: string; status: string }[];
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [editTarget, setEditTarget] = useState<Goal | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const { categories, addCategory, deleteCategory } = useGoalCategories();

  const fetchGoals = async () => {
    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    try {
      const res = await fetch(`/api/goals?${params}`);
      if (!res.ok) throw new Error();
      setGoals(await res.json());
    } catch {
      toast.error("Failed to load goals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [filterCategory]);

  const updateProgress = async (id: string, progress: number) => {
    try {
      const status = progress === 100 ? "completed" : "active";
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, progress, status }),
      });
      if (!res.ok) throw new Error();
      setGoals((prev) => prev.map((g) => g.id === id ? { ...g, progress, status } : g));
      if (progress === 100) toast.success("Goal completed!");
    } catch {
      toast.error("Failed to update progress");
    }
  };

  const deleteGoal = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/goals?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Goal deleted");
      setGoals((prev) => prev.filter((g) => g.id !== deleteTarget.id));
    } catch {
      toast.error("Failed to delete goal");
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const success = addCategory(newCategoryName.trim());
    if (success) {
      toast.success(`Added "${newCategoryName.trim()}" category`);
      setNewCategoryName("");
      setShowAddCategory(false);
    } else {
      toast.error("Category already exists");
    }
  };

  const goalsInCategory = (cat: string) => goals.filter((g) => g.category === cat);

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const goalsToDelete = goalsInCategory(categoryToDelete);
    for (const goal of goalsToDelete) {
      try {
        await fetch(`/api/goals?id=${goal.id}`, { method: "DELETE" });
      } catch {}
    }
    deleteCategory(categoryToDelete);
    setGoals((prev) => prev.filter((g) => g.category !== categoryToDelete));
    if (filterCategory === categoryToDelete) setFilterCategory("");
    toast.success(`Deleted "${categoryToDelete}" and ${goalsToDelete.length} goal${goalsToDelete.length !== 1 ? "s" : ""}`);
    setCategoryToDelete(null);
  };

  const allCategories = Array.from(new Set([
    ...categories,
    ...goals.map((g) => g.category).filter(Boolean),
  ]));

  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Goals</h1>
          <p className="text-muted-foreground text-sm">
            {activeGoals.length} active, {completedGoals.length} completed
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Goal</DialogTitle>
              <DialogDescription>Set a new goal to track</DialogDescription>
            </DialogHeader>
            <GoalForm
              categories={categories}
              onSaved={() => { setShowAdd(false); fetchGoals(); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button
          variant={filterCategory === "" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterCategory("")}
        >
          All
        </Button>
        {allCategories.map((cat) => (
          <div key={cat} className="group relative">
            <Button
              variant={filterCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
            >
              {cat}
            </Button>
            <button
              onClick={(e) => { e.stopPropagation(); setCategoryToDelete(cat); }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive/80 text-white items-center justify-center text-[8px] hidden group-hover:flex hover:bg-destructive transition-colors"
            >
              <span className="text-[10px]">×</span>
            </button>
          </div>
        ))}
        {showAddCategory ? (
          <form onSubmit={(e) => { e.preventDefault(); handleAddCategory(); }} className="flex items-center gap-1">
            <input
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name..."
              className="h-8 w-28 px-2 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              onBlur={() => { if (!newCategoryName) setShowAddCategory(false); }}
            />
            <Button type="submit" size="sm" className="h-8" disabled={!newCategoryName.trim()}>
              <Plus className="w-3 h-3" />
            </Button>
          </form>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setShowAddCategory(true)} className="text-muted-foreground">
            <Plus className="w-3 h-3 mr-1" />
            Category
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          No goals yet. Set a goal to stay focused.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const isOverdue = goal.status === "active" && goal.targetDate && isPast(new Date(goal.targetDate));
            return (
              <Card key={goal.id} className={isOverdue ? "border-destructive/40" : ""}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{goal.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">{goal.category}</Badge>
                        {goal.status === "completed" && (
                          <Badge variant="default" className="bg-green-600">Done</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditTarget(goal)}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(goal)}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {goal.description && (
                    <p className="text-sm text-muted-foreground mb-3">{goal.description}</p>
                  )}

                  {goal.targetDate && (
                    <div className={`flex items-center gap-1.5 text-xs mb-3 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                      {isOverdue && <AlertTriangle className="w-3 h-3" />}
                      <span>
                        {isOverdue ? "Overdue — was due " : "Target: "}
                        {format(new Date(goal.targetDate), "MMM d, yyyy")}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{goal.progress}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={goal.progress}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, progress: val } : g));
                        }}
                        onPointerUp={(e) => updateProgress(goal.id, parseInt((e.target as HTMLInputElement).value))}
                        className="w-32 h-2 accent-primary cursor-pointer"
                      />
                    </div>
                    <Progress value={goal.progress} />
                  </div>

                  {goal.tasks.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Related tasks: {goal.tasks.filter((t) => t.status === "done").length}/{goal.tasks.length}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Goal Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
            <DialogDescription>Update goal details</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <GoalForm
              categories={categories}
              goal={editTarget}
              onSaved={() => { setEditTarget(null); fetchGoals(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete goal?"
        description={`"${deleteTarget?.title}" and its progress will be permanently deleted.`}
        onConfirm={deleteGoal}
      />

      <ConfirmDialog
        open={!!categoryToDelete}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
        title={`Delete "${categoryToDelete}" category?`}
        description={
          categoryToDelete && goalsInCategory(categoryToDelete).length > 0
            ? `This will permanently delete ${goalsInCategory(categoryToDelete).length} goal${goalsInCategory(categoryToDelete).length !== 1 ? "s" : ""} in this category. This cannot be undone.`
            : "No goals in this category. Safe to delete."
        }
        onConfirm={confirmDeleteCategory}
      />
    </div>
  );
}

function GoalForm({ categories, goal, onSaved }: { categories: string[]; goal?: Goal; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: goal?.title || "",
    description: goal?.description || "",
    category: goal?.category || categories[0] || "Personal",
    targetDate: goal?.targetDate ? goal.targetDate.slice(0, 10) : "",
    progress: goal?.progress ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (goal) {
        const res = await fetch("/api/goals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: goal.id,
            title: form.title,
            description: form.description || null,
            category: form.category,
            targetDate: form.targetDate || null,
            progress: form.progress,
            status: form.progress === 100 ? "completed" : "active",
          }),
        });
        if (!res.ok) throw new Error();
        toast.success("Goal updated");
      } else {
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        toast.success("Goal created");
      }
      onSaved();
    } catch {
      toast.error(goal ? "Failed to update goal" : "Failed to create goal");
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
          placeholder="What's your goal?"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Why does this matter?"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full h-10 border rounded-md px-3 text-sm bg-background"
          >
            {Array.from(new Set([...categories, ...(goal?.category ? [goal.category] : [])])).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Target date</label>
          <Input
            type="date"
            value={form.targetDate}
            onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
          />
        </div>
      </div>
      {goal && (
        <div>
          <label className="text-sm font-medium">Progress: {form.progress}%</label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={form.progress}
            onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) })}
            className="w-full h-2 accent-primary cursor-pointer mt-1"
          />
        </div>
      )}
      <Button type="submit" className="w-full" disabled={saving || !form.title}>
        {saving ? "Saving..." : goal ? "Save Changes" : "Create Goal"}
      </Button>
    </form>
  );
}
