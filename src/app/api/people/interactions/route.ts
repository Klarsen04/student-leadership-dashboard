import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInteractionSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createInteractionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;

  const person = await prisma.person.findFirst({
    where: { id: data.personId, userId: session.user.id },
  });
  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  const interaction = await prisma.interaction.create({
    data: {
      type: data.type,
      notes: data.notes || null,
      date: new Date(),
      personId: data.personId,
    },
  });

  await prisma.person.update({
    where: { id: data.personId },
    data: { lastContactDate: new Date() },
  });

  return NextResponse.json(interaction, { status: 201 });
}
