import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, format, isWeekend, startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

function shouldGenerateForDate(recurrence: string, date: Date): boolean {
  const day = date.getDay();
  switch (recurrence) {
    case "daily":
      return true;
    case "weekdays":
      return !isWeekend(date);
    case "weekly":
      return true;
    case "biweekly":
      return true;
    case "monthly":
      return true;
    default:
      return false;
  }
}

function getNextDates(recurrence: string, fromDate: Date, days: number): Date[] {
  const dates: Date[] = [];
  const today = startOfDay(new Date());

  if (recurrence === "weekly") {
    const dayOfWeek = fromDate.getDay();
    for (let i = 0; i < days; i++) {
      const candidate = addDays(today, i);
      if (candidate.getDay() === dayOfWeek) {
        dates.push(candidate);
      }
    }
    return dates;
  }

  if (recurrence === "biweekly") {
    const dayOfWeek = fromDate.getDay();
    const diffDays = Math.floor((today.getTime() - startOfDay(fromDate).getTime()) / (1000 * 60 * 60 * 24));
    for (let i = 0; i < days; i++) {
      const candidate = addDays(today, i);
      if (candidate.getDay() === dayOfWeek) {
        const weeksDiff = Math.floor((diffDays + i) / 7);
        if (weeksDiff % 2 === 0) {
          dates.push(candidate);
        }
      }
    }
    return dates;
  }

  if (recurrence === "monthly") {
    const dayOfMonth = fromDate.getDate();
    for (let i = 0; i < days; i++) {
      const candidate = addDays(today, i);
      if (candidate.getDate() === dayOfMonth) {
        dates.push(candidate);
      }
    }
    return dates;
  }

  for (let i = 0; i < days; i++) {
    const candidate = addDays(today, i);
    if (shouldGenerateForDate(recurrence, candidate)) {
      dates.push(candidate);
    }
  }

  return dates;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recurringTasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      recurrence: { not: null },
      parentTaskId: null,
    },
  });

  let created = 0;

  for (const parent of recurringTasks) {
    if (!parent.recurrence) continue;

    const endDate = parent.recurrenceEnd ? new Date(parent.recurrenceEnd) : null;
    const dates = getNextDates(parent.recurrence, parent.createdAt, 7);

    for (const date of dates) {
      if (endDate && date > endDate) continue;

      const dateStr = format(date, "yyyy-MM-dd");
      const existing = await prisma.task.findFirst({
        where: {
          parentTaskId: parent.id,
          dueDate: {
            gte: new Date(dateStr + "T00:00:00.000Z"),
            lt: new Date(dateStr + "T23:59:59.999Z"),
          },
        },
      });

      if (!existing) {
        await prisma.task.create({
          data: {
            title: parent.title,
            description: parent.description,
            priority: parent.priority,
            role: parent.role,
            hours: parent.hours,
            dueDate: new Date(dateStr + "T00:00:00.000Z"),
            parentTaskId: parent.id,
            userId: session.user.id,
          },
        });
        created++;
      }
    }
  }

  return NextResponse.json({ created });
}
