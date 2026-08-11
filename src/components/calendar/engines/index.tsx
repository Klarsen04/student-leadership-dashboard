"use client";

import { lazy, Suspense } from "react";
import type { CalendarEngineProps } from "./types";
import "./engine-theme.css";

export type { CalendarEngineProps, EngineEvent, EngineClass, EngineView } from "./types";

// iLamy is the app's single calendar engine. It's lazy-loaded so its bundle only
// ships when the calendar page mounts.
const IlamyEngine = lazy(() => import("./IlamyEngine"));

/**
 * Renders the iLamy calendar engine with a loading fallback.
 */
export function CalendarEngineHost(props: CalendarEngineProps) {
  return (
    <Suspense
      fallback={
        <div className="relative z-20 flex h-[70vh] items-center justify-center rounded-2xl border border-black/10 bg-white text-black/40 text-sm">
          Loading calendar…
        </div>
      }
    >
      <IlamyEngine {...props} />
    </Suspense>
  );
}
