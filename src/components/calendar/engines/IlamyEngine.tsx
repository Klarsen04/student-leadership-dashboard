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

/**
 * Format an instant as a zone-less wall-clock string, e.g. "2026-08-13T10:00:00".
 *
 * ilamy's dayjs is wired so its constructor forwards to `dayjs.tz()`, which reads
 * its input *as* wall time in the display zone and throws any offset away:
 * `dayjs.tz("2026-08-13T14:00:00.000Z")` is 2pm, not 10am EDT. Feeding it the UTC
 * ISO strings the API returns therefore drew every event and class one UTC offset
 * late (a 10am class landed in the 2pm row). Local wall time is what it wants;
 * `toISO` turns the dayjs it hands back into a real instant again.
 */
function toWallClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

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
  // Merge real events with recurring classes expanded into dated instances so
  // classes render too, handing ilamy local wall-clock times (see toWallClock).
  // Each event block is filled with its tag's colour (or its sub-calendar's
  // when untagged; classes carry their own hex). ilamy uses `backgroundColor`
  // for the block fill and `color` for the text, so set both.
  const ilamyEvents = useMemo(
    () =>
      [...events, ...classesToEvents(classes, currentDate, view)].map((e) => ({
        id: e.id,
        title: e.title,
        start: toWallClock(e.startTime),
        end: toWallClock(e.endTime),
        description: e.description,
        backgroundColor: calHex(getColor(e.category, e.role)),
        color: "#ffffff",
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
    <div
      ref={wrapRef}
      className="ilamy-scope relative z-20 h-[70vh] rounded-2xl overflow-hidden border border-black/10 bg-white"
      // ilamy's toolbar "New" button opens its own built-in form, whose colour
      // picker isn't persisted anywhere (events looked blue after saving).
      // Intercept it in the capture phase and open the app's Add Event dialog
      // instead. The selector relies on the default English aria-label.
      onClickCapture={(e) => {
        const btn = (e.target as HTMLElement).closest?.('button[aria-label="New"]');
        if (btn && wrapRef.current?.contains(btn)) {
          e.preventDefault();
          e.stopPropagation();
          onTimeSlotClick?.(currentDate, 9);
        }
      }}
    >
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

