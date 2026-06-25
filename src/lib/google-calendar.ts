import { prisma } from "./prisma";
import { categorizeEvent } from "./microsoft-graph";

async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account?.access_token) return null;

  if (account.expires_at && account.expires_at * 1000 < Date.now()) {
    if (!account.refresh_token) return null;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: account.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) return null;

    const tokens = await res.json();
    await prisma.account.update({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: account.providerAccountId,
        },
      },
      data: {
        access_token: tokens.access_token,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
      },
    });

    return tokens.access_token;
  }

  return account.access_token;
}

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
}

export async function fetchGoogleCalendarEvents(
  userId: string,
  startDate: string,
  endDate: string
): Promise<GoogleCalendarEvent[]> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) return [];

  try {
    const params = new URLSearchParams({
      timeMin: startDate,
      timeMax: endDate,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) return [];

    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function syncGoogleCalendar(
  userId: string,
  startDate: string,
  endDate: string
) {
  const events = await fetchGoogleCalendarEvents(userId, startDate, endDate);
  const synced = [];

  for (const event of events) {
    const startTime = event.start.dateTime || event.start.date;
    const endTime = event.end.dateTime || event.end.date;
    if (!startTime || !endTime) continue;

    const { category, role } = categorizeEvent(event.summary, event.description);
    const googleId = `google_${event.id}`;

    const upserted = await prisma.event.upsert({
      where: { outlookId: googleId },
      update: {
        title: event.summary || "(No title)",
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location: event.location || null,
      },
      create: {
        title: event.summary || "(No title)",
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location: event.location || null,
        category,
        role,
        outlookId: googleId,
        userId,
      },
    });
    synced.push(upserted);
  }

  return synced;
}
