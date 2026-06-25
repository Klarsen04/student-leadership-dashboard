import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ExportType = "events" | "tasks" | "goals" | "reflections" | "checkins" | "all";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "all") as ExportType;
  const format = searchParams.get("format") || "json";

  const userId = session.user.id;

  const data: Record<string, unknown[]> = {};

  if (type === "all" || type === "events") {
    data.events = await prisma.event.findMany({ where: { userId }, orderBy: { startTime: "desc" } });
  }
  if (type === "all" || type === "tasks") {
    data.tasks = await prisma.task.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }
  if (type === "all" || type === "goals") {
    data.goals = await prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }
  if (type === "all" || type === "reflections") {
    data.reflections = await prisma.reflection.findMany({ where: { userId }, orderBy: { date: "desc" } });
  }
  if (type === "all" || type === "checkins") {
    data.checkIns = await prisma.dailyCheckIn.findMany({ where: { userId }, orderBy: { date: "desc" } });
  }

  if (format === "csv") {
    const csvSections: string[] = [];
    for (const [key, rows] of Object.entries(data)) {
      if (rows.length === 0) continue;
      const headers = Object.keys(rows[0] as Record<string, unknown>);
      const csvRows = rows.map((row) =>
        headers.map((h) => {
          const val = (row as Record<string, unknown>)[h];
          const str = val === null || val === undefined ? "" : String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(",")
      );
      csvSections.push(`--- ${key.toUpperCase()} ---\n${headers.join(",")}\n${csvRows.join("\n")}`);
    }

    return new NextResponse(csvSections.join("\n\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leadership-os-export-${type}.csv"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="leadership-os-export-${type}.json"`,
    },
  });
}
