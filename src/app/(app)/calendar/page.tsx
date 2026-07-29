"use client";

import { useEffect, useState, useMemo } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday as isDateToday,
  isTomorrow,
  isThisWeek,
} from "date-fns";
import { Plus, ChevronLeft, ChevronRight, Trash2, Pencil, X, BookOpen, Flame, AlertTriangle, Clock, MapPin, User, GraduationCap } from "lucide-react";
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
import { useCalendars, SubCalendar } from "@/lib/useCalendars";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ShineBorder } from "@/components/ui/shine-border";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { ActivityRing } from "@/components/ui/activity-ring";
import { BorderBeam } from "@/components/ui/border-beam";
import { AnimatedGradientText } from "@/components/ui/gradient-text";
import { ClickSpark } from "@/components/ui/click-spark";
import { ParticlesBg } from "@/components/ui/particles-bg";
import { CurrentTimeLine } from "@/components/ui/current-time-line";
import { Marquee } from "@/components/ui/marquee";
import { NoiseOverlay } from "@/components/ui/noise-overlay";
import { GlowCard } from "@/components/ui/glow-card";
import { motion, AnimatePresence } from "framer-motion";

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
}

interface Task {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  priority: string;
}

type View = "day" | "3day" | "5day" | "week" | "month";

const CLASS_COLORS = [
  "#f9a8d4", "#a5b4fc", "#86efac", "#fcd34d", "#fdba74",
  "#c4b5fd", "#67e8f9", "#fca5a5", "#bef264", "#d8b4fe",
];

const MONTH_THEMES: Record<number, { bg: string; accent: string; name: string }> = {
  0: { bg: "#e8f4fd", accent: "#93c5fd", name: "January" },
  1: { bg: "#fce7f3", accent: "#f9a8d4", name: "February" },
  2: { bg: "#ecfdf5", accent: "#6ee7b7", name: "March" },
  3: { bg: "#eff6ff", accent: "#93c5fd", name: "April" },
  4: { bg: "#fdf2f8", accent: "#fbcfe8", name: "May" },
  5: { bg: "#fefce8", accent: "#fde047", name: "June" },
  6: { bg: "#fef2f2", accent: "#fca5a5", name: "July" },
  7: { bg: "#fffbeb", accent: "#fbbf24", name: "August" },
  8: { bg: "#fff7ed", accent: "#fdba74", name: "September" },
  9: { bg: "#fef3c7", accent: "#f59e0b", name: "October" },
  10: { bg: "#fef9c3", accent: "#a3e635", name: "November" },
  11: { bg: "#f0fdf4", accent: "#4ade80", name: "December" },
};

interface ScheduleConflict {
  class1: ClassBlock;
  class2: ClassBlock;
  day: string;
  overlapStart: string;
  overlapEnd: string;
}

function getMinutesFromTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m > 0 ? `${h12}:${m.toString().padStart(2, "0")} ${period}` : `${h12} ${period}`;
}

function findConflicts(classes: ClassBlock[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const CLASS_DAY_MAP: Record<string, number[]> = {
    MWF: [1, 3, 5], TuTh: [2, 4], MW: [1, 3], TuThF: [2, 4, 5],
    Mon: [1], Tue: [2], Wed: [3], Thu: [4], Fri: [5], Sat: [6], Sun: [0],
  };
  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const a = classes[i], b = classes[j];
      const aDays = a.days.flatMap(d => CLASS_DAY_MAP[d] || []);
      const bDays = b.days.flatMap(d => CLASS_DAY_MAP[d] || []);
      const sharedDays = aDays.filter(d => bDays.includes(d));
      if (sharedDays.length > 0) {
        const aStart = getMinutesFromTime(a.startTime), aEnd = getMinutesFromTime(a.endTime);
        const bStart = getMinutesFromTime(b.startTime), bEnd = getMinutesFromTime(b.endTime);
        if (aStart < bEnd && bStart < aEnd) {
          const overlapStartMins = Math.max(aStart, bStart);
          const overlapEndMins = Math.min(aEnd, bEnd);
          sharedDays.forEach(d => conflicts.push({
            class1: a,
            class2: b,
            day: DAY_LABELS[d],
            overlapStart: minutesToTimeStr(overlapStartMins),
            overlapEnd: minutesToTimeStr(overlapEndMins),
          }));
        }
      }
    }
  }
  return conflicts;
}

function getNextClass(classes: ClassBlock[]): { cls: ClassBlock; minutesUntil: number } | null {
  if (classes.length === 0) return null;
  const now = new Date();
  const dow = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const CLASS_DAY_MAP: Record<string, number[]> = {
    MWF: [1, 3, 5], TuTh: [2, 4], MW: [1, 3], TuThF: [2, 4, 5],
    Mon: [1], Tue: [2], Wed: [3], Thu: [4], Fri: [5], Sat: [6], Sun: [0],
  };

  const todayClasses = classes
    .filter(cls => cls.days.some(d => (CLASS_DAY_MAP[d] || []).includes(dow)))
    .filter(cls => getMinutesFromTime(cls.startTime) > nowMinutes)
    .sort((a, b) => getMinutesFromTime(a.startTime) - getMinutesFromTime(b.startTime));

  if (todayClasses.length > 0) {
    const cls = todayClasses[0];
    return { cls, minutesUntil: getMinutesFromTime(cls.startTime) - nowMinutes };
  }

  for (let offset = 1; offset <= 7; offset++) {
    const targetDow = (dow + offset) % 7;
    const nextDayClasses = classes
      .filter(cls => cls.days.some(d => (CLASS_DAY_MAP[d] || []).includes(targetDow)))
      .sort((a, b) => getMinutesFromTime(a.startTime) - getMinutesFromTime(b.startTime));
    if (nextDayClasses.length > 0) {
      const cls = nextDayClasses[0];
      const minutesUntil = (offset * 24 * 60) - nowMinutes + getMinutesFromTime(cls.startTime);
      return { cls, minutesUntil };
    }
  }
  return null;
}

function formatCountdown(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
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

const CLASSES_STORAGE_KEY = "leadership-os-classes";

function getStoredClasses(): ClassBlock[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CLASSES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveClasses(classes: ClassBlock[]) {
  localStorage.setItem(CLASSES_STORAGE_KEY, JSON.stringify(classes));
}

/* ---------- Seasonal SVG Illustrations ---------- */
function SeasonalIcon({ month, size = 32 }: { month: number; size?: number }) {
  const s = size;
  const icons: Record<number, JSX.Element> = {
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
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>("week");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState(false);
  const [classes, setClasses] = useState<ClassBlock[]>([]);
  const [showAddClass, setShowAddClass] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [showAddCalendar, setShowAddCalendar] = useState(false);
  const [newCalName, setNewCalName] = useState("");
  const [newCalColor, setNewCalColor] = useState("bg-blue-500");
  const [calendarToDelete, setCalendarToDelete] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassBlock | null>(null);
  const { calendars, addCalendar, deleteCalendar, addTag, deleteTag, getCalendarColor, getTagsForCalendar, COLOR_OPTIONS } = useCalendars();

  useEffect(() => { setClasses(getStoredClasses()); }, []);

  const nextUp = useMemo(() => getNextClass(classes), [classes]);
  const conflicts = useMemo(() => findConflicts(classes), [classes]);
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

  const fetchEvents = async () => {
    let start: Date, end: Date;
    if (view === "day") {
      start = new Date(currentDate); start.setHours(0, 0, 0, 0);
      end = new Date(currentDate); end.setHours(23, 59, 59, 999);
    } else if (view === "3day") {
      start = new Date(currentDate); start.setHours(0, 0, 0, 0);
      end = addDays(start, 3);
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
    else if (view === "3day") setCurrentDate(addDays(currentDate, dir * 3));
    else if (view === "5day") setCurrentDate(addDays(currentDate, dir * 5));
    else if (view === "week") setCurrentDate(addDays(currentDate, dir * 7));
    else setCurrentDate(addDays(currentDate, dir * 30));
  };

  const currentTags = getTagsForCalendar(selectedCalendar);

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const cal = selectedCalendar ? calendars.find((c) => c.name === selectedCalendar) : calendars[0];
    if (!cal) return;
    const success = addTag(cal.id, newTagName.trim());
    if (success) { toast.success(`Added "${newTagName.trim()}" tag`); setNewTagName(""); setShowAddTag(false); }
    else { toast.error("Tag already exists"); }
  };

  const handleDeleteTag = (tag: string) => { setTagToDelete(tag); };

  const confirmDeleteTag = async () => {
    if (tagToDelete) {
      const matchingEvents = events.filter((e) => e.role === tagToDelete);
      for (const ev of matchingEvents) {
        try { await fetch("/api/calendar", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ev.id, role: "" }) }); } catch {}
      }
      const cal = selectedCalendar ? calendars.find((c) => c.name === selectedCalendar) : calendars.find((c) => c.tags.includes(tagToDelete!));
      if (cal) deleteTag(cal.id, tagToDelete);
      if (activeTag === tagToDelete) setActiveTag(null);
      setEvents((prev) => prev.map((e) => e.role === tagToDelete ? { ...e, role: "" } : e));
      toast.success(`Removed "${tagToDelete}" tag`);
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
    const updated = [...classes, cls];
    setClasses(updated);
    saveClasses(updated);
    toast.success("Class added!");
    setShowAddClass(false);
  };

  const deleteClass = (id: string) => {
    const updated = classes.filter((c) => c.id !== id);
    setClasses(updated);
    saveClasses(updated);
    toast.success("Class removed");
  };

  const monthIdx = currentDate.getMonth();

  return (
    <ClickSpark sparkColor="#a855f7" sparkCount={10} sparkSize={6}>
    <div className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 relative z-20" style={{ background: "#faf9f7" }}>
      {/* Film grain overlay for cinematic depth */}
      <NoiseOverlay opacity={0.02} />
      {/* Floating particles background */}
      <ParticlesBg quantity={30} color="#a855f7" size={1} speed={0.2} className="opacity-40" />

      {/* Header */}
      <header className="max-w-7xl mx-auto mb-6 relative">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <SeasonalIcon month={monthIdx} size={40} />
            <div>
              <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif" }}>
                <AnimatedGradientText colorFrom="#1f1f1f" colorTo="#6b21a8" speed={6}>
                  {format(currentDate, "MMMM yyyy")}
                </AnimatedGradientText>
              </h1>
              <p className="text-black/50 text-sm">
                {view === "day" ? format(currentDate, "EEEE, MMMM d")
                  : view === "3day" ? `${format(currentDate, "MMM d")} - ${format(addDays(currentDate, 2), "MMM d")}`
                  : view === "5day" ? "Class Schedule View"
                  : view === "week" ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")}`
                  : format(currentDate, "MMMM yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="sm" onClick={() => setShowAddClass(true)} className="bg-purple-500 hover:bg-purple-600 text-white shadow-md shadow-purple-500/20">
                <BookOpen className="w-4 h-4 mr-1" /> Class
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="sm" onClick={() => setShowAdd(true)} className="bg-black text-white hover:bg-black/80 shadow-md shadow-black/20">
                <Plus className="w-4 h-4 mr-1" /> Event
              </Button>
            </motion.div>
          </div>
        </div>

        {/* View Selector */}
        <div className="flex items-center justify-between mt-4">
          <AnimatedTabs
            tabs={[
              { id: "day", label: "Day" },
              { id: "3day", label: "3-Day" },
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
              className="px-3 py-1.5 rounded-full text-xs font-medium text-black/70 hover:bg-purple-50 hover:text-purple-700 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Today
            </motion.button>
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

        {/* Calendar & Tag Filters */}
        <div className="flex gap-2 flex-wrap items-center mt-3">
          <button onClick={() => setSelectedCalendar(null)} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedCalendar === null ? "bg-black text-white" : "bg-black/5 text-black/60 hover:bg-black/10"}`}>
            All
          </button>
          {calendars.map((cal) => (
            <div key={cal.id} className="group relative flex items-center">
              <button onClick={() => setSelectedCalendar(selectedCalendar === cal.name ? null : cal.name)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${selectedCalendar === cal.name ? "ring-2 ring-offset-1 ring-black/20 bg-white text-black shadow-sm" : "bg-black/5 text-black/60 hover:bg-black/10"}`}>
                <div className={`w-2 h-2 rounded-full ${cal.color}`} />
                {cal.name}
              </button>
              {cal.id !== "default" && (
                <button onClick={(e) => { e.stopPropagation(); setCalendarToDelete(cal.id); }} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-400 text-white items-center justify-center text-[8px] hidden group-hover:flex hover:bg-red-500 transition-colors">
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
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

        {/* Tags */}
        {currentTags.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center mt-2">
            {currentTags.map((tag) => (
              <div key={tag} className="group relative">
                <button onClick={() => setActiveTag(activeTag === tag ? null : tag)} className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${activeTag === tag ? "bg-black/10 text-black" : "bg-black/5 text-black/50 hover:bg-black/10"}`}>
                  {tag}
                </button>
                <button onClick={() => handleDeleteTag(tag)} className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-400 text-white items-center justify-center text-[7px] hidden group-hover:flex">
                  <X className="w-2 h-2" />
                </button>
              </div>
            ))}
            {showAddTag ? (
              <form onSubmit={(e) => { e.preventDefault(); handleAddTag(); }} className="flex items-center gap-1">
                <input autoFocus value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag..." className="h-5 w-20 px-2 text-[11px] border border-black/20 rounded-full bg-white text-black focus:outline-none" onBlur={() => { if (!newTagName) setShowAddTag(false); }} />
              </form>
            ) : (
              <button onClick={() => setShowAddTag(true)} className="w-5 h-5 rounded-full border border-dashed border-black/20 flex items-center justify-center text-black/40 hover:border-black/40 hover:text-black transition-colors">
                <Plus className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )}
      </header>

      {/* Infinite marquee ticker */}
      {classes.length > 0 && (
        <div className="max-w-7xl mx-auto mb-3 overflow-hidden rounded-xl bg-black/[0.02] border border-black/5">
          <Marquee speed={25} pauseOnHover className="py-2">
            {classes.map((cls) => (
              <span key={cls.id} className="flex items-center gap-2 px-4 text-xs text-black/50">
                <span className="w-2 h-2 rounded-full" style={{ background: cls.color }} />
                <span className="font-medium text-black/70">{cls.title}</span>
                <span>·</span>
                <span>{cls.days.join("/")}</span>
                <span>·</span>
                <span>{cls.startTime}–{cls.endTime}</span>
              </span>
            ))}
          </Marquee>
        </div>
      )}

      {/* Next Up Banner + Conflicts */}
      <div className="max-w-7xl mx-auto mb-4 space-y-2">
        {nextUp && (
          <BlurFade delay={0.1} duration={0.5}>
            <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-black/5 shadow-sm relative overflow-hidden" style={{ background: "linear-gradient(135deg, #faf9f7 0%, #f5f3ff 100%)" }}>
              <ShineBorder shineColor={[nextUp.cls.color, "#a855f7", nextUp.cls.color]} duration={8} borderWidth={1} />
              <div className="absolute inset-0 opacity-[0.04]" style={{ background: `linear-gradient(90deg, ${nextUp.cls.color} 0%, transparent 60%)` }} />
              <motion.div
                className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                style={{ background: nextUp.cls.color }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <GraduationCap className="w-5 h-5 text-white" />
              </motion.div>
              <div className="relative flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-black/40 font-semibold">Next Up</p>
                <p className="text-sm font-bold text-black truncate">{nextUp.cls.title}</p>
                {nextUp.cls.professor && (
                  <p className="text-[11px] text-black/40 truncate">{nextUp.cls.professor}</p>
                )}
              </div>
              <div className="relative flex items-center gap-3 text-xs text-black/60 shrink-0">
                {nextUp.cls.location && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/[0.03]">
                    <MapPin className="w-3 h-3 text-black/40" />{nextUp.cls.location}
                  </span>
                )}
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/[0.03]">
                  <Clock className="w-3 h-3 text-black/40" />{nextUp.cls.startTime}
                </span>
                <motion.span
                  className="px-2.5 py-1 rounded-full font-bold text-xs text-white shadow-sm"
                  style={{ background: nextUp.cls.color }}
                  animate={{ opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  {formatCountdown(nextUp.minutesUntil)}
                </motion.span>
              </div>
            </div>
          </BlurFade>
        )}
        {conflicts.length > 0 && (
          <BlurFade delay={0.2} duration={0.4}>
          <div className="rounded-xl bg-amber-50 border border-amber-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs font-semibold text-amber-800">
                {conflicts.length} time {conflicts.length === 1 ? "conflict" : "conflicts"} detected
              </p>
            </div>
            <div className="px-4 pb-2.5 space-y-1.5">
              {conflicts.slice(0, 3).map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-amber-900/80">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: c.class1.color }} />
                    <span className="font-medium">{c.class1.title}</span>
                  </div>
                  <span className="text-amber-600">×</span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: c.class2.color }} />
                    <span className="font-medium">{c.class2.title}</span>
                  </div>
                  <span className="text-amber-700/60 ml-auto">{c.day} · {c.overlapStart}–{c.overlapEnd}</span>
                </div>
              ))}
              {conflicts.length > 3 && (
                <p className="text-[10px] text-amber-600 pl-3">+{conflicts.length - 3} more conflicts</p>
              )}
            </div>
          </div>
          </BlurFade>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto flex gap-4">
        {/* Calendar Area */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center text-black/40 py-12">
              <motion.div
                className="w-8 h-8 rounded-full border-2 border-purple-300 border-t-purple-600 mx-auto"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <p className="mt-2 text-sm">Loading schedule...</p>
            </div>
          ) : view === "month" ? (
            <BlurFade key={`month-${currentDate.getMonth()}`} duration={0.3}>
              <MonthViewCute events={filteredEvents} currentDate={currentDate} onEventClick={setSelectedEvent} getColor={getCalendarColor} classes={classes} onClassClick={setSelectedClass} />
            </BlurFade>
          ) : (
            <BlurFade key={`grid-${view}-${currentDate.toISOString()}`} duration={0.3}>
              <TimeGridView events={filteredEvents} currentDate={currentDate} view={view} onEventClick={setSelectedEvent} getColor={getCalendarColor} classes={classes} onClassClick={setSelectedClass} />
            </BlurFade>
          )}
        </div>

        {/* Task Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <BlurFade delay={0.2} direction="right" duration={0.5}>
          <GlowCard className="sticky top-4" glowColor="rgba(168, 85, 247, 0.08)">
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
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-purple-50/60 border border-purple-100 relative overflow-hidden">
                  <GraduationCap className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-[11px] font-bold text-purple-700">
                    <NumberTicker value={totalCredits} /> credits
                  </span>
                  <span className="text-[10px] text-purple-400">•</span>
                  <span className="text-[11px] text-purple-600">
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
        </aside>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
            <DialogDescription>Create a new calendar event</DialogDescription>
          </DialogHeader>
          <EventForm calendars={calendars} onSaved={() => { setShowAdd(false); fetchEvents(); }} onCancel={() => setShowAdd(false)} />
        </DialogContent>
      </Dialog>

      {/* Add Class Dialog */}
      <Dialog open={showAddClass} onOpenChange={setShowAddClass}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Class</DialogTitle>
            <DialogDescription>Add a recurring class to your schedule</DialogDescription>
          </DialogHeader>
          {showAddClass && <ClassForm onSaved={addClass} onCancel={() => setShowAddClass(false)} />}
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
      <Dialog open={!!selectedClass} onOpenChange={(open) => { if (!open) setSelectedClass(null); }}>
        <DialogContent>
          {selectedClass && (
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
                <Button variant="destructive" size="sm" onClick={() => { deleteClass(selectedClass.id); setSelectedClass(null); }}>
                  <Trash2 className="w-4 h-4 mr-1" />Remove Class
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
    </div>
    </ClickSpark>
  );
}

/* ---------- Collision layout: positions overlapping items side-by-side ---------- */
interface LayoutItem { id: string; startMin: number; endMin: number; }
interface LayoutResult { col: number; totalCols: number; }

function computeColumns(items: LayoutItem[]): Map<string, LayoutResult> {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const result = new Map<string, LayoutResult>();
  const groups: LayoutItem[][] = [];

  for (const item of sorted) {
    let placed = false;
    for (const group of groups) {
      if (group.every(g => g.endMin <= item.startMin || g.startMin >= item.endMin)) {
        group.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([item]);
  }

  // Assign columns using greedy coloring
  const columns: LayoutItem[][] = [];
  for (const item of sorted) {
    let col = 0;
    while (col < columns.length) {
      if (columns[col].every(c => c.endMin <= item.startMin || c.startMin >= item.endMin)) break;
      col++;
    }
    if (col >= columns.length) columns.push([]);
    columns[col].push(item);
  }

  // Find connected groups to determine totalCols per item
  for (const item of sorted) {
    const col = columns.findIndex(c => c.includes(item));
    const overlapping = sorted.filter(o => o.startMin < item.endMin && o.endMin > item.startMin);
    const maxCol = Math.max(...overlapping.map(o => columns.findIndex(c => c.includes(o))));
    result.set(item.id, { col, totalCols: maxCol + 1 });
  }
  return result;
}

/* ---------- Time Grid View (Day / 3-Day / 5-Day / Week) ---------- */
function TimeGridView({ events, currentDate, view, onEventClick, getColor, classes, onClassClick }: {
  events: CalendarEvent[]; currentDate: Date; view: View; onEventClick: (e: CalendarEvent) => void; getColor: (category: string) => string; classes: ClassBlock[]; onClassClick: (cls: ClassBlock) => void;
}) {
  const dayCount = view === "day" ? 1 : view === "3day" ? 3 : view === "5day" ? 5 : 7;
  const weekStart = view === "5day" || view === "week" ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
  const days = Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i));
  const START_HOUR = 6;
  const END_HOUR = 23;
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);
  const HOUR_PX = 56;
  const CLASS_DAY_MAP: Record<string, number[]> = {
    MWF: [1, 3, 5], TuTh: [2, 4], MW: [1, 3], TuThF: [2, 4, 5],
    Mon: [1], Tue: [2], Wed: [3], Thu: [4], Fri: [5], Sat: [6], Sun: [0],
  };

  const getClassesForDay = (day: Date) => {
    const dow = getDay(day);
    return classes.filter((cls) => cls.days.some((d) => (CLASS_DAY_MAP[d] || []).includes(dow)));
  };

  const getEventsForDay = (day: Date) => {
    return events.filter((e) => isSameDay(new Date(e.startTime), day));
  };

  const timeToY = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return Math.max(0, ((h - START_HOUR) + m / 60) * HOUR_PX);
  };

  const hourHeight = (startStr: string, endStr: string) => {
    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);
    return Math.max(28, ((eh - sh) + (em - sm) / 60) * HOUR_PX);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden relative">
      <BorderBeam size={100} duration={10} colorFrom="#a855f7" colorTo="#ec4899" borderWidth={2} />
      {/* Day headers */}
      <div className="grid border-b border-black/5" style={{ gridTemplateColumns: `3.5rem repeat(${dayCount}, 1fr)` }}>
        <div className="p-2" />
        {days.map((day) => {
          const today = isDateToday(day);
          return (
            <div key={day.toISOString()} className={`p-2 text-center border-l border-black/5 ${today ? "bg-blue-50" : ""}`}>
              <p className="text-[10px] uppercase text-black/40 font-medium">{format(day, "EEE")}</p>
              <p className={`text-lg font-bold ${today ? "text-blue-600" : "text-black"}`}>{format(day, "d")}</p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="relative overflow-y-auto max-h-[600px]">
        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${dayCount}, 1fr)` }}>
          {/* Hour labels */}
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="h-14 border-b border-black/5 flex items-start justify-end pr-2">
                <span className="text-[10px] text-black/30 -mt-1.5">{format(new Date(2024, 0, 1, hour), "h a")}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayClasses = getClassesForDay(day);
            const dayEvents = getEventsForDay(day);
            const gaps = findGaps(classes, day);

            // Compute side-by-side layout for overlapping classes
            const classItems: LayoutItem[] = dayClasses.map(cls => ({
              id: cls.id,
              startMin: getMinutesFromTime(cls.startTime),
              endMin: getMinutesFromTime(cls.endTime),
            }));
            const classLayout = computeColumns(classItems);

            // Compute side-by-side layout for overlapping events
            const eventItems: LayoutItem[] = dayEvents.map(ev => {
              const s = new Date(ev.startTime);
              const e = new Date(ev.endTime);
              return { id: ev.id, startMin: s.getHours() * 60 + s.getMinutes(), endMin: e.getHours() * 60 + e.getMinutes() };
            });
            const eventLayout = computeColumns(eventItems);

            return (
              <div key={day.toISOString()} className="relative border-l border-black/5">
                {hours.map((hour) => (
                  <div key={hour} className="h-14 border-b border-black/5" />
                ))}
                {/* Current time indicator */}
                <CurrentTimeLine startHour={START_HOUR} hourHeight={HOUR_PX} dayCount={dayCount} isToday={isDateToday(day)} />
                {/* Gap indicators */}
                {gaps.map((gap, i) => {
                  const top = ((gap.start / 60) - START_HOUR) * HOUR_PX;
                  const height = ((gap.end - gap.start) / 60) * HOUR_PX;
                  if (top < 0) return null;
                  const gapMins = gap.end - gap.start;
                  return (
                    <div
                      key={`gap-${i}`}
                      className="absolute left-1 right-1 rounded-lg border border-dashed border-black/10 flex items-center justify-center pointer-events-none"
                      style={{ top: `${top}px`, height: `${height}px`, background: "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(0,0,0,0.02) 4px, rgba(0,0,0,0.02) 8px)" }}
                    >
                      <span className="text-[9px] text-black/30 font-medium bg-white/80 px-1.5 py-0.5 rounded">
                        {gapMins >= 60 ? `${Math.floor(gapMins / 60)}h ${gapMins % 60 > 0 ? `${gapMins % 60}m` : ""} free` : `${gapMins}m free`}
                      </span>
                    </div>
                  );
                })}
                {/* Class blocks — side-by-side when overlapping, staggered entrance */}
                {dayClasses.map((cls, idx) => {
                  const blockHeight = hourHeight(cls.startTime, cls.endTime);
                  const isCompact = blockHeight < 42;
                  const layout = classLayout.get(cls.id) || { col: 0, totalCols: 1 };
                  const widthPct = 100 / layout.totalCols;
                  const leftPct = layout.col * widthPct;
                  return (
                    <motion.button
                      key={cls.id}
                      onClick={() => onClassClick(cls)}
                      className="absolute rounded-lg px-2 py-1 overflow-hidden shadow-sm text-left cursor-pointer hover:shadow-lg transition-shadow border-l-[3px]"
                      style={{
                        top: `${timeToY(cls.startTime)}px`,
                        height: `${blockHeight}px`,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        background: `${cls.color}20`,
                        borderLeftColor: cls.color,
                      }}
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: idx * 0.08, ease: "easeOut" }}
                      whileHover={{ scale: 1.03, y: -2 }}
                    >
                      <p className="text-[11px] font-bold truncate" style={{ color: cls.color }}>{cls.title}</p>
                      {!isCompact && <p className="text-[9px] text-black/50 truncate">{cls.location}</p>}
                      {!isCompact && <p className="text-[9px] text-black/40">{cls.startTime} - {cls.endTime}</p>}
                    </motion.button>
                  );
                })}
                {/* Event blocks — side-by-side when overlapping */}
                {dayEvents.map((ev) => {
                  const start = new Date(ev.startTime);
                  const end = new Date(ev.endTime);
                  const startHour = start.getHours() + start.getMinutes() / 60;
                  const endHour = end.getHours() + end.getMinutes() / 60;
                  const top = Math.max(0, (startHour - START_HOUR) * HOUR_PX);
                  const maxY = (END_HOUR - START_HOUR) * HOUR_PX;
                  const height = Math.min(Math.max(28, (endHour - startHour) * HOUR_PX), maxY - top);
                  const layout = eventLayout.get(ev.id) || { col: 0, totalCols: 1 };
                  const widthPct = 100 / layout.totalCols;
                  const leftPct = layout.col * widthPct;
                  const colorClass = getColor(ev.category);
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className="absolute rounded-lg px-2 py-1 text-left border border-black/5 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                      style={{ top: `${top}px`, height: `${height}px`, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`, background: "white" }}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${colorClass}`} />
                      <p className="text-[11px] font-semibold text-black truncate ml-1.5">{ev.title}</p>
                      <p className="text-[9px] text-black/50 ml-1.5">{format(start, "h:mm a")}</p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Month View (Cute Seasonal) ---------- */
function MonthViewCute({ events, currentDate, onEventClick, getColor, classes, onClassClick }: {
  events: CalendarEvent[]; currentDate: Date; onEventClick: (e: CalendarEvent) => void; getColor: (category: string) => string; classes: ClassBlock[]; onClassClick: (cls: ClassBlock) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = (getDay(monthStart) + 6) % 7;
  const monthIdx = currentDate.getMonth();
  const theme = MONTH_THEMES[monthIdx];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
      {/* Month header with seasonal decoration */}
      <div className="p-4 flex items-center justify-between" style={{ background: theme.bg }}>
        <div className="flex items-center gap-3">
          <SeasonalIcon month={monthIdx} size={36} />
          <h2 className="text-xl font-bold text-black" style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif" }}>
            {format(currentDate, "MMMM yyyy")}
          </h2>
        </div>
        <SeasonalIcon month={monthIdx} size={28} />
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 border-b border-black/5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center py-2 text-[11px] font-semibold text-black/40 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="h-24 border-b border-r border-black/5" />
        ))}
        {days.map((day) => {
          const dayEvents = events.filter((e) => {
            const s = new Date(e.startTime);
            const end = new Date(e.endTime);
            return isSameDay(s, day) || isSameDay(end, day) || (s < day && end > day);
          });
          const today = isDateToday(day);
          return (
            <div key={day.toISOString()} className={`h-24 p-1.5 border-b border-r border-black/5 transition-colors hover:bg-black/[0.02] ${today ? "bg-blue-50/50" : ""}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-0.5 ${today ? "text-white" : "text-black/70"}`} style={today ? { background: theme.accent } : {}}>
                {format(day, "d")}
              </div>
              <div className="space-y-px overflow-hidden">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button key={ev.id} onClick={() => onEventClick(ev)} className="flex items-center gap-0.5 w-full text-left rounded px-0.5 hover:bg-black/5 cursor-pointer">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getColor(ev.category)}`} />
                    <span className="text-[9px] text-black/70 truncate">{ev.title}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && <span className="text-[8px] text-black/30 px-0.5">+{dayEvents.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Event Form ---------- */
function EventForm({ calendars, event, onSaved, onCancel }: { calendars: SubCalendar[]; event?: CalendarEvent; onSaved: () => void; onCancel: () => void }) {
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
    const payload = { ...form, actualMinutes: form.hours ? Math.round(parseFloat(form.hours) * 60) : undefined };
    delete (payload as any).hours;
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
        <div><label className="text-sm font-medium text-black/80">Start *</label><Input type="datetime-local" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
        <div><label className="text-sm font-medium text-black/80">End *</label><Input type="datetime-local" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-black/80">Tag</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full h-10 border rounded-md px-3 text-sm bg-white text-black">
            <option value="">No tag</option>
            {Array.from(new Set([...(calendars.find((c) => c.name === form.category)?.tags || []), ...(event?.role ? [event.role] : [])])).map((t) => (
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
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-sm font-medium text-black/80">Location</label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Optional" /></div>
        <div><label className="text-sm font-medium text-black/80">Hours</label><Input type="number" step="0.5" min="0" max="24" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="e.g. 1.5" /></div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving || !form.title}>{saving ? "Saving..." : event ? "Save Changes" : "Create Event"}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

/* ---------- Class Form ---------- */
function ClassForm({ onSaved, onCancel }: { onSaved: (cls: ClassBlock) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    title: "", professor: "", location: "", creditHours: 3,
    days: [] as string[], startTime: "09:00", endTime: "10:15", color: CLASS_COLORS[0],
  });

  const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const PRESETS = ["MWF", "TuTh", "MW"];

  const toggleDay = (d: string) => {
    setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || form.days.length === 0) { toast.error("Fill in title and select days"); return; }
    onSaved({ ...form, id: `class_${Date.now().toString(36)}` });
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
        <label className="text-sm font-medium text-black/80 block mb-1.5">Days *</label>
        <div className="flex gap-1 mb-2">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setForm({ ...form, days: [p] })} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${form.days.length === 1 && form.days[0] === p ? "bg-purple-500 text-white" : "bg-black/5 text-black/60 hover:bg-black/10"}`}>
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {DAY_OPTIONS.map((d) => (
            <button key={d} type="button" onClick={() => toggleDay(d)} className={`w-9 h-9 rounded-full text-xs font-medium transition-all ${form.days.includes(d) ? "bg-purple-500 text-white shadow-sm" : "bg-black/5 text-black/50 hover:bg-black/10"}`}>
              {d.charAt(0)}{d === "Thu" ? "h" : ""}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-sm font-medium text-black/80">Start</label><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
        <div><label className="text-sm font-medium text-black/80">End</label><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
        <div><label className="text-sm font-medium text-black/80">Credits</label><Input type="number" min="1" max="6" value={form.creditHours} onChange={(e) => setForm({ ...form, creditHours: parseInt(e.target.value) || 3 })} /></div>
      </div>
      <div>
        <label className="text-sm font-medium text-black/80 block mb-1.5">Color</label>
        <div className="flex gap-2 flex-wrap">
          {CLASS_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-purple-400 scale-110" : "hover:scale-105"}`} style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1 bg-purple-500 hover:bg-purple-600">Add Class</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
