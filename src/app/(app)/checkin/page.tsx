"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Heart, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CheckIn {
  id: string;
  date: string;
  energy: number;
  stress: number;
  mood: number;
  sleep: number | null;
  notes: string | null;
}

export default function CheckInPage() {
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [form, setForm] = useState({
    energy: 5,
    stress: 5,
    mood: 5,
    sleep: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/checkins?days=14")
      .then((r) => r.json())
      .then(setHistory);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        sleep: form.sleep ? parseFloat(form.sleep) : null,
      }),
    });
    if (res.ok) {
      setSaved(true);
      const updated = await fetch("/api/checkins?days=14").then((r) => r.json());
      setHistory(updated);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Daily Check-in</h1>
        <p className="text-muted-foreground text-sm">
          {format(new Date(), "EEEE, MMMM d")} — How are you doing?
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            Today&apos;s Check-in
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <SliderField
              label="Energy"
              value={form.energy}
              onChange={(v) => setForm({ ...form, energy: v })}
              low="Drained"
              high="Energized"
            />
            <SliderField
              label="Stress"
              value={form.stress}
              onChange={(v) => setForm({ ...form, stress: v })}
              low="Calm"
              high="Overwhelmed"
            />
            <SliderField
              label="Mood"
              value={form.mood}
              onChange={(v) => setForm({ ...form, mood: v })}
              low="Low"
              high="Great"
            />

            <div>
              <label className="text-sm font-medium">Hours of sleep</label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="16"
                value={form.sleep}
                onChange={(e) => setForm({ ...form, sleep: e.target.value })}
                placeholder="7.5"
                className="w-32"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anything on your mind?"
              />
            </div>

            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : saved ? "Saved!" : "Save Check-in"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((c) => (
                <div key={c.id} className="flex items-center gap-4 p-3 rounded-lg border">
                  <div className="text-sm text-muted-foreground w-16">
                    {format(new Date(c.date), "MMM d")}
                  </div>
                  <div className="flex-1 flex items-center gap-4">
                    <Metric label="Energy" value={c.energy} />
                    <Metric label="Stress" value={c.stress} />
                    <Metric label="Mood" value={c.mood} />
                    {c.sleep && <Metric label="Sleep" value={c.sleep} suffix="h" />}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  low: string;
  high: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-bold text-primary">{value}/10</span>
      </div>
      <input
        type="range"
        min="1"
        max="10"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold">
        {value}
        {suffix}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
