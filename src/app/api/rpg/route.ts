import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  applyDelta,
  completionReward,
  missPenalty,
  dayKey,
  xpForLevel,
  type Difficulty,
  type Stats,
} from "@/lib/rpg";

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function statsOf(u: { xp: number; level: number; hp: number; maxHp: number; gold: number }): Stats {
  return { xp: u.xp, level: u.level, hp: u.hp, maxHp: u.maxHp, gold: u.gold };
}

// Persist a stat delta to the user and return the new stats + event flags.
async function persistDelta(userId: string, current: Stats, delta: Parameters<typeof applyDelta>[1]) {
  const res = applyDelta(current, delta);
  await prisma.user.update({
    where: { id: userId },
    data: {
      xp: res.stats.xp,
      level: res.stats.level,
      hp: res.stats.hp,
      maxHp: res.stats.maxHp,
      gold: res.stats.gold,
    },
  });
  return res;
}

// GET — return stats + all entities, running daily rollover first (missed dailies cost HP).
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = dayKey(new Date());

  // Daily rollover: if a new day started, penalize uncompleted dailies and reset flags/streaks.
  if (user.lastActiveDay !== today) {
    const dailies = await prisma.daily.findMany({ where: { userId } });
    let stats = statsOf(user);
    for (const d of dailies) {
      if (!d.completedToday) {
        // Missed yesterday -> lose HP and break streak.
        const res = applyDelta(stats, missPenalty(d.difficulty as Difficulty));
        stats = res.stats;
        await prisma.daily.update({ where: { id: d.id }, data: { streak: 0, completedToday: false } });
      } else {
        // Completed -> just reset the daily flag for the new day.
        await prisma.daily.update({ where: { id: d.id }, data: { completedToday: false } });
      }
    }
    await prisma.user.update({
      where: { id: userId },
      data: { xp: stats.xp, level: stats.level, hp: stats.hp, maxHp: stats.maxHp, gold: stats.gold, lastActiveDay: today },
    });
  }

  const [fresh, habits, dailies, rewards] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.habit.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.daily.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.reward.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  const stats = statsOf(fresh!);
  return NextResponse.json({
    stats: { ...stats, xpToNext: xpForLevel(stats.level) },
    habits,
    dailies,
    rewards,
  });
}

// POST — dispatch an action by `type`.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type } = body;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const current = statsOf(user);

  switch (type) {
    // ---- create entities ----
    case "createHabit": {
      const habit = await prisma.habit.create({
        data: { userId, title: body.title, notes: body.notes, positive: body.positive ?? true, negative: body.negative ?? false, color: body.color || "bg-purple-500" },
      });
      return NextResponse.json({ habit });
    }
    case "createDaily": {
      const daily = await prisma.daily.create({
        data: { userId, title: body.title, notes: body.notes, difficulty: body.difficulty || "medium", color: body.color || "bg-blue-500" },
      });
      return NextResponse.json({ daily });
    }
    case "createReward": {
      const reward = await prisma.reward.create({
        data: { userId, title: body.title, notes: body.notes, cost: body.cost ?? 10, color: body.color || "bg-amber-500" },
      });
      return NextResponse.json({ reward });
    }

    // ---- tap a habit + or - ----
    case "tapHabit": {
      const habit = await prisma.habit.findFirst({ where: { id: body.id, userId } });
      if (!habit) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const positive = body.direction === "up";
      const delta = positive ? completionReward("easy") : missPenalty("easy");
      const res = await persistDelta(userId, current, delta);
      const updated = await prisma.habit.update({
        where: { id: habit.id },
        data: positive ? { upCount: habit.upCount + 1 } : { downCount: habit.downCount + 1 },
      });
      return NextResponse.json({ habit: updated, ...res });
    }

    // ---- complete / uncomplete a daily ----
    case "toggleDaily": {
      const daily = await prisma.daily.findFirst({ where: { id: body.id, userId } });
      if (!daily) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const today = dayKey(new Date());
      if (!daily.completedToday) {
        const newStreak = daily.streak + 1;
        const res = await persistDelta(userId, current, completionReward(daily.difficulty as Difficulty, daily.streak));
        const updated = await prisma.daily.update({
          where: { id: daily.id },
          data: { completedToday: true, streak: newStreak, bestStreak: Math.max(daily.bestStreak, newStreak), lastCompleted: today },
        });
        return NextResponse.json({ daily: updated, ...res });
      } else {
        // Undo: reverse the reward and decrement streak.
        const reward = completionReward(daily.difficulty as Difficulty, Math.max(0, daily.streak - 1));
        const res = await persistDelta(userId, current, { xp: -(reward.xp ?? 0), gold: -(reward.gold ?? 0) });
        const updated = await prisma.daily.update({
          where: { id: daily.id },
          data: { completedToday: false, streak: Math.max(0, daily.streak - 1) },
        });
        return NextResponse.json({ daily: updated, ...res });
      }
    }

    // ---- buy a reward with gold ----
    case "buyReward": {
      const reward = await prisma.reward.findFirst({ where: { id: body.id, userId } });
      if (!reward) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (current.gold < reward.cost) {
        return NextResponse.json({ error: "Not enough gold" }, { status: 400 });
      }
      const res = await persistDelta(userId, current, { gold: -reward.cost });
      const updated = await prisma.reward.update({
        where: { id: reward.id },
        data: { timesBought: reward.timesBought + 1 },
      });
      return NextResponse.json({ reward: updated, ...res });
    }

    // ---- delete any entity ----
    case "delete": {
      const { entity, id } = body;
      if (entity === "habit") await prisma.habit.deleteMany({ where: { id, userId } });
      else if (entity === "daily") await prisma.daily.deleteMany({ where: { id, userId } });
      else if (entity === "reward") await prisma.reward.deleteMany({ where: { id, userId } });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
