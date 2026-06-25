import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchCalendarEvents, categorizeEvent } from "@/lib/microsoft-graph";
import { syncGoogleCalendar } from "@/lib/google-calendar";
import { createEventSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const role = searchParams.get("role");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (start && end) {
    where.startTime = { gte: new Date(start) };
    where.endTime = { lte: new Date(end) };
  }
  if (role) where.role = role;

  const events = await prisma.event.findMany({
    where,
    include: { interactions: true },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.action === "sync") {
    const start = body.start || new Date().toISOString();
    const end = body.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const allSynced = [];

    // Sync Outlook/Microsoft calendar
    const outlookEvents = await fetchCalendarEvents(session.user.id, start, end);
    for (const event of outlookEvents) {
      const { category, role } = categorizeEvent(event.subject, event.bodyPreview);
      const upserted = await prisma.event.upsert({
        where: { outlookId: event.id },
        update: {
          title: event.subject,
          startTime: new Date(event.start.dateTime + "Z"),
          endTime: new Date(event.end.dateTime + "Z"),
          location: event.location?.displayName,
        },
        create: {
          title: event.subject,
          startTime: new Date(event.start.dateTime + "Z"),
          endTime: new Date(event.end.dateTime + "Z"),
          location: event.location?.displayName,
          category,
          role,
          outlookId: event.id,
          userId: session.user.id,
        },
      });
      allSynced.push(upserted);
    }

    // Sync Google Calendar
    const googleSynced = await syncGoogleCalendar(session.user.id, start, end);
    allSynced.push(...googleSynced);

    return NextResponse.json({ synced: allSynced.length, events: allSynced });
  }

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;
  const event = await prisma.event.create({
    data: {
      title: data.title,
      description: data.description,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      category: data.category,
      role: data.role,
      location: data.location,
      isLed: data.isLed,
      userId: session.user.id,
    },
  });

  return NextResponse.json(event, { status: 201 });
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
  if (fields.title !== undefined) data.title = fields.title;
  if (fields.startTime !== undefined) data.startTime = new Date(fields.startTime);
  if (fields.endTime !== undefined) data.endTime = new Date(fields.endTime);
  if (fields.location !== undefined) data.location = fields.location || null;
  if (fields.category !== undefined) data.category = fields.category;
  if (fields.role !== undefined) data.role = fields.role;
  if (fields.isLed !== undefined) data.isLed = fields.isLed;
  if (fields.attended !== undefined) data.attended = fields.attended;
  if (fields.actualMinutes !== undefined) data.actualMinutes = fields.actualMinutes;

  const event = await prisma.event.update({
    where: { id, userId: session.user.id },
    data,
  });

  return NextResponse.json(event);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.event.delete({ where: { id, userId: session.user.id } });
  return NextResponse.json({ success: true });
}
