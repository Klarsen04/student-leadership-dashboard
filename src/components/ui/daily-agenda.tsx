"use client";

import { motion } from "framer-motion";
import { format, isBefore, isAfter, getDay } from "date-fns";
import { MapPin, Clock, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgendaEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  category: string;
}

interface AgendaClass {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  color: string;
  days: string[];
}

interface DailyAgendaProps {
  events: AgendaEvent[];
  classes: AgendaClass[];
  className?: string;
  onItemClick?: (id: string) => void;
}

interface AgendaItem {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location: string | null;
  color: string;
  type: "event" | "class";
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MAX_VISIBLE = 8;

function parseTimeToday(timeStr: string): Date {
  const now = new Date();
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  return date;
}

function formatCompactTime(date: Date): string {
  return format(date, "h:mm");
}

function getItemStatus(item: AgendaItem, now: Date): "past" | "active" | "future" {
  if (isBefore(item.endTime, now)) return "past";
  if (isAfter(item.startTime, now)) return "future";
  return "active";
}

export function DailyAgenda({ events, classes, className, onItemClick }: DailyAgendaProps) {
  const now = new Date();
  const todayDayName = DAY_NAMES[getDay(now)];

  const todayClasses: AgendaItem[] = classes
    .filter((cls) => cls.days.includes(todayDayName))
    .map((cls) => ({
      id: cls.id,
      title: cls.title,
      startTime: parseTimeToday(cls.startTime),
      endTime: parseTimeToday(cls.endTime),
      location: cls.location,
      color: cls.color,
      type: "class" as const,
    }));

  const todayEvents: AgendaItem[] = events.map((evt) => ({
    id: evt.id,
    title: evt.title,
    startTime: parseTimeToday(evt.startTime),
    endTime: parseTimeToday(evt.endTime),
    location: evt.location,
    color: getCategoryColor(evt.category),
    type: "event" as const,
  }));

  const allItems = [...todayClasses, ...todayEvents].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  const visibleItems = allItems.slice(0, MAX_VISIBLE);
  const overflowCount = allItems.length - MAX_VISIBLE;

  if (allItems.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          className="mb-4 opacity-40"
        >
          <rect x="8" y="12" width="48" height="44" rx="6" stroke="currentColor" strokeWidth="2" />
          <path d="M8 24h48" stroke="currentColor" strokeWidth="2" />
          <rect x="20" y="4" width="2" height="12" rx="1" fill="currentColor" />
          <rect x="42" y="4" width="2" height="12" rx="1" fill="currentColor" />
          <circle cx="32" cy="38" r="3" fill="currentColor" opacity="0.3" />
          <path d="M26 44h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        </svg>
        <p className="text-sm font-medium text-muted-foreground">No events today</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Enjoy your free time</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {visibleItems.map((item, index) => {
        const status = getItemStatus(item, now);

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
            onClick={() => onItemClick?.(item.id)}
            className={cn(
              "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
              onItemClick && "cursor-pointer hover:bg-accent/50",
              status === "past" && "opacity-60",
              status === "active" && "bg-accent/30"
            )}
          >
            {/* Color dot */}
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />

            {/* Time range */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground w-[90px] shrink-0">
              <Clock className="w-3 h-3" />
              <span className="font-medium">
                {formatCompactTime(item.startTime)}&ndash;{formatCompactTime(item.endTime)}
              </span>
            </div>

            {/* Title and location */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{item.title}</span>
                {status === "active" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-green-500/15 text-green-600 dark:text-green-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    Live
                  </span>
                )}
              </div>
              {item.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground/70 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{item.location}</span>
                </div>
              )}
            </div>

            {/* Active indicator */}
            {status === "active" && (
              <Radio className="w-4 h-4 text-green-500 shrink-0" />
            )}
          </motion.div>
        );
      })}

      {overflowCount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: MAX_VISIBLE * 0.05, duration: 0.3 }}
          className="px-3 py-2 text-xs text-muted-foreground font-medium"
        >
          +{overflowCount} more
        </motion.div>
      )}
    </div>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    meeting: "#6366f1",
    class: "#8b5cf6",
    deadline: "#ef4444",
    event: "#f59e0b",
    personal: "#10b981",
    work: "#3b82f6",
    study: "#8b5cf6",
  };
  return colors[category.toLowerCase()] || "#6b7280";
}
