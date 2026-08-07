"use client";

import { useMemo } from "react";
import {
  DayFlowCalendar,
  useCalendarApp,
  createDayView,
  createWeekView,
  createMonthView,
  createYearView,
  createEventsPlugin,
  createEvent,
} from "@dayflow/react";
// Scoped copy of DayFlow's stylesheet — global resets are bound to `.dayflow-scope`
// so they can't leak into the rest of the app. Regenerate via scripts/scope-vendor-css.mjs.
import "./dayflow.scoped.css";
import type { CalendarEngineProps, EngineView } from "./types";

// DayFlow has no "3day/5day"; map those onto its closest native views.
const VIEW_MAP: Record<EngineView, string> = {
  day: "day",
  "3day": "day",
  "5day": "week",
  week: "week",
  month: "month",
};

export default function DayFlowEngine({
  events,
  currentDate,
  view,
  onEventClick,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
}: CalendarEngineProps) {
  // Map the app's events into DayFlow's event objects (Date in → Temporal handled internally).
  const dfEvents = useMemo(
    () =>
      events.map((e) =>
        createEvent({
          id: e.id,
          title: e.title,
          description: e.description,
          start: new Date(e.startTime),
          end: new Date(e.endTime),
        })
      ),
    [events]
  );

  const calendar = useCalendarApp({
    views: [createDayView(), createWeekView(), createMonthView(), createYearView()],
    plugins: [createEventsPlugin()],
    events: dfEvents,
    defaultView: VIEW_MAP[view],
    initialDate: currentDate,
    useCalendarHeader: true,
    // Reskin to the app's cute/warm palette (Instrument Serif + pastel purple accent).
    theme: {
      accent: "#8b5cf6",
      fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif",
    } as any,
    callbacks: {
      onEventClick: (ev: any) => {
        const match = events.find((e) => e.id === ev.id);
        if (match) onEventClick(match);
      },
      onEventCreate: (ev: any) =>
        onEventCreate?.({
          title: ev.title,
          startTime: new Date(ev.start).toISOString?.() ?? String(ev.start),
          endTime: new Date(ev.end).toISOString?.() ?? String(ev.end),
        }),
      onEventUpdate: (ev: any) => {
        const match = events.find((e) => e.id === ev.id);
        if (match)
          onEventUpdate?.({
            ...match,
            title: ev.title,
            startTime: new Date(ev.start).toISOString?.() ?? match.startTime,
            endTime: new Date(ev.end).toISOString?.() ?? match.endTime,
          });
      },
      onEventDelete: (id: string) => onEventDelete?.(id),
    },
  });

  return (
    <div className="dayflow-scope dayflow-engine relative z-20 h-[70vh] rounded-2xl overflow-hidden border border-black/10 bg-white">
      <DayFlowCalendar calendar={calendar} />
    </div>
  );
}
