// Cross-device sync for the documents that used to live only in the browser.
//
// Sub-calendars, the class schedule, roles, the user's own notebooks, their page
// indexes, stickers and custom templates were all kept in localStorage or
// IndexedDB, which meant signing in on a second device showed none of them. This
// route is the account-scoped home for all of it: one JSON document per
// (scope, key), pulled on load and pushed on change.
//
// The client stays the source of truth for a document's *contents* — the server
// never merges two versions of one document, it just stores the last one it was
// given, exactly as /api/planner does with a page of ink.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Scopes are an allowlist rather than free text: the table is shared by every
 * feature, so a typo in a client would otherwise quietly create a private
 * namespace that nothing ever reads back.
 */
const SCOPES = ["setting", "notebook", "pageIndex", "sticker", "template"] as const;
type Scope = (typeof SCOPES)[number];

const isScope = (s: unknown): s is Scope => typeof s === "string" && SCOPES.includes(s as Scope);

/** Setting names, notebook ids, sticker ids and template ids all fit this. */
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,80}$/;

/**
 * Per-document cap. A page index for a 2000-page notebook is the largest thing
 * that comes through here and lands well under this; anything bigger means a
 * client is storing something it shouldn't.
 */
const MAX_VALUE_BYTES = 2_000_000;
/** Documents accepted in one batch push. */
const MAX_BATCH = 200;

// The deployed database is migrated by POST /api/migrate rather than by
// `prisma migrate`, so it can lag behind the schema. Detect that and create the
// table in place instead of failing the write — the same self-heal /api/planner
// does for PlannerInk.
const DRIFT_RE = /no such table|no such column|has no column named/i;

async function repairTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserData" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "scope" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "deletedAt" DATETIME,
      "userId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "UserData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "UserData_userId_scope_key_key" ON "UserData"("userId", "scope", "key")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "UserData_userId_scope_idx" ON "UserData"("userId", "scope")`,
  );
}

async function withRepair<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e: any) {
    if (!DRIFT_RE.test(String(e?.message))) throw e;
    console.warn("UserData schema drift detected — repairing:", e.message);
    await repairTable();
    return await op();
  }
}

async function requireUser() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function failed(e: any, what: string) {
  const message = String(e?.message || "Unknown database error");
  // A session can outlive the account row it points at (a wiped or re-seeded
  // database), which fails the foreign key rather than the auth check.
  if (/FOREIGN KEY/i.test(message)) {
    return NextResponse.json(
      { error: "Your account wasn't found — sign out and sign in again." },
      { status: 409 },
    );
  }
  console.error(`${what} failed:`, message);
  return NextResponse.json({ error: message.split("\n").pop() || message }, { status: 500 });
}

// GET /api/sync?scope=setting            → every document in the scope
// GET /api/sync?scope=setting&key=roles  → one document
//
// Deleted documents come back too, as `{ key, deleted: true }`. A device that
// missed the delete needs to hear about it, and filtering them out here would
// leave it re-uploading what it still has locally.
export async function GET(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  if (!isScope(scope)) return NextResponse.json({ error: "Unknown scope" }, { status: 400 });

  const key = searchParams.get("key");
  if (key !== null && !KEY_RE.test(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  try {
    const rows = await withRepair(() =>
      prisma.userData.findMany({
        where: { userId, scope, ...(key !== null ? { key } : {}) },
        select: { key: true, value: true, deletedAt: true, updatedAt: true },
      }),
    );
    return NextResponse.json({
      scope,
      items: rows.map((r) => ({
        key: r.key,
        value: r.deletedAt ? null : r.value,
        deleted: r.deletedAt !== null,
        updatedAt: r.updatedAt.getTime(),
      })),
    });
  } catch (e) {
    return failed(e, "UserData read");
  }
}

interface Incoming {
  key: string;
  value: string;
}

/** Pull `{key, value}` documents out of a body that may be single or batch. */
function readItems(body: any): Incoming[] | string {
  const raw: unknown[] = Array.isArray(body?.items)
    ? body.items
    : [{ key: body?.key, value: body?.value }];
  if (!raw.length) return "Nothing to save";
  if (raw.length > MAX_BATCH) return `Too many documents in one request (max ${MAX_BATCH})`;

  const items: Incoming[] = [];
  for (const it of raw as any[]) {
    if (typeof it?.key !== "string" || !KEY_RE.test(it.key)) return "Invalid key";
    if (typeof it?.value !== "string") return "value must be a JSON string";
    if (it.value.length > MAX_VALUE_BYTES) return "That's too large to sync";
    try {
      JSON.parse(it.value);
    } catch {
      return "value must be valid JSON";
    }
    items.push({ key: it.key, value: it.value });
  }
  return items;
}

// PUT { scope, key, value } — or { scope, items: [{key, value}, ...] } to send a
// whole scope at once, which is how a device that has never synced uploads what
// it already had locally.
//
// A write clears any tombstone on that key: re-creating a notebook with the same
// id (re-importing the same PDF) has to bring it back rather than stay hidden.
export async function PUT(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!isScope(body?.scope)) return NextResponse.json({ error: "Unknown scope" }, { status: 400 });
  const scope: Scope = body.scope;

  const items = readItems(body);
  if (typeof items === "string") return NextResponse.json({ error: items }, { status: 400 });

  try {
    const saved = await withRepair(async () => {
      const out: { key: string; updatedAt: number }[] = [];
      for (const { key, value } of items) {
        const row = await prisma.userData.upsert({
          where: { userId_scope_key: { userId, scope, key } },
          update: { value, deletedAt: null },
          create: { userId, scope, key, value },
        });
        out.push({ key: row.key, updatedAt: row.updatedAt.getTime() });
      }
      return out;
    });
    return NextResponse.json({ scope, saved });
  } catch (e) {
    return failed(e, "UserData save");
  }
}

// DELETE /api/sync?scope=notebook&key=<id>
//
// Tombstoned rather than removed, so every other device learns the document is
// gone. The value is emptied at the same time — a deleted notebook shouldn't
// leave its contents sitting in the table.
export async function DELETE(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const key = searchParams.get("key");
  if (!isScope(scope)) return NextResponse.json({ error: "Unknown scope" }, { status: 400 });
  if (!key || !KEY_RE.test(key)) return NextResponse.json({ error: "Invalid key" }, { status: 400 });

  try {
    const { count } = await withRepair(() =>
      prisma.userData.updateMany({
        where: { userId, scope, key, deletedAt: null },
        data: { value: "null", deletedAt: new Date() },
      }),
    );
    return NextResponse.json({ deleted: count });
  } catch (e) {
    return failed(e, "UserData delete");
  }
}
