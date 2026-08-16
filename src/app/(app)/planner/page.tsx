"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Hand,
  Pen,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  CalendarDays,
  Home,
  Library,
  NotebookPen,
} from "lucide-react";
import { toast } from "sonner";
import {
  hotspotsForPage,
  pageLabel,
  todayPage,
  monthlyPage,
  SECTION_PAGES,
  PLANNER_YEAR,
} from "@/lib/planner";
import {
  type PlannerInfo,
  type PlannerManifest,
  imageSrc,
  fetchPlannerIndex,
  fetchPlannerManifest,
  getSelectedPlannerId,
  setSelectedPlannerId,
} from "@/lib/planners";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

// ---- ink model ---------------------------------------------------------------
// Stroke points are normalised to the page (0..1 in both axes) so ink stays put
// at any screen size. Pressure is kept per-point for pen-width variation.
type Tool = "hand" | "pen" | "highlighter" | "eraser";

interface Stroke {
  tool: "pen" | "highlighter";
  color: string;
  size: number; // base width as a fraction of page width
  points: [number, number, number][]; // x, y, pressure
}

const PEN_COLORS = ["#1a1a1a", "#e03131", "#1971c2", "#2f9e44", "#f08c00", "#9c36b5"];
const PEN_SIZES = [0.0012, 0.0022, 0.004]; // fine / medium / bold (fraction of page width)
const HIGHLIGHT_ALPHA = 0.35;

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, W: number, H: number) {
  if (s.points.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = s.color;
  ctx.globalAlpha = s.tool === "highlighter" ? HIGHLIGHT_ALPHA : 1;
  const base = s.size * W * (s.tool === "highlighter" ? 6 : 1);

  if (s.points.length === 1) {
    const [x, y, p] = s.points[0];
    ctx.beginPath();
    ctx.arc(x * W, y * H, Math.max(0.5, (base * (0.4 + p)) / 2), 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  // Variable-width polyline: draw segment-by-segment with midpoint smoothing.
  for (let i = 1; i < s.points.length; i++) {
    const [x0, y0, p0] = s.points[i - 1];
    const [x1, y1, p1] = s.points[i];
    ctx.beginPath();
    ctx.lineWidth = Math.max(0.6, base * (0.4 + (p0 + p1) / 2));
    const mx = ((x0 + x1) / 2) * W;
    const my = ((y0 + y1) / 2) * H;
    ctx.moveTo(x0 * W, y0 * H);
    ctx.quadraticCurveTo(x0 * W, y0 * H, mx, my);
    ctx.lineTo(x1 * W, y1 * H);
    ctx.stroke();
  }
  ctx.restore();
}

export default function PlannerPage() {
  return (
    <Suspense fallback={null}>
      <PlannerRoot />
    </Suspense>
  );
}

function PlannerRoot() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPlanner = searchParams.get("planner");
  const showLibrary = searchParams.get("library") === "1";

  const [planners, setPlanners] = useState<PlannerInfo[] | null>(null);
  const [active, setActive] = useState<PlannerManifest | null>(null);

  useEffect(() => {
    (async () => {
      const list = await fetchPlannerIndex();
      setPlanners(list);
    })();
  }, []);

  // Resolve which planner to open: URL param → stored choice → the only one.
  useEffect(() => {
    if (!planners || showLibrary) {
      setActive(null);
      return;
    }
    const wanted = urlPlanner || getSelectedPlannerId() || (planners.length === 1 ? planners[0].id : null);
    const info = planners.find((p) => p.id === wanted);
    if (!info) {
      setActive(null);
      return;
    }
    let cancelled = false;
    fetchPlannerManifest(info).then((m) => {
      if (!cancelled) setActive(m);
    });
    return () => { cancelled = true; };
  }, [planners, urlPlanner, showLibrary]);

  if (!planners) {
    return (
      <div className="min-h-screen -m-4 md:-m-8 flex items-center justify-center relative z-20" style={{ background: "#F2E8DC" }}>
        <div className="w-8 h-8 rounded-full border-2 border-[#FFE39A] border-t-[#FFB400] animate-spin" />
      </div>
    );
  }

  const openPlanner = (id: string) => {
    setSelectedPlannerId(id);
    router.replace(`/planner?planner=${id}`, { scroll: false });
  };

  if (showLibrary || !active) {
    // Still resolving the manifest for a known selection? Avoid a picker flash.
    const pending = !showLibrary && (urlPlanner || getSelectedPlannerId() || (planners.length === 1 ? planners[0].id : null));
    if (pending && planners.some((p) => p.id === pending)) {
      return (
        <div className="min-h-screen -m-4 md:-m-8 flex items-center justify-center relative z-20" style={{ background: "#F2E8DC" }}>
          <div className="w-8 h-8 rounded-full border-2 border-[#FFE39A] border-t-[#FFB400] animate-spin" />
        </div>
      );
    }
    return <PlannerLibrary planners={planners} onOpen={openPlanner} />;
  }

  return <PlannerViewer key={active.id} planner={active} onLibrary={() => router.replace("/planner?library=1", { scroll: false })} />;
}

// ---- library (planner picker) --------------------------------------------------
function PlannerLibrary({ planners, onOpen }: { planners: PlannerInfo[]; onOpen: (id: string) => void }) {
  return (
    <div className="min-h-screen -m-4 md:-m-8 p-6 md:p-10 relative z-20" style={{ background: "#F2E8DC" }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <NotebookPen className="w-7 h-7 text-[#c98a00]" />
          <h1 className="text-3xl font-bold text-black" style={MARKER}>Your planners</h1>
        </div>
        <p className="text-black/50 text-sm mb-8">Pick a notebook — each one keeps its own handwriting.</p>

        {planners.length === 0 ? (
          <div className="rounded-3xl bg-white border border-black/5 p-10 text-center text-black/50">
            No planners installed yet. Add one with <code className="text-xs bg-black/5 rounded px-1.5 py-0.5">node scripts/add-planner.mjs &lt;pdf&gt; &lt;id&gt; &quot;Name&quot;</code>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {planners.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="group text-left rounded-3xl bg-white border border-black/5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all overflow-hidden"
              >
                <div className="relative w-full bg-black/[0.03]" style={{ aspectRatio: `${p.aspect}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageSrc(p, 1)} alt={p.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="p-4">
                  <h2 className="font-bold text-black" style={MARKER}>{p.name}</h2>
                  {p.description && <p className="text-xs text-black/50 mt-1 leading-relaxed">{p.description}</p>}
                  <p className="text-[11px] text-black/35 mt-2">{p.pages} pages</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- viewer --------------------------------------------------------------------
function PlannerViewer({ planner, onLibrary }: { planner: PlannerManifest; onLibrary: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCollanote = planner.template === "collanote-2026";

  const initialPage = (() => {
    const p = parseInt(searchParams.get("page") || "", 10);
    if (p >= 1 && p <= planner.pages) return p;
    if (isCollanote) {
      const now = new Date();
      return now.getFullYear() === PLANNER_YEAR ? monthlyPage(now.getMonth() + 1) : SECTION_PAGES.cover;
    }
    return 1;
  })();
  const debug = searchParams.get("debug") === "1";

  const [page, setPage] = useState(initialPage);
  const [tool, setTool] = useState<Tool>("hand");
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [size, setSize] = useState(PEN_SIZES[1]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [, forceRender] = useState(0);

  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const liveRef = useRef<Stroke | null>(null);
  const undoRef = useRef<Stroke[][]>([]);
  const redoRef = useRef<Stroke[][]>([]);
  const cacheRef = useRef<Map<number, Stroke[]>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawingPointer = useRef<number | null>(null);
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;

  const hotspots = useMemo(() => {
    if (isCollanote) return hotspotsForPage(page);
    return planner.links?.[String(page)] ?? [];
  }, [isCollanote, planner.links, page]);

  const label = isCollanote ? pageLabel(page) : `Page ${page}`;

  // ---- rendering ----
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const rect = box.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const s of strokesRef.current) drawStroke(ctx, s, rect.width, rect.height);
    if (liveRef.current) drawStroke(ctx, liveRef.current, rect.width, rect.height);
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(box);
    return () => ro.disconnect();
  }, [redraw]);

  // ---- persistence ----
  const scheduleSave = useCallback((forPage: number) => {
    setSaveState("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await fetch("/api/planner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planner: planner.id, page: forPage, strokes: JSON.stringify(cacheRef.current.get(forPage) ?? []) }),
        });
        if (!res.ok) throw new Error();
        setSaveState("saved");
      } catch {
        setSaveState("unsaved");
        toast.error("Couldn't save your ink — it will retry on your next stroke.");
      }
    }, 1200);
  }, [planner.id]);

  const commit = useCallback((next: Stroke[]) => {
    undoRef.current.push(strokesRef.current);
    if (undoRef.current.length > 50) undoRef.current.shift();
    redoRef.current = [];
    strokesRef.current = next;
    cacheRef.current.set(page, next);
    scheduleSave(page);
    redraw();
    forceRender((n) => n + 1);
  }, [page, redraw, scheduleSave]);

  // Load ink whenever the page changes (memory cache first).
  useEffect(() => {
    let cancelled = false;
    undoRef.current = [];
    redoRef.current = [];
    liveRef.current = null;
    const cached = cacheRef.current.get(page);
    if (cached) {
      strokesRef.current = cached;
      redraw();
      return;
    }
    strokesRef.current = [];
    redraw();
    (async () => {
      try {
        const res = await fetch(`/api/planner?planner=${planner.id}&page=${page}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const parsed: Stroke[] = JSON.parse(data.strokes || "[]");
        cacheRef.current.set(page, parsed);
        strokesRef.current = parsed;
        redraw();
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [page, planner.id, redraw]);

  // Keep the URL shareable + preload neighbouring pages for snappy flips.
  useEffect(() => {
    router.replace(`/planner?planner=${planner.id}&page=${page}`, { scroll: false });
    for (const p of [page - 1, page + 1]) {
      if (p >= 1 && p <= planner.pages) {
        const img = new Image();
        img.src = imageSrc(planner, p);
      }
    }
  }, [page, planner, router]);

  const go = useCallback((p: number) => {
    if (p < 1 || p > planner.pages) return;
    // Flush any pending save for the page we're leaving.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const leaving = page;
      const strokes = JSON.stringify(cacheRef.current.get(leaving) ?? []);
      fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planner: planner.id, page: leaving, strokes }),
      }).then(() => setSaveState("saved")).catch(() => {});
    }
    setPage(p);
  }, [page, planner.id, planner.pages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") go(page - 1);
      if (e.key === "ArrowRight") go(page + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, go]);

  // ---- pointer handling ----
  // GoodNotes-style input routing: Apple Pencil (pointerType "pen") always
  // draws; fingers always navigate (tap hotspots / swipe pages); the mouse
  // follows the selected tool.
  const norm = (e: React.PointerEvent): [number, number] => {
    const rect = boxRef.current!.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  const shouldDraw = (e: React.PointerEvent) =>
    e.pointerType === "pen" || (e.pointerType === "mouse" && toolRef.current !== "hand");

  const eraseAt = useCallback((x: number, y: number) => {
    const R = 0.012; // eraser radius as a fraction of page width
    const before = strokesRef.current;
    const after = before.filter((s) => !s.points.some(([px, py]) => {
      const dx = px - x, dy = (py - y) / planner.aspect;
      return dx * dx + dy * dy < R * R;
    }));
    if (after.length !== before.length) commit(after);
  }, [commit, planner.aspect]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      return;
    }
    if (!shouldDraw(e)) {
      tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      return;
    }
    e.preventDefault();
    const activeTool = e.pointerType === "pen" && toolRef.current === "hand" ? "pen" : toolRef.current;
    const [x, y] = norm(e);
    if (activeTool === "eraser") {
      drawingPointer.current = e.pointerId;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      eraseAt(x, y);
      return;
    }
    drawingPointer.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    liveRef.current = {
      tool: activeTool === "highlighter" ? "highlighter" : "pen",
      color,
      size,
      points: [[x, y, e.pressure || 0.5]],
    };
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (drawingPointer.current !== e.pointerId) return;
    e.preventDefault();
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent as PointerEvent];
    const rect = boxRef.current!.getBoundingClientRect();
    if (liveRef.current) {
      for (const ev of events) {
        liveRef.current.points.push([
          (ev.clientX - rect.left) / rect.width,
          (ev.clientY - rect.top) / rect.height,
          ev.pressure || 0.5,
        ]);
      }
      redraw();
    } else {
      // eraser drag
      const [x, y] = norm(e);
      eraseAt(x, y);
    }
  };

  const endStroke = (e: React.PointerEvent) => {
    if (drawingPointer.current === e.pointerId) {
      drawingPointer.current = null;
      if (liveRef.current) {
        const s = liveRef.current;
        liveRef.current = null;
        commit([...strokesRef.current, s]);
      }
      return;
    }
    // Tap navigation (finger, or mouse in hand mode).
    const start = tapStart.current;
    tapStart.current = null;
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (moved > 12 || Date.now() - start.t > 600) return;
    const [x, y] = norm(e);
    const hit = hotspots.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
    if (hit) go(hit.page);
  };

  const undo = () => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(strokesRef.current);
    strokesRef.current = prev;
    cacheRef.current.set(page, prev);
    scheduleSave(page);
    redraw();
    forceRender((n) => n + 1);
  };
  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(strokesRef.current);
    strokesRef.current = next;
    cacheRef.current.set(page, next);
    scheduleSave(page);
    redraw();
    forceRender((n) => n + 1);
  };

  const ToolButton = ({ t, icon, title }: { t: Tool; icon: React.ReactNode; title: string }) => (
    <button
      onClick={() => setTool(t)}
      title={title}
      className={`p-2 rounded-xl transition-colors ${tool === t ? "bg-[#FFB400] text-black shadow-sm" : "text-black/50 hover:bg-black/5"}`}
    >
      {icon}
    </button>
  );

  return (
    <div className="min-h-screen -m-4 md:-m-8 flex flex-col relative z-20" style={{ background: "#F2E8DC" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 flex-wrap bg-white/80 backdrop-blur border-b border-black/5 sticky top-0 z-30">
        <button onClick={onLibrary} className="p-2 rounded-xl text-black/50 hover:bg-black/5" title="All planners">
          <Library className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold mr-1 text-black" style={MARKER}>{planner.name}</span>
        <span className="text-xs text-black/45 mr-2 hidden sm:inline">{label}</span>

        <div className="flex items-center gap-0.5 rounded-2xl bg-black/[0.04] p-0.5">
          <ToolButton t="hand" icon={<Hand className="w-4 h-4" />} title="Navigate (tap tabs & days)" />
          <ToolButton t="pen" icon={<Pen className="w-4 h-4" />} title="Pen" />
          <ToolButton t="highlighter" icon={<Highlighter className="w-4 h-4" />} title="Highlighter" />
          <ToolButton t="eraser" icon={<Eraser className="w-4 h-4" />} title="Eraser (removes whole strokes)" />
        </div>

        <div className="flex items-center gap-1 ml-1">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); if (tool === "hand" || tool === "eraser") setTool("pen"); }}
              className={`w-5 h-5 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-1 ring-black/40 scale-110" : "hover:scale-110"}`}
              style={{ background: c }}
              title="Pen colour"
            />
          ))}
        </div>

        <div className="flex items-center gap-0.5 ml-1">
          {PEN_SIZES.map((s, i) => (
            <button
              key={s}
              onClick={() => { setSize(s); if (tool === "hand" || tool === "eraser") setTool("pen"); }}
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${size === s ? "bg-black/10" : "hover:bg-black/5"}`}
              title={["Fine", "Medium", "Bold"][i]}
            >
              <span className="rounded-full bg-black/70" style={{ width: 3 + i * 3, height: 3 + i * 3 }} />
            </button>
          ))}
        </div>

        <div className="flex items-center ml-1">
          <button onClick={undo} disabled={undoRef.current.length === 0} className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30" title="Undo">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={redoRef.current.length === 0} className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30" title="Redo">
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1" />

        <span className={`text-[10px] mr-2 ${saveState === "saved" ? "text-black/30" : "text-[#c98a00]"}`}>
          {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Unsaved"}
        </span>
        <button onClick={() => go(1)} className="p-2 rounded-xl text-black/50 hover:bg-black/5" title="Cover">
          <Home className="w-4 h-4" />
        </button>
        {isCollanote && (
          <button
            onClick={() => go(todayPage())}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#7FB800] text-black hover:brightness-105 transition-all"
            style={MARKER}
            title="Jump to today's daily page"
          >
            <CalendarDays className="w-3.5 h-3.5" /> Today
          </button>
        )}
        <div className="flex items-center ml-1">
          <button onClick={() => go(page - 1)} disabled={page <= 1} className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30" title="Previous page">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-black/40 tabular-nums w-16 text-center">{page} / {planner.pages}</span>
          <button onClick={() => go(page + 1)} disabled={page >= planner.pages} className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30" title="Next page">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Page */}
      <div className="flex-1 flex items-center justify-center p-2 md:p-4 overflow-hidden">
        <div
          ref={boxRef}
          className="relative w-full max-h-full shadow-xl rounded-lg overflow-hidden select-none"
          style={{ aspectRatio: `${planner.aspect}`, maxWidth: `min(100%, calc((100vh - 120px) * ${planner.aspect}))`, touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc(planner, page)}
            alt={label}
            className="absolute inset-0 w-full h-full pointer-events-none"
            draggable={false}
          />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ cursor: tool === "hand" ? "pointer" : "crosshair" }} />
          {debug && hotspots.map((h, i) => (
            <div
              key={i}
              className="absolute border border-red-500/60 bg-red-500/10 pointer-events-none"
              style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` }}
              title={h.label}
            />
          ))}
        </div>
      </div>

      <p className="text-center text-[11px] text-black/35 pb-2 px-4">
        Tap the month tabs or a day with your finger to jump around · write with your Apple Pencil anywhere · mouse draws when a pen tool is selected
      </p>
    </div>
  );
}
