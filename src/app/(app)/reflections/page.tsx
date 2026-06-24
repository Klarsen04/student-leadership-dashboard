"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { BookOpen, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
    "Which role received too much attention?",
    "Which role received too little?",
    "What are my top priorities next week?",
  ],
  monthly: [
    "Major accomplishments this month?",
    "Growth areas?",
    "Relationship health?",
    "Leadership impact?",
  ],
};

export default function ReflectionsPage() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterType, setFilterType] = useState("");

  const fetchReflections = async () => {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    const res = await fetch(`/api/reflections?${params}`);
    if (res.ok) setReflections(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchReflections();
  }, [filterType]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reflections</h1>
          <p className="text-muted-foreground text-sm">
            Pause, reflect, grow intentionally
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
        <div className="space-y-4">
          {reflections.map((ref) => (
            <Card key={ref.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
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
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(ref.date), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {ref.mood && <span>Mood: {ref.mood}/10</span>}
                    {ref.energy && <span>Energy: {ref.energy}/10</span>}
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{ref.content}</p>
                {ref.gratitude && (
                  <p className="mt-3 text-sm text-muted-foreground italic border-t pt-3">
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
}

function ReflectionForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    type: "daily" as string,
    content: "",
    mood: 5,
    energy: 5,
    gratitude: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/reflections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) onSaved();
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        className="min-h-[150px]"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Mood ({form.mood}/10)</label>
          <input
            type="range"
            min="1"
            max="10"
            value={form.mood}
            onChange={(e) => setForm({ ...form, mood: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Energy ({form.energy}/10)</label>
          <input
            type="range"
            min="1"
            max="10"
            value={form.energy}
            onChange={(e) => setForm({ ...form, energy: parseInt(e.target.value) })}
            className="w-full"
          />
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
        {saving ? "Saving..." : "Save Reflection"}
      </Button>
    </form>
  );
}
