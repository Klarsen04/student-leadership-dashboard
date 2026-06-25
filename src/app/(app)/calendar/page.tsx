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
import { RefreshCw, Plus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { ROLE_BADGE_VARIANTS } from "@/lib/utils";
import { useRoles, getRoleColor } from "@/lib/useRoles";

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  role: string;
  location: string | null;
  isLed: boolean;
  description?: string;
}

type View = "day" | "week" | "month";

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>("week");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [activeRoles, setActiveRoles] = useState<Set<string>>(new Set());
  const { roles } = useRoles();

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

    try {
      const res = await fetch(
        `/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      if (!res.ok) throw new Error();
      setEvents(await res.json());
    } catch {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate, view]);

  const syncOutlook = async () => {
    setSyncing(true);
    try {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = addDays(start, 14);
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", start: start.toISOString(), end: end.toISOString() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`Synced ${data.synced} events`);
      await fetchEvents();
    } catch {
      toast.error("Failed to sync calendars");
    } finally {
      setSyncing(false);
    }
  };

  const navigate = (dir: number) => {
    if (view === "day") setCurrentDate(addDays(currentDate, dir));
    else if (view === "week") setCurrentDate(addDays(currentDate, dir * 7));
    else setCurrentDate(addDays(currentDate, dir * 30));
  };

  const toggleRoleFilter = (role: string) => {
    setActiveRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const filteredEvents = activeRoles.size === 0
    ? events
    : events.filter((e) => activeRoles.has(e.role));

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
            Sync Calendars
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
                roles={roles}
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

      {/* Role Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setActiveRoles(new Set())}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            activeRoles.size === 0
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          All
        </button>
        {roles.map((role) => {
          const isActive = activeRoles.has(role);
          const color = getRoleColor(role);
          return (
            <button
              key={role}
              onClick={() => toggleRoleFilter(role)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? "ring-2 ring-offset-1 ring-foreground/20 bg-accent text-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${color}`} />
              {role}
            </button>
          );
        })}
      </div>

      {/* Calendar View */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : view === "week" ? (
        <WeekView events={filteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} />
      ) : view === "day" ? (
        <DayView events={filteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} />
      ) : (
        <MonthView events={filteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} />
      )}

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Start:</span>
                  <p className="font-medium">{format(new Date(selectedEvent.startTime), "MMM d, h:mm a")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">End:</span>
                  <p className="font-medium">{format(new Date(selectedEvent.endTime), "MMM d, h:mm a")}</p>
                </div>
              </div>
              {selectedEvent.location && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Location:</span>
                  <p className="font-medium">{selectedEvent.location}</p>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={(ROLE_BADGE_VARIANTS[selectedEvent.role] || "secondary") as any}>
                  {selectedEvent.role}
                </Badge>
                <Badge variant="outline">{selectedEvent.category}</Badge>
              </div>
              <div className="pt-3 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/calendar?id=${selectedEvent.id}`, { method: "DELETE" });
                      if (!res.ok) throw new Error();
                      toast.success("Event deleted");
                      setSelectedEvent(null);
                      fetchEvents();
                    } catch {
                      toast.error("Failed to delete event");
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Event
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WeekView({ events, currentDate, onEventClick }: { events: CalendarEvent[]; currentDate: Date; onEventClick: (e: CalendarEvent) => void }) {
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
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className="w-full text-left p-1.5 rounded text-[11px] bg-accent/50 border leading-tight hover:bg-accent transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getRoleColor(ev.role)}`} />
                    <span className="font-medium truncate">{ev.title}</span>
                  </div>
                  <p className="text-muted-foreground ml-2.5">
                    {format(new Date(ev.startTime), "h:mm a")}
                  </p>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ events, currentDate, onEventClick }: { events: CalendarEvent[]; currentDate: Date; onEventClick: (e: CalendarEvent) => void }) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.startTime), currentDate));
  const hours = Array.from({ length: 16 }, (_, i) => i + 6);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="relative">
          {hours.map((hour) => (
            <div key={hour} className="flex border-t h-16">
              <div className="w-16 pr-2 text-right text-xs text-muted-foreground -mt-2 shrink-0">
                {format(new Date(2024, 0, 1, hour), "h a")}
              </div>
              <div className="flex-1 relative" />
            </div>
          ))}
          {dayEvents.map((ev) => {
            const start = new Date(ev.startTime);
            const end = new Date(ev.endTime);
            const startHour = start.getHours() + start.getMinutes() / 60;
            const endHour = end.getHours() + end.getMinutes() / 60;
            const top = Math.max(0, (startHour - 6) * 64);
            const height = Math.max(24, (endHour - startHour) * 64);

            return (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="absolute left-16 right-2 rounded-md px-2 py-1 text-left border shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  backgroundColor: `var(--accent)`,
                  borderLeftWidth: "3px",
                  borderLeftColor: getRoleColor(ev.role)?.includes("bg-")
                    ? undefined
                    : "#6b7280",
                }}
              >
                <p className="text-xs font-medium truncate">{ev.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {format(start, "h:mm a")} - {format(end, "h:mm a")}
                </p>
                {ev.location && (
                  <p className="text-[10px] text-muted-foreground truncate">{ev.location}</p>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function MonthView({ events, currentDate, onEventClick }: { events: CalendarEvent[]; currentDate: Date; onEventClick: (e: CalendarEvent) => void }) {
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
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className="flex items-center gap-0.5 w-full text-left hover:bg-accent/50 rounded px-0.5 cursor-pointer"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getRoleColor(ev.role)}`} />
                    <span className="text-[9px] truncate">{ev.title}</span>
                  </button>
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

function AddEventForm({ roles, onSaved }: { roles: string[]; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: "",
    startTime: "",
    endTime: "",
    role: roles[0] || "Student",
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
            className="w-full h-10 border rounded-md px-3 text-sm bg-background"
          >
            {roles.map((r) => (
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
