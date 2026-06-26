"use client";

import { useEffect, useState } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { BookOpen, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Reflection {
  id: string;
  type: string;
  date: string;
  content: string;
  mood: number | null;
  energy: number | null;
  gratitude: string | null;
}

const PROMPTS: Record<string, string[]> = {
  daily: [
    "What went well today?",
    "What challenged me?",
    "Who did I invest in?",
    "What am I grateful for?",
  ],
  weekly: [
    "Did my time reflect my priorities?",
    "What went well this week?",
    "What could be better next week?",
    "What are my top priorities next week?",
  ],
  monthly: [
    "Major accomplishments this month?",
    "Growth areas?",
    "What do I want to focus on next month?",
    "What am I most proud of?",
  ],
};

function formatReflectionDate(type: string, dateStr: string): string {
  const date = new Date(dateStr);
  if (type === "daily") {
    return format(date, "EEEE, MMM d");
  } else if (type === "weekly") {
    const ws = startOfWeek(date, { weekStartsOn: 0 });
    const we = endOfWeek(date, { weekStartsOn: 0 });
    return `Week of ${format(ws, "MMM d")} – ${format(we, "MMM d")}`;
  } else {
    return format(date, "MMMM yyyy");
  }
}

function groupByMonth(reflections: Reflection[]): { month: string; items: Reflection[] }[] {
  const groups: Record<string, Reflection[]> = {};
  for (const ref of reflections) {
    const dateStr = ref.date.slice(0, 7);
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(ref);
  }
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      const [year, month] = key.split("-");
      return {
        month: `${monthNames[parseInt(month) - 1]} ${year}`,
        items,
      };
    });
}

export default function ReflectionsPage() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Reflection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reflection | null>(null);
  const [filterType, setFilterType] = useState("");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const fetchReflections = async () => {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    try {
      const res = await fetch(`/api/reflections?${params}`);
      if (res.ok) setReflections(await res.json());
    } catch {
      toast.error("Failed to load reflections");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReflections();
  }, [filterType]);

  const grouped = groupByMonth(reflections);

  useEffect(() => {
    if (grouped.length > 0 && expandedMonths.size === 0) {
      setExpandedMonths(new Set([grouped[0].month]));
    }
  }, [grouped.length]);

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const deleteReflection = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/reflections?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setReflections((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success("Reflection deleted");
    } catch {
      toast.error("Failed to delete reflection");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reflections</h1>
          <p className="text-muted-foreground text-sm">
            {reflections.length} reflection{reflections.length !== 1 ? "s" : ""} logged
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Reflect
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Reflection</DialogTitle>
              <DialogDescription>Take a moment to pause and reflect</DialogDescription>
            </DialogHeader>
            <ReflectionForm
              onSaved={() => {
                setShowAdd(false);
                fetchReflections();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { value: "", label: "All" },
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
        ].map((item) => (
          <Button
            key={item.value}
            variant={filterType === item.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : reflections.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          No reflections yet. Take a moment to pause.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ month, items }) => {
            const isExpanded = expandedMonths.has(month);
            return (
              <div key={month}>
                <button
                  onClick={() => toggleMonth(month)}
                  className="flex items-center gap-2 w-full text-left px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-semibold text-sm">{month}</span>
                  <span className="text-xs text-muted-foreground">
                    ({items.length})
                  </span>
                </button>

                {isExpanded && (
                  <div className="space-y-3 mt-2 ml-6">
                    {items.map((ref) => (
                      <Card key={ref.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  ref.type === "daily"
                                    ? "info"
                                    : ref.type === "weekly"
                                    ? "purple"
                                    : "success"
                                }
                              >
                                {ref.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatReflectionDate(ref.type, ref.date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {ref.mood && (
                                <span className="text-[10px] text-muted-foreground mr-2">
                                  Mood {ref.mood}/10
                                </span>
                              )}
                              <button
                                onClick={() => setEditTarget(ref)}
                                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(ref)}
                                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap line-clamp-3">{ref.content}</p>
                          {ref.gratitude && (
                            <p className="mt-2 text-xs text-muted-foreground italic">
                              Grateful for: {ref.gratitude}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Reflection</DialogTitle>
            <DialogDescription>Update your reflection</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <ReflectionForm
              reflection={editTarget}
              onSaved={() => {
                setEditTarget(null);
                fetchReflections();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete reflection?"
        description="This reflection will be permanently deleted."
        onConfirm={deleteReflection}
      />
    </div>
  );
}

function ReflectionForm({ reflection, onSaved }: { reflection?: Reflection; onSaved: () => void }) {
  const [form, setForm] = useState({
    type: reflection?.type || "daily",
    content: reflection?.content || "",
    mood: reflection?.mood || 5,
    energy: reflection?.energy || 5,
    gratitude: reflection?.gratitude || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (reflection) {
        const res = await fetch("/api/reflections", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: reflection.id, ...form }),
        });
        if (!res.ok) throw new Error();
        toast.success("Reflection updated");
      } else {
        const res = await fetch("/api/reflections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        toast.success("Reflection saved");
      }
      onSaved();
    } catch {
      toast.error("Failed to save reflection");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!reflection && (
        <div className="flex gap-2">
          {(["daily", "weekly", "monthly"] as const).map((type) => (
            <Button
              key={type}
              type="button"
              variant={form.type === type ? "default" : "outline"}
              size="sm"
              onClick={() => setForm({ ...form, type })}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>
      )}

      <div className="bg-accent/50 rounded-lg p-3">
        <p className="text-xs font-medium mb-1">Consider:</p>
        <ul className="space-y-0.5">
          {PROMPTS[form.type]?.map((p) => (
            <li key={p} className="text-xs text-muted-foreground">{p}</li>
          ))}
        </ul>
      </div>

      <Textarea
        required
        value={form.content}
        onChange={(e) => setForm({ ...form, content: e.target.value })}
        placeholder="Write your reflection..."
        className="min-h-[120px]"
      />

      {/* Wellness Check-in */}
      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wellness Check-in</p>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">Energy</label>
              <span className="text-xs text-primary font-bold">{form.energy}/10</span>
            </div>
            <input
              type="range" min="1" max="10" value={form.energy}
              onChange={(e) => setForm({ ...form, energy: parseInt(e.target.value) })}
              className="w-full h-1.5 accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Drained</span><span>Energized</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">Mood</label>
              <span className="text-xs text-primary font-bold">{form.mood}/10</span>
            </div>
            <input
              type="range" min="1" max="10" value={form.mood}
              onChange={(e) => setForm({ ...form, mood: parseInt(e.target.value) })}
              className="w-full h-1.5 accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Low</span><span>Great</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Gratitude</label>
        <Input
          value={form.gratitude}
          onChange={(e) => setForm({ ...form, gratitude: e.target.value })}
          placeholder="One thing I'm grateful for..."
        />
      </div>

      <Button type="submit" className="w-full" disabled={saving || !form.content}>
        {saving ? "Saving..." : reflection ? "Save Changes" : "Save Reflection"}
      </Button>
    </form>
  );
}
