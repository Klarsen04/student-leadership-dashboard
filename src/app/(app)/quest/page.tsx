"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Flame, Heart, Coins, Star, Trash2, ChevronUp, ChevronDown, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfetti } from "@/components/Confetti";

const SERIF = { fontFamily: "var(--font-instrument-serif), Georgia, serif" };

interface Stats { xp: number; level: number; hp: number; maxHp: number; gold: number; xpToNext: number; }
interface Habit { id: string; title: string; positive: boolean; negative: boolean; upCount: number; downCount: number; color: string; }
interface Daily { id: string; title: string; streak: number; bestStreak: number; completedToday: boolean; difficulty: string; color: string; }
interface Reward { id: string; title: string; cost: number; timesBought: number; color: string; }

type AddKind = "habit" | "daily" | "reward" | null;

export default function QuestPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [dailies, setDailies] = useState<Daily[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [addKind, setAddKind] = useState<AddKind>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDifficulty, setNewDifficulty] = useState("medium");
  const [newCost, setNewCost] = useState(10);
  const { burst } = useConfetti();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/rpg");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStats(data.stats);
      setHabits(data.habits);
      setDailies(data.dailies);
      setRewards(data.rewards);
    } catch {
      toast.error("Failed to load your quest");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Apply a POST action, then reflect stat changes + celebrate level-ups.
  const act = async (payload: Record<string, unknown>) => {
    const prevLevel = stats?.level ?? 1;
    const res = await fetch("/api/rpg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Something went wrong");
      return null;
    }
    const data = await res.json();
    if (data.stats) {
      setStats((s) => (s ? { ...s, ...data.stats, xpToNext: data.stats.xpToNext ?? s.xpToNext } : s));
    }
    if (data.leveledUp) {
      burst();
      toast.success(`⭐ Level up! You reached level ${data.stats.level}`);
    } else if (data.died) {
      toast.error("💀 You ran out of HP! Lost a level — keep going!");
    }
    return data;
  };

  const refreshAfter = async (payload: Record<string, unknown>) => {
    const data = await act(payload);
    if (data) load();
    return data;
  };

  const createEntity = async () => {
    if (!newTitle.trim() || !addKind) return;
    const map = { habit: "createHabit", daily: "createDaily", reward: "createReward" } as const;
    const extra =
      addKind === "daily" ? { difficulty: newDifficulty } : addKind === "reward" ? { cost: newCost } : {};
    await refreshAfter({ type: map[addKind], title: newTitle.trim(), ...extra });
    setNewTitle(""); setNewDifficulty("medium"); setNewCost(10); setAddKind(null);
  };

  if (loading) {
    return <div className="p-8 text-center text-black/40">Loading your quest…</div>;
  }

  return (
    <div className="relative z-20 min-h-screen" style={{ background: "#faf9f7" }}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-black" style={SERIF}>Your Quest</h1>
          <p className="text-sm text-black/50">Build habits, keep streaks, earn rewards.</p>
        </div>

        {/* Stats bar */}
        {stats && <StatsBar stats={stats} />}

        {/* Four columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Column title="Habits" accent="text-purple-600" onAdd={() => setAddKind("habit")}>
            {habits.length === 0 && <Empty text="Tap + to build a good habit" />}
            {habits.map((h) => (
              <HabitCard key={h.id} habit={h}
                onUp={() => refreshAfter({ type: "tapHabit", id: h.id, direction: "up" })}
                onDown={() => refreshAfter({ type: "tapHabit", id: h.id, direction: "down" })}
                onDelete={() => refreshAfter({ type: "delete", entity: "habit", id: h.id })} />
            ))}
          </Column>

          <Column title="Dailies" accent="text-blue-600" onAdd={() => setAddKind("daily")}>
            {dailies.length === 0 && <Empty text="Add a daily to start a streak" />}
            {dailies.map((d) => (
              <DailyCard key={d.id} daily={d}
                onToggle={() => refreshAfter({ type: "toggleDaily", id: d.id })}
                onDelete={() => refreshAfter({ type: "delete", entity: "daily", id: d.id })} />
            ))}
          </Column>

          <Column title="To-Dos" accent="text-emerald-600" hint="from your Goals & Tasks">
            <Empty text="To-dos live on your Tasks page" />
          </Column>

          <Column title="Rewards" accent="text-amber-600" onAdd={() => setAddKind("reward")}>
            {rewards.length === 0 && <Empty text="Treat yourself — add a reward" />}
            {rewards.map((r) => (
              <RewardCard key={r.id} reward={r} canAfford={(stats?.gold ?? 0) >= r.cost}
                onBuy={() => refreshAfter({ type: "buyReward", id: r.id })}
                onDelete={() => refreshAfter({ type: "delete", entity: "reward", id: r.id })} />
            ))}
          </Column>
        </div>
      </div>

      {/* Add dialog */}
      <Dialog open={addKind !== null} onOpenChange={(o) => !o && setAddKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={SERIF} className="text-black capitalize">New {addKind}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title…" className="text-black"
              onKeyDown={(e) => e.key === "Enter" && createEntity()} />
            {addKind === "daily" && (
              <div className="flex gap-2">
                {["trivial", "easy", "medium", "hard"].map((d) => (
                  <button key={d} onClick={() => setNewDifficulty(d)}
                    className={`px-3 py-1 rounded-full text-xs capitalize ${newDifficulty === d ? "bg-blue-600 text-white" : "bg-black/5 text-black/60"}`}>
                    {d}
                  </button>
                ))}
              </div>
            )}
            {addKind === "reward" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-black/60">Cost:</span>
                <Input type="number" value={newCost} onChange={(e) => setNewCost(Number(e.target.value))}
                  className="w-24 text-black" />
                <Coins className="w-4 h-4 text-amber-500" />
              </div>
            )}
            <Button onClick={createEntity} className="w-full">Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatsBar({ stats }: { stats: Stats }) {
  const hpPct = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
  const xpPct = Math.max(0, Math.min(100, (stats.xp / stats.xpToNext) * 100));
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-lg" style={SERIF}>
          {stats.level}
        </div>
        <span className="text-xs text-black/50">Level</span>
      </div>
      {/* HP */}
      <Meter icon={<Heart className="w-4 h-4 text-rose-500 fill-rose-500" />} label="HP"
        value={`${stats.hp}/${stats.maxHp}`} pct={hpPct} bar="bg-rose-500" />
      {/* XP */}
      <Meter icon={<Star className="w-4 h-4 text-purple-500 fill-purple-500" />} label="XP"
        value={`${stats.xp}/${stats.xpToNext}`} pct={xpPct} bar="bg-purple-500" />
      {/* Gold */}
      <div className="flex items-center gap-2 ml-auto">
        <Coins className="w-5 h-5 text-amber-500" />
        <span className="text-lg font-bold text-black" style={SERIF}>{stats.gold}</span>
        <span className="text-xs text-black/50">gold</span>
      </div>
    </div>
  );
}

function Meter({ icon, label, value, pct, bar }: { icon: React.ReactNode; label: string; value: string; pct: number; bar: string }) {
  return (
    <div className="flex-1 min-w-[140px]">
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1 text-xs font-medium text-black/60">{icon}{label}</span>
        <span className="text-xs text-black/50">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-black/10 overflow-hidden">
        <div className={`h-full ${bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Column({ title, accent, onAdd, hint, children }: { title: string; accent: string; onAdd?: () => void; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-3 flex flex-col gap-2 min-h-[200px]">
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-bold ${accent}`} style={SERIF}>{title}</h2>
        {onAdd && (
          <button onClick={onAdd} className="w-6 h-6 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-black/60">
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-black/40 -mt-1">{hint}</p>}
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-black/30 text-center py-6">{text}</p>;
}

function HabitCard({ habit, onUp, onDown, onDelete }: { habit: Habit; onUp: () => void; onDown: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-2 rounded-xl border border-black/10 p-2">
      {habit.positive && (
        <button onClick={onUp} className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
          <ChevronUp className="w-4 h-4" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-black truncate">{habit.title}</p>
        <p className="text-[10px] text-black/40">+{habit.upCount} · −{habit.downCount}</p>
      </div>
      {habit.negative && (
        <button onClick={onDown} className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-black/30 hover:text-rose-500 transition-opacity">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function DailyCard({ daily, onToggle, onDelete }: { daily: Daily; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-2 rounded-xl border border-black/10 p-2">
      <button onClick={onToggle}
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${daily.completedToday ? "bg-blue-600 text-white" : "bg-black/5 text-black/30 hover:bg-black/10"}`}>
        <Check className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${daily.completedToday ? "text-black/40 line-through" : "text-black"}`}>{daily.title}</p>
        {daily.streak > 0 && (
          <p className="text-[10px] text-orange-500 flex items-center gap-0.5">
            <Flame className="w-3 h-3 fill-orange-500" />{daily.streak} day streak
          </p>
        )}
      </div>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-black/30 hover:text-rose-500 transition-opacity">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function RewardCard({ reward, canAfford, onBuy, onDelete }: { reward: Reward; canAfford: boolean; onBuy: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-2 rounded-xl border border-black/10 p-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-black truncate">{reward.title}</p>
        {reward.timesBought > 0 && <p className="text-[10px] text-black/40">bought ×{reward.timesBought}</p>}
      </div>
      <button onClick={onBuy} disabled={!canAfford}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${canAfford ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-black/5 text-black/30 cursor-not-allowed"}`}>
        <Coins className="w-3 h-3" />{reward.cost}
      </button>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-black/30 hover:text-rose-500 transition-opacity">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
