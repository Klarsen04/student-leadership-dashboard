"use client";

import { useEffect, useMemo, useState } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { PODS, getPod, type Pod } from "@/lib/pods";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RainbowArc, HeartFlower, SeedMascot } from "@/components/reflections/PeaceDecor";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" };

// ---- palette ---------------------------------------------------------------
const CREAM = "#FFFAF5";
const MARIGOLD = "#FFB400";
const GRASS = "#7FB800";

interface QA {
  question: string;
  answer: string;
}

interface Reflection {
  id: string;
  type: string;
  date: string;
  content: string;
  mood: number | null;
  energy: number | null;
  gratitude: string | null;
  podId: string | null;
  questions: string | null;
}

type Screen = "welcome" | "flow" | "done";

function formatReflectionDate(type: string, dateStr: string): string {
  const date = new Date(dateStr);
  if (type === "daily") return format(date, "EEEE, MMM d");
  if (type === "weekly") {
    const ws = startOfWeek(date, { weekStartsOn: 0 });
    const we = endOfWeek(date, { weekStartsOn: 0 });
    return `Week of ${format(ws, "MMM d")} – ${format(we, "MMM d")}`;
  }
  return format(date, "MMMM yyyy");
}

function parseQA(raw: string | null): QA[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Which pods already have a reflection logged for the current period.
function usedPodTypes(reflections: Reflection[]): Set<string> {
  const now = new Date();
  const used = new Set<string>();
  for (const ref of reflections) {
    const d = new Date(ref.date);
    if (ref.type === "daily" && d.toDateString() === now.toDateString()) used.add("daily");
    else if (ref.type === "weekly") {
      const ws = startOfWeek(now, { weekStartsOn: 0 });
      const we = endOfWeek(now, { weekStartsOn: 0 });
      if (d >= ws && d <= we) used.add("weekly");
    } else if (ref.type === "monthly" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      used.add("monthly");
    }
  }
  return used;
}

export default function ReflectionsPage() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [activePod, setActivePod] = useState<Pod | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reflection | null>(null);
  const [editTarget, setEditTarget] = useState<Reflection | null>(null);

  const fetchReflections = async () => {
    try {
      const res = await fetch("/api/reflections");
      if (res.ok) setReflections(await res.json());
    } catch {
      toast.error("Failed to load reflections");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReflections();
  }, []);

  const usedTypes = useMemo(() => usedPodTypes(reflections), [reflections]);

  const startPod = (pod: Pod) => {
    setActivePod(pod);
    setScreen("flow");
  };

  const onSaved = () => {
    setScreen("done");
    fetchReflections();
  };

  const deleteReflection = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/reflections?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setReflections((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success("Reflection deleted");
    } catch {
      toast.error("Failed to delete reflection");
    }
  };

  return (
    <div
      className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 flex flex-col items-center overflow-x-hidden relative z-20"
      style={{ background: CREAM, color: "#1a1a1a" }}
    >
      {screen === "welcome" && (
        <WelcomeScreen
          reflections={reflections}
          loading={loading}
          usedTypes={usedTypes}
          onStartPod={startPod}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
        />
      )}

      {screen === "flow" && activePod && (
        <GuidedFlow
          pod={activePod}
          alreadyLogged={usedTypes.has(activePod.type)}
          onCancel={() => setScreen("welcome")}
          onSaved={onSaved}
        />
      )}

      {screen === "done" && activePod && (
        <DoneScreen pod={activePod} onHome={() => setScreen("welcome")} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete reflection?"
        description="This reflection will be permanently deleted."
        onConfirm={deleteReflection}
      />

      {editTarget && (
        <EditDialog
          reflection={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            fetchReflections();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome screen: hero + pod picker + history
// ---------------------------------------------------------------------------
function WelcomeScreen({
  reflections,
  loading,
  usedTypes,
  onStartPod,
  onEdit,
  onDelete,
}: {
  reflections: Reflection[];
  loading: boolean;
  usedTypes: Set<string>;
  onStartPod: (pod: Pod) => void;
  onEdit: (r: Reflection) => void;
  onDelete: (r: Reflection) => void;
}) {
  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      {/* Hero */}
      <div className="text-center pt-6 md:pt-12 animate-fade-in">
        <p className="text-lg text-black/60" style={MARKER}>
          hi! welcome to
        </p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mt-1" style={MARKER}>
          the daily reflection
        </h1>
        <p className="mt-4 text-black/60 max-w-md mx-auto">
          Start with three gentle questions. A moment to pause, notice, and grow.
        </p>
        <button
          onClick={() => onStartPod(PODS[0])}
          className="mt-6 inline-flex items-center gap-2 px-7 py-3 rounded-full text-black font-semibold shadow-md hover:brightness-105 hover:-translate-y-0.5 active:translate-y-0 transition-all"
          style={{ background: GRASS, ...MARKER }}
        >
          Begin here <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Rainbow divider */}
      <div className="relative w-[130%] h-20 md:h-28 mt-8 mb-2 pointer-events-none">
        <RainbowArc className="absolute inset-0 w-full h-full" />
      </div>

      {/* Pod picker */}
      <section className="w-full mt-4">
        <h2 className="text-2xl md:text-3xl font-bold text-center" style={MARKER}>
          Which area would you like to explore?
        </h2>
        <p className="text-center text-black/50 text-sm mt-1">
          Our pods help you untangle your feelings.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {PODS.map((pod) => {
            const done = usedTypes.has(pod.type);
            return (
              <button
                key={pod.id}
                onClick={() => onStartPod(pod)}
                className="group text-left rounded-3xl bg-white border border-black/5 p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all"
              >
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${pod.accent} flex items-center justify-center text-2xl mb-3`}
                >
                  {pod.emoji}
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold" style={MARKER}>
                    {pod.title}
                  </h3>
                  {done && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                      <Check className="w-3 h-3" /> done
                    </span>
                  )}
                </div>
                <p className="text-sm text-black/50 mt-1 leading-relaxed">{pod.tagline}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-black/70 group-hover:gap-2 transition-all">
                  {done ? "Reflect again" : "Start"} <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Flower row */}
      <div className="flex items-end justify-center gap-6 md:gap-10 mt-10 opacity-90 pointer-events-none">
        {[0, 0.4, 0.8, 1.2, 1.6].map((d, i) => (
          <HeartFlower key={i} delay={d} className="w-8 h-16 md:w-10 md:h-20" />
        ))}
      </div>

      {/* History */}
      <section className="w-full mt-10 mb-8">
        <h2 className="text-xl font-bold mb-3" style={MARKER}>
          Your reflections
        </h2>
        {loading ? (
          <div className="text-center text-black/40 py-10">Loading…</div>
        ) : reflections.length === 0 ? (
          <div className="rounded-3xl bg-white border border-black/5 p-8 text-center">
            <SeedMascot className="w-14 h-14 mx-auto mb-3" />
            <p className="font-semibold" style={MARKER}>
              No reflections yet
            </p>
            <p className="text-sm text-black/50 mt-1">
              Pick a pod above and answer three questions to plant your first one.
            </p>
          </div>
        ) : (
          <HistoryList reflections={reflections} onEdit={onEdit} onDelete={onDelete} />
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History list, grouped by month
// ---------------------------------------------------------------------------
function HistoryList({
  reflections,
  onEdit,
  onDelete,
}: {
  reflections: Reflection[];
  onEdit: (r: Reflection) => void;
  onDelete: (r: Reflection) => void;
}) {
  const groups = useMemo(() => {
    const map: Record<string, Reflection[]> = {};
    for (const ref of reflections) {
      const key = ref.date.slice(0, 7);
      (map[key] ||= []).push(ref);
    }
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => {
        const [year, month] = key.split("-");
        return { month: `${monthNames[parseInt(month) - 1]} ${year}`, items };
      });
  }, [reflections]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set(groups[0] ? [groups[0].month] : []));

  const toggle = (m: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });

  return (
    <div className="space-y-3">
      {groups.map(({ month, items }) => {
        const open = expanded.has(month);
        return (
          <div key={month}>
            <button
              onClick={() => toggle(month)}
              className="flex items-center gap-2 w-full text-left px-2 py-2 rounded-lg hover:bg-black/[0.03] transition-colors"
            >
              {open ? <ChevronDown className="w-4 h-4 text-black/40" /> : <ChevronRight className="w-4 h-4 text-black/40" />}
              <span className="font-semibold text-sm">{month}</span>
              <span className="text-xs text-black/40">({items.length})</span>
            </button>
            {open && (
              <div className="space-y-3 mt-2 ml-6">
                {items.map((ref) => (
                  <ReflectionCard key={ref.id} ref={ref} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReflectionCard({
  ref,
  onEdit,
  onDelete,
}: {
  ref: Reflection;
  onEdit: (r: Reflection) => void;
  onDelete: (r: Reflection) => void;
}) {
  const pod = getPod(ref.podId);
  const qa = parseQA(ref.questions);
  return (
    <div className="rounded-3xl bg-white border border-black/5 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 bg-amber-100 text-amber-800">
            {pod ? (
              <>
                <span>{pod.emoji}</span> {pod.title}
              </>
            ) : (
              ref.type
            )}
          </span>
          <span className="text-xs text-black/40">{formatReflectionDate(ref.type, ref.date)}</span>
        </div>
        <div className="flex items-center gap-1">
          {ref.mood != null && <span className="text-[10px] text-black/40 mr-1">Mood {ref.mood}/10</span>}
          <button onClick={() => onEdit(ref)} className="p-1 text-black/40 hover:text-black transition-colors" aria-label="Edit reflection">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(ref)} className="p-1 text-black/40 hover:text-red-500 transition-colors" aria-label="Delete reflection">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {qa.length > 0 ? (
        <div className="space-y-2">
          {qa.map((item, i) => (
            <div key={i}>
              <p className="text-xs font-semibold text-black/60">{item.question}</p>
              <p className="text-sm text-black/80 whitespace-pre-wrap">{item.answer || "—"}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-black/80 whitespace-pre-wrap line-clamp-4">{ref.content}</p>
      )}

      {ref.gratitude && (
        <p className="mt-2 text-xs text-black/50 italic">💛 Grateful for: {ref.gratitude}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guided flow: one question at a time -> wellness -> gratitude -> save
// ---------------------------------------------------------------------------
function GuidedFlow({
  pod,
  alreadyLogged,
  onCancel,
  onSaved,
}: {
  pod: Pod;
  alreadyLogged: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  // steps: 0..N-1 questions, N = wellness+gratitude
  const total = pod.questions.length + 1;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => pod.questions.map(() => ""));
  const [mood, setMood] = useState(6);
  const [energy, setEnergy] = useState(6);
  const [gratitude, setGratitude] = useState("");
  const [saving, setSaving] = useState(false);

  const isWellness = step === pod.questions.length;
  const currentAnswer = answers[step] ?? "";

  const setAnswer = (v: string) =>
    setAnswers((prev) => prev.map((a, i) => (i === step ? v : a)));

  const next = () => setStep((s) => Math.min(s + 1, total - 1));
  const back = () => (step === 0 ? onCancel() : setStep((s) => s - 1));

  const save = async () => {
    setSaving(true);
    const qa: QA[] = pod.questions.map((q, i) => ({ question: q, answer: answers[i].trim() }));
    const content = qa.map((x) => `${x.question}\n${x.answer}`).join("\n\n");
    try {
      const res = await fetch("/api/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: pod.type,
          content,
          mood,
          energy,
          gratitude: gratitude.trim() || undefined,
          podId: pod.id,
          questions: JSON.stringify(qa),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to save");
      }
      toast.success("Reflection saved 🌱");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save reflection");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-2xl flex flex-col min-h-[70vh] pt-6 md:pt-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={back}
          className="inline-flex items-center gap-1.5 text-black/50 text-sm font-medium hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {step === 0 ? "Exit" : "Back"}
        </button>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-black/60">
          <span>{pod.emoji}</span> {pod.title}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className="h-2 rounded-full transition-all"
            style={{
              width: i === step ? 28 : 8,
              background: i <= step ? MARIGOLD : "rgba(0,0,0,0.12)",
            }}
          />
        ))}
      </div>

      {alreadyLogged && (
        <p className="mt-4 text-xs text-center text-amber-800 bg-amber-100 border border-amber-200 rounded-xl px-3 py-2">
          You already reflected in this pod's period. Saving will not overwrite it — edit the existing one from the list instead.
        </p>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col justify-center py-8">
        {!isWellness ? (
          <div key={step} className="animate-fade-in">
            <p className="text-sm font-semibold text-black/40 mb-2">
              Question {step + 1} of {pod.questions.length}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold leading-snug" style={MARKER}>
              {pod.questions[step]}
            </h2>
            <textarea
              autoFocus
              value={currentAnswer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Take your time…"
              className="mt-5 w-full min-h-[160px] rounded-3xl bg-white border border-black/10 p-4 text-black placeholder:text-black/30 focus:outline-none focus:ring-2 resize-none"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
            />
          </div>
        ) : (
          <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold leading-snug" style={MARKER}>
              How are you feeling?
            </h2>
            <WellnessSlider label="Energy" value={energy} onChange={setEnergy} lowLabel="Drained" highLabel="Energized" />
            <WellnessSlider label="Mood" value={mood} onChange={setMood} lowLabel="Low" highLabel="Great" />
            <div>
              <label className="text-sm font-semibold text-black/70">One thing you're grateful for 💛</label>
              <input
                value={gratitude}
                onChange={(e) => setGratitude(e.target.value)}
                placeholder="Something small counts…"
                className="mt-2 w-full rounded-2xl bg-white border border-black/10 px-4 py-3 text-black placeholder:text-black/30 focus:outline-none focus:ring-2"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer action */}
      <div className="pb-10">
        {!isWellness ? (
          <button
            onClick={next}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full text-black font-semibold shadow-md hover:brightness-105 transition-all disabled:opacity-40"
            style={{ background: MARIGOLD, ...MARKER }}
          >
            {step === pod.questions.length - 1 ? "Almost there" : "Next"}
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={save}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full text-black font-semibold shadow-md hover:brightness-105 transition-all disabled:opacity-50"
            style={{ background: GRASS, ...MARKER }}
          >
            {saving ? "Saving…" : "Finish reflection"}
            <Check className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function WellnessSlider({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-semibold text-black/70">{label}</label>
        <span className="text-sm font-bold" style={{ color: GRASS }}>
          {value}/10
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 cursor-pointer"
        style={{ accentColor: MARIGOLD }}
      />
      <div className="flex justify-between text-[10px] text-black/40 mt-0.5">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Done screen
// ---------------------------------------------------------------------------
function DoneScreen({ pod, onHome }: { pod: Pod; onHome: () => void }) {
  return (
    <div className="w-full max-w-lg flex flex-col items-center justify-center min-h-[70vh] text-center animate-fade-in">
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-6 shadow-md"
        style={{ background: `linear-gradient(135deg, ${MARIGOLD}, ${GRASS})` }}
      >
        {pod.emoji}
      </div>
      <h1 className="text-3xl md:text-4xl font-bold" style={MARKER}>
        You did it!
      </h1>
      <p className="mt-3 text-black/60 max-w-sm">
        You walked away with a thing or two ;) One reflection at a time, you&apos;re growing.
      </p>

      <div className="flex items-end justify-center gap-6 mt-8 pointer-events-none">
        {[0, 0.5, 1].map((d, i) => (
          <HeartFlower key={i} delay={d} className="w-9 h-18" />
        ))}
      </div>

      <button
        onClick={onHome}
        className="mt-8 inline-flex items-center gap-2 px-7 py-3 rounded-full text-black font-semibold shadow-md hover:brightness-105 hover:-translate-y-0.5 transition-all"
        style={{ background: GRASS, ...MARKER }}
      >
        Back to reflections
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit dialog (simple textarea edit of an existing reflection)
// ---------------------------------------------------------------------------
function EditDialog({
  reflection,
  onClose,
  onSaved,
}: {
  reflection: Reflection;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qa = parseQA(reflection.questions);
  const [answers, setAnswers] = useState<string[]>(
    qa.length > 0 ? qa.map((x) => x.answer) : [reflection.content]
  );
  const [gratitude, setGratitude] = useState(reflection.gratitude || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    let content: string;
    let questions: string | undefined;
    if (qa.length > 0) {
      const merged: QA[] = qa.map((x, i) => ({ question: x.question, answer: answers[i]?.trim() ?? "" }));
      content = merged.map((x) => `${x.question}\n${x.answer}`).join("\n\n");
      questions = JSON.stringify(merged);
    } else {
      content = answers[0]?.trim() ?? "";
    }
    try {
      const res = await fetch("/api/reflections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reflection.id, content, gratitude, questions }),
      });
      if (!res.ok) throw new Error();
      toast.success("Reflection updated");
      onSaved();
    } catch {
      toast.error("Failed to update reflection");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
        style={{ color: "#1a1a1a" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold" style={MARKER}>
          Edit reflection
        </h2>
        <div className="mt-4 space-y-4">
          {qa.length > 0 ? (
            qa.map((item, i) => (
              <div key={i}>
                <label className="text-xs font-semibold text-black/60">{item.question}</label>
                <textarea
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))}
                  className="mt-1 w-full min-h-[80px] rounded-2xl bg-[#FFFAF5] border border-black/10 p-3 text-sm focus:outline-none focus:ring-2 resize-none"
                />
              </div>
            ))
          ) : (
            <textarea
              value={answers[0] ?? ""}
              onChange={(e) => setAnswers([e.target.value])}
              className="w-full min-h-[140px] rounded-2xl bg-[#FFFAF5] border border-black/10 p-3 text-sm focus:outline-none focus:ring-2 resize-none"
            />
          )}
          <div>
            <label className="text-xs font-semibold text-black/60">Grateful for</label>
            <input
              value={gratitude}
              onChange={(e) => setGratitude(e.target.value)}
              className="mt-1 w-full rounded-2xl bg-[#FFFAF5] border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-medium text-black/60 hover:bg-black/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-full text-sm font-semibold text-black shadow-md hover:brightness-105 transition-all disabled:opacity-50"
            style={{ background: GRASS }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
