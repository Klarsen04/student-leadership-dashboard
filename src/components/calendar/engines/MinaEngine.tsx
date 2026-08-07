"use client";

import { useMemo } from "react";
import ModalProvider from "@/providers/modal-context";
import { SchedulerProvider } from "@/providers/schedular-provider";
import SchedulerView from "@/components/schedule/_components/view/schedular-view";
import type { Event as MinaEvent } from "@/types/scheduler";
import type { CalendarEngineProps } from "./types";

export default function MinaEngine({
  events,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
}: CalendarEngineProps) {
  // Mina uses JS Date objects (not ISO strings) and a `variant` field.
  const minaEvents = useMemo<MinaEvent[]>(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startDate: new Date(e.startTime),
        endDate: new Date(e.endTime),
        variant: "primary",
      })),
    [events]
  );

  return (
    <div className="mina-engine relative z-20 rounded-2xl overflow-hidden border border-black/10 bg-white p-4">
      <ModalProvider>
        <SchedulerProvider
          initialState={minaEvents}
          weekStartsOn="monday"
          onAddEvent={(ev) =>
            onEventCreate?.({
              title: ev.title,
              startTime: new Date(ev.startDate).toISOString(),
              endTime: new Date(ev.endDate).toISOString(),
            })
          }
          onUpdateEvent={(ev) => {
            const match = events.find((e) => e.id === ev.id);
            if (match)
              onEventUpdate?.({
                ...match,
                title: ev.title,
                startTime: new Date(ev.startDate).toISOString(),
                endTime: new Date(ev.endDate).toISOString(),
              });
          }}
          onDeleteEvent={(id) => onEventDelete?.(id)}
        >
          <SchedulerView />
        </SchedulerProvider>
      </ModalProvider>
    </div>
  );
}
