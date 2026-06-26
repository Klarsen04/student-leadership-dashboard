import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGoalSchema, updateGoalSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (category) where.category = category;
  if (status) where.status = status;

  const goals = await prisma.goal.findMany({
    where,
    include: { tasks: { select: { id: true, title: true, status: true }, orderBy: { createdAt: "desc" }, take: 20 } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(goals);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;
  const goal = await prisma.goal.create({
    data: {
      title: data.title,
      description: data.description || null,
      category: data.category,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      userId: session.user.id,
    },
  });

  return NextResponse.json(goal, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;
  const data: Record<string, unknown> = {};
  if (fields.title !== undefined) data.title = fields.title;
  if (fields.description !== undefined) data.description = fields.description;
  if (fields.category !== undefined) data.category = fields.category;
  if (fields.targetDate !== undefined) data.targetDate = fields.targetDate ? new Date(fields.targetDate) : null;
  if (fields.progress !== undefined) data.progress = fields.progress;
  if (fields.status !== undefined) data.status = fields.status;

  const goal = await prisma.goal.update({
    where: { id, userId: session.user.id },
    data,
  });

  return NextResponse.json(goal);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.goal.delete({ where: { id, userId: session.user.id } });
  return NextResponse.json({ success: true });
}
