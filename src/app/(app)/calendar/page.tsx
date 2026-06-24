"use client";

import { useEffect, useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { RefreshCw, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { CATEGORIES } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  location: string | null;
  isLed: boolean;
  actualMinutes: number | null;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"week" | "day">("week");

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  const fetchEvents = async () => {
    const start = weekStart.toISOString();
    const end = addDays(weekStart, 7).toISOString();
    const res = await fetch(`/api/calendar?start=${start}&end=${end}`);
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  const syncOutlook = async () => {
    setSyncing(true);
    const start = weekStart.toISOString();
    const end = addDays(weekStart, 7).toISOString();
    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", start, end }),
    });
    await fetchEvents();
    setSyncing(false);
  };

  const updateCategory = async (eventId: string, category: string) => {
    await fetch("/api/calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: eventId, category }),
    });
    fetchEvents();
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600 mt-1">
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={syncOutlook}
            disabled={syncing}
            className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            Sync Outlook
          </button>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setCurrentDate(addDays(currentDate, -7))}
              className="p-1.5 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm font-medium hover:bg-gray-100 rounded"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(addDays(currentDate, 7))}
              className="p-1.5 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Legend */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {CATEGORIES.map((cat) => (
          <div key={cat.value} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${cat.color}`} />
            <span className="text-xs text-gray-600">{cat.label}</span>
          </div>
        ))}
      </div>

      {/* Week View */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading events...</div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {days.map((day) => {
            const dayEvents = events.filter((e) =>
              isSameDay(new Date(e.startTime), day)
            );
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className={`bg-white rounded-xl border p-3 min-h-[200px] ${
                  isToday ? "border-primary-300 bg-primary-50/30" : "border-gray-200"
                }`}
              >
                <div className="text-center mb-3">
                  <p className="text-xs text-gray-500 uppercase">
                    {format(day, "EEE")}
                  </p>
                  <p
                    className={`text-lg font-semibold ${
                      isToday ? "text-primary-600" : "text-gray-900"
                    }`}
                  >
                    {format(day, "d")}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {dayEvents.map((event) => {
                    const cat = CATEGORIES.find((c) => c.value === event.category);
                    return (
                      <div
                        key={event.id}
                        className="group relative p-2 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200"
                      >
                        <div className="flex items-start gap-1.5">
                          <div
                            className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                              cat?.color || "bg-gray-400"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-900 truncate">
                              {event.title}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {format(new Date(event.startTime), "h:mm a")}
                            </p>
                          </div>
                        </div>
                        <select
                          value={event.category}
                          onChange={(e) =>
                            updateCategory(event.id, e.target.value)
                          }
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          title="Change category"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
