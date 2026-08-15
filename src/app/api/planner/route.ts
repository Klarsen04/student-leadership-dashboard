import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_PAGE = 513;
// Generous per-page cap; vector strokes are small, so hitting this means
// something is wrong client-side.
const MAX_STROKES_BYTES = 2_000_000;

// GET /api/planner?page=N  → ink for one page
// GET /api/planner?pages=all → list of page numbers that have ink (for dots/UI)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  if (searchParams.get("pages") === "all") {
    const rows = await prisma.plannerInk.findMany({
      where: { userId: session.user.id },
      select: { page: true },
    });
    return NextResponse.json({ pages: rows.map((r) => r.page) });
  }

  const page = parseInt(searchParams.get("page") || "", 10);
  if (!page || page < 1 || page > MAX_PAGE) {
    return NextResponse.json({ error: "Valid page required" }, { status: 400 });
  }

  const ink = await prisma.plannerInk.findUnique({
    where: { userId_page: { userId: session.user.id, page } },
  });
  return NextResponse.json({ page, strokes: ink?.strokes ?? "[]" });
}

// POST { page, strokes } — full replace of the page's ink (client is source of
// truth; strokes are the page's entire vector state after each edit burst).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const page = parseInt(body?.page, 10);
  const strokes = body?.strokes;
  if (!page || page < 1 || page > MAX_PAGE || typeof strokes !== "string") {
    return NextResponse.json({ error: "page and strokes (JSON string) required" }, { status: 400 });
  }
  if (strokes.length > MAX_STROKES_BYTES) {
    return NextResponse.json({ error: "Ink payload too large" }, { status: 413 });
  }
  try {
    JSON.parse(strokes);
  } catch {
    return NextResponse.json({ error: "strokes must be valid JSON" }, { status: 400 });
  }

  const ink = await prisma.plannerInk.upsert({
    where: { userId_page: { userId: session.user.id, page } },
    update: { strokes },
    create: { userId: session.user.id, page, strokes },
  });
  return NextResponse.json({ page: ink.page, updatedAt: ink.updatedAt });
}
