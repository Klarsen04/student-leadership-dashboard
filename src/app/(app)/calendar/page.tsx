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
import { Plus, ChevronLeft, ChevronRight, Trash2, Pencil, X } from "lucide-react";
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
import { useCalendars, SubCalendar } from "@/lib/useCalendars";
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>("week");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [showAddCalendar, setShowAddCalendar] = useState(false);
  const [newCalName, setNewCalName] = useState("");
  const [newCalColor, setNewCalColor] = useState("bg-blue-500");
  const [selectedCalendar, setSelectedCalendar] = useState<string | null>(null);
  const [calendarToDelete, setCalendarToDelete] = useState<string | null>(null);
  const { calendars, addCalendar, deleteCalendar, addTag, deleteTag, getCalendarColor, getTagsForCalendar, getCalendarByName, COLOR_OPTIONS } = useCalendars();

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
      const [evRes, taskRes] = await Promise.all([
        fetch(`/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`),
        fetch("/api/tasks?limit=100"),
      ]);
      const calEvents = evRes.ok ? await evRes.json() : [];
      let taskEvents: CalendarEvent[] = [];
      if (taskRes.ok) {
        const taskData = await taskRes.json();
        const tasks = taskData.tasks || taskData;
        taskEvents = tasks
          .filter((t: any) => t.dueDate && t.status !== "done")
          .map((t: any) => ({
            id: `task_${t.id}`,
            title: `📋 ${t.title}`,
            startTime: t.dueDate,
            endTime: t.dueDate,
            category: "Personal",
            role: "",
            location: null,
            isLed: false,
          }));
      }
      setEvents([...calEvents, ...taskEvents]);
    } catch {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate, view]);

  const navigate = (dir: number) => {
    if (view === "day") setCurrentDate(addDays(currentDate, dir));
    else if (view === "week") setCurrentDate(addDays(currentDate, dir * 7));
    else setCurrentDate(addDays(currentDate, dir * 30));
  };

  const currentTags = getTagsForCalendar(selectedCalendar);

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const cal = selectedCalendar
      ? calendars.find((c) => c.name === selectedCalendar)
      : calendars[0];
    if (!cal) return;
    const success = addTag(cal.id, newTagName.trim());
    if (success) {
      toast.success(`Added "${newTagName.trim()}" tag`);
      setNewTagName("");
      setShowAddTag(false);
    } else {
      toast.error("Tag already exists in this calendar");
    }
  };

  const handleDeleteTag = (tag: string) => {
    setTagToDelete(tag);
  };

  const confirmDeleteTag = async () => {
    if (tagToDelete) {
      const matchingEvents = events.filter((e) => e.role === tagToDelete);
      for (const ev of matchingEvents) {
        try {
          await fetch("/api/calendar", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: ev.id, role: "" }),
          });
        } catch {}
      }
      const cal = selectedCalendar
        ? calendars.find((c) => c.name === selectedCalendar)
        : calendars.find((c) => c.tags.includes(tagToDelete!));
      if (cal) deleteTag(cal.id, tagToDelete);
      if (activeTag === tagToDelete) setActiveTag(null);
      setEvents((prev) => prev.map((e) => e.role === tagToDelete ? { ...e, role: "" } : e));
      toast.success(`Removed "${tagToDelete}" tag from ${matchingEvents.length} event${matchingEvents.length !== 1 ? "s" : ""}`);
      setTagToDelete(null);
    }
  };

  const filteredEvents = events.filter((e) => {
    if (selectedCalendar && e.category !== selectedCalendar) return false;
    if (activeTag && e.role !== activeTag) return false;
    return true;
  });

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

      {/* Tags (per-calendar) */}
      {currentTags.length > 0 || selectedCalendar ? (
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeTag === null
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            All Tags
          </button>
          {currentTags.map((tag) => (
            <div key={tag} className="group relative flex items-center">
              <button
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  activeTag === tag
                    ? "ring-2 ring-offset-1 ring-foreground/20 bg-accent text-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {tag}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag); }}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive/80 text-white items-center justify-center text-[8px] hidden group-hover:flex hover:bg-destructive transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          {showAddTag ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleAddTag(); }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name..."
                className="h-6 w-24 px-2 text-xs border rounded-full bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                onBlur={() => { if (!newTagName) setShowAddTag(false); }}
              />
              <button
                type="submit"
                disabled={!newTagName.trim()}
                className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowAddTag(true)}
              className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-foreground hover:text-foreground text-muted-foreground transition-colors"
              title="Add tag"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
      ) : null}

      {/* My Calendars */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setSelectedCalendar(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedCalendar === null
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          All Calendars
        </button>
        {calendars.map((cal) => {
          const isSelected = selectedCalendar === cal.name;
          return (
            <div key={cal.id} className="group relative flex items-center">
              <button
                onClick={() => setSelectedCalendar(isSelected ? null : cal.name)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isSelected
                    ? "ring-2 ring-offset-1 ring-foreground/20 bg-accent text-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${cal.color}`} />
                {cal.name}
              </button>
              {cal.id !== "default" && (
                <button
                  onClick={(e) => { e.stopPropagation(); setCalendarToDelete(cal.id); }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive/80 text-white items-center justify-center text-[8px] hidden group-hover:flex hover:bg-destructive transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
        {showAddCalendar ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newCalName}
              onChange={(e) => setNewCalName(e.target.value)}
              placeholder="Calendar name..."
              className="h-6 w-28 px-2 text-xs border rounded-full bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCalName.trim()) {
                  addCalendar(newCalName.trim(), newCalColor);
                  setNewCalName("");
                  setShowAddCalendar(false);
                }
              }}
              onBlur={() => { if (!newCalName) setShowAddCalendar(false); }}
            />
            <div className="flex gap-0.5">
              {COLOR_OPTIONS.slice(0, 6).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewCalColor(c)}
                  className={`w-4 h-4 rounded-full ${c} ${newCalColor === c ? "ring-2 ring-offset-1 ring-foreground/30" : ""}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (newCalName.trim()) {
                  addCalendar(newCalName.trim(), newCalColor);
                  setNewCalName("");
                  setShowAddCalendar(false);
                }
              }}
              disabled={!newCalName.trim()}
              className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddCalendar(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-foreground/30 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Calendar
          </button>
        )}
      </div>

      {/* Calendar View */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : view === "week" ? (
        <WeekView events={filteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} getColor={getCalendarColor} />
      ) : view === "day" ? (
        <DayView events={filteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} getColor={getCalendarColor} />
      ) : (
        <MonthView events={filteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} getColor={getCalendarColor} />
      )}

      {/* Add Event Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
            <DialogDescription>Create a new calendar event</DialogDescription>
          </DialogHeader>
          <EventForm
            calendars={calendars}
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
              {selectedEvent.id.startsWith("task_") ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    This is a task due on {format(new Date(selectedEvent.startTime), "MMM d, yyyy")}
                  </p>
                  <div className="pt-3 border-t">
                    <a href="/tasks">
                      <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>
                        Go to Tasks
                      </Button>
                    </a>
                  </div>
                </div>
              ) : (
                <>
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
                  {selectedEvent.role && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant={(ROLE_BADGE_VARIANTS[selectedEvent.role] || "secondary") as any}>
                        {selectedEvent.role}
                      </Badge>
                      {selectedEvent.category && (
                        <Badge variant="outline">{selectedEvent.category}</Badge>
                      )}
                    </div>
                  )}
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
                </>
              )}
            </div>
          )}
          {selectedEvent && editingEvent && (
            <EventForm
              calendars={calendars}
              event={selectedEvent}
              onSaved={() => { setSelectedEvent(null); setEditingEvent(false); fetchEvents(); }}
              onCancel={() => setEditingEvent(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!tagToDelete}
        onOpenChange={(open) => !open && setTagToDelete(null)}
        title={`Delete "${tagToDelete}" tag?`}
        description="Events with this tag will keep their label, but the tag filter will be removed from this calendar."
        onConfirm={confirmDeleteTag}
      />

      <ConfirmDialog
        open={!!calendarToDelete}
        onOpenChange={(open) => !open && setCalendarToDelete(null)}
        title="Delete this calendar?"
        description={(() => {
          const cal = calendars.find((c) => c.id === calendarToDelete);
          const count = cal ? events.filter((e) => e.category === cal.name).length : 0;
          return count > 0
            ? `This will permanently delete ${count} event${count !== 1 ? "s" : ""} in this calendar. This cannot be undone.`
            : "No events in this calendar. Safe to delete.";
        })()}
        onConfirm={async () => {
          if (calendarToDelete) {
            const cal = calendars.find((c) => c.id === calendarToDelete);
            if (cal) {
              const calEvents = events.filter((e) => e.category === cal.name);
              for (const ev of calEvents) {
                try {
                  await fetch(`/api/calendar?id=${ev.id}`, { method: "DELETE" });
                } catch {}
              }
              setEvents((prev) => prev.filter((e) => e.category !== cal.name));
              if (selectedCalendar === cal.name) setSelectedCalendar(null);
            }
            deleteCalendar(calendarToDelete);
            toast.success("Calendar and its events deleted");
            setCalendarToDelete(null);
          }
        }}
      />
    </div>
  );
}

function WeekView({ events, currentDate, onEventClick, getColor }: { events: CalendarEvent[]; currentDate: Date; onEventClick: (e: CalendarEvent) => void; getColor: (category: string) => string }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const MAX_VISIBLE_SPANS = 3;

  const multiDayEvents = events.filter((e) => {
    const start = new Date(e.startTime);
    const end = new Date(e.endTime);
    return !isSameDay(start, end);
  });

  const getSingleDayEvents = (day: Date) => {
    return events.filter((e) => {
      const start = new Date(e.startTime);
      const end = new Date(e.endTime);
      return isSameDay(start, day) && isSameDay(start, end);
    });
  };

  const [showAllSpans, setShowAllSpans] = useState(false);
  const visibleSpans = showAllSpans ? multiDayEvents : multiDayEvents.slice(0, MAX_VISIBLE_SPANS);
  const hiddenCount = multiDayEvents.length - MAX_VISIBLE_SPANS;

  return (
    <div className="space-y-2">
      {/* Multi-day event spans */}
      {multiDayEvents.length > 0 && (
        <div className="rounded-lg border bg-card/50 p-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1">
            Multi-day events
          </p>
          {visibleSpans.map((ev) => {
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
                  className={`rounded px-2 py-0.5 text-[10px] font-medium text-white ${getColor(ev.category)} truncate`}
                  style={{
                    gridColumnStart: colStart + 1,
                    gridColumnEnd: colEnd + 1,
                  }}
                >
                  {ev.title}
                </div>
              </button>
            );
          })}
          {!showAllSpans && hiddenCount > 0 && (
            <button
              onClick={() => setShowAllSpans(true)}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1 transition-colors"
            >
              +{hiddenCount} more
            </button>
          )}
          {showAllSpans && hiddenCount > 0 && (
            <button
              onClick={() => setShowAllSpans(false)}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1 transition-colors"
            >
              Show less
            </button>
          )}
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
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getColor(ev.category)}`} />
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

function DayView({ events, currentDate, onEventClick, getColor }: { events: CalendarEvent[]; currentDate: Date; onEventClick: (e: CalendarEvent) => void; getColor: (category: string) => string }) {
  const dayEvents = events.filter((e) => {
    const start = new Date(e.startTime);
    const end = new Date(e.endTime);
    return isSameDay(start, currentDate) || isSameDay(end, currentDate) ||
      isWithinInterval(currentDate, { start, end });
  });

  const allDayEvents = dayEvents.filter((e) => {
    const start = new Date(e.startTime);
    const end = new Date(e.endTime);
    return !isSameDay(start, end);
  });

  const timedEvents = dayEvents.filter((e) => {
    const start = new Date(e.startTime);
    const end = new Date(e.endTime);
    return isSameDay(start, end);
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-2">
      {/* All-day / multi-day banner */}
      {allDayEvents.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">All Day / Multi-Day</p>
            <div className="space-y-1">
              {allDayEvents.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${getColor(ev.category)}`} />
                  <span className="text-sm font-medium truncate">{ev.title}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                    {format(new Date(ev.startTime), "MMM d")} – {format(new Date(ev.endTime), "MMM d")}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time grid */}
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
            {timedEvents.map((ev) => {
              const start = new Date(ev.startTime);
              const end = new Date(ev.endTime);
              const startHour = start.getHours() + start.getMinutes() / 60;
              const endHour = end.getHours() + end.getMinutes() / 60;
              const top = startHour * 56;
              const height = Math.max(28, (endHour - startHour) * 56);

              return (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className="absolute left-16 right-2 rounded-md px-2 py-1 text-left border shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden bg-accent"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                  }}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md ${getColor(ev.category)}`} />
                  <p className="text-xs font-medium truncate ml-1">{ev.title}</p>
                  <p className="text-[10px] text-muted-foreground ml-1">
                    {format(start, "h:mm a")} - {format(end, "h:mm a")}
                  </p>
                  {ev.location && (
                    <p className="text-[10px] text-muted-foreground truncate ml-1">{ev.location}</p>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MonthView({ events, currentDate, onEventClick, getColor }: { events: CalendarEvent[]; currentDate: Date; onEventClick: (e: CalendarEvent) => void; getColor: (category: string) => string }) {
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
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getColor(ev.category)}`} />
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
  calendars,
  event,
  onSaved,
  onCancel,
}: {
  calendars: SubCalendar[];
  event?: CalendarEvent;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: event?.title || "",
    startTime: event ? format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm") : "",
    endTime: event ? format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm") : "",
    role: event?.role || "",
    category: event?.category || calendars[0]?.name || "",
    location: event?.location || "",
    hours: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      actualMinutes: form.hours ? Math.round(parseFloat(form.hours) * 60) : undefined,
    };
    delete (payload as any).hours;
    try {
      if (event) {
        const res = await fetch("/api/calendar", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: event.id, ...payload }),
        });
        if (!res.ok) throw new Error();
        toast.success("Event updated");
      } else {
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
          <label className="text-sm font-medium">Tag</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full h-10 border rounded-md px-3 text-sm bg-background"
          >
            <option value="">No tag</option>
            {Array.from(new Set([
              ...(calendars.find((c) => c.name === form.category)?.tags || []),
              ...(event?.role ? [event.role] : []),
            ])).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Calendar</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full h-10 border rounded-md px-3 text-sm bg-background"
          >
            {Array.from(new Set([
              ...calendars.map((c) => c.name),
              ...(event?.category ? [event.category] : []),
            ])).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Location</label>
          <Input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Hours</label>
          <Input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
            placeholder="e.g. 1.5"
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
