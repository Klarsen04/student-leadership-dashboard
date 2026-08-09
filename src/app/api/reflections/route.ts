import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createReflectionSchema } from "@/lib/validations";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

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
  const now = data.date ? new Date(data.date) : new Date();

  let periodStart: Date;
  let periodEnd: Date;
  if (data.type === "daily") {
    periodStart = startOfDay(now);
    periodEnd = endOfDay(now);
  } else if (data.type === "weekly") {
    periodStart = startOfWeek(now, { weekStartsOn: 0 });
    periodEnd = endOfWeek(now, { weekStartsOn: 0 });
  } else {
    periodStart = startOfMonth(now);
    periodEnd = endOfMonth(now);
  }

  // Guard against duplicates within the period. When a pod is specified, the
  // guard is per-pod (so different pods can be done the same day); otherwise
  // it falls back to per-type for legacy/untyped entries.
  //
  // This runs inside the try/catch below: on a drifted DB (missing the podId
  // column) the podId filter throws, and we must fall through to the schema
  // recovery path rather than 500 with an opaque, body-less error.
  try {
    const existing = await prisma.reflection.findFirst({
      where: {
        userId: session.user.id,
        ...(data.podId ? { podId: data.podId } : { type: data.type }),
        date: { gte: periodStart, lte: periodEnd },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You already reflected in this pod for this period. Edit the existing entry instead.", code: "DUPLICATE" },
        { status: 409 }
      );
    }

    const reflection = await prisma.reflection.create({
      data: {
        type: data.type,
        date: now,
        content: data.content,
        mood: data.mood,
        energy: data.energy,
        gratitude: data.gratitude,
        podId: data.podId ?? null,
        questions: data.questions ?? null,
        userId: session.user.id,
      },
    });
    return NextResponse.json(reflection, { status: 201 });
  } catch (e) {
    // Surface a descriptive message instead of an opaque 500. The most common
    // cause is schema drift — the deployed DB missing the podId/questions
    // columns — so retry once without the newer optional fields before failing.
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Reflection create failed:", msg);

    const missingNewColumns = /no column|has no column|podId|questions|SQLITE_ERROR/i.test(msg);
    if (missingNewColumns) {
      try {
        const reflection = await prisma.reflection.create({
          data: {
            type: data.type,
            date: now,
            content: data.content,
            mood: data.mood,
            energy: data.energy,
            gratitude: data.gratitude,
            userId: session.user.id,
          },
        });
        return NextResponse.json(reflection, { status: 201 });
      } catch (e2) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        console.error("Reflection create retry failed:", msg2);
        return NextResponse.json(
          { error: "Couldn't save your reflection — the database schema may be out of date.", detail: msg2 },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Couldn't save your reflection. Please try again.", detail: msg },
      { status: 500 }
    );
  }
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
  if (fields.questions !== undefined) data.questions = fields.questions || null;

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
