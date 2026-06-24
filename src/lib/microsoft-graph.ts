import { Client } from "@microsoft/microsoft-graph-client";
import { prisma } from "./prisma";

export async function getGraphClient(userId: string): Promise<Client | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "azure-ad" },
  });

  if (!account?.access_token) return null;

  return Client.init({
    authProvider: (done) => {
      done(null, account.access_token!);
    },
  });
}

export async function fetchCalendarEvents(
  userId: string,
  startDate: string,
  endDate: string
) {
  const client = await getGraphClient(userId);
  if (!client) return [];

  const response = await client
    .api("/me/calendarview")
    .query({
      startDateTime: startDate,
      endDateTime: endDate,
    })
    .select("id,subject,start,end,location,bodyPreview,categories")
    .orderby("start/dateTime")
    .top(100)
    .get();

  return response.value || [];
}

export function categorizeEvent(title: string, bodyPreview?: string): string {
  const text = `${title} ${bodyPreview || ""}`.toLowerCase();

  if (
    text.includes("ra ") ||
    text.includes("resident") ||
    text.includes("duty") ||
    text.includes("rounds") ||
    text.includes("floor")
  )
    return "RA";
  if (
    text.includes("psg") ||
    text.includes("peer success") ||
    text.includes("mentoring") ||
    text.includes("tutoring")
  )
    return "PSG";
  if (
    text.includes("phe") ||
    text.includes("health edu") ||
    text.includes("wellness") ||
    text.includes("outreach")
  )
    return "PHE";
  if (
    text.includes("intervarsity") ||
    text.includes("bible") ||
    text.includes("worship") ||
    text.includes("prayer") ||
    text.includes("ministry") ||
    text.includes("small group")
  )
    return "Ministry";
  if (
    text.includes("class") ||
    text.includes("lecture") ||
    text.includes("exam") ||
    text.includes("study") ||
    text.includes("homework") ||
    text.includes("lab")
  )
    return "Academics";

  return "Personal";
}
