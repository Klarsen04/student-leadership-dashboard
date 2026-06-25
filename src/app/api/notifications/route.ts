import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [upcomingEvents, dueTasks] = await Promise.all([
    prisma.event.findMany({
      where: {
        userId: session.user.id,
        startTime: { gte: now, lte: tomorrow },
      },
      orderBy: { startTime: "asc" },
      take: 10,
    }),
    prisma.task.findMany({
      where: {
        userId: session.user.id,
        status: { not: "done" },
        dueDate: { lte: tomorrow },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  const notifications = [
    ...upcomingEvents.map((e) => ({
      id: `event_${e.id}`,
      type: "event" as const,
      title: e.title,
      message: `Starts at ${e.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      time: e.startTime,
      url: "/calendar",
    })),
    ...dueTasks.map((t) => ({
      id: `task_${t.id}`,
      type: "task" as const,
      title: t.title,
      message: t.dueDate
        ? `Due ${t.dueDate < now ? "overdue" : "today"}`
        : "No due date",
      time: t.dueDate || now,
      url: "/tasks",
      taskId: t.id,
    })),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return NextResponse.json(notifications);
}
