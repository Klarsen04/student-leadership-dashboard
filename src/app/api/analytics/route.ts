import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { differenceInMinutes, subDays, startOfDay, endOfDay } from "date-fns";
import { userDayKey, userDayKeyAgo, userPeriod } from "@/lib/userTime";

// Consecutive-day streak over user-local day keys. Today still being in
// progress doesn't break the streak — an empty today just doesn't count yet.
function dayStreak(dates: Date[], now: Date, tz: number): number {
  const keys = new Set(dates.map((d) => userDayKey(d, tz)));
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    if (keys.has(userDayKeyAgo(now, tz, i))) streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "week";
  // Client's Date#getTimezoneOffset(), so days/weeks are bucketed in the
  // user's timezone rather than the server's (UTC on Vercel).
  const tz = parseInt(searchParams.get("tz") || "0", 10) || 0;
  const now = new Date();

  const { start, end } = userPeriod(now, tz, period === "month" ? "monthly" : "weekly");

  let events: any[] = [], tasks: any[] = [], reflections: any[] = [], allTasks: any[] = [], allReflections: any[] = [];
  try {
    [events, tasks, reflections, allTasks, allReflections] = await Promise.all([
      prisma.event.findMany({
        where: { userId: session.user.id, startTime: { lte: end }, endTime: { gte: start } },
      }),
      prisma.task.findMany({
        where: { userId: session.user.id, updatedAt: { gte: start, lte: end } },
      }),
      prisma.reflection.findMany({
        where: { userId: session.user.id, date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      }),
      prisma.task.findMany({
        where: { userId: session.user.id, status: "done" },
        orderBy: { updatedAt: "desc" },
        take: 60,
      }),
      prisma.reflection.findMany({
        where: { userId: session.user.id },
        orderBy: { date: "desc" },
        take: 60,
      }),
    ]);
  } catch (e) {
    console.error("Analytics query error:", e);
    return NextResponse.json({
      eventsByCalendar: {},
      hoursByCalendar: {},
      totalEvents: 0,
      tasksCompleted: 0,
      tasksPending: 0,
      taskStreak: 0,
      reflectionStreak: 0,
      reflectionCount: 0,
      wellness: [],
    });
  }

  // Events per calendar
  const eventsByCalendar: Record<string, number> = {};
  const hoursByCalendar: Record<string, number> = {};

  for (const event of events) {
    const cal = event.category || "Personal";
    eventsByCalendar[cal] = (eventsByCalendar[cal] || 0) + 1;
    const mins = event.actualMinutes || differenceInMinutes(event.endTime, event.startTime);
    if (mins > 0 && mins <= 720) {
      hoursByCalendar[cal] = (hoursByCalendar[cal] || 0) + Math.round((mins / 60) * 10) / 10;
    }
  }

  // Task streak (consecutive user-local days with at least one task completed)
  const taskStreak = dayStreak(
    allTasks.filter((t) => t.updatedAt).map((t) => new Date(t.updatedAt)),
    now,
    tz
  );

  // Reflection streak (consecutive user-local days with a reflection)
  const reflectionStreak = dayStreak(
    allReflections.map((r) => new Date(r.date)),
    now,
    tz
  );

  const tasksCompleted = tasks.filter((t) => t.status === "done").length;
  const tasksPending = tasks.filter((t) => t.status !== "done").length;

  const taskHours = tasks.reduce((sum, t) => sum + ((t as any).hours || 0), 0);
  if (taskHours > 0) {
    hoursByCalendar["Tasks"] = Math.round(taskHours * 10) / 10;
  }

  const wellness = reflections
    .filter((r) => r.mood || r.energy)
    .map((r) => ({
      date: r.date,
      type: r.type,
      energy: r.energy,
      mood: r.mood,
    }));

  let daily: { date: string; tasksCompleted: number; reflections: number; events: number }[] = [];
  if (period === "month") {
    const thirtyDaysAgo = subDays(now, 30);
    const [dailyTasks, dailyReflections, dailyEvents] = await Promise.all([
      prisma.task.findMany({
        where: {
          userId: session.user.id,
          status: "done",
          updatedAt: { gte: startOfDay(thirtyDaysAgo), lte: endOfDay(now) },
        },
      }),
      prisma.reflection.findMany({
        where: {
          userId: session.user.id,
          date: { gte: startOfDay(thirtyDaysAgo), lte: endOfDay(now) },
        },
      }),
      prisma.event.findMany({
        where: {
          userId: session.user.id,
          startTime: { gte: startOfDay(thirtyDaysAgo), lte: endOfDay(now) },
        },
      }),
    ]);

    for (let i = 29; i >= 0; i--) {
      const dateStr = userDayKeyAgo(now, tz, i);
      daily.push({
        date: dateStr,
        tasksCompleted: dailyTasks.filter((t) => userDayKey(t.updatedAt!, tz) === dateStr).length,
        reflections: dailyReflections.filter((r) => userDayKey(new Date(r.date), tz) === dateStr).length,
        events: dailyEvents.filter((e) => userDayKey(e.startTime, tz) === dateStr).length,
      });
    }
  }

  return NextResponse.json({
    eventsByCalendar,
    hoursByCalendar,
    totalEvents: events.length,
    tasksCompleted,
    tasksPending,
    taskStreak,
    reflectionStreak,
    reflectionCount: reflections.length,
    wellness,
    daily,
  });
}
