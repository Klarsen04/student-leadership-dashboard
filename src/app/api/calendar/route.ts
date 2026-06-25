import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchCalendarEvents, categorizeEvent } from "@/lib/microsoft-graph";
import { syncGoogleCalendar } from "@/lib/google-calendar";

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

  const event = await prisma.event.create({
    data: {
      title: body.title,
      description: body.description,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      category: body.category || "Personal",
      role: body.role || "Student",
      location: body.location,
      isLed: body.isLed || false,
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
  const event = await prisma.event.update({
    where: { id: body.id, userId: session.user.id },
    data: {
      category: body.category,
      role: body.role,
      isLed: body.isLed,
      attended: body.attended,
      actualMinutes: body.actualMinutes,
    },
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
