import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTaskSchema, updateTaskSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const role = searchParams.get("role");
  const priority = searchParams.get("priority");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const where: Record<string, unknown> = { userId: session.user.id };
  if (status) where.status = status;
  if (role) where.role = role;
  if (priority) where.priority = priority;

  const [rawTasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { goal: true },
      orderBy: [{ dueDate: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const tasks = rawTasks.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

  return NextResponse.json({ tasks, total, page, limit });
}

async function ensureColumns() {
  try {
    const cols = await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info(Task)`);
    const names = cols.map((c: any) => c.name);
    if (!names.includes("recurrence")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN "recurrence" TEXT`);
    }
    if (!names.includes("recurrenceEnd")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN "recurrenceEnd" DATETIME`);
    }
    if (!names.includes("parentTaskId")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN "parentTaskId" TEXT`);
    }
  } catch {}
}

let migrated = false;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!migrated) {
    await ensureColumns();
    migrated = true;
  }

  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;
  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      priority: data.priority,
      role: data.role,
      hours: data.hours ?? null,
      goalId: data.goalId || null,
      recurrence: data.recurrence || null,
      recurrenceEnd: data.recurrenceEnd ? new Date(data.recurrenceEnd) : null,
      userId: session.user.id,
    },
  });

  return NextResponse.json(task, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;
  const data: Record<string, unknown> = {};
  if (fields.title !== undefined) data.title = fields.title;
  if (fields.description !== undefined) data.description = fields.description;
  if (fields.dueDate !== undefined) data.dueDate = fields.dueDate ? new Date(fields.dueDate) : null;
  if (fields.priority !== undefined) data.priority = fields.priority;
  if (fields.status !== undefined) data.status = fields.status;
  if (fields.role !== undefined) data.role = fields.role;
  if (fields.hours !== undefined) data.hours = fields.hours;
  if (fields.goalId !== undefined) data.goalId = fields.goalId;
  if (fields.recurrence !== undefined) data.recurrence = fields.recurrence;
  if (fields.recurrenceEnd !== undefined) data.recurrenceEnd = fields.recurrenceEnd ? new Date(fields.recurrenceEnd) : null;

  const task = await prisma.task.update({
    where: { id, userId: session.user.id },
    data,
  });

  return NextResponse.json(task);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.task.delete({ where: { id, userId: session.user.id } });
  return NextResponse.json({ success: true });
}
