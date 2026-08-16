"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  startOfMonth,
  endOfMonth,
  isToday as isDateToday,
  isTomorrow,
  isThisWeek,
} from "date-fns";
import { Plus, ChevronLeft, ChevronRight, Trash2, Pencil, X, BookOpen, Flame, Clock, MapPin, User, GraduationCap, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
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
import { useCalendars, SubCalendar, CalendarTag, calHex } from "@/lib/useCalendars";
import { useSyncedSetting, type SettingSpec } from "@/lib/synced-setting";
import { CalendarEngineHost } from "@/components/calendar/engines";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { ActivityRing } from "@/components/ui/activity-ring";
import { AnimatedGradientText } from "@/components/ui/gradient-text";
import { ClickSpark } from "@/components/ui/click-spark";
import { ParticlesBg } from "@/components/ui/particles-bg";
import { NoiseOverlay } from "@/components/ui/noise-overlay";
import { GlowCard } from "@/components/ui/glow-card";
import { AuroraGlow } from "@/components/ui/aurora-glow";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import { UnscheduledPanel } from "@/components/ui/unscheduled-panel";
import { KeyboardShortcuts } from "@/components/ui/keyboard-shortcuts";
import { WeekStats } from "@/components/ui/week-stats";
import { FocusSuggestion } from "@/components/ui/focus-suggestion";
import { CommandPalette } from "@/components/ui/command-palette";
import { ScheduleHeatmap } from "@/components/ui/schedule-heatmap";
import { ExportButton } from "@/components/ui/export-button";
import { FocusModeToggle } from "@/components/ui/focus-mode";
import { motion, useReducedMotion } from "framer-motion";
import { useIntroCalEntrance } from "@/components/home/intro-cal-entrance";

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

interface ClassBlock {
  id: string;
  title: string;
  professor: string;
  location: string;
  creditHours: number;
  days: string[];
  startTime: string;
  endTime: string;
  color: string;
  /** Sub-calendar this class belongs to (matches SubCalendar.name). Optional for
   *  legacy stored classes; backfilled to "Personal" on load. */
  calendar?: string;
  /** Optional term window: the class only repeats on/after startDate and on/before
   *  endDate (yyyy-MM-dd). Empty = repeats indefinitely (legacy behaviour). */
  startDate?: string;
  endDate?: string;
}

interface Task {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  priority: string;
}

type View = "day" | "5day" | "week" | "month";

const CLASS_COLORS = [
  "#f9a8d4", "#a5b4fc", "#86efac", "#fcd34d", "#fdba74",
  "#c4b5fd", "#67e8f9", "#fca5a5", "#bef264", "#d8b4fe",
];

function getMinutesFromTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}



function findGaps(classes: ClassBlock[], day: Date): { start: number; end: number }[] {
  const dow = day.getDay();
  const CLASS_DAY_MAP: Record<string, number[]> = {
    MWF: [1, 3, 5], TuTh: [2, 4], MW: [1, 3], TuThF: [2, 4, 5],
    Mon: [1], Tue: [2], Wed: [3], Thu: [4], Fri: [5], Sat: [6], Sun: [0],
  };
  const dayClasses = classes
    .filter(cls => cls.days.some(d => (CLASS_DAY_MAP[d] || []).includes(dow)))
    .map(cls => ({ start: getMinutesFromTime(cls.startTime), end: getMinutesFromTime(cls.endTime) }))
    .sort((a, b) => a.start - b.start);

  const gaps: { start: number; end: number }[] = [];
  for (let i = 0; i < dayClasses.length - 1; i++) {
    const gapStart = dayClasses[i].end;
    const gapEnd = dayClasses[i + 1].start;
    if (gapEnd - gapStart >= 30) {
      gaps.push({ start: gapStart, end: gapEnd });
    }
  }
  return gaps;
}

// The class schedule follows the account, so a timetable entered on a laptop
// shows up on a tablet too (src/lib/synced-setting.ts).
const CLASSES: SettingSpec<ClassBlock[]> = {
  key: "leadership-os-classes",
  fallback: [],
  revive: (raw) =>
    Array.isArray(raw)
      // Backfill `calendar` for classes saved before classes could be assigned to
      // a sub-calendar; default them to the built-in "Personal" calendar.
      ? raw.map((c: any) => ({ ...c, calendar: c.calendar || "Personal" }))
      : null,
};


/* ---------- Seasonal SVG Illustrations ---------- */
function SeasonalIcon({ month, size = 32 }: { month: number; size?: number }) {
  const s = size;
  const icons: Record<number, React.JSX.Element> = {
    0: ( // Snowflake
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <line x1="16" y1="4" x2="16" y2="28" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round"/>
        <line x1="4" y1="16" x2="28" y2="16" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round"/>
        <line x1="7.5" y1="7.5" x2="24.5" y2="24.5" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="24.5" y1="7.5" x2="7.5" y2="24.5" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="16" cy="16" r="2" fill="#bfdbfe"/>
      </svg>
    ),
    1: ( // Hearts
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <path d="M16 26 C16 26 5 19 5 12 C5 8 8 5 12 7 C14 8.5 16 11 16 11 C16 11 18 8.5 20 7 C24 5 27 8 27 12 C27 19 16 26 16 26Z" fill="#f9a8d4" stroke="#ec4899" strokeWidth="1"/>
      </svg>
    ),
    2: ( // Tulip
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <path d="M16 14 C13 10 10 11 11 8 C12 5 16 4 16 4 C16 4 20 5 21 8 C22 11 19 10 16 14Z" fill="#f472b6"/>
        <line x1="16" y1="14" x2="16" y2="28" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
        <path d="M16 20 Q12 18 10 20" stroke="#22c55e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    3: ( // Rain/Umbrella
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <path d="M6 18 Q16 6 26 18" fill="#93c5fd" stroke="#60a5fa" strokeWidth="1.5"/>
        <line x1="16" y1="18" x2="16" y2="26" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M16 26 Q14 28 13 26" stroke="#6b7280" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <circle cx="10" cy="24" r="1" fill="#60a5fa"/><circle cx="22" cy="22" r="1" fill="#60a5fa"/><circle cx="14" cy="28" r="0.8" fill="#60a5fa"/>
      </svg>
    ),
    4: ( // Cherry Blossom
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="12" r="3.5" fill="#fbcfe8"/><circle cx="12" cy="16" r="3.5" fill="#fce7f3"/><circle cx="20" cy="16" r="3.5" fill="#fce7f3"/>
        <circle cx="13" cy="21" r="3.5" fill="#fbcfe8"/><circle cx="19" cy="21" r="3.5" fill="#fbcfe8"/>
        <circle cx="16" cy="17" r="2" fill="#f472b6"/>
      </svg>
    ),
    5: ( // Sun
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="6" fill="#fde047" stroke="#f59e0b" strokeWidth="1"/>
        {[0,45,90,135,180,225,270,315].map((a, i) => (
          <line key={i} x1={16 + 8*Math.cos(a*Math.PI/180)} y1={16 + 8*Math.sin(a*Math.PI/180)} x2={16 + 11*Math.cos(a*Math.PI/180)} y2={16 + 11*Math.sin(a*Math.PI/180)} stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
        ))}
      </svg>
    ),
    6: ( // Watermelon
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <path d="M6 20 A12 12 0 0 1 26 20 Z" fill="#4ade80" stroke="#16a34a" strokeWidth="1"/>
        <path d="M8 20 A10 10 0 0 1 24 20 Z" fill="#fca5a5"/>
        <circle cx="13" cy="18" r="1" fill="#1f2937"/><circle cx="17" cy="17" r="1" fill="#1f2937"/><circle cx="20" cy="19" r="0.8" fill="#1f2937"/>
      </svg>
    ),
    7: ( // Sunflower
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        {[0,45,90,135,180,225,270,315].map((a, i) => (
          <ellipse key={i} cx={16 + 7*Math.cos(a*Math.PI/180)} cy={16 + 7*Math.sin(a*Math.PI/180)} rx="3" ry="5" fill="#fbbf24" transform={`rotate(${a} ${16 + 7*Math.cos(a*Math.PI/180)} ${16 + 7*Math.sin(a*Math.PI/180)})`}/>
        ))}
        <circle cx="16" cy="16" r="5" fill="#92400e"/>
      </svg>
    ),
    8: ( // Maple Leaf
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <path d="M16 4 L18 10 L24 8 L20 14 L26 16 L20 18 L22 24 L16 20 L10 24 L12 18 L6 16 L12 14 L8 8 L14 10 Z" fill="#f97316" stroke="#ea580c" strokeWidth="0.5"/>
        <line x1="16" y1="20" x2="16" y2="28" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    9: ( // Pumpkin
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <ellipse cx="16" cy="19" rx="9" ry="8" fill="#fb923c"/><ellipse cx="12" cy="19" rx="4" ry="8" fill="#fdba74" opacity="0.5"/>
        <ellipse cx="20" cy="19" rx="4" ry="8" fill="#f97316" opacity="0.3"/>
        <path d="M14 11 Q16 6 18 11" stroke="#16a34a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    10: ( // Acorn
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <ellipse cx="16" cy="20" rx="5" ry="7" fill="#a16207"/>
        <path d="M10 16 Q16 13 22 16 Q22 11 16 10 Q10 11 10 16Z" fill="#65a30d"/>
        <line x1="16" y1="10" x2="16" y2="6" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    11: ( // Christmas Tree
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <polygon points="16,4 10,14 22,14" fill="#22c55e"/><polygon points="16,10 8,20 24,20" fill="#16a34a"/><polygon points="16,16 6,26 26,26" fill="#15803d"/>
        <rect x="14" y="26" width="4" height="3" fill="#92400e"/>
        <circle cx="14" cy="15" r="1" fill="#ef4444"/><circle cx="18" cy="21" r="1" fill="#fbbf24"/><circle cx="16" cy="8" r="1" fill="#fbbf24"/>
      </svg>
    ),
  };
  return icons[month] || icons[0];
}

export default function CalendarPage() {
  const reduceMotion = useReducedMotion();
  // One-time cinematic "the week draws itself" entrance — plays once per session,
  // no-op under reduced motion / repeat visits. Presentation-only, gated inside.
  const introRoot = useRef<HTMLDivElement>(null);
  useIntroCalEntrance(introRoot);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>("week");
  const [showAdd, setShowAdd] = useState(false);
  const [defaultEventTime, setDefaultEventTime] = useState<{ start: string; end: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState(false);
  const { value: classes, setValue: saveClasses } = useSyncedSetting(CLASSES);
  const [showAddClass, setShowAddClass] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string | null>(null);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [showAddCalendar, setShowAddCalendar] = useState(false);
  const [newCalName, setNewCalName] = useState("");
  const [newCalColor, setNewCalColor] = useState("bg-blue-500");
  const [calendarToDelete, setCalendarToDelete] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassBlock | null>(null);
  const [editingClass, setEditingClass] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const { calendars, addCalendar, deleteCalendar, updateCalendar, addTag, setTagColor, deleteTag, getCalendarColor, getTagsForCalendar, COLOR_OPTIONS } = useCalendars();
  const [editCal, setEditCal] = useState<SubCalendar | null>(null);

  const handleTimeSlotClick = (date: Date, hour: number) => {
    const startDate = new Date(date);
    startDate.setHours(hour, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(hour + 1, 0, 0, 0);
    setDefaultEventTime({
      start: format(startDate, "yyyy-MM-dd'T'HH:mm"),
      end: format(endDate, "yyyy-MM-dd'T'HH:mm"),
    });
    setShowAdd(true);
  };

  const handleEventDrop = async (eventId: string, newDate: Date, newHour: number) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const oldStart = new Date(event.startTime);
    const oldEnd = new Date(event.endTime);
    const durationMs = oldEnd.getTime() - oldStart.getTime();
    const newStart = new Date(newDate);
    newStart.setHours(newHour, 0, 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);
    try {
      const res = await fetch("/api/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: eventId,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Event rescheduled");
      fetchEvents();
    } catch {
      toast.error("Failed to reschedule event");
    }
  };

  const totalCredits = useMemo(() => classes.reduce((sum, c) => sum + c.creditHours, 0), [classes]);
  const weeklyHours = useMemo(() => {
    const CLASS_DAY_MAP: Record<string, number[]> = {
      MWF: [1, 3, 5], TuTh: [2, 4], MW: [1, 3], TuThF: [2, 4, 5],
      Mon: [1], Tue: [2], Wed: [3], Thu: [4], Fri: [5], Sat: [6], Sun: [0],
    };
    return classes.reduce((sum, cls) => {
      const meetingsPerWeek = cls.days.flatMap(d => CLASS_DAY_MAP[d] || []).length;
      const durationHrs = (getMinutesFromTime(cls.endTime) - getMinutesFromTime(cls.startTime)) / 60;
      return sum + meetingsPerWeek * durationHrs;
    }, 0);
  }, [classes]);

  const focusGaps = useMemo(() => {
    const weekStart2 = startOfWeek(currentDate, { weekStartsOn: 1 });
    const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const allGaps: { start: number; end: number; day: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart2, i);
      const dayGaps = findGaps(classes, day);
      dayGaps.forEach((g) => allGaps.push({ ...g, day: DAY_NAMES[i] }));
    }
    return allGaps;
  }, [classes, currentDate]);

  const fetchEvents = async () => {
    let start: Date, end: Date;
    if (view === "day") {
      start = new Date(currentDate); start.setHours(0, 0, 0, 0);
      end = new Date(currentDate); end.setHours(23, 59, 59, 999);
    } else if (view === "5day") {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = addDays(start, 5);
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
      let allTasks: Task[] = [];
      if (taskRes.ok) {
        const taskData = await taskRes.json();
        const rawTasks = taskData.tasks || taskData;
        allTasks = rawTasks;
        taskEvents = rawTasks
          .filter((t: any) => t.dueDate && t.status !== "done")
          .map((t: any) => ({
            id: `task_${t.id}`,
            title: `${t.title}`,
            startTime: t.dueDate,
            endTime: t.dueDate,
            category: "Personal",
            role: "",
            location: null,
            isLed: false,
          }));
      }
      setTasks(allTasks);
      setEvents([...calEvents, ...taskEvents]);
    } catch {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [currentDate, view]);

  const navigate = (dir: number) => {
    if (view === "day") setCurrentDate(addDays(currentDate, dir));
    else if (view === "5day") setCurrentDate(addDays(currentDate, dir * 5));
    else if (view === "week") setCurrentDate(addDays(currentDate, dir * 7));
    else setCurrentDate(addDays(currentDate, dir * 30));
  };

  const currentTags = getTagsForCalendar(selectedCalendar);

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const cal = selectedCalendar ? calendars.find((c) => c.name === selectedCalendar) : calendars[0];
    if (!cal) return;
    const success = addTag(cal.id, newTagName.trim(), newTagColor || cal.color);
    if (success) { toast.success(`Added "${newTagName.trim()}" tag`); setNewTagName(""); setNewTagColor(null); setShowAddTag(false); }
    else { toast.error("Tag already exists"); }
  };

  const handleDeleteTag = (tag: string) => { setTagToDelete(tag); };

  const confirmDeleteTag = async () => {
    if (tagToDelete) {
      const matchingEvents = events.filter((e) => e.role === tagToDelete);
      for (const ev of matchingEvents) {
        try { await fetch("/api/calendar", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ev.id, role: "" }) }); } catch {}
      }
      const cal = selectedCalendar ? calendars.find((c) => c.name === selectedCalendar) : calendars.find((c) => c.tags.some((t) => t.name === tagToDelete));
      if (cal) deleteTag(cal.id, tagToDelete);
      if (activeTag === tagToDelete) setActiveTag(null);
      setEvents((prev) => prev.map((e) => e.role === tagToDelete ? { ...e, role: "" } : e));
      toast.success(`Removed "${tagToDelete}" tag`);
      setTagToDelete(null);
    }
  };

  const filteredEvents = events.filter((e) => {
    const isTask = e.id.startsWith("task_");
    if (selectedCalendar) {
      if (isTask) return false;
      if (e.category !== selectedCalendar) return false;
    }
    if (activeTag && e.role !== activeTag) return false;
    return true;
  });

  // Classes render on the grid for the selected calendar (all of them under "All").
  const filteredClasses = selectedCalendar
    ? classes.filter((c) => (c.calendar || "Personal") === selectedCalendar)
    : classes;

  const deleteEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Event deleted");
      setSelectedEvent(null);
      fetchEvents();
    } catch { toast.error("Failed to delete event"); }
  };

  // Task sidebar data
  const taskGroups = useMemo(() => {
    const now = new Date();
    const today: Task[] = [], tomorrow: Task[] = [], thisWeek: Task[] = [], later: Task[] = [];
    tasks.filter((t) => t.status !== "done" && t.dueDate).forEach((t) => {
      const d = new Date(t.dueDate);
      if (isDateToday(d)) today.push(t);
      else if (isTomorrow(d)) tomorrow.push(t);
      else if (isThisWeek(d, { weekStartsOn: 1 }) && d > now) thisWeek.push(t);
      else if (d > now) later.push(t);
    });
    const done = tasks.filter((t) => t.status === "done").length;
    const total = tasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { today, tomorrow, thisWeek, later, pct };
  }, [tasks]);

  // Streak calculation
  const streak = useMemo(() => {
    let count = 0;
    const now = new Date();
    for (let i = 1; i <= 30; i++) {
      const day = addDays(now, -i);
      const dayTasks = tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day));
      if (dayTasks.length > 0 && dayTasks.every((t) => t.status === "done")) count++;
      else break;
    }
    return count;
  }, [tasks]);

  const addClass = (cls: ClassBlock) => {
    saveClasses([...classes, cls]);
    toast.success("Class added!");
    setShowAddClass(false);
  };

  const updateClass = (cls: ClassBlock) => {
    saveClasses(classes.map((c) => (c.id === cls.id ? cls : c)));
    toast.success("Class updated!");
    setEditingClass(false);
    setSelectedClass(null);
  };

  const deleteClass = (id: string) => {
    saveClasses(classes.filter((c) => c.id !== id));
    toast.success("Class removed");
  };

  const monthIdx = currentDate.getMonth();

  return (
    <ClickSpark sparkColor="#FFB400" sparkCount={10} sparkSize={6}>
    <div ref={introRoot} className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 relative z-20" style={{ background: "#FFFAF5" }}>
      {/* ClickUp-style aurora glow behind header */}
      <AuroraGlow className="z-0" opacity={0.6} color1="rgba(255, 180, 0, 0.12)" color2="rgba(127, 184, 0, 0.10)" color3="rgba(255, 107, 74, 0.06)" />
      {/* Film grain overlay for cinematic depth */}
      <NoiseOverlay opacity={0.02} />
      {/* Floating particles background */}
      <ParticlesBg quantity={30} color="#FFB400" size={1} speed={0.2} className="opacity-40" />

      {/* Header */}
      <motion.header
        className="max-w-7xl mx-auto mb-6 relative"
        initial={reduceMotion ? false : { opacity: 0, y: -12 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <SeasonalIcon month={monthIdx} size={40} />
            <div className="intro-cal-title">
              <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" }}>
                <AnimatedGradientText colorFrom="#1a1a1a" colorTo="#7FB800" speed={6}>
                  {format(currentDate, "MMMM yyyy")}
                </AnimatedGradientText>
              </h1>
              <p className="text-black/50 text-sm">
                {view === "day" ? format(currentDate, "EEEE, MMMM d")
                  : view === "5day" ? "Class Schedule View"
                  : view === "week" ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")}`
                  : format(currentDate, "MMMM yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="sm" onClick={() => setShowAddClass(true)} className="rounded-full bg-[#7FB800] hover:bg-[#4CA80B] text-black font-semibold shadow-md" style={{ fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" }}>
                <BookOpen className="w-4 h-4 mr-1" /> Class
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="sm" onClick={() => setShowAdd(true)} className="rounded-full bg-[#FFB400] hover:brightness-105 text-black font-semibold shadow-md" style={{ fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" }}>
                <Plus className="w-4 h-4 mr-1" /> Event
              </Button>
            </motion.div>
            <ExportButton onExport={(format) => toast.success(`Exporting as ${format}...`)} />
          </div>
        </div>

        {/* View Selector */}
        <div className="flex items-center justify-between mt-4">
          <AnimatedTabs
            className="intro-cal-tabs"
            tabs={[
              { id: "day", label: "Day" },
              { id: "5day", label: "5-Day" },
              { id: "week", label: "Week" },
              { id: "month", label: "Month" },
            ]}
            activeTab={view}
            onTabChange={(id) => setView(id as View)}
          />
          <div className="flex items-center gap-1">
            <motion.button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-black/5 text-black/60 transition-colors"
              whileHover={{ x: -3, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>
            <motion.button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-black/70 hover:bg-[#FFF3D6] hover:text-[#8a6300] transition-colors"
              style={{ fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Today
            </motion.button>
            <FocusModeToggle isActive={focusMode} onToggle={() => setFocusMode(!focusMode)} />
            <motion.button
              onClick={() => navigate(1)}
              className="p-2 rounded-full hover:bg-black/5 text-black/60 transition-colors"
              whileHover={{ x: 3, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* Week Stats */}
        <WeekStats
          totalClasses={classes.length}
          totalEvents={filteredEvents.filter(e => !e.id.startsWith("task_")).length}
          totalHours={weeklyHours}
          busyPercentage={Math.min(100, Math.round((weeklyHours / 40) * 100))}
          className="mt-3"
        />

        {/* Calendar & Tag Filters */}
        <div className="flex gap-2 flex-wrap items-center mt-3">
          <button onClick={() => setSelectedCalendar(null)} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedCalendar === null ? "bg-black text-white" : "bg-black/5 text-black/60 hover:bg-black/10"}`}>
            All
          </button>
          {calendars.map((cal) => {
            const active = selectedCalendar === cal.name;
            const hex = calHex(cal.color);
            return (
              <div key={cal.id} className="group relative flex items-center">
                <button
                  onClick={() => setSelectedCalendar(active ? null : cal.name)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:-translate-y-px"
                  style={active
                    ? { background: hex, color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }
                    : { background: `${hex}22`, color: "#1a1a1a" }}
                >
                  {cal.name}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setEditCal(cal); }} className="ml-0.5 w-4 h-4 rounded-full text-black/40 hover:text-black items-center justify-center hidden group-hover:flex transition-colors" title="Edit calendar">
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
          {showAddCalendar ? (
            <div className="flex items-center gap-1">
              <input autoFocus value={newCalName} onChange={(e) => setNewCalName(e.target.value)} placeholder="Name..." className="h-6 w-24 px-2 text-xs border border-black/20 rounded-full bg-white text-black focus:outline-none focus:ring-1 focus:ring-black/30" onKeyDown={(e) => { if (e.key === "Enter" && newCalName.trim()) { addCalendar(newCalName.trim(), newCalColor); setNewCalName(""); setShowAddCalendar(false); } }} onBlur={() => { if (!newCalName) setShowAddCalendar(false); }} />
              <div className="flex gap-0.5">
                {COLOR_OPTIONS.slice(0, 6).map((c) => (
                  <button key={c} type="button" onClick={() => setNewCalColor(c)} className={`w-4 h-4 rounded-full ${c} ${newCalColor === c ? "ring-2 ring-offset-1 ring-black/30" : ""}`} />
                ))}
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddCalendar(true)} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-black/40 hover:text-black border border-dashed border-black/20 hover:border-black/40 transition-colors">
              <Plus className="w-3 h-3" /> Calendar
            </button>
          )}
        </div>

        {/* Tags / filters — shown for any selected calendar (and for "All" when tags exist) */}
        {(selectedCalendar || currentTags.length > 0) && (
          <div className="flex gap-2 flex-wrap items-center mt-2">
            <span className="text-[11px] font-medium text-black/40">Filters:</span>
            {currentTags.map((tag) => {
              // Each filter chip carries its own colour (Outlook-style tags).
              const hex = calHex(tag.color);
              const on = activeTag === tag.name;
              return (
                <div key={tag.name} className="group relative">
                  <button
                    onClick={() => setActiveTag(on ? null : tag.name)}
                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all"
                    style={on ? { background: hex, color: "#fff" } : { background: `${hex}22`, color: "#1a1a1a" }}
                  >
                    {tag.name}
                  </button>
                  <button onClick={() => handleDeleteTag(tag.name)} className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-400 text-white items-center justify-center text-[7px] hidden group-hover:flex">
                    <X className="w-2 h-2" />
                  </button>
                </div>
              );
            })}
            {currentTags.length === 0 && !showAddTag && (
              <span className="text-[11px] text-black/30">No filters yet</span>
            )}
            {selectedCalendar && (showAddTag ? (
              <form onSubmit={(e) => { e.preventDefault(); handleAddTag(); }} className="flex items-center gap-1">
                <input autoFocus value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Filter..." className="h-5 w-20 px-2 text-[11px] border border-black/20 rounded-full bg-white text-black focus:outline-none" onBlur={() => { if (!newTagName) { setShowAddTag(false); setNewTagColor(null); } }} />
                <div className="flex gap-0.5">
                  {COLOR_OPTIONS.slice(0, 6).map((c) => (
                    <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setNewTagColor(c)} className={`w-3.5 h-3.5 rounded-full ${c} ${newTagColor === c ? "ring-2 ring-offset-1 ring-black/30" : ""}`} />
                  ))}
                </div>
              </form>
            ) : (
              <button onClick={() => setShowAddTag(true)} className="w-5 h-5 rounded-full border border-dashed border-black/20 flex items-center justify-center text-black/40 hover:border-black/40 hover:text-black transition-colors">
                <Plus className="w-2.5 h-2.5" />
              </button>
            ))}
          </div>
        )}
      </motion.header>

      {/* Focus Suggestion */}
      {(view === "week" || view === "5day") && (
        <div className="max-w-7xl mx-auto mb-4">
          <FocusSuggestion gaps={focusGaps} />
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto flex gap-4">
        {/* Calendar Area */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center text-black/40 py-12">
              <motion.div
                className="w-8 h-8 rounded-full border-2 border-[#FFE39A] border-t-[#FFB400] mx-auto"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <p className="mt-2 text-sm">Loading schedule...</p>
            </div>
          ) : (
            <BlurFade key={`engine-ilamy-${view}`} duration={0.3}>
              <CalendarEngineHost
                events={filteredEvents}
                classes={filteredClasses}
                currentDate={currentDate}
                view={view}
                getColor={getCalendarColor}
                onEventClick={setSelectedEvent}
                onClassClick={setSelectedClass}
                onTimeSlotClick={handleTimeSlotClick}
                onEventDrop={handleEventDrop}
                onEventCreate={async (ev) => {
                  try {
                    await fetch("/api/calendar", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: ev.title || "Untitled",
                        startTime: ev.startTime,
                        endTime: ev.endTime,
                        category: selectedCalendar || "Personal",
                        // File the event under the active filter tag, so it shows
                        // up in the view it was created from (Outlook-style tags).
                        role: activeTag || "",
                      }),
                    });
                    fetchEvents();
                  } catch { toast.error("Failed to create event"); }
                }}
                onEventUpdate={async (ev) => {
                  try {
                    await fetch("/api/calendar", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: ev.id, title: ev.title, startTime: ev.startTime, endTime: ev.endTime }),
                    });
                    fetchEvents();
                  } catch { toast.error("Failed to update event"); }
                }}
                onEventDelete={async (id) => {
                  try {
                    await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
                    fetchEvents();
                  } catch { toast.error("Failed to delete event"); }
                }}
              />
            </BlurFade>
          )}
        </div>

        {/* Task Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-4 space-y-3">
          {/* Mini Calendar Widget (ClickUp-style) */}
          <BlurFade delay={0.15} direction="right" duration={0.4}>
            <MiniCalendar
              currentDate={currentDate}
              onDateSelect={(date) => { setCurrentDate(date); setView("day"); }}
              events={filteredEvents}
            />
          </BlurFade>
          {/* Schedule Heatmap */}
          <BlurFade delay={0.18} direction="right" duration={0.4}>
            <ScheduleHeatmap classes={classes} events={filteredEvents} />
          </BlurFade>
          {/* Unscheduled Tasks Panel (ClickUp-style) */}
          <UnscheduledPanel
            tasks={tasks.filter(t => !t.dueDate).map(t => ({ id: t.id, title: t.title, priority: t.priority, status: t.status }))}
          />
          {/* Task Panel */}
          <BlurFade delay={0.2} direction="right" duration={0.5}>
          <GlowCard glowColor="rgba(168, 85, 247, 0.08)">
          <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-4">
            <div className="flex items-center gap-3 mb-4">
              <ActivityRing percentage={taskGroups.pct} size={52} strokeWidth={5} color="#22c55e">
                <span className="text-[10px] font-bold text-green-600">{taskGroups.pct}%</span>
              </ActivityRing>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-black">Tasks</h3>
                <p className="text-[10px] text-black/40">
                  {tasks.filter(t => t.status === "done").length}/{tasks.length} complete
                </p>
              </div>
              <motion.div
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50"
                animate={{ scale: streak > 0 ? [1, 1.1, 1] : 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <Flame className="w-3 h-3 text-orange-500" />
                <span className="text-[10px] font-bold text-orange-600">{streak}</span>
              </motion.div>
            </div>
            {[
              { label: "Today", items: taskGroups.today },
              { label: "Tomorrow", items: taskGroups.tomorrow },
              { label: "This Week", items: taskGroups.thisWeek },
              { label: "Later", items: taskGroups.later },
            ].map(({ label, items }) => items.length > 0 && (
              <div key={label} className="mb-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-black/40 mb-1">{label}</p>
                {items.slice(0, 4).map((t) => (
                  <div key={t.id} className="flex items-start gap-1.5 py-1">
                    <div className="w-3 h-3 rounded-full border border-black/20 mt-0.5 shrink-0" />
                    <span className="text-xs text-black/70 leading-tight">{t.title}</span>
                  </div>
                ))}
                {items.length > 4 && <p className="text-[10px] text-black/30">+{items.length - 4} more</p>}
              </div>
            ))}

            {/* Classes section */}
            {classes.length > 0 && (
              <div className="mt-4 pt-3 border-t border-black/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-black/40">Classes</p>
                </div>
                {/* Credit stats */}
                <div className="flex items-center gap-2 mb-3 p-2 rounded-xl bg-[#FFF3D6]/70 border border-[#FFE39A] relative overflow-hidden">
                  <GraduationCap className="w-3.5 h-3.5 text-[#c98a00]" />
                  <span className="text-[11px] font-bold text-[#8a6300]">
                    <NumberTicker value={totalCredits} /> credits
                  </span>
                  <span className="text-[10px] text-[#c98a00]">•</span>
                  <span className="text-[11px] text-[#8a6300]">
                    <NumberTicker value={parseFloat(weeklyHours.toFixed(1))} decimalPlaces={1} />h/wk
                  </span>
                </div>
                {classes.map((cls) => (
                  <div key={cls.id} className="flex items-center gap-2 py-1.5 group cursor-pointer rounded-md px-1 -mx-1 hover:bg-black/[0.02] transition-colors" onClick={() => setSelectedClass(cls)}>
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: cls.color }} />
                    <span className="text-xs text-black/70 flex-1 truncate">{cls.title}</span>
                    <span className="text-[9px] text-black/30 group-hover:hidden">{cls.days.join(", ")}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteClass(cls.id); }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          </GlowCard>
          </BlurFade>
          </div>
        </aside>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) setDefaultEventTime(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
            <DialogDescription>Create a new calendar event</DialogDescription>
          </DialogHeader>
          <EventForm calendars={calendars} defaultCalendar={selectedCalendar || undefined} defaultTag={activeTag || undefined} defaultStartTime={defaultEventTime?.start} defaultEndTime={defaultEventTime?.end} onSaved={() => { setShowAdd(false); setDefaultEventTime(null); fetchEvents(); }} onCancel={() => { setShowAdd(false); setDefaultEventTime(null); }} />
        </DialogContent>
      </Dialog>

      {/* Add Class Dialog */}
      <Dialog open={showAddClass} onOpenChange={setShowAddClass}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Class</DialogTitle>
            <DialogDescription>Add a recurring class to your schedule</DialogDescription>
          </DialogHeader>
          {showAddClass && <ClassForm calendars={calendars} defaultCalendar={selectedCalendar || undefined} onSaved={addClass} onCancel={() => setShowAddClass(false)} />}
        </DialogContent>
      </Dialog>

      {/* Event Detail Dialog */}
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
                  <p className="text-sm text-black/60">Task due {format(new Date(selectedEvent.startTime), "MMM d, yyyy")}</p>
                  <a href="/tasks"><Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>Go to Tasks</Button></a>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-black/50">Start:</span><p className="font-medium text-black">{format(new Date(selectedEvent.startTime), "MMM d, h:mm a")}</p></div>
                    <div><span className="text-black/50">End:</span><p className="font-medium text-black">{format(new Date(selectedEvent.endTime), "MMM d, h:mm a")}</p></div>
                  </div>
                  {selectedEvent.location && <div className="text-sm"><span className="text-black/50">Location:</span><p className="font-medium text-black">{selectedEvent.location}</p></div>}
                  {selectedEvent.role && <Badge variant="secondary">{selectedEvent.role}</Badge>}
                  <div className="pt-3 border-t flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingEvent(true)}><Pencil className="w-4 h-4 mr-1" />Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteEvent(selectedEvent.id)}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
                  </div>
                </>
              )}
            </div>
          )}
          {selectedEvent && editingEvent && (
            <EventForm calendars={calendars} event={selectedEvent} onSaved={() => { setSelectedEvent(null); setEditingEvent(false); fetchEvents(); }} onCancel={() => setEditingEvent(false)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Class Detail Dialog */}
      <Dialog open={!!selectedClass} onOpenChange={(open) => { if (!open) { setSelectedClass(null); setEditingClass(false); } }}>
        <DialogContent>
          {selectedClass && editingClass ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit class</DialogTitle>
                <DialogDescription>Update the details for {selectedClass.title}.</DialogDescription>
              </DialogHeader>
              <ClassForm existing={selectedClass} calendars={calendars} onSaved={updateClass} onCancel={() => setEditingClass(false)} />
            </>
          ) : selectedClass && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm" style={{ background: selectedClass.color }}>
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogHeader className="p-0 space-y-0">
                    <DialogTitle className="text-lg">{selectedClass.title}</DialogTitle>
                    <DialogDescription className="text-xs">{selectedClass.creditHours} credit{selectedClass.creditHours !== 1 ? "s" : ""} · {selectedClass.days.join(", ")}</DialogDescription>
                  </DialogHeader>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-black/[0.02] border border-black/5">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-3.5 h-3.5 text-black/30" />
                    <p className="text-[10px] uppercase tracking-wider text-black/40 font-semibold">Professor</p>
                  </div>
                  <p className="font-medium text-sm text-black pl-5">{selectedClass.professor || "Not specified"}</p>
                </div>
                <div className="p-3 rounded-xl bg-black/[0.02] border border-black/5">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-black/30" />
                    <p className="text-[10px] uppercase tracking-wider text-black/40 font-semibold">Location</p>
                  </div>
                  <p className="font-medium text-sm text-black pl-5">{selectedClass.location || "Not specified"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 rounded-xl bg-black/[0.02] border border-black/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-3.5 h-3.5 text-black/30" />
                    <p className="text-[10px] uppercase tracking-wider text-black/40 font-semibold">Schedule</p>
                  </div>
                  <p className="font-medium text-sm text-black pl-5">{selectedClass.startTime} – {selectedClass.endTime}</p>
                </div>
                <div className="p-3 rounded-xl bg-black/[0.02] border border-black/5">
                  <div className="flex items-center gap-2 mb-1">
                    <GraduationCap className="w-3.5 h-3.5 text-black/30" />
                    <p className="text-[10px] uppercase tracking-wider text-black/40 font-semibold">Credits</p>
                  </div>
                  <p className="font-medium text-sm text-black pl-5">{selectedClass.creditHours} credit hours</p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-black/5 flex items-center gap-2">
                <Button size="sm" onClick={() => setEditingClass(true)} className="bg-[#7FB800] hover:bg-[#4CA80B] text-black font-semibold">
                  <Pencil className="w-4 h-4 mr-1" />Edit Class
                </Button>
                <Button variant="destructive" size="sm" onClick={() => { deleteClass(selectedClass.id); setSelectedClass(null); }}>
                  <Trash2 className="w-4 h-4 mr-1" />Remove Class
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {editCal && (
        <EditCalendarDialog
          key={editCal.id}
          cal={editCal}
          calendars={calendars}
          colorOptions={COLOR_OPTIONS}
          updateCalendar={updateCalendar}
          addTag={addTag}
          setTagColor={setTagColor}
          deleteTag={deleteTag}
          onRequestDelete={() => { const id = editCal.id; setEditCal(null); setCalendarToDelete(id); }}
          onClose={() => setEditCal(null)}
        />
      )}

      <ConfirmDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)} title={`Delete "${tagToDelete}" tag?`} description="Events with this tag will have it removed." onConfirm={confirmDeleteTag} />
      <ConfirmDialog open={!!calendarToDelete} onOpenChange={(open) => !open && setCalendarToDelete(null)} title="Delete this calendar?" description="This will delete the calendar and its events." onConfirm={async () => {
        if (calendarToDelete) {
          const cal = calendars.find((c) => c.id === calendarToDelete);
          if (cal) {
            const calEvents = events.filter((e) => e.category === cal.name);
            for (const ev of calEvents) { try { await fetch(`/api/calendar?id=${ev.id}`, { method: "DELETE" }); } catch {} }
            setEvents((prev) => prev.filter((e) => e.category !== cal.name));
            if (selectedCalendar === cal.name) setSelectedCalendar(null);
          }
          deleteCalendar(calendarToDelete);
          toast.success("Calendar deleted");
          setCalendarToDelete(null);
        }
      }} />

      {/* Keyboard Shortcuts (ClickUp-style) */}
      <KeyboardShortcuts onAction={(action) => {
        switch (action) {
          case "new-event": setShowAdd(true); break;
          case "new-class": setShowAddClass(true); break;
          case "today": setCurrentDate(new Date()); break;
          case "day": setView("day"); break;
          case "5day": setView("5day"); break;
          case "week": setView("week"); break;
          case "month": setView("month"); break;
          case "prev": navigate(-1); break;
          case "next": navigate(1); break;
        }
      }} />

      {/* Command Palette (Cmd+K) */}
      <CommandPalette commands={[
        { id: "new-event", label: "Create new event", icon: <Plus className="w-4 h-4" />, action: () => setShowAdd(true), category: "Actions" },
        { id: "new-class", label: "Add a class", icon: <BookOpen className="w-4 h-4" />, action: () => setShowAddClass(true), category: "Actions" },
        { id: "today", label: "Go to today", icon: <CalendarIcon className="w-4 h-4" />, action: () => setCurrentDate(new Date()), category: "Navigation" },
        { id: "day-view", label: "Switch to Day view", icon: <CalendarIcon className="w-4 h-4" />, action: () => setView("day"), category: "Views" },
        { id: "week-view", label: "Switch to Week view", icon: <CalendarIcon className="w-4 h-4" />, action: () => setView("week"), category: "Views" },
        { id: "month-view", label: "Switch to Month view", icon: <CalendarIcon className="w-4 h-4" />, action: () => setView("month"), category: "Views" },
        { id: "5day-view", label: "Switch to 5-Day view", icon: <BookOpen className="w-4 h-4" />, action: () => setView("5day"), category: "Views" },
        { id: "prev", label: "Previous period", icon: <ChevronLeft className="w-4 h-4" />, action: () => navigate(-1), category: "Navigation" },
        { id: "next", label: "Next period", icon: <ChevronRight className="w-4 h-4" />, action: () => navigate(1), category: "Navigation" },
      ]} />
    </div>
    </ClickSpark>
  );
}

/* ---------- Event Form ---------- */
/* ---------- Edit Calendar (rename / recolor / manage filters) ---------- */
function EditCalendarDialog({ cal, calendars, colorOptions, updateCalendar, addTag, setTagColor, deleteTag, onRequestDelete, onClose }: {
  cal: SubCalendar;
  calendars: SubCalendar[];
  colorOptions: string[];
  updateCalendar: (id: string, updates: Partial<Pick<SubCalendar, "name" | "color">>) => void;
  addTag: (calendarId: string, tag: string, color?: string) => boolean;
  setTagColor: (calendarId: string, tag: string, color: string) => void;
  deleteTag: (calendarId: string, tag: string) => void;
  onRequestDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(cal.name);
  const [color, setColor] = useState(cal.color);
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState(cal.color);
  // Tag currently being recoloured (click a tag chip to select it).
  const [recolorTag, setRecolorTag] = useState<string | null>(null);
  // Live tags for this calendar (reflects add/delete immediately).
  const current = calendars.find((c) => c.id === cal.id) ?? cal;

  const save = () => {
    if (!name.trim()) return;
    updateCalendar(cal.id, { name: name.trim(), color });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit calendar</DialogTitle>
          <DialogDescription>Rename it, change its colour, and manage its filters.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-black/80">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-black/80 block mb-1.5">Colour</label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`w-7 h-7 rounded-full ${c} transition-all ${color === c ? "ring-2 ring-offset-2 ring-black/30 scale-110" : "hover:scale-105"}`} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-black/80 block mb-1.5">Filters (tags)</label>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {current.tags.length === 0 && <span className="text-xs text-black/35">No filters yet</span>}
              {current.tags.map((t) => {
                const hex = calHex(t.color);
                const selected = recolorTag === t.name;
                return (
                  <span
                    key={t.name}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer transition-shadow ${selected ? "ring-2 ring-black/25" : ""}`}
                    style={{ background: `${hex}22`, color: "#1a1a1a" }}
                    onClick={() => setRecolorTag(selected ? null : t.name)}
                    title="Click to change this filter's colour"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: hex }} />
                    {t.name}
                    <button type="button" onClick={(e) => { e.stopPropagation(); if (recolorTag === t.name) setRecolorTag(null); deleteTag(cal.id, t.name); }} className="text-black/30 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </span>
                );
              })}
            </div>
            {recolorTag && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-black/50">Colour for &quot;{recolorTag}&quot;:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {colorOptions.map((c) => (
                    <button key={c} type="button" onClick={() => setTagColor(cal.id, recolorTag, c)} className={`w-5 h-5 rounded-full ${c} transition-all ${current.tags.find((t) => t.name === recolorTag)?.color === c ? "ring-2 ring-offset-1 ring-black/30 scale-110" : "hover:scale-105"}`} />
                  ))}
                </div>
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); if (newTag.trim()) { addTag(cal.id, newTag.trim(), newTagColor); setNewTag(""); } }} className="space-y-2">
              <div className="flex gap-2">
                <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add a filter..." className="h-9" />
                <Button type="submit" variant="outline" disabled={!newTag.trim()}>Add</Button>
              </div>
              {newTag.trim() && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-black/50">Colour:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {colorOptions.map((c) => (
                      <button key={c} type="button" onClick={() => setNewTagColor(c)} className={`w-5 h-5 rounded-full ${c} transition-all ${newTagColor === c ? "ring-2 ring-offset-1 ring-black/30 scale-110" : "hover:scale-105"}`} />
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={save} className="flex-1" disabled={!name.trim()}>Save</Button>
            {cal.id !== "default" && (
              <Button type="button" variant="outline" onClick={onRequestDelete} className="text-red-500 hover:text-red-600">Delete</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Every quarter hour of the day, labelled the way a timetable reads. */
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const value = `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`;
  return { value, label: timeLabel(value) };
});

/**
 * A date field plus a *time dropdown*.
 *
 * `datetime-local` pops a calendar for the date half but makes you type the time
 * digit by digit, which is the fiddly bit — so the two halves are split and the
 * time becomes a list of quarter hours. The value stays one
 * `yyyy-MM-dd'T'HH:mm` string, which is what the form and the API already speak.
 */
function DateTimeField({ label, value, required, onChange }: { label: string; value: string; required?: boolean; onChange: (value: string) => void }) {
  const [date, time] = value ? value.split("T") : ["", ""];

  const update = (nextDate: string, nextTime: string) => {
    // Half a value can't be saved, so picking one side fills the other with
    // something sensible rather than leaving the field invalid.
    if (!nextDate && !nextTime) return onChange("");
    onChange(`${nextDate || format(new Date(), "yyyy-MM-dd")}T${nextTime || "09:00"}`);
  };

  // An event created by dragging on the grid can land off the quarter hour; keep
  // its exact time in the list instead of silently rounding it away.
  const options = time && !TIME_OPTIONS.some((o) => o.value === time)
    ? [...TIME_OPTIONS, { value: time, label: timeLabel(time) }].sort((a, b) => a.value.localeCompare(b.value))
    : TIME_OPTIONS;

  return (
    <div>
      <label className="text-sm font-medium text-black/80">{label}</label>
      <div className="flex gap-2">
        <Input type="date" required={required} value={date} onChange={(e) => update(e.target.value, time)} className="flex-1 min-w-0" />
        <select
          required={required}
          value={time}
          onChange={(e) => update(date, e.target.value)}
          className="h-10 shrink-0 border rounded-md px-2 text-sm bg-white text-black"
        >
          <option value="" disabled>Time</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function EventForm({ calendars, event, onSaved, onCancel, defaultStartTime, defaultEndTime, defaultCalendar, defaultTag }: { calendars: SubCalendar[]; event?: CalendarEvent; onSaved: () => void; onCancel: () => void; defaultStartTime?: string; defaultEndTime?: string; defaultCalendar?: string; defaultTag?: string }) {
  const [form, setForm] = useState({
    title: event?.title || "",
    startTime: event ? format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm") : (defaultStartTime || ""),
    endTime: event ? format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm") : (defaultEndTime || ""),
    role: event?.role || defaultTag || "",
    category: event?.category || defaultCalendar || calendars[0]?.name || "",
    location: event?.location || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Hours per calendar are derived from each event's duration in Analytics —
    // no manual hours field needed.
    const payload = { ...form };
    try {
      if (event) {
        const res = await fetch("/api/calendar", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: event.id, ...payload }) });
        if (!res.ok) throw new Error();
        toast.success("Event updated");
      } else {
        const res = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error();
        toast.success("Event created");
      }
      onSaved();
    } catch { toast.error(event ? "Failed to update" : "Failed to create"); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-black/80">Title *</label>
        <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DateTimeField label="Start *" required value={form.startTime} onChange={(startTime) => setForm({ ...form, startTime })} />
        <DateTimeField label="End *" required value={form.endTime} onChange={(endTime) => setForm({ ...form, endTime })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-black/80">Tag</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full h-10 border rounded-md px-3 text-sm bg-white text-black">
            <option value="">No tag</option>
            {Array.from(new Set([...(calendars.find((c) => c.name === form.category)?.tags.map((t) => t.name) || []), ...(event?.role ? [event.role] : [])])).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-black/80">Calendar</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-10 border rounded-md px-3 text-sm bg-white text-black">
            {Array.from(new Set([...calendars.map((c) => c.name), ...(event?.category ? [event.category] : [])])).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-black/80">Location</label>
        <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Optional" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving || !form.title}>{saving ? "Saving..." : event ? "Save Changes" : "Create Event"}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

/* ---------- Class Form ---------- */
function ClassForm({ onSaved, onCancel, existing, calendars, defaultCalendar }: { onSaved: (cls: ClassBlock) => void; onCancel: () => void; existing?: ClassBlock; calendars: SubCalendar[]; defaultCalendar?: string }) {
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    professor: existing?.professor ?? "",
    location: existing?.location ?? "",
    creditHours: existing?.creditHours ?? 3,
    days: existing?.days ?? ([] as string[]),
    startTime: existing?.startTime ?? "09:00",
    endTime: existing?.endTime ?? "10:15",
    color: existing?.color ?? CLASS_COLORS[0],
    calendar: existing?.calendar ?? defaultCalendar ?? calendars[0]?.name ?? "Personal",
    startDate: existing?.startDate ?? "",
    endDate: existing?.endDate ?? "",
  });

  const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const PRESETS = ["MWF", "TuTh", "MW"];

  const toggleDay = (d: string) => {
    setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || form.days.length === 0) { toast.error("Fill in title and select days"); return; }
    // Preserve id when editing an existing class; generate one for a new class.
    onSaved({ ...form, id: existing?.id ?? `class_${Date.now().toString(36)}` });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-black/80">Class Title *</label>
        <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. MATH 201" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-sm font-medium text-black/80">Professor</label><Input value={form.professor} onChange={(e) => setForm({ ...form, professor: e.target.value })} placeholder="Dr. Smith" /></div>
        <div><label className="text-sm font-medium text-black/80">Location</label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Room 201" /></div>
      </div>
      <div>
        <label className="text-sm font-medium text-black/80 block mb-1.5">Calendar</label>
        <select value={form.calendar} onChange={(e) => setForm({ ...form, calendar: e.target.value })} className="w-full h-10 border rounded-md px-3 text-sm bg-white text-black">
          {calendars.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-black/80 block mb-1.5">Days *</label>
        <div className="flex gap-1 mb-2">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setForm({ ...form, days: [p] })} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${form.days.length === 1 && form.days[0] === p ? "bg-[#7FB800] text-black" : "bg-black/5 text-black/60 hover:bg-black/10"}`}>
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {DAY_OPTIONS.map((d) => (
            <button key={d} type="button" onClick={() => toggleDay(d)} className={`w-9 h-9 rounded-full text-xs font-medium transition-all ${form.days.includes(d) ? "bg-[#7FB800] text-black shadow-sm" : "bg-black/5 text-black/50 hover:bg-black/10"}`}>
              {d.charAt(0)}{d === "Thu" ? "h" : ""}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-sm font-medium text-black/80">Repeats from</label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
        <div><label className="text-sm font-medium text-black/80">Until</label><Input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
      </div>
      <p className="text-xs text-black/40 -mt-2">Leave the dates empty to repeat every week with no end.</p>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-sm font-medium text-black/80">Start</label><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
        <div><label className="text-sm font-medium text-black/80">End</label><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
        <div><label className="text-sm font-medium text-black/80">Credits</label><Input type="number" min="1" max="6" value={form.creditHours} onChange={(e) => setForm({ ...form, creditHours: parseInt(e.target.value) || 3 })} /></div>
      </div>
      <div>
        <label className="text-sm font-medium text-black/80 block mb-1.5">Color</label>
        <div className="flex gap-2 flex-wrap">
          {CLASS_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-[#FFB400] scale-110" : "hover:scale-105"}`} style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1 rounded-full bg-[#7FB800] hover:bg-[#4CA80B] text-black font-semibold" style={{ fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" }}>{existing ? "Save Changes" : "Add Class"}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
