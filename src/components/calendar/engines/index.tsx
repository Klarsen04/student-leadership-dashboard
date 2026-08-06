"use client";

import { lazy, Suspense, type ComponentType } from "react";
import type { CalendarEngine } from "@/lib/useCalendars";
import type { CalendarEngineProps } from "./types";

export type { CalendarEngineProps, EngineEvent, EngineClass, EngineView } from "./types";

// Each non-default engine is lazy-loaded so its bundle only ships when a calendar uses it.
const DayFlowEngine = lazy(() => import("./DayFlowEngine"));
const IlamyEngine = lazy(() => import("./IlamyEngine"));
const FullCalendarEngine = lazy(() => import("./FullCalendarEngine"));
const MinaEngine = lazy(() => import("./MinaEngine"));

// Registry maps an engine id to its renderer. "default" is null — the page renders its
// own original views (MonthViewCute / TimeGridView) for that case.
const ENGINE_COMPONENTS: Partial<Record<CalendarEngine, ComponentType<CalendarEngineProps>>> = {
  dayflow: DayFlowEngine,
  ilamy: IlamyEngine,
  "full-calendar": FullCalendarEngine,
  mina: MinaEngine,
};

export function hasEngine(engine: CalendarEngine): boolean {
  return engine !== "default" && engine in ENGINE_COMPONENTS;
}

/**
 * Renders the chosen engine. Returns null for "default" (or not-yet-implemented engines)
 * so the caller falls back to the app's built-in views.
 */
export function CalendarEngineHost({
  engine,
  ...props
}: { engine: CalendarEngine } & CalendarEngineProps) {
  const Comp = ENGINE_COMPONENTS[engine];
  if (!Comp) return null;
  return (
    <Suspense
      fallback={
        <div className="relative z-20 flex h-[70vh] items-center justify-center rounded-2xl border border-black/10 bg-white text-black/40 text-sm">
          Loading calendar…
        </div>
      }
    >
      <Comp {...props} />
    </Suspense>
  );
}
