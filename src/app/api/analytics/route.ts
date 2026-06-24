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

  const events = await prisma.event.findMany({
    where: {
      userId: session.user.id,
      startTime: { gte: start },
      endTime: { lte: end },
    },
    include: { interactions: true },
  });

  const hoursByCategory: Record<string, number> = {};
  let totalMinutes = 0;
  let eventsLed = 0;
  let totalInteractions = 0;

  for (const event of events) {
    const minutes = event.actualMinutes || differenceInMinutes(event.endTime, event.startTime);
    totalMinutes += minutes;
    hoursByCategory[event.category] = (hoursByCategory[event.category] || 0) + minutes;
    if (event.isLed) eventsLed++;
    totalInteractions += event.interactions.length;
  }

  const hoursFormatted: Record<string, number> = {};
  for (const [key, mins] of Object.entries(hoursByCategory)) {
    hoursFormatted[key] = Math.round((mins / 60) * 10) / 10;
  }

  const newPeople = await prisma.person.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: start, lte: end },
    },
  });

  const academicMinutes = hoursByCategory["Academics"] || 0;
  const leadershipMinutes =
    (hoursByCategory["RA"] || 0) +
    (hoursByCategory["PSG"] || 0) +
    (hoursByCategory["PHE"] || 0);
  const ministryMinutes = hoursByCategory["Ministry"] || 0;
  const personalMinutes = hoursByCategory["Personal"] || 0;

  const burnoutFactors: string[] = [];
  if (totalMinutes > (period === "month" ? 10000 : 2500))
    burnoutFactors.push("Overscheduled");
  if (personalMinutes < totalMinutes * 0.1)
    burnoutFactors.push("Low personal time");
  if (leadershipMinutes > academicMinutes * 1.5)
    burnoutFactors.push("Leadership outpacing academics");
  if (ministryMinutes < totalMinutes * 0.05)
    burnoutFactors.push("Neglecting spiritual life");

  const burnoutScore = Math.min(burnoutFactors.length * 25, 100);

  return NextResponse.json({
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    hoursByCategory: hoursFormatted,
    eventsAttended: events.length,
    eventsLed,
    interactions: totalInteractions,
    newPeopleMet: newPeople,
    burnout: {
      score: burnoutScore,
      factors: burnoutFactors,
      recommendation:
        burnoutScore >= 75
          ? "Consider dropping a commitment this week. Your schedule is unsustainable."
          : burnoutScore >= 50
          ? "You're running warm. Protect your rest time."
          : "Your balance looks healthy. Keep it up!",
    },
    balance: {
      academics: Math.round((academicMinutes / (totalMinutes || 1)) * 100),
      leadership: Math.round((leadershipMinutes / (totalMinutes || 1)) * 100),
      ministry: Math.round((ministryMinutes / (totalMinutes || 1)) * 100),
      personal: Math.round((personalMinutes / (totalMinutes || 1)) * 100),
    },
  });
}
