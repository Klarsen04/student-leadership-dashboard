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

  try {
    const response = await client
      .api("/me/calendarview")
      .query({ startDateTime: startDate, endDateTime: endDate })
      .select("id,subject,start,end,location,bodyPreview,categories")
      .orderby("start/dateTime")
      .top(200)
      .get();

    return response.value || [];
  } catch {
    return [];
  }
}

export function categorizeEvent(
  title: string,
  bodyPreview?: string
): { category: string; role: string } {
  return { category: "Personal", role: "Personal" };
}
