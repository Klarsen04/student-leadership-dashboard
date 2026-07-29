"use client";

import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, addMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MiniCalendarProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  events?: { startTime: string }[];
  className?: string;
}

export function MiniCalendar({ currentDate, onDateSelect, events = [], className }: MiniCalendarProps) {
  const [displayMonth, setDisplayMonth] = useState(new Date(currentDate));
  const [direction, setDirection] = useState(0);

  const monthStart = startOfMonth(displayMonth);
  const monthEnd = endOfMonth(displayMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = (getDay(monthStart) + 6) % 7;

  const eventDays = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      const d = new Date(e.startTime);
      set.add(format(d, "yyyy-MM-dd"));
    });
    return set;
  }, [events]);

  const navigateMonth = (dir: number) => {
    setDirection(dir);
    setDisplayMonth((prev) => addMonths(prev, dir));
  };

  return (
    <div className={cn("bg-white rounded-2xl shadow-sm border border-black/5 p-3", className)}>
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigateMonth(-1)} className="p-1 rounded-md hover:bg-black/5 text-black/50 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold text-black/80">{format(displayMonth, "MMMM yyyy")}</span>
        <button onClick={() => navigateMonth(1)} className="p-1 rounded-md hover:bg-black/5 text-black/50 transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-black/30 py-0.5">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={format(displayMonth, "yyyy-MM")}
          initial={{ opacity: 0, x: direction * 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -20 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-7"
        >
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="w-7 h-7" />
          ))}
          {days.map((day) => {
            const selected = isSameDay(day, currentDate);
            const today = isToday(day);
            const hasEvents = eventDays.has(format(day, "yyyy-MM-dd"));

            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateSelect(day)}
                className={cn(
                  "w-7 h-7 rounded-full flex flex-col items-center justify-center text-[10px] font-medium transition-all relative",
                  today && !selected && "bg-purple-500 text-white",
                  selected && "ring-2 ring-purple-400 ring-offset-1 bg-purple-50 text-purple-700",
                  !today && !selected && "text-black/60 hover:bg-black/5"
                )}
              >
                {format(day, "d")}
                {hasEvents && !today && !selected && (
                  <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-purple-400" />
                )}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
