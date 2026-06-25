import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckInSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") || "30"), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const checkIns = await prisma.dailyCheckIn.findMany({
    where: {
      userId: session.user.id,
      date: { gte: since },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(checkIns);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createCheckInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkIn = await prisma.dailyCheckIn.upsert({
    where: {
      userId_date: {
        userId: session.user.id,
        date: today,
      },
    },
    update: {
      energy: data.energy,
      stress: data.stress,
      mood: data.mood,
      sleep: data.sleep || null,
      notes: data.notes || null,
    },
    create: {
      date: today,
      energy: data.energy,
      stress: data.stress,
      mood: data.mood,
      sleep: data.sleep || null,
      notes: data.notes || null,
      userId: session.user.id,
    },
  });

  return NextResponse.json(checkIn, { status: 201 });
}
