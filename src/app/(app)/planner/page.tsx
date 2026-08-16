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
  GraduationCap,
  Sparkles,
  BookOpen,
  LayoutGrid,
  Layers,
  FilePlus2,
  Star,
  Type,
  Copy,
  Trash2,
  Pencil,
  CloudOff,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import type { Hotspot, Rect } from "@/lib/planner";
import { PLANNER_TEMPLATES, templateOpeningPage } from "@/lib/planner-templates";
import {
  type PlannerInfo,
  type PlannerManifest,
  DEFAULT_CATEGORY,
  imageSrc,
  isPdfBacked,
  fetchPlannerIndex,
  fetchPlannerManifest,
  getSelectedPlannerId,
  setSelectedPlannerId,
  groupByCategory,
  deriveFurniture,
} from "@/lib/planners";
import {
  type PageElement,
  type Stroke,
  type TextBox,
  PLANNER_FONTS,
  TEXT_SIZES,
  clearLocal,
  fontStack,
  isText,
  isStroke,
  parseElements,
  pendingLocalPages,
  pushPage,
  readLocal,
  retryDelay,
  saveErrorMessage,
  serializeElements,
  simplifyStroke,
  writeLocal,
} from "@/lib/planner-ink";
import {
  type UserPlanner,
  PdfRenderer,
  USER_CATEGORY,
  deleteUserPlanner,
  duplicatePlanner,
  importPdf,
  listUserPlanners,
  renameUserPlanner,
} from "@/lib/planner-library";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

// ---- page content ------------------------------------------------------------
// Strokes and text boxes are normalised to the page (0..1 in both axes) so
// content stays put at any screen size. See src/lib/planner-ink.ts.
type Tool = "hand" | "pen" | "highlighter" | "eraser" | "text";

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

const inside = (h: Hotspot | Rect, x: number, y: number) =>
  x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h;

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

  // The library is the shipped planners plus whatever this device has imported
  // or duplicated. User notebooks come first so they're the first thing seen.
  const reload = useCallback(async () => {
    const [builtIn, mine] = await Promise.all([fetchPlannerIndex(), listUserPlanners()]);
    setPlanners([...mine, ...builtIn]);
  }, []);

  useEffect(() => { reload(); }, [reload]);

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
    return <PlannerLibrary planners={planners} onOpen={openPlanner} onChanged={reload} />;
  }

  return <PlannerViewer key={active.id} planner={active} onLibrary={() => router.replace("/planner?library=1", { scroll: false })} />;
}

// ---- library (planner picker) --------------------------------------------------
// Shelf layout: a segmented category filter over full-bleed rows of covers, one
// row per category with a coloured spine marking the section.
const CATEGORY_STYLE: Record<string, { accent: string; icon: typeof CalendarDays }> = {
  [USER_CATEGORY]: { accent: "#8A6DE9", icon: FilePlus2 },
  "365-Day Planners": { accent: "#E8705F", icon: CalendarDays },
  "Study Planners": { accent: "#F2A93B", icon: GraduationCap },
  "Minimal Planners": { accent: "#4EA8A0", icon: Sparkles },
  "Journals & Notebooks": { accent: "#7FB800", icon: BookOpen },
  [DEFAULT_CATEGORY]: { accent: "#D46A9F", icon: NotebookPen },
};

const styleFor = (category: string) => CATEGORY_STYLE[category] ?? CATEGORY_STYLE[DEFAULT_CATEGORY];

function PlannerLibrary({ planners, onOpen, onChanged }: {
  planners: PlannerInfo[]; onOpen: (id: string) => void; onChanged: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => setSelectedId(getSelectedPlannerId()), []);

  const sections = useMemo(() => groupByCategory(planners), [planners]);
  const shown = filter ? sections.filter((s) => s.category === filter) : sections;

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      toast.error("Please choose a PDF file.");
      return;
    }
    setImporting(true);
    const id = toast.loading(`Importing “${file.name}”…`);
    try {
      const meta = await importPdf(file, (stage, done, total) => {
        if (stage === "links" && total > 1) {
          toast.loading(`Reading “${file.name}” — page ${done} of ${total}…`, { id });
        }
      });
      await onChanged();
      toast.success(`Added “${meta.name}” — ${meta.pages} pages`, {
        id,
        description: "Stored on this device. Your handwriting still syncs to your account.",
      });
      setSelectedPlannerId(meta.id);
      onOpen(meta.id);
    } catch (e: any) {
      toast.error("Couldn't import that PDF", { id, description: e?.message?.slice(0, 140) });
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onDuplicate = async (p: PlannerInfo) => {
    const t = toast.loading("Making a copy…");
    try {
      const meta = await duplicatePlanner(p);
      await onChanged();
      toast.success(`Created “${meta.name}”`, { id: t, description: "A blank copy — write freely." });
    } catch (e: any) {
      toast.error("Couldn't duplicate", { id: t, description: e?.message });
    }
  };

  const onDelete = async (p: PlannerInfo) => {
    if (!confirm(`Delete “${p.name}” from this device? Its handwriting stays in your account.`)) return;
    await deleteUserPlanner(p.id);
    if (getSelectedPlannerId() === p.id) setSelectedPlannerId(null);
    await onChanged();
    toast.success("Deleted from this device");
  };

  const onRename = async (p: PlannerInfo) => {
    const name = prompt("Rename notebook", p.name)?.trim();
    if (!name || name === p.name) return;
    await renameUserPlanner(p.id, name.slice(0, 80));
    await onChanged();
  };

  return (
    <div className="min-h-screen -m-4 md:-m-8 pb-28 relative z-20" style={{ background: "#F2E8DC" }}>
      {/* Header + segmented category filter */}
      <div className="sticky top-0 z-30 px-4 md:px-8 pt-5 pb-3" style={{ background: "linear-gradient(#F2E8DC 70%, rgba(242,232,220,0.85))", backdropFilter: "blur(8px)" }}>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2.5">
              <NotebookPen className="w-6 h-6 text-[#c98a00]" />
              <h1 className="text-2xl md:text-3xl font-bold text-black" style={MARKER}>Your planners</h1>
            </div>
            <p className="text-black/45 text-[13px] mt-1">Pick a notebook — each one keeps its own handwriting.</p>
          </div>
          <span className="text-[11px] text-black/35 shrink-0 pb-1">{planners.length} installed</span>
        </div>

        {sections.length > 1 && (
          <div className="flex items-center gap-1 p-1 rounded-full bg-white/70 border border-black/5 w-fit max-w-full overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <SegmentButton active={filter === null} onClick={() => setFilter(null)} icon={<LayoutGrid className="w-4 h-4" />} label="All" accent="#c98a00" />
            {sections.map((s) => {
              const { accent, icon: Icon } = styleFor(s.category);
              return (
                <SegmentButton
                  key={s.category}
                  active={filter === s.category}
                  onClick={() => setFilter(s.category)}
                  icon={<Icon className="w-4 h-4" />}
                  label={s.category.replace(/ Planners$/, "")}
                  accent={accent}
                />
              );
            })}
          </div>
        )}
      </div>

      {planners.length === 0 ? (
        <div className="px-4 md:px-8">
          <button
            onClick={() => fileInput.current?.click()}
            className="w-full rounded-3xl bg-white border-2 border-dashed border-black/10 p-10 text-center text-black/50 hover:border-[#8A6DE9]/50 hover:text-black/70 transition-colors"
          >
            <FilePlus2 className="w-8 h-8 mx-auto mb-3 text-[#8A6DE9]" />
            <span className="font-semibold" style={MARKER}>Import a PDF planner</span>
            <p className="text-[12px] mt-1">Any PDF becomes a notebook you can write in — tabs and links stay tappable.</p>
          </button>
        </div>
      ) : (
        <div className="space-y-7 pt-2">
          {shown.map((section) => {
            const { accent } = styleFor(section.category);
            return (
              <section key={section.category}>
                <div className="flex items-center gap-2.5 px-4 md:px-8 mb-3">
                  <span className="w-1.5 h-6 rounded-full" style={{ background: accent }} />
                  <h2 className="text-lg md:text-xl font-bold text-black/80" style={MARKER}>{section.category}</h2>
                </div>
                <div
                  className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 md:px-8 pb-3"
                  style={{ scrollbarWidth: "none" }}
                >
                  {section.planners.map((p) => (
                    <PlannerCard
                      key={p.id}
                      planner={p}
                      accent={accent}
                      current={p.id === selectedId}
                      onOpen={() => onOpen(p.id)}
                      onDuplicate={() => onDuplicate(p)}
                      onDelete={"kind" in p ? () => onDelete(p) : undefined}
                      onRename={"kind" in p ? () => onRename(p) : undefined}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Floating dock */}
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => onImport(e.target.files?.[0])}
      />
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-2 py-2 rounded-full bg-white/85 backdrop-blur border border-black/5 shadow-lg">
        <button
          onClick={() => fileInput.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-semibold text-black/70 hover:bg-black/5 transition-colors disabled:opacity-50"
          style={MARKER}
        >
          <FilePlus2 className="w-4 h-4 text-[#8A6DE9]" /> {importing ? "Importing…" : "Import PDF"}
        </button>
        <a
          href="/dashboard"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-semibold text-black/70 hover:bg-black/5 transition-colors"
          style={MARKER}
        >
          <Home className="w-4 h-4 text-[#c98a00]" /> Dashboard
        </a>
      </div>
    </div>
  );
}

function SegmentButton({ active, onClick, icon, label, accent }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${
        active ? "text-black shadow-sm" : "text-black/50 hover:bg-black/[0.04]"
      }`}
      style={{ ...MARKER, background: active ? `${accent}33` : undefined }}
    >
      <span style={{ color: active ? accent : undefined }}>{icon}</span>
      {label}
    </button>
  );
}

function PlannerCard({ planner, accent, current, onOpen, onDuplicate, onDelete, onRename }: {
  planner: PlannerInfo; accent: string; current: boolean; onOpen: () => void;
  onDuplicate: () => void; onDelete?: () => void; onRename?: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const owned = "kind" in planner; // a user notebook (import or copy)
  const isImport = (planner as UserPlanner).kind === "import";
  const [cover, setCover] = useState<string | null>(null);

  // A duplicate reuses its source's WebP cover; an import has to render page 1.
  useEffect(() => {
    if (!isImport || !planner.pdfKey) return;
    let url: string | null = null;
    const renderer = new PdfRenderer(planner.pdfKey, 480);
    renderer.page(1).then((u) => { url = u; setCover(u); }).catch(() => {});
    return () => { renderer.destroy(); if (url) setCover(null); };
  }, [isImport, planner.pdfKey]);

  const coverSrc = isImport ? cover : imageSrc(planner, 1);

  return (
    <div
      className="group relative snap-start shrink-0 w-[230px] sm:w-[248px] rounded-3xl bg-white border border-black/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all p-3"
    >
      <button onClick={onOpen} title={planner.credit ? `${planner.name} — ${planner.credit}` : planner.name} className="block w-full text-left">
        {/* Cover, contained so tall and wide planners both sit nicely */}
        <div className="relative h-[190px] flex items-center justify-center rounded-2xl bg-black/[0.02] overflow-hidden">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc}
              alt={planner.name}
              className="max-h-full max-w-full object-contain rounded-lg shadow-[0_2px_10px_rgba(0,0,0,0.12)]"
              loading="lazy"
            />
          ) : (
            <div className="w-6 h-6 rounded-full border-2 border-black/10 border-t-[#8A6DE9] animate-spin" />
          )}
          {owned && (
            <span
              className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
              style={{ background: accent }}
            >
              {isImport ? <FilePlus2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {isImport ? "Imported" : "Copy"}
            </span>
          )}
          {/* Page dots, echoing the stack of pages inside */}
          <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === 0 ? accent : "rgba(0,0,0,0.14)" }} />
            ))}
          </div>
        </div>

        <div className="flex items-start gap-1.5 mt-3">
          <h3 className="flex-1 font-bold text-[15px] leading-snug text-black" style={MARKER}>{planner.name}</h3>
          {current && (
            <span title="Currently open" className="shrink-0 mt-0.5">
              <Star className="w-4 h-4 text-[#FFB400] fill-[#FFB400]" />
            </span>
          )}
        </div>
        {planner.description && (
          <p className="text-[11px] text-black/40 mt-1 leading-relaxed line-clamp-2">{planner.description}</p>
        )}

        <div className="flex items-center gap-3 mt-2.5 text-[12px] text-black/45">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />{planner.pages}
          </span>
          {(planner.template || planner.links) && (
            <span className="flex items-center gap-1" title="Tappable tabs, links and day cells">
              <Hand className="w-3.5 h-3.5" />Tabs
            </span>
          )}
          <span className="flex-1" />
          {planner.sizeMb ? <span className="text-black/30">{planner.sizeMb} MB</span> : null}
        </div>
      </button>

      {/* Overflow menu: duplicate everything; rename/delete only your own. */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenu((m) => !m); }}
        onBlur={() => setTimeout(() => setMenu(false), 150)}
        className="absolute top-4 right-4 p-1.5 rounded-full bg-white/90 border border-black/5 text-black/50 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-white transition-opacity shadow-sm"
        title="More"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {menu && (
        <div className="absolute top-12 right-4 z-10 w-40 rounded-xl bg-white border border-black/10 shadow-lg py-1 text-[13px]">
          <MenuItem icon={<Copy className="w-3.5 h-3.5" />} label="Duplicate" onClick={() => { setMenu(false); onDuplicate(); }} />
          {onRename && <MenuItem icon={<Pencil className="w-3.5 h-3.5" />} label="Rename" onClick={() => { setMenu(false); onRename(); }} />}
          {onDelete && <MenuItem icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" danger onClick={() => { setMenu(false); onDelete(); }} />}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-black/[0.04] ${danger ? "text-red-600" : "text-black/70"}`}
    >
      {icon} {label}
    </button>
  );
}

// ---- viewer --------------------------------------------------------------------
function PlannerViewer({ planner, onLibrary }: { planner: PlannerManifest; onLibrary: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const template = planner.template ? PLANNER_TEMPLATES[planner.template] : undefined;
  const pdfBacked = isPdfBacked(planner);

  const initialPage = (() => {
    const p = parseInt(searchParams.get("page") || "", 10);
    if (p >= 1 && p <= planner.pages) return p;
    return planner.template ? templateOpeningPage(planner.template) : 1;
  })();
  const debug = searchParams.get("debug") === "1";

  const [page, setPage] = useState(initialPage);
  const [tool, setTool] = useState<Tool>("hand");
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [size, setSize] = useState(PEN_SIZES[1]);
  const [font, setFont] = useState(PLANNER_FONTS[0].key);
  const [textSize, setTextSize] = useState(TEXT_SIZES[1]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "offline">("saved");
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender((n) => n + 1), []);

  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elementsRef = useRef<PageElement[]>([]);
  const liveRef = useRef<Stroke | null>(null);
  const undoRef = useRef<PageElement[][]>([]);
  const redoRef = useRef<PageElement[][]>([]);
  const cacheRef = useRef<Map<number, PageElement[]>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);
  const lastToastAt = useRef(0);
  const drawingPointer = useRef<number | null>(null);
  const rendererRef = useRef<PdfRenderer | null>(null);
  // A pending tap. `chromeOnly` taps came from a stylus landing on page
  // furniture, so they may only activate tabs — never a writable day cell.
  const tapStart = useRef<{ x: number; y: number; t: number; chromeOnly: boolean } | null>(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;

  // Link-based planners get their tab strips inferred from the link geometry.
  const pageLinks = planner.links?.[String(page)];
  const furniture = useMemo(() => deriveFurniture(pageLinks), [pageLinks]);

  const hotspots = useMemo(() => {
    if (template) return template.hotspots(page);
    return (pageLinks ?? []).map((h) =>
      h.kind ? h : { ...h, kind: furniture.isChrome(h) ? ("chrome" as const) : ("content" as const) });
  }, [template, pageLinks, page, furniture]);
  const hotspotsRef = useRef<Hotspot[]>(hotspots);
  hotspotsRef.current = hotspots;

  // Ink is fenced to the paper: the template's area, or the one inferred above.
  const writeArea = template?.writeArea ?? furniture.writeArea;
  const writeAreaRef = useRef(writeArea);
  writeAreaRef.current = writeArea;

  const label = template ? template.label(page) : `Page ${page}`;

  /** Ink is allowed on paper only: inside the write area and clear of the tabs. */
  const inkAllowed = useCallback((x: number, y: number) => {
    if (!inside(writeAreaRef.current, x, y)) return false;
    return !hotspotsRef.current.some((h) => h.kind === "chrome" && inside(h, x, y));
  }, []);

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
    // Clip strokes to the writable paper so one that strays into the tabs or the
    // outer margin is trimmed rather than painted over the furniture. Text boxes
    // are DOM overlays and clip themselves.
    const wa = writeAreaRef.current;
    ctx.save();
    ctx.beginPath();
    ctx.rect(wa.x * rect.width, wa.y * rect.height, wa.w * rect.width, wa.h * rect.height);
    ctx.clip();
    for (const el of elementsRef.current) if (isStroke(el)) drawStroke(ctx, el, rect.width, rect.height);
    if (liveRef.current) drawStroke(ctx, liveRef.current, rect.width, rect.height);
    ctx.restore();
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const apply = () => {
      const r = box.getBoundingClientRect();
      setBoxSize({ w: r.width, h: r.height });
      redraw();
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(box);
    return () => ro.disconnect();
  }, [redraw]);

  // ---- persistence ----
  // Every edit is mirrored to localStorage *before* the network call and the
  // mirror is cleared only once the server acknowledges. A failed save therefore
  // degrades to "not synced yet" and survives a reload, rather than losing ink.
  const saveNow = useCallback(async (forPage: number) => {
    const json = serializeElements(cacheRef.current.get(forPage) ?? []);
    writeLocal(planner.id, forPage, json);
    if (forPage === page) setSaveState("saving");
    const res = await pushPage(planner.id, forPage, json);
    if (res.ok) {
      clearLocal(planner.id, forPage);
      retryAttempt.current = 0;
      if (forPage === page && !saveTimer.current) setSaveState("saved");
      return true;
    }
    // Left on disk; reflect the failure and back off before retrying.
    if (forPage === page) setSaveState(res.status === 0 ? "offline" : "unsaved");
    const now = Date.now();
    if (now - lastToastAt.current > 8000) {
      lastToastAt.current = now;
      toast.error(saveErrorMessage(res));
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveNow(forPage);
    }, retryDelay(retryAttempt.current++));
    return false;
  }, [planner.id, page]);

  const scheduleSave = useCallback((forPage: number) => {
    setSaveState("unsaved");
    writeLocal(planner.id, forPage, serializeElements(cacheRef.current.get(forPage) ?? []));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveNow(forPage);
    }, 1000);
  }, [planner.id, saveNow]);

  const setElements = useCallback((next: PageElement[], { history = true }: { history?: boolean } = {}) => {
    if (history) {
      undoRef.current.push(elementsRef.current);
      if (undoRef.current.length > 60) undoRef.current.shift();
      redoRef.current = [];
    }
    elementsRef.current = next;
    cacheRef.current.set(page, next);
    scheduleSave(page);
    redraw();
    rerender();
  }, [page, redraw, rerender, scheduleSave]);

  // Recover any pages a previous session couldn't sync.
  useEffect(() => {
    for (const p of pendingLocalPages(planner.id)) {
      const local = readLocal(planner.id, p);
      if (!local) continue;
      pushPage(planner.id, p, local.json).then((r) => { if (r.ok) clearLocal(planner.id, p); });
    }
  }, [planner.id]);

  // Load a page's content when it changes: memory cache → unsynced local mirror
  // → server. A local mirror means an edit never reached the server, so it wins.
  useEffect(() => {
    let cancelled = false;
    undoRef.current = [];
    redoRef.current = [];
    liveRef.current = null;
    setSelectedText(null);

    const cached = cacheRef.current.get(page);
    if (cached) {
      elementsRef.current = cached;
      redraw();
      rerender();
      return;
    }
    const local = readLocal(planner.id, page);
    if (local) {
      const parsed = parseElements(local.json);
      elementsRef.current = parsed;
      cacheRef.current.set(page, parsed);
      redraw();
      rerender();
      setSaveState("unsaved");
      saveNow(page);
      return;
    }
    elementsRef.current = [];
    redraw();
    rerender();
    (async () => {
      try {
        const res = await fetch(`/api/planner?planner=${planner.id}&page=${page}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const parsed = parseElements(data.strokes);
        cacheRef.current.set(page, parsed);
        elementsRef.current = parsed;
        redraw();
        rerender();
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [page, planner.id, redraw, rerender, saveNow]);

  // Render the current page image: a folder WebP, or a PDF page on demand.
  useEffect(() => {
    if (!pdfBacked || !planner.pdfKey) return;
    rendererRef.current ??= new PdfRenderer(planner.pdfKey);
    let alive = true;
    setPdfSrc(null);
    rendererRef.current.page(page).then((url) => { if (alive) setPdfSrc(url); }).catch(() => {});
    return () => { alive = false; };
  }, [page, pdfBacked, planner.pdfKey]);

  useEffect(() => () => { rendererRef.current?.destroy(); rendererRef.current = null; }, []);

  // Flush any pending save if the tab is closed or backgrounded.
  useEffect(() => {
    const flush = () => {
      if (!saveTimer.current) return;
      const json = serializeElements(cacheRef.current.get(page) ?? []);
      writeLocal(planner.id, page, json);
      navigator.sendBeacon?.(
        "/api/planner",
        new Blob([JSON.stringify({ planner: planner.id, page, strokes: json })], { type: "application/json" }),
      );
    };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [page, planner.id]);

  // Keep the URL shareable + preload neighbouring pages for snappy flips.
  useEffect(() => {
    router.replace(`/planner?planner=${planner.id}&page=${page}`, { scroll: false });
    if (pdfBacked) {
      for (const p of [page + 1, page - 1]) if (p >= 1 && p <= planner.pages) rendererRef.current?.page(p).catch(() => {});
    } else {
      for (const p of [page - 1, page + 1]) {
        if (p >= 1 && p <= planner.pages) { const img = new Image(); img.src = imageSrc(planner, p); }
      }
    }
  }, [page, planner, router, pdfBacked]);

  const go = useCallback((p: number) => {
    if (p < 1 || p > planner.pages || p === page) return;
    // Persist the page we're leaving right away, keeping its mirror until acked.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      saveNow(page);
    }
    setPage(p);
  }, [page, planner.pages, saveNow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
      if (e.key === "ArrowLeft") go(page - 1);
      if (e.key === "ArrowRight") go(page + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, go]);

  // ---- text boxes ----
  const updateText = useCallback((id: string, patch: Partial<TextBox>, history = false) => {
    const next = elementsRef.current.map((el) =>
      isText(el) && el.id === id ? { ...el, ...patch } : el,
    );
    setElements(next, { history });
  }, [setElements]);

  const removeText = useCallback((id: string) => {
    setElements(elementsRef.current.filter((el) => !(isText(el) && el.id === id)));
    setSelectedText(null);
  }, [setElements]);

  const addTextAt = useCallback((x: number, y: number) => {
    const id = `t-${Date.now().toString(36)}-${Math.floor(x * 1000)}`;
    const box: TextBox = {
      kind: "text", id, x, y,
      w: Math.min(0.4, writeAreaRef.current.x + writeAreaRef.current.w - x),
      text: "", font, size: textSize, color, align: "left",
    };
    setElements([...elementsRef.current, box]);
    setSelectedText(id);
  }, [color, font, textSize, setElements]);

  // ---- pointer handling ----
  // GoodNotes-style input routing: Apple Pencil (pointerType "pen") draws on
  // paper and taps tabs; fingers always navigate (tap hotspots); the mouse
  // follows the selected tool.
  const norm = (e: React.PointerEvent): [number, number] => {
    const rect = boxRef.current!.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  const shouldDraw = (e: React.PointerEvent) =>
    e.pointerType === "pen" || (e.pointerType === "mouse" && toolRef.current !== "hand");

  const eraseAt = useCallback((x: number, y: number) => {
    const R = 0.012; // eraser radius as a fraction of page width
    const before = elementsRef.current;
    const after = before.filter((el) => {
      if (!isStroke(el)) return true;
      return !el.points.some(([px, py]) => {
        const dx = px - x, dy = (py - y) / planner.aspect;
        return dx * dx + dy * dy < R * R;
      });
    });
    if (after.length !== before.length) setElements(after);
  }, [setElements, planner.aspect]);

  const onPointerDown = (e: React.PointerEvent) => {
    const [x, y] = norm(e);

    // Tapping the paper while a text box is selected just deselects it.
    if (selectedText) { setSelectedText(null); return; }

    // Text tool: a tap on the paper drops a new box; taps elsewhere navigate.
    if (toolRef.current === "text") {
      if (inkAllowed(x, y)) { e.preventDefault(); addTextAt(x, y); }
      else tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now(), chromeOnly: e.pointerType === "pen" };
      return;
    }

    if (e.pointerType === "touch" || !shouldDraw(e)) {
      // Fingers and the hand tool navigate anywhere on the page.
      tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now(), chromeOnly: false };
      return;
    }
    if (!inkAllowed(x, y)) {
      // Landed on a tab or the outer margin: no ink here, but a tab tap counts.
      tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now(), chromeOnly: true };
      return;
    }
    e.preventDefault();
    const activeTool = e.pointerType === "pen" && toolRef.current === "hand" ? "pen" : toolRef.current;
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
      color, size,
      points: [[x, y, e.pressure || 0.5]],
    };
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (drawingPointer.current !== e.pointerId) return;
    e.preventDefault();
    // Coalesced events give the full high-frequency pen path; some inputs and
    // browsers hand back an empty list, so fall back to the event itself.
    const coalesced = (e.nativeEvent as PointerEvent).getCoalescedEvents?.();
    const events = coalesced?.length ? coalesced : [e.nativeEvent as PointerEvent];
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
      const [x, y] = norm(e); // eraser drag
      eraseAt(x, y);
    }
  };

  const endStroke = (e: React.PointerEvent) => {
    if (drawingPointer.current === e.pointerId) {
      drawingPointer.current = null;
      if (liveRef.current) {
        const s = simplifyStroke(liveRef.current);
        liveRef.current = null;
        setElements([...elementsRef.current, s]);
      }
      return;
    }
    // Tap navigation (finger, hand tool, or a stylus tap on a tab).
    const start = tapStart.current;
    tapStart.current = null;
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (moved > 12 || Date.now() - start.t > 600) return;
    const [x, y] = norm(e);
    const hit = hotspots.find((h) => inside(h, x, y) && (!start.chromeOnly || h.kind === "chrome"));
    if (hit) go(hit.page);
  };

  const undo = () => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(elementsRef.current);
    elementsRef.current = prev;
    cacheRef.current.set(page, prev);
    setSelectedText(null);
    scheduleSave(page);
    redraw();
    rerender();
  };
  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(elementsRef.current);
    elementsRef.current = next;
    cacheRef.current.set(page, next);
    setSelectedText(null);
    scheduleSave(page);
    redraw();
    rerender();
  };

  const ToolButton = ({ t, icon, title }: { t: Tool; icon: React.ReactNode; title: string }) => (
    <button
      onClick={() => { setTool(t); setSelectedText(null); }}
      title={title}
      className={`p-2 rounded-xl transition-colors ${tool === t ? "bg-[#FFB400] text-black shadow-sm" : "text-black/50 hover:bg-black/5"}`}
    >
      {icon}
    </button>
  );

  const textBoxes = elementsRef.current.filter(isText);
  const showInkControls = tool === "pen" || tool === "highlighter";

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
          <ToolButton t="text" icon={<Type className="w-4 h-4" />} title="Text box (tap the paper to type)" />
          <ToolButton t="eraser" icon={<Eraser className="w-4 h-4" />} title="Eraser (removes whole strokes)" />
        </div>

        {showInkControls && (
          <>
            <div className="flex items-center gap-1 ml-1">
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
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
                  onClick={() => setSize(s)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${size === s ? "bg-black/10" : "hover:bg-black/5"}`}
                  title={["Fine", "Medium", "Bold"][i]}
                >
                  <span className="rounded-full bg-black/70" style={{ width: 3 + i * 3, height: 3 + i * 3 }} />
                </button>
              ))}
            </div>
          </>
        )}

        {tool === "text" && (
          <div className="flex items-center gap-1 ml-1">
            <select
              value={font}
              onChange={(e) => setFont(e.target.value)}
              className="text-[12px] rounded-lg border border-black/10 bg-white px-2 py-1"
              title="Font"
            >
              {PLANNER_FONTS.map((f) => <option key={f.key} value={f.key} style={{ fontFamily: f.stack }}>{f.name}</option>)}
            </select>
            <div className="flex items-center gap-0.5">
              {TEXT_SIZES.map((s, i) => (
                <button
                  key={s}
                  onClick={() => setTextSize(s)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-black/70 ${textSize === s ? "bg-black/10" : "hover:bg-black/5"}`}
                  title={["Small", "Normal", "Large", "Title"][i]}
                >
                  <span style={{ fontSize: 9 + i * 3 }}>A</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-1 ring-black/40 scale-110" : "hover:scale-110"}`}
                  style={{ background: c }}
                  title="Text colour"
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center ml-1">
          <button onClick={undo} disabled={undoRef.current.length === 0} className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30" title="Undo">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={redoRef.current.length === 0} className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30" title="Redo">
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1" />

        <span className={`flex items-center gap-1 text-[10px] mr-2 ${saveState === "saved" ? "text-black/30" : "text-[#c98a00]"}`} title={saveState === "offline" ? "Saved on this device — will sync when you reconnect" : undefined}>
          {saveState === "offline" && <CloudOff className="w-3 h-3" />}
          {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "offline" ? "Offline" : "Unsaved"}
        </span>
        <button onClick={() => go(1)} className="p-2 rounded-xl text-black/50 hover:bg-black/5" title="Cover">
          <Home className="w-4 h-4" />
        </button>
        {template && (
          <button
            onClick={() => go(template.today(new Date()))}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#7FB800] text-black hover:brightness-105 transition-all"
            style={MARKER}
            title="Jump to today's page"
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
          style={{ aspectRatio: `${planner.aspect}`, maxWidth: `min(100%, calc((100vh - 120px) * ${planner.aspect}))`, touchAction: "none", background: "#fff" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        >
          {(pdfBacked ? pdfSrc : imageSrc(planner, page)) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={(pdfBacked ? pdfSrc : imageSrc(planner, page)) as string}
              alt={label}
              className="absolute inset-0 w-full h-full pointer-events-none"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-black/10 border-t-[#8A6DE9] animate-spin" />
            </div>
          )}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ cursor: tool === "hand" ? "pointer" : tool === "text" ? "text" : "crosshair" }} />

          {/* Typed text boxes sit above the ink so they can be edited and moved. */}
          {textBoxes.map((t) => (
            <TextBoxView
              key={t.id}
              box={t}
              boxSize={boxSize}
              selected={selectedText === t.id}
              editable={tool === "text"}
              onSelect={() => setSelectedText(t.id)}
              onChange={(patch, history) => updateText(t.id, patch, history)}
              onBeginEdit={() => { undoRef.current.push(elementsRef.current); redoRef.current = []; }}
              onRemove={() => removeText(t.id)}
            />
          ))}

          {debug && (
            <>
              <div
                className="absolute border-2 border-blue-500/70 pointer-events-none"
                style={{ left: `${writeArea.x * 100}%`, top: `${writeArea.y * 100}%`, width: `${writeArea.w * 100}%`, height: `${writeArea.h * 100}%` }}
                title="Write area"
              />
              {hotspots.map((h, i) => (
                <div
                  key={i}
                  className={`absolute pointer-events-none ${h.kind === "chrome" ? "border border-amber-500/70 bg-amber-400/20" : "border border-red-500/60 bg-red-500/10"}`}
                  style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` }}
                  title={h.label}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <p className="text-center text-[11px] text-black/35 pb-2 px-4">
        Tap the tabs or a day to jump around · write with your Apple Pencil on the paper · the Text tool drops a box you can type in — tabs and margins stay clear
      </p>
    </div>
  );
}

// ---- text box overlay ----------------------------------------------------------
// A text box lives in normalised page coordinates. It renders as plain positioned
// text; the Text tool turns it into an editable textarea with a drag handle, a
// width handle, and a small format bar. Font size is a fraction of page height so
// it scales with the page.
function TextBoxView({ box, boxSize, selected, editable, onSelect, onChange, onBeginEdit, onRemove }: {
  box: TextBox;
  boxSize: { w: number; h: number };
  selected: boolean;
  editable: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TextBox>, history?: boolean) => void;
  onBeginEdit: () => void;
  onRemove: () => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const widthDrag = useRef<{ px: number; w: number } | null>(null);
  const edited = useRef(false);

  useEffect(() => {
    if (selected && editable) areaRef.current?.focus();
  }, [selected, editable]);

  const fontPx = box.size * boxSize.h;
  const common: React.CSSProperties = {
    fontFamily: fontStack(box.font),
    fontSize: fontPx || 16,
    lineHeight: 1.3,
    color: box.color,
    fontWeight: box.bold ? 700 : 400,
    fontStyle: box.italic ? "italic" : "normal",
    textAlign: box.align,
  };
  const left = `${box.x * 100}%`;
  const top = `${box.y * 100}%`;
  const width = `${box.w * 100}%`;

  const startDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: box.x, y: box.y };
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!drag.current || !boxSize.w) return;
    const nx = drag.current.x + (e.clientX - drag.current.px) / boxSize.w;
    const ny = drag.current.y + (e.clientY - drag.current.py) / boxSize.h;
    onChange({ x: Math.max(0, Math.min(1 - box.w, nx)), y: Math.max(0, Math.min(0.98, ny)) }, false);
  };
  const endDrag = (e: React.PointerEvent) => {
    if (drag.current) { drag.current = null; onChange({}, true); }
    if (widthDrag.current) { widthDrag.current = null; onChange({}, true); }
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };
  const startWidth = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    widthDrag.current = { px: e.clientX, w: box.w };
  };
  const onWidthMove = (e: React.PointerEvent) => {
    if (!widthDrag.current || !boxSize.w) return;
    const nw = widthDrag.current.w + (e.clientX - widthDrag.current.px) / boxSize.w;
    onChange({ w: Math.max(0.08, Math.min(1 - box.x, nw)) }, false);
  };

  if (!selected || !editable) {
    // Static text. Clickable to select when the Text tool is active.
    return (
      <div
        className="absolute whitespace-pre-wrap break-words"
        style={{ left, top, width, ...common, pointerEvents: editable ? "auto" : "none" }}
        onPointerDown={editable ? (e) => { e.stopPropagation(); onSelect(); } : undefined}
      >
        {box.text || (editable ? "" : "")}
      </div>
    );
  }

  return (
    <div className="absolute" style={{ left, top, width }} onPointerDown={(e) => e.stopPropagation()}>
      {/* Format bar */}
      <div className="absolute -top-10 left-0 flex items-center gap-0.5 px-1 py-1 rounded-xl bg-white border border-black/10 shadow-lg z-10 whitespace-nowrap">
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => onChange({ bold: !box.bold }, true)} className={`p-1.5 rounded-lg ${box.bold ? "bg-black/10" : "hover:bg-black/5"}`} title="Bold"><Bold className="w-3.5 h-3.5" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => onChange({ italic: !box.italic }, true)} className={`p-1.5 rounded-lg ${box.italic ? "bg-black/10" : "hover:bg-black/5"}`} title="Italic"><Italic className="w-3.5 h-3.5" /></button>
        <span className="w-px h-4 bg-black/10 mx-0.5" />
        {(["left", "center", "right"] as const).map((a) => {
          const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
          return <button key={a} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange({ align: a }, true)} className={`p-1.5 rounded-lg ${box.align === a ? "bg-black/10" : "hover:bg-black/5"}`} title={`Align ${a}`}><Icon className="w-3.5 h-3.5" /></button>;
        })}
        <span className="w-px h-4 bg-black/10 mx-0.5" />
        <button onMouseDown={(e) => e.preventDefault()} onClick={onRemove} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50" title="Delete text"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>

      {/* Move handle */}
      <div
        className="absolute -left-3 top-0 w-6 h-6 -mt-1 flex items-center justify-center rounded-full bg-[#8A6DE9] text-white shadow cursor-move touch-none z-10"
        onPointerDown={startDrag}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="Drag to move"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </div>

      <textarea
        ref={areaRef}
        value={box.text}
        onChange={(e) => { edited.current = true; onChange({ text: e.target.value }, false); }}
        onFocus={() => { if (!edited.current) onBeginEdit(); }}
        onBlur={() => { if (!box.text.trim()) onRemove(); }}
        rows={1}
        placeholder="Type…"
        className="w-full bg-[#8A6DE9]/[0.06] outline outline-1 outline-[#8A6DE9]/60 rounded-md resize-none overflow-hidden px-1 py-0.5"
        style={{ ...common }}
        onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
      />

      {/* Width handle */}
      <div
        className="absolute top-1/2 -right-2 w-4 h-8 -mt-4 flex items-center justify-center rounded bg-white border border-black/10 shadow cursor-ew-resize touch-none z-10"
        onPointerDown={startWidth}
        onPointerMove={onWidthMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="Drag to resize"
      >
        <span className="w-0.5 h-4 bg-black/30 rounded" />
      </div>
    </div>
  );
}
