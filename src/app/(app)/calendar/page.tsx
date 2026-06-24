"use client";

import { useEffect, useState } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
} from "date-fns";
import { RefreshCw, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ROLES, ROLE_COLORS, ROLE_BADGE_VARIANTS } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  role: string;
  location: string | null;
  isLed: boolean;
}

type View = "day" | "week" | "month";

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>("week");
  const [showAdd, setShowAdd] = useState(false);

  const fetchEvents = async () => {
    let start: Date, end: Date;
    if (view === "day") {
      start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);
    } else if (view === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = addDays(start, 7);
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    }

    const res = await fetch(
      `/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`
    );
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate, view]);

  const syncOutlook = async () => {
    setSyncing(true);
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = addDays(start, 14);
    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", start: start.toISOString(), end: end.toISOString() }),
    });
    await fetchEvents();
    setSyncing(false);
  };

  const navigate = (dir: number) => {
    if (view === "day") setCurrentDate(addDays(currentDate, dir));
    else if (view === "week") setCurrentDate(addDays(currentDate, dir * 7));
    else setCurrentDate(addDays(currentDate, dir * 30));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-muted-foreground text-sm">
            {view === "day"
              ? format(currentDate, "EEEE, MMMM d")
              : view === "week"
              ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")}`
              : format(currentDate, "MMMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={syncOutlook} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </Button>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Event</DialogTitle>
              </DialogHeader>
              <AddEventForm
                onSaved={() => {
                  setShowAdd(false);
                  fetchEvents();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 border rounded-lg p-1">
          {(["day", "week", "month"] as const).map((v) => (
            <Button
              key={v}
              variant={view === v ? "default" : "ghost"}
              size="sm"
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Role legend */}
      <div className="flex gap-3 flex-wrap">
        {ROLES.map((role) => (
          <div key={role} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${ROLE_COLORS[role]}`} />
            <span className="text-xs text-muted-foreground">{role}</span>
          </div>
        ))}
      </div>

      {/* Calendar View */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : view === "week" ? (
        <WeekView events={events} currentDate={currentDate} />
      ) : view === "day" ? (
        <DayView events={events} currentDate={currentDate} />
      ) : (
        <MonthView events={events} currentDate={currentDate} />
      )}
    </div>
  );
}

function WeekView({ events, currentDate }: { events: CalendarEvent[]; currentDate: Date }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const dayEvents = events.filter((e) => isSameDay(new Date(e.startTime), day));
        const isToday = isSameDay(day, new Date());
        return (
          <div
            key={day.toISOString()}
            className={`rounded-lg border p-2 min-h-[180px] ${
              isToday ? "border-primary bg-primary/5" : "bg-background"
            }`}
          >
            <div className="text-center mb-2">
              <p className="text-[10px] text-muted-foreground uppercase">{format(day, "EEE")}</p>
              <p className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                {format(day, "d")}
              </p>
            </div>
            <div className="space-y-1">
              {dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-1.5 rounded text-[11px] bg-accent/50 border leading-tight"
                >
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${ROLE_COLORS[ev.role] || "bg-gray-400"}`} />
                    <span className="font-medium truncate">{ev.title}</span>
                  </div>
                  <p className="text-muted-foreground ml-2.5">
                    {format(new Date(ev.startTime), "h:mm a")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ events, currentDate }: { events: CalendarEvent[]; currentDate: Date }) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.startTime), currentDate));

  return (
    <Card>
      <CardContent className="p-4">
        {dayEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">No events today.</p>
        ) : (
          <div className="space-y-3">
            {dayEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="text-sm text-muted-foreground w-24">
                  {format(new Date(ev.startTime), "h:mm a")}
                  <br />
                  <span className="text-xs">{format(new Date(ev.endTime), "h:mm a")}</span>
                </div>
                <div className={`w-1 h-10 rounded-full ${ROLE_COLORS[ev.role] || "bg-gray-400"}`} />
                <div className="flex-1">
                  <p className="font-medium text-sm">{ev.title}</p>
                  {ev.location && (
                    <p className="text-xs text-muted-foreground">{ev.location}</p>
                  )}
                </div>
                <Badge variant={(ROLE_BADGE_VARIANTS[ev.role] || "secondary") as any}>
                  {ev.role}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MonthView({ events, currentDate }: { events: CalendarEvent[]; currentDate: Date }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = (getDay(monthStart) + 6) % 7;

  return (
    <div>
      <div className="grid grid-cols-7 gap-px text-center mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-xs text-muted-foreground font-medium py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="h-20" />
        ))}
        {days.map((day) => {
          const dayEvents = events.filter((e) => isSameDay(new Date(e.startTime), day));
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={`h-20 p-1 border rounded-sm ${isToday ? "border-primary bg-primary/5" : ""}`}
            >
              <p className={`text-xs ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                {format(day, "d")}
              </p>
              <div className="mt-0.5 space-y-px">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div key={ev.id} className="flex items-center gap-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${ROLE_COLORS[ev.role] || "bg-gray-400"}`} />
                    <span className="text-[9px] truncate">{ev.title}</span>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[9px] text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddEventForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    title: "",
    startTime: "",
    endTime: "",
    role: "Student",
    category: "",
    location: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) onSaved();
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Title *</label>
        <Input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Start *</label>
          <Input
            type="datetime-local"
            required
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">End *</label>
          <Input
            type="datetime-local"
            required
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full h-10 border rounded-md px-3 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Location</label>
          <Input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={saving || !form.title}>
        {saving ? "Saving..." : "Create Event"}
      </Button>
    </form>
  );
}
