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
  isWithinInterval,
  differenceInDays,
} from "date-fns";
import { RefreshCw, Plus, ChevronLeft, ChevronRight, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ROLE_BADGE_VARIANTS } from "@/lib/utils";
import { useRoles, getRoleColor } from "@/lib/useRoles";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  const [editingEvent, setEditingEvent] = useState(false);
  const [activeRoles, setActiveRoles] = useState<Set<string>>(new Set());
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [roleUsageCount, setRoleUsageCount] = useState(0);
  const { roles, addRole, deleteRole } = useRoles();

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
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    const success = addRole(newRoleName.trim());
    if (success) {
      toast.success(`Added "${newRoleName.trim()}" filter`);
      setNewRoleName("");
      setShowAddRole(false);
    } else {
      toast.error("Role already exists");
    }
  };

  const handleDeleteRole = async (role: string) => {
    try {
      const res = await fetch(`/api/calendar?role=${encodeURIComponent(role)}`);
      let count = 0;
      if (res.ok) {
        const evts = await res.json();
        count = Array.isArray(evts) ? evts.length : 0;
      }
      const taskRes = await fetch(`/api/tasks?role=${encodeURIComponent(role)}&limit=1`);
      if (taskRes.ok) {
        const data = await taskRes.json();
        count += data.total || 0;
      }
      setRoleUsageCount(count);
      setRoleToDelete(role);
    } catch {
      setRoleUsageCount(0);
      setRoleToDelete(role);
    }
  };

  const confirmDeleteRole = () => {
    if (roleToDelete) {
      deleteRole(roleToDelete);
      activeRoles.delete(roleToDelete);
      setActiveRoles(new Set(activeRoles));
      toast.success(`Removed "${roleToDelete}" filter`);
      setRoleToDelete(null);
    }
  };

  const filteredEvents = activeRoles.size === 0
    ? events
    : events.filter((e) => activeRoles.has(e.role));

  const deleteEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Event deleted");
      setSelectedEvent(null);
      fetchEvents();
    } catch {
      toast.error("Failed to delete event");
    }
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
            Sync Calendars
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Event
          </Button>
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
            <div key={role} className="group relative flex items-center">
              <button
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
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteRole(role); }}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive/80 text-white items-center justify-center text-[8px] hidden group-hover:flex hover:bg-destructive transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}
        {showAddRole ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleAddRole(); }}
            className="flex items-center gap-1"
          >
            <input
              autoFocus
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Role name..."
              className="h-6 w-24 px-2 text-xs border rounded-full bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              onBlur={() => { if (!newRoleName) setShowAddRole(false); }}
            />
            <button
              type="submit"
              disabled={!newRoleName.trim()}
              className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowAddRole(true)}
            className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-foreground hover:text-foreground text-muted-foreground transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
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

      {/* Add Event Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
            <DialogDescription>Create a new calendar event</DialogDescription>
          </DialogHeader>
          <EventForm
            roles={roles}
            onSaved={() => { setShowAdd(false); fetchEvents(); }}
            onCancel={() => setShowAdd(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Event Detail / Edit Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => { if (!open) { setSelectedEvent(null); setEditingEvent(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit Event" : selectedEvent?.title}</DialogTitle>
            {editingEvent && <DialogDescription>Update event details</DialogDescription>}
          </DialogHeader>
          {selectedEvent && !editingEvent && (
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
                {selectedEvent.category && (
                  <Badge variant="outline">{selectedEvent.category}</Badge>
                )}
              </div>
              <div className="pt-3 border-t flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingEvent(true)}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteEvent(selectedEvent.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
          {selectedEvent && editingEvent && (
            <EventForm
              roles={roles}
              event={selectedEvent}
              onSaved={() => { setSelectedEvent(null); setEditingEvent(false); fetchEvents(); }}
              onCancel={() => setEditingEvent(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!roleToDelete}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
        title={`Delete "${roleToDelete}" filter?`}
        description={
          roleUsageCount > 0
            ? `This role is used by ${roleUsageCount} task${roleUsageCount !== 1 ? "s" : ""}/event${roleUsageCount !== 1 ? "s" : ""}. They will keep their label but this filter will be removed.`
            : "No tasks or events use this role. Safe to delete."
        }
        onConfirm={confirmDeleteRole}
      />
    </div>
  );
}

function WeekView({ events, currentDate, onEventClick }: { events: CalendarEvent[]; currentDate: Date; onEventClick: (e: CalendarEvent) => void }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getMultiDayEvents = () => {
    return events.filter((e) => {
      const start = new Date(e.startTime);
      const end = new Date(e.endTime);
      return !isSameDay(start, end);
    });
  };

  const getSingleDayEvents = (day: Date) => {
    return events.filter((e) => {
      const start = new Date(e.startTime);
      const end = new Date(e.endTime);
      return isSameDay(start, day) && isSameDay(start, end);
    });
  };

  const multiDayEvents = getMultiDayEvents();

  return (
    <div className="space-y-2">
      {/* Multi-day event spans */}
      {multiDayEvents.length > 0 && (
        <div className="space-y-1 mb-2">
          {multiDayEvents.map((ev) => {
            const evStart = new Date(ev.startTime);
            const evEnd = new Date(ev.endTime);
            const startIdx = days.findIndex((d) => isSameDay(d, evStart) || d > evStart);
            const endIdx = days.findIndex((d) => d >= evEnd);
            const colStart = Math.max(0, startIdx === -1 ? 0 : startIdx);
            const colEnd = endIdx === -1 ? 7 : Math.min(7, endIdx + 1);
            if (colStart >= 7 || colEnd <= 0) return null;

            return (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="w-full hover:opacity-80 transition-opacity cursor-pointer"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "0.5rem",
                }}
              >
                <div
                  className={`rounded-md px-2 py-1 text-[11px] font-medium text-white ${getRoleColor(ev.role)} truncate`}
                  style={{
                    gridColumnStart: colStart + 1,
                    gridColumnEnd: colEnd + 1,
                  }}
                >
                  {ev.title} · {format(evStart, "MMM d")} – {format(evEnd, "MMM d")}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Day columns */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayEvents = getSingleDayEvents(day);
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
    </div>
  );
}

function DayView({ events, currentDate, onEventClick }: { events: CalendarEvent[]; currentDate: Date; onEventClick: (e: CalendarEvent) => void }) {
  const dayEvents = events.filter((e) => {
    const start = new Date(e.startTime);
    const end = new Date(e.endTime);
    return isSameDay(start, currentDate) || isSameDay(end, currentDate) ||
      isWithinInterval(currentDate, { start, end });
  });
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="relative">
          {hours.map((hour) => (
            <div key={hour} className="flex border-t h-14">
              <div className="w-16 pr-2 text-right text-xs text-muted-foreground -mt-2 shrink-0">
                {format(new Date(2024, 0, 1, hour), "h a")}
              </div>
              <div className="flex-1 relative" />
            </div>
          ))}
          {dayEvents.map((ev) => {
            const start = new Date(ev.startTime);
            const end = new Date(ev.endTime);
            const startHour = isSameDay(start, currentDate)
              ? start.getHours() + start.getMinutes() / 60
              : 0;
            const endHour = isSameDay(end, currentDate)
              ? end.getHours() + end.getMinutes() / 60
              : 24;
            const top = startHour * 56;
            const height = Math.max(24, (endHour - startHour) * 56);

            return (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="absolute left-16 right-2 rounded-md px-2 py-1 text-left border shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden bg-accent"
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  borderLeftWidth: "3px",
                  borderLeftColor: "currentColor",
                }}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${getRoleColor(ev.role)}`} />
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
          const dayEvents = events.filter((e) => {
            const start = new Date(e.startTime);
            const end = new Date(e.endTime);
            return isSameDay(start, day) || isSameDay(end, day) ||
              (start < day && end > day);
          });
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

function EventForm({
  roles,
  event,
  onSaved,
  onCancel,
}: {
  roles: string[];
  event?: CalendarEvent;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: event?.title || "",
    startTime: event ? format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm") : "",
    endTime: event ? format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm") : "",
    role: event?.role || roles[0] || "Student",
    category: event?.category || "",
    location: event?.location || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (event) {
        const res = await fetch("/api/calendar", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: event.id, ...form }),
        });
        if (!res.ok) throw new Error();
        toast.success("Event updated");
      } else {
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        toast.success("Event created");
      }
      onSaved();
    } catch {
      toast.error(event ? "Failed to update event" : "Failed to create event");
    } finally {
      setSaving(false);
    }
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
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving || !form.title}>
          {saving ? "Saving..." : event ? "Save Changes" : "Create Event"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
