"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Plus, Target, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { GOAL_CATEGORIES } from "@/lib/utils";

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

  const fetchGoals = async () => {
    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    const res = await fetch(`/api/goals?${params}`);
    if (res.ok) setGoals(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchGoals();
  }, [filterCategory]);

  const updateProgress = async (id: string, progress: number) => {
    await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, progress }),
    });
    fetchGoals();
  };

  const deleteGoal = async (id: string) => {
    await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    fetchGoals();
  };

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
            </DialogHeader>
            <AddGoalForm
              onSaved={() => {
                setShowAdd(false);
                fetchGoals();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filterCategory === "" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterCategory("")}
        >
          All
        </Button>
        {GOAL_CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={filterCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
          >
            {cat}
          </Button>
        ))}
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
          {goals.map((goal) => (
            <Card key={goal.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{goal.title}</h3>
                    <Badge variant="secondary" className="mt-1">
                      {goal.category}
                    </Badge>
                  </div>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {goal.description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {goal.description}
                  </p>
                )}

                {goal.targetDate && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Target: {format(new Date(goal.targetDate), "MMM d, yyyy")}
                  </p>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{goal.progress}%</span>
                    {goal.status === "active" && (
                      <div className="flex gap-1">
                        {[0, 25, 50, 75, 100].map((val) => (
                          <button
                            key={val}
                            onClick={() => updateProgress(goal.id, val)}
                            className={`w-6 h-6 rounded text-xs border transition-colors ${
                              goal.progress >= val
                                ? "bg-primary text-primary-foreground border-primary"
                                : "hover:bg-accent border-input"
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Progress value={goal.progress} />
                </div>

                {goal.tasks.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-1">
                      Related tasks: {goal.tasks.filter((t) => t.status === "done").length}/
                      {goal.tasks.length}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddGoalForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Academic",
    targetDate: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) onSaved();
    setSaving(false);
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
            className="w-full h-10 border rounded-md px-3 text-sm"
          >
            {GOAL_CATEGORIES.map((c) => (
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
      <Button type="submit" className="w-full" disabled={saving || !form.title}>
        {saving ? "Saving..." : "Create Goal"}
      </Button>
    </form>
  );
}
