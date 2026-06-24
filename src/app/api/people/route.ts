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
  const context = searchParams.get("context");
  const needsFollowUp = searchParams.get("needsFollowUp");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (context) where.context = context;
  if (needsFollowUp === "true") {
    where.followUpDate = { lte: new Date() };
  }

  const people = await prisma.person.findMany({
    where,
    include: {
      interactions: { orderBy: { date: "desc" }, take: 3 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(people);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const person = await prisma.person.create({
    data: {
      name: body.name,
      context: body.context,
      email: body.email,
      phone: body.phone,
      dateMet: body.dateMet ? new Date(body.dateMet) : new Date(),
      notes: body.notes,
      prayerRequests: body.prayerRequests,
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
      userId: session.user.id,
    },
  });

  return NextResponse.json(person, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const person = await prisma.person.update({
    where: { id: body.id, userId: session.user.id },
    data: {
      name: body.name,
      context: body.context,
      email: body.email,
      phone: body.phone,
      notes: body.notes,
      prayerRequests: body.prayerRequests,
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
      lastContactDate: body.lastContactDate
        ? new Date(body.lastContactDate)
        : undefined,
    },
  });

  return NextResponse.json(person);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  await prisma.person.delete({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
