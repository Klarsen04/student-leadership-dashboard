"use client";

import { useMemo } from "react";
import { IlamyCalendar } from "@ilamy/calendar";
import type { CalendarEngineProps, EngineView } from "./types";

// ilamy views: month | week | day (+ its own). Map the app's granular views onto these.
const VIEW_MAP: Record<EngineView, string> = {
  day: "day",
  "3day": "day",
  "5day": "week",
  week: "week",
  month: "month",
};

// dayjs objects come back from callbacks; normalize to ISO for the app's API.
function toISO(d: any): string {
  if (!d) return "";
  if (typeof d === "string") return d;
  if (typeof d?.toISOString === "function") return d.toISOString();
  if (typeof d?.toDate === "function") return d.toDate().toISOString(); // dayjs
  return String(d);
}

export default function IlamyEngine({
  events,
  currentDate,
  view,
  onEventClick,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
}: CalendarEngineProps) {
  // ilamy accepts ISO strings for start/end directly — pass through, stash app fields in `data`.
  const ilamyEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.startTime,
        end: e.endTime,
        description: e.description,
        data: { category: e.category, role: e.role, isLed: e.isLed, location: e.location },
      })),
    [events]
  );

  return (
    <div className="ilamy-scope relative z-20 h-[70vh] rounded-2xl overflow-hidden border border-black/10 bg-white">
      <IlamyCalendar
        events={ilamyEvents as any}
        initialView={VIEW_MAP[view] as any}
        initialDate={currentDate}
        firstDayOfWeek="monday"
        onEventClick={(ev: any) => {
          const match = events.find((e) => String(e.id) === String(ev.id));
          if (match) onEventClick(match);
        }}
        onEventAdd={(ev: any) =>
          onEventCreate?.({ title: ev.title, startTime: toISO(ev.start), endTime: toISO(ev.end) })
        }
        onEventUpdate={(ev: any) => {
          const match = events.find((e) => String(e.id) === String(ev.id));
          if (match) onEventUpdate?.({ ...match, title: ev.title, startTime: toISO(ev.start), endTime: toISO(ev.end) });
        }}
        onEventDelete={(ev: any) => onEventDelete?.(String(ev.id))}
      />
    </div>
  );
}
