"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { IlamyCalendar } from "@ilamy/calendar";
import type { CalendarEngineProps, EngineView, EngineEvent } from "./types";
import { classesToEvents, isClassEvent, findClassForEventId } from "./classEvents";

// ilamy views: month | week | day (+ its own). Map the app's granular views onto these.
const VIEW_MAP: Record<EngineView, string> = {
  day: "day",
  "5day": "week",
  week: "week",
  month: "month",
};

// dayjs objects come back from callbacks; normalize to ISO for the app's API.
function toISO(d: any): string {
  if (!d) return "";
  if (typeof d === "string") return d;
  if (typeof d?.toISOString === "function") return d.toISOString();
  if (typeof d?.toDate === "function") return d.toDate().toISOString(); // dayjs
  return String(d);
}

export default function IlamyEngine({
  events,
  classes,
  currentDate,
  view,
  onEventClick,
  onClassClick,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  calendars,
  defaultCalendar,
  onInlineSaved,
}: CalendarEngineProps) {
  // ilamy accepts ISO strings for start/end directly. Merge real events with
  // recurring classes expanded into dated instances so classes render too.
  const ilamyEvents = useMemo(
    () =>
      [...events, ...classesToEvents(classes, currentDate, view)].map((e) => ({
        id: e.id,
        title: e.title,
        start: e.startTime,
        end: e.endTime,
        description: e.description,
        data: { category: e.category, role: e.role, isLed: e.isLed, location: e.location },
      })),
    [events, classes, currentDate, view]
  );

  // iLamy's day/week grid opens scrolled to midnight, so daytime classes (e.g.
  // a 10am class) sit below the fold and look "missing". Scroll its Radix
  // ScrollArea viewport to ~7am once rendered (and on view/date change).
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (VIEW_MAP[view] === "month") return; // month view isn't time-scrolled
    const wrap = wrapRef.current;
    if (!wrap) return;
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      const grid = wrap.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
      if (grid && grid.scrollHeight > grid.clientHeight) {
        grid.scrollTop = (grid.scrollHeight * 7) / 24; // ~7am
        clearInterval(id);
      } else if (tries > 20) {
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [view, currentDate]);

  return (
    <div ref={wrapRef} className="ilamy-scope relative z-20 h-[70vh] rounded-2xl overflow-hidden border border-black/10 bg-white">
      <IlamyCalendar
        events={ilamyEvents as any}
        initialView={VIEW_MAP[view] as any}
        initialDate={currentDate}
        firstDayOfWeek="monday"
        hiddenDays={view === "5day" ? (["saturday", "sunday"] as any) : undefined}
        renderEventForm={(p: any) => (
          <InlineEventForm
            selectedEvent={p.selectedEvent}
            onClose={p.onClose}
            calendars={calendars || []}
            defaultCalendar={defaultCalendar}
            existingEvents={events}
            onSaved={onInlineSaved}
          />
        )}
        onEventClick={(ev: any) => {
          if (isClassEvent(String(ev.id))) {
            const cls = findClassForEventId(String(ev.id), classes);
            if (cls) onClassClick?.(cls);
            return;
          }
          const match = events.find((e) => String(e.id) === String(ev.id));
          if (match) onEventClick(match);
        }}
        onEventAdd={(ev: any) =>
          onEventCreate?.({ title: ev.title, startTime: toISO(ev.start), endTime: toISO(ev.end) })
        }
        onEventUpdate={(ev: any) => {
          const match = events.find((e) => String(e.id) === String(ev.id));
          if (match) onEventUpdate?.({ ...match, title: ev.title, startTime: toISO(ev.start), endTime: toISO(ev.end) });
        }}
        onEventDelete={(ev: any) => onEventDelete?.(String(ev.id))}
      />
    </div>
  );
}

// ---- Inline create/edit form rendered inside iLamy's popover -----------------
// Replaces iLamy's built-in event form so the quick "+ new" create on the grid
// has the same fields as the "+ Add Event" dialog — including Hours. It persists
// directly to /api/calendar, then refreshes the page's events via onSaved().

function fmtDate(d: any): string {
  if (d?.format) return d.format("YYYY-MM-DD");
  const dt = d ? new Date(toISO(d)) : new Date();
  return dt.toISOString().slice(0, 10);
}
function fmtTime(d: any, fallback: string): string {
  if (d?.format) return d.format("HH:mm");
  if (!d) return fallback;
  const dt = new Date(toISO(d));
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function InlineEventForm({
  selectedEvent,
  onClose,
  calendars,
  defaultCalendar,
  existingEvents,
  onSaved,
}: {
  selectedEvent?: any;
  onClose: () => void;
  calendars: { id?: string; name: string; tags?: string[] }[];
  defaultCalendar?: string;
  existingEvents: EngineEvent[];
  onSaved?: () => void;
}) {
  // Editing an existing DB event if iLamy handed us one we already know about.
  const existing = selectedEvent ? existingEvents.find((e) => String(e.id) === String(selectedEvent.id)) : undefined;

  const [form, setForm] = useState(() => ({
    title: existing?.title ?? selectedEvent?.title ?? "",
    date: fmtDate(selectedEvent?.start),
    startTime: fmtTime(selectedEvent?.start, "09:00"),
    endTime: fmtTime(selectedEvent?.end, "10:00"),
    calendar: existing?.category ?? defaultCalendar ?? calendars[0]?.name ?? "Personal",
    role: existing?.role ?? "",
    location: existing?.location ?? "",
    hours: "",
  }));
  const [saving, setSaving] = useState(false);

  const tags = calendars.find((c) => c.name === form.calendar)?.tags ?? [];
  const inputCls = "w-full h-9 border border-black/15 rounded-md px-2.5 text-sm bg-white text-black";
  const labelCls = "text-xs font-medium text-black/70";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const startTime = new Date(`${form.date}T${form.startTime}`).toISOString();
    const endTime = new Date(`${form.date}T${form.endTime}`).toISOString();
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      startTime,
      endTime,
      category: form.calendar,
      role: form.role,
      location: form.location || null,
      actualMinutes: form.hours ? Math.round(parseFloat(form.hours) * 60) : undefined,
    };
    try {
      if (existing) {
        await fetch("/api/calendar", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: existing.id, ...payload }) });
      } else {
        await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-72 max-w-[90vw] p-3 space-y-2.5 text-black">
      <input autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title" className={inputCls + " font-medium"} />
      <div>
        <label className={labelCls}>Date</label>
        <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={labelCls}>Start</label><input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={inputCls} /></div>
        <div><label className={labelCls}>End</label><input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={inputCls} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Calendar</label>
          <select value={form.calendar} onChange={(e) => setForm({ ...form, calendar: e.target.value, role: "" })} className={inputCls}>
            {(calendars.length ? calendars : [{ name: "Personal" }]).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Tag</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
            <option value="">No tag</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={labelCls}>Location</label><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Optional" className={inputCls} /></div>
        <div><label className={labelCls}>Hours</label><input type="number" step="0.5" min="0" max="24" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="e.g. 1.5" className={inputCls} /></div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving || !form.title.trim()} className="flex-1 h-9 rounded-md bg-black text-white text-sm font-medium disabled:opacity-50">{saving ? "Saving…" : existing ? "Save" : "Create"}</button>
        <button type="button" onClick={onClose} className="h-9 px-3 rounded-md border border-black/15 text-sm text-black/70">Cancel</button>
      </div>
    </form>
  );
}
