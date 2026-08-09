"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronRight, BookOpen, Sparkles } from "lucide-react";
import { getPod } from "@/lib/pods";
import {
  type Reflection,
  formatReflectionDate,
  parseQA,
  groupReflectionsByMonth,
} from "@/lib/reflections";
import { SeedMascot } from "@/components/reflections/PeaceDecor";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;
const GRASS = "#7FB800";

/**
 * Dedicated reflections history page. Fetches all saved reflections, groups
 * them by month, and shows each as an expandable card with its pod, date,
 * per-question answers, mood/energy, and gratitude.
 */
export default function ReflectionHistoryPage() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/reflections");
        if (res.ok) setReflections(await res.json());
        else toast.error("Couldn't load your reflections");
      } catch {
        toast.error("Couldn't load your reflections");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const groups = useMemo(() => groupReflectionsByMonth(reflections), [reflections]);

  return (
    <div className="peace-surface min-h-screen -m-4 md:-m-8 p-4 md:p-8 relative z-20">
      <div className="max-w-3xl mx-auto">
        {/* header */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/reflections"
            className="inline-flex items-center gap-1.5 text-black/50 text-sm font-medium hover:text-black transition-colors"
            style={MARKER}
          >
            <ArrowLeft className="w-4 h-4" /> Reflect
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-black/50 text-sm font-medium hover:text-black transition-colors"
            style={MARKER}
          >
            Home
          </Link>
        </div>

        <div className="flex items-center gap-3 mt-4 mb-6">
          <SeedMascot className="w-11 h-11 shrink-0" />
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-black" style={MARKER}>
              Your reflections
            </h1>
            <p className="text-black/55 text-sm mt-0.5">
              {reflections.length} {reflections.length === 1 ? "entry" : "entries"} — every time you showed up.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-3xl bg-white border border-black/5 animate-pulse" />
            ))}
          </div>
        ) : reflections.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {groups.map(({ key, month, items }) => (
              <MonthGroup key={key} month={month} items={items} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-white border border-black/5 p-10 text-center">
      <SeedMascot className="w-16 h-16 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-black" style={MARKER}>
        No reflections yet
      </h2>
      <p className="text-black/55 mt-1 max-w-sm mx-auto">
        Your saved reflections will gather here. Start with three gentle questions.
      </p>
      <Link
        href="/reflections"
        className="mt-6 inline-flex items-center justify-center gap-2 min-h-[44px] px-7 py-3 rounded-full text-black font-semibold shadow-md hover:brightness-105 hover:-translate-y-0.5 transition-all"
        style={{ background: GRASS, ...MARKER }}
      >
        <Sparkles className="w-5 h-5" /> Start reflecting
      </Link>
    </div>
  );
}

function MonthGroup({ month, items }: { month: string; items: Reflection[] }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-sm font-bold text-black/50 uppercase tracking-wide px-1 mb-2">
        {month} <span className="text-black/30">({items.length})</span>
      </h2>
      <div className="space-y-3">
        {items.map((ref) => (
          <ReflectionCard key={ref.id} reflection={ref} />
        ))}
      </div>
    </section>
  );
}

function ReflectionCard({ reflection }: { reflection: Reflection }) {
  const [open, setOpen] = useState(false);
  const pod = getPod(reflection.podId);
  const qa = parseQA(reflection.questions);

  return (
    <div className="rounded-3xl bg-white border border-black/5 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-black/[0.02] transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {open ? (
            <ChevronDown className="w-4 h-4 text-black/40 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-black/40 shrink-0" />
          )}
          <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 bg-amber-100 text-amber-800 shrink-0">
            {pod ? (
              <>
                <span>{pod.emoji}</span> {pod.title}
              </>
            ) : (
              <>
                <BookOpen className="w-3 h-3" /> {reflection.type}
              </>
            )}
          </span>
          <span className="text-sm text-black/50 truncate">
            {formatReflectionDate(reflection.type, reflection.date)}
          </span>
        </div>
        {reflection.mood != null && (
          <span className="text-[11px] font-semibold text-black/40 shrink-0">Mood {reflection.mood}/10</span>
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-black/5">
          {qa.length > 0 ? (
            <div className="space-y-3 mt-3">
              {qa.map((item, i) => (
                <div key={i}>
                  <p className="text-xs font-semibold text-black/60">{item.question}</p>
                  <p className="text-sm text-black/80 whitespace-pre-wrap mt-0.5">{item.answer || "—"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-black/80 whitespace-pre-wrap mt-3">{reflection.content}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-4">
            {reflection.mood != null && (
              <span className="text-xs font-medium text-black/60 bg-black/[0.04] rounded-full px-2.5 py-1">
                Mood {reflection.mood}/10
              </span>
            )}
            {reflection.energy != null && (
              <span className="text-xs font-medium text-black/60 bg-black/[0.04] rounded-full px-2.5 py-1">
                Energy {reflection.energy}/10
              </span>
            )}
          </div>

          {reflection.gratitude && (
            <p className="mt-3 text-xs text-black/50 italic">💛 Grateful for: {reflection.gratitude}</p>
          )}
        </div>
      )}
    </div>
  );
}
