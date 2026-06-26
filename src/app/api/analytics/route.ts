import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInMinutes } from "date-fns";

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

  const [events, tasks, reflections, goals] = await Promise.all([
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
  ]);

  const hoursByCalendar: Record<string, number> = {};
  let totalMinutes = 0;

  for (const event of events) {
    const mins = event.actualMinutes || differenceInMinutes(event.endTime, event.startTime);
    if (mins <= 0 || mins > 720) continue;
    totalMinutes += mins;
    const cal = event.category || "Personal";
    hoursByCalendar[cal] = (hoursByCalendar[cal] || 0) + mins;
  }

  const hoursFormatted: Record<string, number> = {};
  for (const [key, mins] of Object.entries(hoursByCalendar)) {
    hoursFormatted[key] = Math.round((mins / 60) * 10) / 10;
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
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    hoursByCalendar: hoursFormatted,
    totalEvents: events.length,
    tasksCompleted,
    tasksPending,
    goalsActive: goals.length,
    goalsProgress: goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length) : 0,
    reflectionCount: reflections.length,
    wellness,
  });
}
