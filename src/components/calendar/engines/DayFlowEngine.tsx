"use client";

import { useMemo, useEffect, useRef } from "react";
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
import { classesToEvents, isClassEvent, findClassForEventId } from "./classEvents";

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
  classes,
  currentDate,
  view,
  onEventClick,
  onClassClick,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
}: CalendarEngineProps) {
  // Merge real events with recurring classes expanded into dated instances so
  // classes render alongside events. Map both into DayFlow's event objects.
  const dfEvents = useMemo(
    () =>
      [...events, ...classesToEvents(classes, currentDate, view)].map((e) =>
        createEvent({
          id: e.id,
          title: e.title,
          description: e.description,
          start: new Date(e.startTime),
          end: new Date(e.endTime),
        })
      ),
    [events, classes, currentDate, view]
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
        // A clicked class instance opens the class editor, like the classic view.
        if (isClassEvent(String(ev.id))) {
          const cls = findClassForEventId(String(ev.id), classes);
          if (cls) onClassClick?.(cls);
          return;
        }
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

  // DayFlow's time grid opens scrolled to midnight, so daytime classes/events
  // (e.g. a 10am class) sit far below the fold and look "missing". Scroll the
  // grid to ~7am once it renders (and when the view changes).
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      const grid = wrap.querySelector<HTMLElement>(".df-week-time-grid-scroller");
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
      className="dayflow-scope dayflow-engine relative z-20 h-[70vh] rounded-2xl overflow-hidden border border-black/10 bg-white"
    >
      <DayFlowCalendar calendar={calendar} />
    </div>
  );
}
