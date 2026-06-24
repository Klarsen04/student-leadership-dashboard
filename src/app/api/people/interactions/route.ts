import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const person = await prisma.person.findFirst({
    where: { id: body.personId, userId: session.user.id },
  });
  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  const interaction = await prisma.interaction.create({
    data: {
      type: body.type,
      notes: body.notes || null,
      date: body.date ? new Date(body.date) : new Date(),
      personId: body.personId,
      eventId: body.eventId || null,
    },
  });

  await prisma.person.update({
    where: { id: body.personId },
    data: { lastContactDate: new Date() },
  });

  return NextResponse.json(interaction, { status: 201 });
}
