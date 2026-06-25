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
    start = startOfWeek(now, { weekStartsOn: 1 });
    end = endOfWeek(now, { weekStartsOn: 1 });
  }

  const [events, people, interactions, tasks, checkIns] = await Promise.all([
    prisma.event.findMany({
      where: { userId: session.user.id, startTime: { gte: start }, endTime: { lte: end } },
    }),
    prisma.person.findMany({
      where: { userId: session.user.id },
      select: { id: true, followUpDate: true, createdAt: true },
    }),
    prisma.interaction.findMany({
      where: { person: { userId: session.user.id }, date: { gte: start, lte: end } },
    }),
    prisma.task.findMany({
      where: { userId: session.user.id, status: "done", updatedAt: { gte: start, lte: end } },
    }),
    prisma.dailyCheckIn.findMany({
      where: { userId: session.user.id, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
  ]);

  const hoursByRole: Record<string, number> = {};
  let totalMinutes = 0;
  let eventsLed = 0;

  for (const event of events) {
    const mins = event.actualMinutes || differenceInMinutes(event.endTime, event.startTime);
    totalMinutes += mins;
    hoursByRole[event.role] = (hoursByRole[event.role] || 0) + mins;
    if (event.isLed) eventsLed++;
  }

  const hoursFormatted: Record<string, number> = {};
  for (const [key, mins] of Object.entries(hoursByRole)) {
    hoursFormatted[key] = Math.round((mins / 60) * 10) / 10;
  }

  const followUpsDue = people.filter(
    (p) => p.followUpDate && new Date(p.followUpDate) <= now
  ).length;

  const newPeople = people.filter(
    (p) => p.createdAt >= start && p.createdAt <= end
  ).length;

  return NextResponse.json({
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    hoursByRole: hoursFormatted,
    eventsAttended: events.filter((e) => e.attended).length,
    eventsLed,
    totalInteractions: interactions.length,
    followUpsDue,
    newPeopleMet: newPeople,
    tasksCompleted: tasks.length,
    wellness: checkIns.map((c) => ({
      date: c.date,
      energy: c.energy,
      stress: c.stress,
      mood: c.mood,
      sleep: c.sleep,
    })),
  });
}
