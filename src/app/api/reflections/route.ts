import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (type) where.type = type;

  const reflections = await prisma.reflection.findMany({
    where,
    orderBy: { date: "desc" },
    take: 30,
  });

  return NextResponse.json(reflections);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const reflection = await prisma.reflection.create({
    data: {
      type: body.type,
      date: body.date ? new Date(body.date) : new Date(),
      content: body.content,
      mood: body.mood,
      energy: body.energy,
      gratitude: body.gratitude,
      userId: session.user.id,
    },
  });

  return NextResponse.json(reflection, { status: 201 });
}
