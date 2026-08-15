import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Habit" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "frequency" TEXT NOT NULL DEFAULT 'daily',
        "color" TEXT NOT NULL DEFAULT 'purple',
        "icon" TEXT NOT NULL DEFAULT 'star',
        "userId" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "HabitEntry" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "habitId" TEXT NOT NULL,
        "date" DATETIME NOT NULL,
        "completed" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "HabitEntry_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "HabitEntry_habitId_date_key" ON "HabitEntry"("habitId", "date")
    `);

    const taskCols = await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info(Task)`);
    const colNames = taskCols.map((c: any) => c.name);

    if (!colNames.includes("recurrence")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN "recurrence" TEXT`);
    }
    if (!colNames.includes("recurrenceEnd")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN "recurrenceEnd" DATETIME`);
    }
    if (!colNames.includes("parentTaskId")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN "parentTaskId" TEXT`);
    }

    // Reflection: podId + questions columns (added for the guided PeacePod flow).
    // Missing columns on a drifted prod DB are what caused "Failed to save reflection".
    const reflectionCols = await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info(Reflection)`);
    const reflectionColNames = reflectionCols.map((c: any) => c.name);
    if (!reflectionColNames.includes("podId")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Reflection" ADD COLUMN "podId" TEXT`);
    }
    if (!reflectionColNames.includes("questions")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Reflection" ADD COLUMN "questions" TEXT`);
    }

    // PlannerInk: handwritten strokes for the /planner notebook pages.
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PlannerInk" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "page" INTEGER NOT NULL,
        "strokes" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "PlannerInk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "PlannerInk_userId_page_key" ON "PlannerInk"("userId", "page")
    `);

    return NextResponse.json({ success: true, message: "Migration complete" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
