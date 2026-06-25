import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPersonSchema, updatePersonSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const needsFollowUp = searchParams.get("needsFollowUp");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const where: Record<string, unknown> = { userId: session.user.id };
  if (category) where.category = category;
  if (needsFollowUp === "true") {
    where.followUpDate = { lte: new Date() };
  }
  if (search) {
    where.name = { contains: search };
  }

  const [people, total] = await Promise.all([
    prisma.person.findMany({
      where,
      include: { interactions: { orderBy: { date: "desc" }, take: 5 } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.person.count({ where }),
  ]);

  return NextResponse.json({ people, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createPersonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;
  const person = await prisma.person.create({
    data: {
      name: data.name,
      category: data.category,
      email: data.email || null,
      phone: data.phone || null,
      dateMet: data.dateMet ? new Date(data.dateMet) : new Date(),
      notes: data.notes || null,
      prayerRequests: data.prayerRequests || null,
      goals: data.goals || null,
      tags: data.tags || null,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
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
  const parsed = updatePersonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;
  const data: Record<string, unknown> = {};
  if (fields.name !== undefined) data.name = fields.name;
  if (fields.category !== undefined) data.category = fields.category;
  if (fields.email !== undefined) data.email = fields.email;
  if (fields.phone !== undefined) data.phone = fields.phone;
  if (fields.notes !== undefined) data.notes = fields.notes;
  if (fields.prayerRequests !== undefined) data.prayerRequests = fields.prayerRequests;
  if (fields.goals !== undefined) data.goals = fields.goals;
  if (fields.tags !== undefined) data.tags = fields.tags;
  if (fields.followUpDate !== undefined) data.followUpDate = fields.followUpDate ? new Date(fields.followUpDate) : null;
  if (fields.lastContactDate !== undefined) data.lastContactDate = new Date(fields.lastContactDate);

  const person = await prisma.person.update({
    where: { id, userId: session.user.id },
    data,
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
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.person.delete({ where: { id, userId: session.user.id } });
  return NextResponse.json({ success: true });
}
