"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { BookOpen, Plus, Sun, Moon, Calendar } from "lucide-react";

interface Reflection {
  id: string;
  type: string;
  date: string;
  content: string;
  mood: number | null;
  energy: number | null;
  gratitude: string | null;
}

export default function ReflectionsPage() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [form, setForm] = useState({
    type: "daily",
    content: "",
    mood: 3,
    energy: 3,
    gratitude: "",
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/reflections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ type: "daily", content: "", mood: 3, energy: 3, gratitude: "" });
    fetchReflections();
  };

  const prompts: Record<string, string[]> = {
    daily: [
      "What went well today?",
      "Who did I invest in today?",
      "What drained me? What energized me?",
      "One thing I'm grateful for:",
    ],
    weekly: [
      "What were my biggest wins this week?",
      "Where did I see God at work?",
      "What relationships grew deeper?",
      "What do I need to let go of next week?",
    ],
    monthly: [
      "How have I grown as a leader this month?",
      "What patterns do I notice in my schedule?",
      "Am I living aligned with my values?",
      "What goals do I want to set for next month?",
    ],
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reflections</h1>
          <p className="text-gray-600 mt-1">
            Pause, reflect, and grow intentionally
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Reflection
        </button>
      </div>

      {/* New Reflection Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              {(["daily", "weekly", "monthly"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, type })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.type === type
                      ? "bg-primary-100 text-primary-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* Prompts */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Prompts to consider:
              </p>
              <ul className="space-y-1">
                {prompts[form.type]?.map((prompt) => (
                  <li key={prompt} className="text-sm text-gray-600">
                    {prompt}
                  </li>
                ))}
              </ul>
            </div>

            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 h-40 resize-none"
              placeholder="Write your reflection..."
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mood (1-5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={form.mood}
                  onChange={(e) =>
                    setForm({ ...form, mood: parseInt(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Low</span>
                  <span>{form.mood}/5</span>
                  <span>Great</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Energy (1-5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={form.energy}
                  onChange={(e) =>
                    setForm({ ...form, energy: parseInt(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Drained</span>
                  <span>{form.energy}/5</span>
                  <span>Energized</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gratitude
              </label>
              <input
                type="text"
                value={form.gratitude}
                onChange={(e) => setForm({ ...form, gratitude: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
                placeholder="One thing I'm grateful for today..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 font-medium"
              >
                Save Reflection
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-600 px-4 py-2.5 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {[
          { value: "", label: "All", icon: BookOpen },
          { value: "daily", label: "Daily", icon: Sun },
          { value: "weekly", label: "Weekly", icon: Calendar },
          { value: "monthly", label: "Monthly", icon: Moon },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              onClick={() => setFilterType(item.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterType === item.value
                  ? "bg-primary-100 text-primary-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Reflections List */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading...</div>
      ) : reflections.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            No reflections yet. Take a moment to pause and reflect.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reflections.map((ref) => (
            <div
              key={ref.id}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      ref.type === "daily"
                        ? "bg-blue-100 text-blue-700"
                        : ref.type === "weekly"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {ref.type}
                  </span>
                  <span className="text-sm text-gray-500">
                    {format(new Date(ref.date), "MMM d, yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  {ref.mood && <span>Mood: {ref.mood}/5</span>}
                  {ref.energy && <span>Energy: {ref.energy}/5</span>}
                </div>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{ref.content}</p>
              {ref.gratitude && (
                <p className="mt-3 text-sm text-gray-500 italic">
                  Grateful for: {ref.gratitude}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
