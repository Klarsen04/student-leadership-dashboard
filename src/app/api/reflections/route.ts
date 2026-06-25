import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createReflectionSchema } from "@/lib/validations";

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
  const parsed = createReflectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;
  const reflection = await prisma.reflection.create({
    data: {
      type: data.type,
      date: data.date ? new Date(data.date) : new Date(),
      content: data.content,
      mood: data.mood,
      energy: data.energy,
      gratitude: data.gratitude,
      userId: session.user.id,
    },
  });

  return NextResponse.json(reflection, { status: 201 });
}
