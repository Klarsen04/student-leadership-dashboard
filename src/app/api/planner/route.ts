import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_PAGE = 2000;
const PLANNER_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
// Generous per-page cap; vector strokes are small, so hitting this means
// something is wrong client-side.
const MAX_STROKES_BYTES = 2_000_000;

function parsePlannerId(raw: string | null | undefined): string | null {
  const id = raw || "collanote-2026";
  return PLANNER_ID_RE.test(id) ? id : null;
}

// The deployed database is migrated by POST /api/migrate rather than by
// `prisma migrate`, so it can lag behind the schema — which used to surface as
// an unexplained "couldn't save your ink". Detect that specific failure and
// bring the table up to date in place instead of losing the write.
const DRIFT_RE = /no such table|no such column|has no column named/i;

async function repairInkTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PlannerInk" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "plannerId" TEXT NOT NULL DEFAULT 'collanote-2026',
      "page" INTEGER NOT NULL,
      "strokes" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "PlannerInk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info(PlannerInk)`);
  if (!cols.map((c) => c.name).includes("plannerId")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "PlannerInk" ADD COLUMN "plannerId" TEXT NOT NULL DEFAULT 'collanote-2026'`,
    );
  }
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "PlannerInk_userId_page_key"`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "PlannerInk_userId_plannerId_page_key" ON "PlannerInk"("userId", "plannerId", "page")`,
  );
}

/** Run an ink query, repairing a drifted table once before giving up. */
async function withRepair<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e: any) {
    if (!DRIFT_RE.test(String(e?.message))) throw e;
    console.warn("PlannerInk schema drift detected — repairing:", e.message);
    await repairInkTable();
    return await op();
  }
}

// GET /api/planner?planner=<id>&page=N  → ink for one page
// GET /api/planner?planner=<id>&pages=all → page numbers that have ink
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const plannerId = parsePlannerId(searchParams.get("planner"));
  if (!plannerId) return NextResponse.json({ error: "Invalid planner id" }, { status: 400 });

  if (searchParams.get("pages") === "all") {
    const rows = await withRepair(() =>
      prisma.plannerInk.findMany({
        where: { userId: session.user.id, plannerId },
        select: { page: true },
      }),
    );
    return NextResponse.json({ pages: rows.map((r) => r.page) });
  }

  const page = parseInt(searchParams.get("page") || "", 10);
  if (!page || page < 1 || page > MAX_PAGE) {
    return NextResponse.json({ error: "Valid page required" }, { status: 400 });
  }

  const ink = await withRepair(() =>
    prisma.plannerInk.findUnique({
      where: { userId_plannerId_page: { userId: session.user.id, plannerId, page } },
    }),
  );
  return NextResponse.json({ page, strokes: ink?.strokes ?? "[]", updatedAt: ink?.updatedAt ?? null });
}

// POST { planner, page, strokes } — full replace of the page's ink (client is
// source of truth; strokes are the page's entire vector state per edit burst).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const plannerId = parsePlannerId(body?.planner);
  const page = parseInt(body?.page, 10);
  const strokes = body?.strokes;
  if (!plannerId) return NextResponse.json({ error: "Invalid planner id" }, { status: 400 });
  if (!page || page < 1 || page > MAX_PAGE || typeof strokes !== "string") {
    return NextResponse.json({ error: "page and strokes (JSON string) required" }, { status: 400 });
  }
  if (strokes.length > MAX_STROKES_BYTES) {
    return NextResponse.json(
      { error: "This page holds too much ink to save. Try erasing something." },
      { status: 413 },
    );
  }
  try {
    JSON.parse(strokes);
  } catch {
    return NextResponse.json({ error: "strokes must be valid JSON" }, { status: 400 });
  }

  try {
    const ink = await withRepair(() =>
      prisma.plannerInk.upsert({
        where: { userId_plannerId_page: { userId: session.user.id, plannerId, page } },
        update: { strokes },
        create: { userId: session.user.id, plannerId, page, strokes },
      }),
    );
    return NextResponse.json({ page: ink.page, updatedAt: ink.updatedAt });
  } catch (e: any) {
    const message = String(e?.message || "Unknown database error");
    // A session can outlive the account row it points at (a wiped or re-seeded
    // database), which fails the foreign key rather than the auth check.
    if (/FOREIGN KEY/i.test(message)) {
      return NextResponse.json(
        { error: "Your account wasn't found — sign out and sign in again." },
        { status: 409 },
      );
    }
    console.error("PlannerInk save failed:", message);
    return NextResponse.json({ error: message.split("\n").pop() || message }, { status: 500 });
  }
}
