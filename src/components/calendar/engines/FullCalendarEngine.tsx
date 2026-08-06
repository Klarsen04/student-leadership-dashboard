"use client";

import { useMemo, useRef } from "react";
import { CalendarProvider } from "@/features/calendar/contexts/calendar-context";
import { DndProvider } from "@/features/calendar/contexts/dnd-context";
import { CalendarHeader } from "@/features/calendar/header/calendar-header";
import { CalendarBody } from "@/features/calendar/calendar-body";
import type { IEvent, IUser } from "@/features/calendar/interfaces";
import type { CalendarEngineProps } from "./types";

// full-calendar needs numeric ids; the app uses string ids. Keep a stable string<->number map.
const EVENT_COLORS = ["blue", "green", "purple", "orange", "yellow", "red"] as const;

// Single synthetic user — the app's events have no per-user concept.
const DEFAULT_USER: IUser = { id: "me", name: "Me", picturePath: null };

export default function FullCalendarEngine({
  events,
  view,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
}: CalendarEngineProps) {
  // Bidirectional id map: full-calendar emits numeric ids; we translate back to app string ids.
  const idMap = useRef(new Map<number, string>());

  const fcEvents = useMemo<IEvent[]>(() => {
    idMap.current.clear();
    return events.map((e, i) => {
      const numId = i + 1;
      idMap.current.set(numId, e.id);
      // Deterministic color from the category so it's stable across renders.
      const colorIdx =
        Math.abs([...e.category].reduce((a, c) => a + c.charCodeAt(0), 0)) % EVENT_COLORS.length;
      return {
        id: numId,
        startDate: e.startTime,
        endDate: e.endTime,
        title: e.title,
        color: EVENT_COLORS[colorIdx],
        description: e.description ?? "",
        user: DEFAULT_USER,
      };
    });
  }, [events]);

  const fcView = (view === "month" || view === "week" || view === "day" ? view : "week") as any;

  return (
    <div className="relative z-20 rounded-2xl overflow-hidden border border-black/10 bg-white">
      <CalendarProvider
        events={fcEvents}
        users={[DEFAULT_USER]}
        view={fcView}
        onPersistCreate={(ev) =>
          onEventCreate?.({
            title: ev.title,
            startTime: new Date(ev.startDate).toISOString(),
            endTime: new Date(ev.endDate).toISOString(),
          })
        }
        onPersistUpdate={(ev) => {
          const appId = idMap.current.get(ev.id as number);
          const match = events.find((e) => e.id === appId);
          if (match)
            onEventUpdate?.({
              ...match,
              title: ev.title,
              startTime: new Date(ev.startDate).toISOString(),
              endTime: new Date(ev.endDate).toISOString(),
            });
        }}
        onPersistDelete={(numId) => {
          const appId = idMap.current.get(numId);
          if (appId) onEventDelete?.(appId);
        }}
      >
        <DndProvider>
          <div className="w-full">
            <CalendarHeader />
            <CalendarBody />
          </div>
        </DndProvider>
      </CalendarProvider>
    </div>
  );
}
