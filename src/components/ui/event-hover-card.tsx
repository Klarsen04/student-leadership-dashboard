"use client";

import * as React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventHoverCardProps {
  children: React.ReactNode;
  title: string;
  timeRange: string;
  location?: string | null;
  category?: string;
  colorAccent?: string;
}

export function EventHoverCard({
  children,
  title,
  timeRange,
  location,
  category,
  colorAccent = "#a855f7",
}: EventHoverCardProps) {
  return (
    <Tooltip.Root delayDuration={400}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={8}
          className={cn(
            "z-[100] w-56 rounded-xl bg-white shadow-xl border border-black/10 p-0 overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          )}
        >
          <div className="flex">
            <div className="w-1 shrink-0 rounded-l-xl" style={{ background: colorAccent }} />
            <div className="p-3 flex-1 min-w-0">
              <p className="text-xs font-bold text-black truncate">{title}</p>
              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-black/50">
                <Clock className="w-3 h-3 shrink-0" />
                <span>{timeRange}</span>
              </div>
              {location && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-black/50">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{location}</span>
                </div>
              )}
              {category && (
                <div className="mt-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/5 text-black/50 font-medium">
                    {category}
                  </span>
                </div>
              )}
            </div>
          </div>
          <Tooltip.Arrow className="fill-white" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function EventHoverProvider({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={400} skipDelayDuration={100}>
      {children}
    </Tooltip.Provider>
  );
}
