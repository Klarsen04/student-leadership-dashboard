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

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (fields.content !== undefined) data.content = fields.content;
  if (fields.mood !== undefined) data.mood = fields.mood;
  if (fields.energy !== undefined) data.energy = fields.energy;
  if (fields.gratitude !== undefined) data.gratitude = fields.gratitude || null;
  if (fields.type !== undefined) data.type = fields.type;

  const reflection = await prisma.reflection.update({
    where: { id, userId: session.user.id },
    data,
  });

  return NextResponse.json(reflection);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.reflection.delete({ where: { id, userId: session.user.id } });
  return NextResponse.json({ success: true });
}
