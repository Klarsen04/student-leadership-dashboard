"use client";

import { useMemo, useEffect, useRef } from "react";
import { IlamyCalendar } from "@ilamy/calendar";
import type { CalendarEngineProps, EngineView } from "./types";
import { classesToEvents, isClassEvent, findClassForEventId } from "./classEvents";
import { calHex } from "@/lib/useCalendars";

// ilamy views: month | week | day (+ its own). Map the app's granular views onto these.
const VIEW_MAP: Record<EngineView, string> = {
  day: "day",
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
  classes,
  currentDate,
  view,
  getColor,
  onEventClick,
  onClassClick,
  onTimeSlotClick,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
}: CalendarEngineProps) {
  // ilamy accepts ISO strings for start/end directly. Merge real events with
  // recurring classes expanded into dated instances so classes render too.
  // Each event is painted with its sub-calendar's colour (classes carry their
  // own hex), so the grid matches the coloured calendar/filter chips.
  const ilamyEvents = useMemo(
    () =>
      [...events, ...classesToEvents(classes, currentDate, view)].map((e) => ({
        id: e.id,
        title: e.title,
        start: e.startTime,
        end: e.endTime,
        description: e.description,
        color: calHex(getColor(e.category)),
        data: { category: e.category, role: e.role, isLed: e.isLed, location: e.location },
      })),
    [events, classes, currentDate, view, getColor]
  );

  // iLamy's day/week grid opens scrolled to midnight, so daytime classes (e.g.
  // a 10am class) sit below the fold and look "missing". Scroll its Radix
  // ScrollArea viewport to ~7am once rendered (and on view/date change).
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (VIEW_MAP[view] === "month") return; // month view isn't time-scrolled
    const wrap = wrapRef.current;
    if (!wrap) return;
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      const grid = wrap.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
      if (grid && grid.scrollHeight > grid.clientHeight) {
        grid.scrollTop = (grid.scrollHeight * 7) / 24; // ~7am
        clearInterval(id);
      } else if (tries > 20) {
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [view, currentDate]);

  return (
    <div ref={wrapRef} className="ilamy-scope relative z-20 h-[70vh] rounded-2xl overflow-hidden border border-black/10 bg-white">
      <IlamyCalendar
        events={ilamyEvents as any}
        initialView={VIEW_MAP[view] as any}
        initialDate={currentDate}
        firstDayOfWeek="monday"
        hiddenDays={view === "5day" ? (["saturday", "sunday"] as any) : undefined}
        onEventClick={(ev: any) => {
          if (isClassEvent(String(ev.id))) {
            const cls = findClassForEventId(String(ev.id), classes);
            if (cls) onClassClick?.(cls);
            return;
          }
          const match = events.find((e) => String(e.id) === String(ev.id));
          if (match) onEventClick(match);
        }}
        // Route empty-cell clicks to the app's own Add Event dialog (calendar +
        // filter-tag selects) instead of iLamy's built-in form, whose colour
        // picker isn't part of the app's data model (colour comes from the
        // event's sub-calendar, Outlook-style).
        onCellClick={(info: any) => {
          const d = typeof info?.start?.toDate === "function" ? info.start.toDate() : new Date(info?.start);
          onTimeSlotClick?.(d, info?.allDay ? 9 : d.getHours());
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

