"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startOfWeek, endOfWeek } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  BookOpen,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import confetti from "canvas-confetti";
import { PODS, pickQuestions, type Pod } from "@/lib/pods";
import { INSPIRE_STORIES, type InspireStory } from "@/lib/inspireStories";
import { RainbowArc, HeartFlower } from "@/components/reflections/PeaceDecor";
import { Stagger, StaggerItem, Bounce, Pop } from "@/components/home/motion-kit";
import { useIntroReflect, playIntroReflect } from "@/components/reflections/intro-reflect";
import { useGSAP } from "@/lib/gsap";

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
type Tab = "reflect" | "inspire";

// Is a date within the current period for a given reflection type?
function inCurrentPeriod(type: string, d: Date, now: Date): boolean {
  if (type === "weekly") {
    const ws = startOfWeek(now, { weekStartsOn: 0 });
    const we = endOfWeek(now, { weekStartsOn: 0 });
    return d >= ws && d <= we;
  }
  if (type === "monthly") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  return d.toDateString() === now.toDateString(); // daily
}

// Which pods already have a reflection logged for their current period.
function usedPodIds(reflections: Reflection[]): Set<string> {
  const now = new Date();
  const used = new Set<string>();
  for (const ref of reflections) {
    if (!ref.podId) continue;
    if (inCurrentPeriod(ref.type, new Date(ref.date), now)) used.add(ref.podId);
  }
  return used;
}

export default function ReflectionsPage() {
  const router = useRouter();
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [tab, setTab] = useState<Tab>("reflect");
  const [activePod, setActivePod] = useState<Pod | null>(null);
  // One-time cinematic entrance: true only on first load this browser session
  // (and never under reduced motion). Marked seen on mount, so tab switches /
  // returning from the flow never replay it. Presentation only.
  const intro = useIntroReflect("reflections");

  const fetchReflections = async () => {
    try {
      const res = await fetch("/api/reflections");
      if (res.ok) setReflections(await res.json());
    } catch {
      toast.error("Failed to load reflections");
    }
  };

  useEffect(() => {
    fetchReflections();
  }, []);

  const usedPods = useMemo(() => usedPodIds(reflections), [reflections]);

  const startPod = (pod: Pod) => {
    // Rotate through the pod's wider question bank based on how many times it's
    // been done, so repeat reflections get a fresh trio (reused once cycled).
    const priorCount = reflections.filter((r) => r.podId === pod.id).length;
    setActivePod({ ...pod, questions: pickQuestions(pod, priorCount) });
    setScreen("flow");
  };

  const onSaved = () => {
    // Redirect to the dedicated confirmation page after a successful save.
    router.push("/reflections/saved");
  };

  return (
    <div
      className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 flex flex-col items-center overflow-x-hidden relative z-20"
      style={{ background: CREAM, color: "#1a1a1a" }}
    >
      {screen === "welcome" && (
        <div className="w-full max-w-4xl flex flex-col items-center">
          {/* Tab switcher + history link */}
          <div className="mt-2 mb-2 flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-white border border-black/5 p-1 shadow-sm">
              <TabButton active={tab === "reflect"} onClick={() => setTab("reflect")} icon={<BookOpen className="w-4 h-4" />}>
                Reflect
              </TabButton>
              <TabButton active={tab === "inspire"} onClick={() => setTab("inspire")} icon={<Sparkles className="w-4 h-4" />}>
                Get inspired
              </TabButton>
            </div>
            <Link
              href="/reflections/history"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full bg-white border border-black/5 shadow-sm text-sm font-semibold text-black/60 hover:text-black hover:-translate-y-0.5 transition-all"
              style={MARKER}
            >
              <BookOpen className="w-4 h-4" /> My reflections
            </Link>
          </div>

          {tab === "reflect" ? (
            <WelcomeScreen
              usedPods={usedPods}
              onStartPod={startPod}
              intro={intro && tab === "reflect"}
            />
          ) : (
            <GetInspired />
          )}
        </div>
      )}

      {screen === "flow" && activePod && (
        <GuidedFlow
          pod={activePod}
          alreadyLogged={usedPods.has(activePod.id)}
          onCancel={() => setScreen("welcome")}
          onSaved={onSaved}
        />
      )}

      {screen === "done" && activePod && (
        <DoneScreen pod={activePod} onHome={() => setScreen("welcome")} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome screen: hero + pod picker + history
// ---------------------------------------------------------------------------
function WelcomeScreen({
  usedPods,
  onStartPod,
  intro = false,
}: {
  usedPods: Set<string>;
  onStartPod: (pod: Pod) => void;
  intro?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);

  // Signature entrance — plays once per session (gated upstream by `intro`).
  // Presentation only; auto-reverts via useGSAP scope. When `intro` is false
  // (repeat visit / reduced motion) this no-ops and the screen renders normally
  // with the existing framer Stagger reveal — no layout shift.
  useGSAP(
    () => {
      if (!intro || !root.current) return;
      playIntroReflect(root.current);
    },
    { scope: root, dependencies: [intro] }
  );

  return (
    <div ref={root} className="w-full flex flex-col items-center">
      {/* Hero */}
      <div className={`text-center pt-4 md:pt-8 ${intro ? "" : "animate-fade-in"}`}>
        <p className="ir-eyebrow text-lg text-black/60" style={MARKER}>
          hi! welcome to
        </p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mt-1" style={MARKER}>
          {"the daily reflection".split(" ").map((word, i) => (
            <span key={i} className="ir-title-word inline-block">
              {word}
              {i < 2 ? " " : ""}
            </span>
          ))}
        </h1>
        <p className="ir-sub mt-4 text-black/60 max-w-md mx-auto">
          Start with three gentle questions. A moment to pause, notice, and grow.
        </p>
        <button
          onClick={() => onStartPod(PODS[0])}
          className="ir-cta mt-6 inline-flex items-center gap-2 px-7 py-3 rounded-full text-black font-semibold shadow-md hover:brightness-105 hover:-translate-y-0.5 active:translate-y-0 transition-all"
          style={{ background: GRASS, ...MARKER }}
        >
          Begin here <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Rainbow divider */}
      <div className="ir-arc relative w-[130%] h-20 md:h-28 mt-8 mb-2 pointer-events-none">
        <RainbowArc className="absolute inset-0 w-full h-full" />
      </div>

      {/* Pod picker */}
      <section className="w-full mt-4">
        <h2 className="ir-podhead text-2xl md:text-3xl font-bold text-center" style={MARKER}>
          Which area would you like to explore?
        </h2>
        <p className="ir-podhead text-center text-black/50 text-sm mt-1">
          Our pods help you untangle your feelings.
        </p>

        {/* During the one-time entrance, GSAP owns the card reveal, so render a
            plain always-mounted grid (framer Stagger holds children hidden
            until scrolled into view, which would fight the timeline). On repeat
            visits / reduced motion, the normal Stagger reveal is used. */}
        <PodGridWrap intro={intro} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {PODS.map((pod) => {
            const done = usedPods.has(pod.id);
            return (
              <PodItemWrap key={pod.id} intro={intro}>
                <Bounce lift={-6} scale={1.02} className="h-full">
                  <button
                    onClick={() => onStartPod(pod)}
                    className="ir-card group text-left rounded-3xl bg-white border border-black/5 p-5 shadow-sm hover:shadow-md transition-shadow w-full h-full"
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
                </Bounce>
              </PodItemWrap>
            );
          })}
        </PodGridWrap>
      </section>

      {/* Flower row — past reflections live under "My reflections" (history page) */}
      <div className="flex items-end justify-center gap-6 md:gap-10 mt-10 mb-8 opacity-90 pointer-events-none">
        {[0, 0.4, 0.8, 1.2, 1.6].map((d, i) => (
          <HeartFlower key={i} delay={d} className="w-8 h-16 md:w-10 md:h-20" />
        ))}
      </div>
    </div>
  );
}

// Pod grid container: plain div during the one-time entrance (GSAP drives the
// reveal), framer Stagger otherwise (scroll-in reveal on repeat/reduced visits).
function PodGridWrap({
  intro,
  className,
  children,
}: {
  intro: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (intro) return <div className={className}>{children}</div>;
  return (
    <Stagger className={className} gap={0.07} amount={0.1}>
      {children}
    </Stagger>
  );
}

function PodItemWrap({ intro, children }: { intro: boolean; children: React.ReactNode }) {
  if (intro) return <div>{children}</div>;
  return <StaggerItem>{children}</StaggerItem>;
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
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [answers, setAnswers] = useState<string[]>(() => pod.questions.map(() => ""));
  const [mood, setMood] = useState(6);
  const [energy, setEnergy] = useState(6);
  const [gratitude, setGratitude] = useState("");
  const [saving, setSaving] = useState(false);

  const isWellness = step === pod.questions.length;
  const currentAnswer = answers[step] ?? "";

  const setAnswer = (v: string) =>
    setAnswers((prev) => prev.map((a, i) => (i === step ? v : a)));

  const next = () => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, total - 1));
  };
  const back = () => {
    if (step === 0) return onCancel();
    setDirection(-1);
    setStep((s) => s - 1);
  };

  // Slide + fade variants that honor the current navigation direction.
  const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: reduce ? 0 : dir * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: reduce ? 0 : dir * -40 }),
  };

  const save = async () => {
    // Every question needs a real answer (the Next button enforces this, but
    // guard here too so an empty reflection can never be submitted).
    if (answers.some((a) => !a.trim())) {
      toast.error("Please answer every question before finishing.");
      return;
    }
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
          // Let the server compute the one-per-period window in OUR timezone.
          tzOffset: new Date().getTimezoneOffset(),
        }),
      });
      if (res.ok) {
        toast.success("Reflection saved 🌱");
        onSaved();
        return;
      }
      const err = await res.json().catch(() => null);
      // Duplicate for this period: the entry already exists, so send the user
      // back to their reflections rather than stranding them on this screen.
      if (res.status === 409) {
        toast.info(err?.error || "You already reflected in this pod for this period.");
        onCancel();
        return;
      }
      toast.error(err?.error || "Failed to save reflection");
    } catch {
      toast.error("Failed to save reflection. Check your connection and try again.");
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
        {Array.from({ length: total }).map((_, i) => {
          const filled = i <= step;
          return (
            <motion.span
              key={i}
              className="h-2 rounded-full block"
              animate={{
                width: i === step ? 28 : 8,
                backgroundColor: filled ? MARIGOLD : "rgba(0,0,0,0.12)",
                // 3-keyframe "pop" — springs only support 2 keyframes, so give
                // scale its own tween while width/color stay springy.
                scale: reduce ? 1 : filled && i === step ? [1, 1.25, 1] : 1,
              }}
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      width: { type: "spring", stiffness: 320, damping: 22 },
                      backgroundColor: { type: "spring", stiffness: 320, damping: 22 },
                      scale: { duration: 0.4, ease: "easeOut" },
                    }
              }
            />
          );
        })}
      </div>

      {alreadyLogged && (
        <p className="mt-4 text-xs text-center text-amber-800 bg-amber-100 border border-amber-200 rounded-xl px-3 py-2">
          You already reflected in this pod&apos;s period. Saving will not overwrite it — edit the existing one from the list instead.
        </p>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col justify-center py-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 28 }}
          >
            {!isWellness ? (
              <div>
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
              <div className="space-y-6">
                <h2 className="text-2xl md:text-3xl font-bold leading-snug" style={MARKER}>
                  How are you feeling?
                </h2>
                <WellnessSlider label="Energy" value={energy} onChange={setEnergy} lowLabel="Drained" highLabel="Energized" />
                <WellnessSlider label="Mood" value={mood} onChange={setMood} lowLabel="Low" highLabel="Great" />
                <div>
                  <label className="text-sm font-semibold text-black/70">One thing you&apos;re grateful for 💛</label>
                  <input
                    value={gratitude}
                    onChange={(e) => setGratitude(e.target.value)}
                    placeholder="Something small counts…"
                    className="mt-2 w-full rounded-2xl bg-white border border-black/10 px-4 py-3 text-black placeholder:text-black/30 focus:outline-none focus:ring-2"
                  />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer action */}
      <div className="pb-10">
        {!isWellness ? (
          <>
            <button
              onClick={next}
              disabled={!currentAnswer.trim()}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full text-black font-semibold shadow-md hover:brightness-105 transition-all disabled:opacity-40 disabled:hover:brightness-100"
              style={{ background: MARIGOLD, ...MARKER }}
            >
              {step === pod.questions.length - 1 ? "Almost there" : "Next"}
              <ArrowRight className="w-5 h-5" />
            </button>
            {!currentAnswer.trim() && (
              <p className="mt-2 text-center text-xs text-black/40">
                Write a little something to continue — even one sentence counts.
              </p>
            )}
          </>
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
  const reduce = useReducedMotion();

  // Gentle warm confetti burst on mount (skipped when reduced-motion).
  useEffect(() => {
    if (reduce) return;
    const colors = [MARIGOLD, GRASS, "#FF6B4A"];
    // A soft two-sided burst that fades quickly — celebratory, not chaotic.
    const shoot = (originX: number, angle: number) =>
      confetti({
        particleCount: 45,
        angle,
        spread: 65,
        startVelocity: 42,
        gravity: 0.9,
        scalar: 0.9,
        ticks: 160,
        origin: { x: originX, y: 0.55 },
        colors,
      });
    shoot(0.2, 65);
    shoot(0.8, 115);
    const t = setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 90,
        startVelocity: 30,
        gravity: 0.85,
        scalar: 0.85,
        ticks: 150,
        origin: { x: 0.5, y: 0.5 },
        colors,
      });
    }, 220);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <div className="w-full max-w-lg flex flex-col items-center justify-center min-h-[70vh] text-center animate-fade-in">
      <Pop>
        <motion.div
          className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-6 shadow-md"
          style={{ background: `linear-gradient(135deg, ${MARIGOLD}, ${GRASS})` }}
          animate={reduce ? undefined : { rotate: [0, -6, 6, -3, 0] }}
          transition={reduce ? undefined : { delay: 0.35, duration: 0.7, ease: "easeInOut" }}
        >
          {pod.emoji}
        </motion.div>
      </Pop>
      <Pop delay={0.12}>
        <h1 className="text-3xl md:text-4xl font-bold" style={MARKER}>
          You did it!
        </h1>
      </Pop>
      <motion.p
        className="mt-3 text-black/60 max-w-sm"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={reduce ? {} : { opacity: 1, y: 0 }}
        transition={reduce ? undefined : { delay: 0.3, type: "spring", stiffness: 160, damping: 18 }}
      >
        You walked away with a thing or two ;) One reflection at a time, you&apos;re growing.
      </motion.p>

      <div className="flex items-end justify-center gap-6 mt-8 pointer-events-none">
        {[0, 0.5, 1].map((d, i) => (
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.6 }}
            animate={reduce ? {} : { opacity: 1, y: 0, scale: 1 }}
            transition={
              reduce
                ? undefined
                : { delay: 0.45 + i * 0.12, type: "spring", stiffness: 240, damping: 14 }
            }
          >
            <HeartFlower delay={d} className="w-9 h-18" />
          </motion.div>
        ))}
      </div>

      <Bounce className="mt-8 inline-block">
        <button
          onClick={onHome}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-black font-semibold shadow-md hover:brightness-105 transition-all"
          style={{ background: GRASS, ...MARKER }}
        >
          <ArrowLeft className="w-5 h-5" /> Back to reflections
        </button>
      </Bounce>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab switcher button
// ---------------------------------------------------------------------------
function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all"
      style={
        active
          ? { background: MARIGOLD, color: "#1a1a1a", ...MARKER }
          : { background: "transparent", color: "rgba(0,0,0,0.5)", ...MARKER }
      }
    >
      {icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Get Inspired: a collection of short reflective reads
// ---------------------------------------------------------------------------
function GetInspired() {
  const [openStory, setOpenStory] = useState<InspireStory | null>(null);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Hero over a soft dreamy gradient */}
      <div
        className="w-full rounded-3xl px-6 py-10 text-center animate-fade-in"
        style={{ background: "linear-gradient(135deg, #ffe3f1 0%, #e5e0ff 45%, #d6f0ff 100%)" }}
      >
        <h1 className="text-3xl md:text-5xl font-bold" style={MARKER}>
          Welcome here!
        </h1>
        <p className="mt-3 text-black/60 max-w-md mx-auto">
          We&apos;ve gathered some stories for you. We hope these snippets of writing inspire you
          in one way or another :)
        </p>
      </div>

      {/* Story grid */}
      <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 w-full mb-8" gap={0.07} amount={0.1}>
        {INSPIRE_STORIES.map((story) => (
          <StaggerItem key={story.id} className="h-full">
          <Bounce lift={-6} scale={1.02} className="h-full">
          <button
            onClick={() => setOpenStory(story)}
            className="group text-left rounded-3xl bg-white border border-black/5 p-5 shadow-sm hover:shadow-md transition-shadow w-full h-full"
          >
            <div className="flex items-start gap-4">
              <div
                className={`shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${story.accent} flex items-center justify-center text-2xl`}
              >
                {story.emoji}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold leading-snug" style={MARKER}>
                  {story.title}
                </h3>
                <p className="text-sm text-black/50 mt-1 leading-relaxed">{story.teaser}</p>
                {story.tw && (
                  <p className="mt-2 text-[11px] italic text-amber-800/80">
                    Content note: {story.tw}
                  </p>
                )}
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-black/70 group-hover:gap-2 transition-all">
                  Click here to read <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </button>
          </Bounce>
          </StaggerItem>
        ))}
      </Stagger>

      <AnimatePresence>
        {openStory && <StoryReader story={openStory} onClose={() => setOpenStory(null)} />}
      </AnimatePresence>
    </div>
  );
}

function StoryReader({ story, onClose }: { story: InspireStory; onClose: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.2 }}
    >
      <motion.div
        className="w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-3xl bg-white p-6 md:p-8 shadow-xl"
        style={{ color: "#1a1a1a" }}
        onClick={(e) => e.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${story.accent} flex items-center justify-center text-xl`}
            >
              {story.emoji}
            </div>
            <h2 className="text-2xl font-bold leading-snug" style={MARKER}>
              {story.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-full text-black/40 hover:bg-black/5 hover:text-black transition-colors"
            aria-label="Close story"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {story.tw && (
          <p className="mt-3 text-xs italic text-amber-800 bg-amber-100 border border-amber-200 rounded-xl px-3 py-2">
            Content note: this piece includes {story.tw}. Read with care 💛
          </p>
        )}

        <div className="mt-4 space-y-3">
          {story.body.map((para, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-black/80">
              {para}
            </p>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-black font-semibold shadow-md hover:brightness-105 transition-all"
          style={{ background: GRASS, ...MARKER }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to stories
        </button>
      </motion.div>
    </motion.div>
  );
}
