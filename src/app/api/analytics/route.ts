import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInMinutes, subDays, isSameDay } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "week";
  const now = new Date();

  let start: Date, end: Date;
  if (period === "month") {
    start = startOfMonth(now);
    end = endOfMonth(now);
  } else {
    start = startOfWeek(now, { weekStartsOn: 0 });
    end = endOfWeek(now, { weekStartsOn: 0 });
  }

  let events: any[] = [], tasks: any[] = [], reflections: any[] = [], goals: any[] = [], allTasks: any[] = [], allReflections: any[] = [];
  try {
    [events, tasks, reflections, goals, allTasks, allReflections] = await Promise.all([
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
      prisma.goal.findMany({
        where: { userId: session.user.id, status: "active" },
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
      goalsActive: 0,
      goalsProgress: 0,
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

  // Task streak (consecutive days with at least one task completed)
  let taskStreak = 0;
  let checkDate = new Date();
  for (let i = 0; i < 60; i++) {
    const dayTasks = allTasks.filter((t) => t.updatedAt && isSameDay(t.updatedAt, checkDate));
    if (dayTasks.length > 0) {
      taskStreak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  // Reflection streak (consecutive days/weeks with a reflection)
  let reflectionStreak = 0;
  let refCheckDate = new Date();
  for (let i = 0; i < 60; i++) {
    const dayRefs = allReflections.filter((r) => isSameDay(new Date(r.date), refCheckDate));
    if (dayRefs.length > 0) {
      reflectionStreak++;
      refCheckDate = subDays(refCheckDate, 1);
    } else {
      break;
    }
  }

  const tasksCompleted = tasks.filter((t) => t.status === "done").length;
  const tasksPending = tasks.filter((t) => t.status !== "done").length;

  const wellness = reflections
    .filter((r) => r.mood || r.energy)
    .map((r) => ({
      date: r.date,
      type: r.type,
      energy: r.energy,
      mood: r.mood,
    }));

  return NextResponse.json({
    eventsByCalendar,
    hoursByCalendar,
    totalEvents: events.length,
    tasksCompleted,
    tasksPending,
    taskStreak,
    reflectionStreak,
    reflectionCount: reflections.length,
    goalsActive: goals.length,
    goalsProgress: goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length) : 0,
    wellness,
  });
}
