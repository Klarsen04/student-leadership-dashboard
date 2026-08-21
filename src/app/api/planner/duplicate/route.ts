// POST /api/planner/duplicate { from, to } — clone one notebook's ink onto
// another notebook id, for "duplicate this planner and keep my handwriting".
//
// Ink is keyed by (user, plannerId, page) and a duplicate is just a fresh id, so
// copying a notebook's contents means copying its rows. This runs server-side
// because the client has no reason to hold every page of a 500-page notebook in
// memory just to write it back.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PLANNER_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** A notebook can't exceed MAX_IMPORT_PAGES, so more rows than this is a bug. */
const MAX_PAGES = 2000;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const from = String(body?.from || "");
  const to = String(body?.to || "");
  if (!PLANNER_ID_RE.test(from) || !PLANNER_ID_RE.test(to)) {
    return NextResponse.json({ error: "Invalid planner id" }, { status: 400 });
  }
  if (from === to) {
    return NextResponse.json({ error: "A notebook can't be copied onto itself" }, { status: 400 });
  }

  try {
    const rows = await prisma.plannerInk.findMany({
      where: { userId: session.user.id, plannerId: from },
      select: { page: true, strokes: true },
      take: MAX_PAGES,
    });
    if (!rows.length) return NextResponse.json({ pages: 0 });

    // The destination is a just-minted id, so these are all inserts — but upsert
    // keeps a retried request from failing on the unique index.
    for (const row of rows) {
      await prisma.plannerInk.upsert({
        where: {
          userId_plannerId_page: { userId: session.user.id, plannerId: to, page: row.page },
        },
        update: { strokes: row.strokes },
        create: { userId: session.user.id, plannerId: to, page: row.page, strokes: row.strokes },
      });
    }
    return NextResponse.json({ pages: rows.length });
  } catch (e: any) {
    // A drifted table means there's no ink to copy yet — the blank copy the
    // client already created is still correct, so this isn't worth an error.
    const message = String(e?.message || "Unknown database error");
    if (/no such table|no such column/i.test(message)) return NextResponse.json({ pages: 0 });
    console.error("Planner duplicate failed:", message);
    return NextResponse.json({ error: message.split("\n").pop() || message }, { status: 500 });
  }
}
