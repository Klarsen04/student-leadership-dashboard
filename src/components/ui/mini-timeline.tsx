"use client";

import { useMemo, useEffect, useState } from "react";
import { startOfWeek, addDays, isSameDay, isToday, format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MiniTimelineProps {
  classes: Array<{
    id: string;
    title: string;
    days: string[];
    startTime: string;
    endTime: string;
    color: string;
  }>;
  events: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    category: string;
  }>;
  currentDate: Date;
  className?: string;
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const HOUR_START = 6; // 6am
const HOUR_END = 23; // 11pm
const TOTAL_MINUTES = (HOUR_END - HOUR_START) * 60;

function timeToMinutes(timeStr: string): number {
  const date = new Date(timeStr);
  return date.getHours() * 60 + date.getMinutes();
}

function minutesToPercent(minutes: number): number {
  const offset = minutes - HOUR_START * 60;
  return Math.max(0, Math.min(100, (offset / TOTAL_MINUTES) * 100));
}

function getDayName(dayIndex: number): string {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[dayIndex];
}

export function MiniTimeline({ classes, events, currentDate, className }: MiniTimelineProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const currentTimePercent = useMemo(() => {
    const minutes = now.getHours() * 60 + now.getMinutes();
    return minutesToPercent(minutes);
  }, [now]);

  const isCurrentWeek = useMemo(() => {
    return weekDays.some((day) => isSameDay(day, now));
  }, [weekDays, now]);

  // Build bars for each day column
  const dayBars = useMemo(() => {
    return weekDays.map((day, dayIndex) => {
      const bars: Array<{
        id: string;
        title: string;
        top: number;
        height: number;
        color: string;
      }> = [];

      // Add class bars
      classes.forEach((cls) => {
        const dayOfWeek = getDayName(day.getDay());
        if (cls.days.includes(dayOfWeek) || cls.days.includes(dayOfWeek.slice(0, 3))) {
          const startMinutes = timeToMinutes(cls.startTime);
          const endMinutes = timeToMinutes(cls.endTime);
          const top = minutesToPercent(startMinutes);
          const bottom = minutesToPercent(endMinutes);
          bars.push({
            id: `class-${cls.id}-${dayIndex}`,
            title: cls.title,
            top,
            height: Math.max(bottom - top, 1.5),
            color: cls.color,
          });
        }
      });

      // Add event bars
      events.forEach((evt) => {
        const evtDate = new Date(evt.startTime);
        if (isSameDay(evtDate, day)) {
          const startMinutes = timeToMinutes(evt.startTime);
          const endMinutes = timeToMinutes(evt.endTime);
          const top = minutesToPercent(startMinutes);
          const bottom = minutesToPercent(endMinutes);
          bars.push({
            id: `event-${evt.id}`,
            title: evt.title,
            top,
            height: Math.max(bottom - top, 1.5),
            color: getCategoryColor(evt.category),
          });
        }
      });

      return bars;
    });
  }, [weekDays, classes, events]);

  return (
    <div className={cn("bg-white rounded-2xl border border-black/5 p-3", className)}>
      {/* Day labels */}
      <div className="flex ml-[22px]">
        {DAY_LABELS.map((label, i) => (
          <div
            key={i}
            className={cn(
              "w-[30px] text-center text-[10px] font-medium",
              isToday(weekDays[i]) ? "text-purple-600 font-semibold" : "text-black/40"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Timeline body */}
      <div className="flex mt-1.5">
        {/* Hour markers */}
        <div className="relative w-[22px] h-[120px] flex-shrink-0">
          <span className="absolute text-[8px] text-black/30 leading-none" style={{ top: `${minutesToPercent(8 * 60)}%` }}>
            8a
          </span>
          <span className="absolute text-[8px] text-black/30 leading-none" style={{ top: `${minutesToPercent(12 * 60)}%` }}>
            12p
          </span>
          <span className="absolute text-[8px] text-black/30 leading-none" style={{ top: `${minutesToPercent(18 * 60)}%` }}>
            6p
          </span>
        </div>

        {/* Day columns */}
        <div className="flex flex-1 relative">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className={cn(
                "relative w-[30px] h-[120px] border-l border-black/[0.04]",
                isToday(day) && "bg-purple-50/60 rounded-sm"
              )}
            >
              {dayBars[i].map((bar, barIndex) => (
                <motion.div
                  key={bar.id}
                  className="absolute left-[3px] right-[3px] rounded-full"
                  style={{
                    top: `${bar.top}%`,
                    height: `${bar.height}%`,
                    minHeight: "3px",
                    backgroundColor: bar.color,
                  }}
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{
                    duration: 0.3,
                    delay: i * 0.05 + barIndex * 0.02,
                    ease: "easeOut",
                  }}
                  title={bar.title}
                />
              ))}
            </div>
          ))}

          {/* Current time line */}
          {isCurrentWeek && (
            <div
              className="absolute left-0 right-0 h-[1.5px] bg-red-400 pointer-events-none z-10"
              style={{ top: `${currentTimePercent}%` }}
            >
              <div className="absolute -left-[2px] -top-[2px] w-[5px] h-[5px] rounded-full bg-red-400" />
            </div>
          )}
        </div>
      </div>

      {/* Footer label */}
      <div className="mt-1.5 text-[9px] text-black/30 text-center">
        {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d")}
      </div>
    </div>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    meeting: "#8b5cf6",
    deadline: "#ef4444",
    social: "#f59e0b",
    study: "#3b82f6",
    work: "#10b981",
    personal: "#ec4899",
  };
  return colors[category] || "#6b7280";
}
