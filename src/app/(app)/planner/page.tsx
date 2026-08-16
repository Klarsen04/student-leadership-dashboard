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
  Lock,
  Plus,
  PanelLeft,
  LayoutTemplate,
  Maximize2,
  ZoomIn,
  ZoomOut,
  X,
  Lasso,
  SquareDashed,
  Scissors,
  ClipboardPaste,
  CopyPlus,
  BringToFront,
  SendToBack,
  RotateCw,
  Shapes,
  Stamp,
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
  isPaperBacked,
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
import { SHAPE_LABEL, snapStroke } from "@/lib/planner-shapes";
import {
  type UserPlanner,
  PdfRenderer,
  USER_CATEGORY,
  createBlankNotebook,
  deleteUserPlanner,
  duplicatePlanner,
  importPdf,
  isOwned,
  listUserPlanners,
  renameUserPlanner,
  suggestedCopyName,
} from "@/lib/planner-library";
import {
  type TemplateDefinition,
  DEFAULT_PAPER,
  DEFAULT_TEMPLATE,
  PAPER_SIZES,
  PAPER_TINTS,
  PAPER_TYPES,
  paperSrc,
  templateFor,
} from "@/lib/planner-paper";
import {
  type PageIndex,
  type PageMeta,
  type NewPageSpec,
  MAX_SLOT,
  clearSlot,
  copySlot,
  defaultIndex,
  deletePages,
  duplicatePages,
  fetchSlot,
  insertPages,
  loadPageIndex,
  movePages,
  pageAspect,
  pageGeometry,
  resolveBackground,
  savePageIndex,
  setPageProps,
} from "@/lib/planner-pages";
import {
  capturePage,
  listUserTemplates,
  saveUserTemplate,
  templateImageUrl,
  templateImageUrlNow,
} from "@/lib/planner-user-templates";
import {
  type Bounds,
  type Handle,
  type PageGeom,
  type Region,
  type SelectMode,
  HANDLES,
  HANDLE_CURSOR,
  addCopies,
  angleTo,
  boundsContain,
  clampMove,
  clipboardSize,
  elementBounds,
  elementId,
  getClipboard,
  handleAt,
  pick,
  pickAt,
  recolor,
  remove as removeSelected,
  reorder,
  resizeScale,
  rotate as rotateSelection,
  scale as scaleSelection,
  selectedElements,
  selectionBounds,
  setClipboard,
  snapAngle,
  translate,
} from "@/lib/planner-select";
import {
  type Viewport,
  FIT,
  MAX_ZOOM,
  clampViewport,
  inkPixelRatio,
  isFit,
  moved as viewMoved,
  panBy,
  stepZoom,
  zoomAbout,
} from "@/lib/planner-viewport";
import {
  type SavedElement,
  STAMP_HEIGHT,
  captureElements,
  clampStamp,
  deleteSavedElement,
  listSavedElements,
  renameSavedElement,
  saveElement,
  stampElements,
} from "@/lib/planner-elements";
import { PageSidebar, THUMB_H } from "@/components/planner/PageSidebar";
import { PageSetupDialog } from "@/components/planner/PageSetupDialog";
import { StickerNameDialog, StickerTray } from "@/components/planner/StickerTray";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

// ---- page content ------------------------------------------------------------
// Strokes and text boxes are normalised to the page (0..1 in both axes) so
// content stays put at any screen size. See src/lib/planner-ink.ts.
type Tool = "hand" | "pen" | "highlighter" | "eraser" | "text" | "select" | "shape";

/**
 * One undoable step.
 *
 * `content` is an edit to one page's elements, remembered with the slot it applies
 * to so undo still works after you've turned the page. `pages` is a change to the
 * notebook's arrangement — insert, duplicate, delete, reorder, or a change of
 * paper, colour or page size — remembered as the index either side, which is
 * metadata rather than pixels.
 */
type HistoryOp =
  | { kind: "content"; slot: number; before: PageElement[]; after: PageElement[] }
  | { kind: "pages"; label: string; before: PageIndex; after: PageIndex; page: number; toPage: number };

const PEN_COLORS = ["#1a1a1a", "#e03131", "#1971c2", "#2f9e44", "#f08c00", "#9c36b5"];
const PEN_SIZES = [0.0012, 0.0022, 0.004]; // fine / medium / bold (fraction of page width)
const HIGHLIGHT_ALPHA = 0.35;

// ---- turning pages -----------------------------------------------------------
// A planner runs to hundreds of pages and the interesting ones (the weekly and
// daily spreads behind a month) sit right after the page a tab lands you on, so
// there are three ways to step one page without reaching for the toolbar arrows:
// tap the outer edge of the page, swipe sideways, or scroll.

/** Fraction of the page width, at either side, where a tap turns the page. */
const EDGE_FLIP = 0.07;
/** Sideways travel (px) that makes a drag a flip rather than a tap. */
const SWIPE_FLIP_PX = 55;
/** Accumulated wheel/trackpad travel (px) that turns one page. */
const WHEEL_FLIP_PX = 90;

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

  return (
    <PlannerViewer
      key={active.id}
      planner={active}
      onLibrary={() => router.replace("/planner?library=1", { scroll: false })}
      onOpenPlanner={async (id, page) => {
        // A notebook made from inside the viewer (e.g. "make a copy to write")
        // has to reach the library list before the URL points at it.
        await reload();
        setSelectedPlannerId(id);
        router.replace(`/planner?planner=${id}${page ? `&page=${page}` : ""}`, { scroll: false });
      }}
    />
  );
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
  // One open dialog at a time: duplicate/rename take a name, delete confirms,
  // "new" builds a blank notebook from a paper template.
  const [dialog, setDialog] = useState<
    | { mode: "duplicate"; planner: PlannerInfo; suggested: string }
    | { mode: "rename"; planner: PlannerInfo }
    | { mode: "delete"; planner: PlannerInfo }
    | { mode: "new" }
    | null
  >(null);
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

  // Duplicating asks for a name first, so a copy doesn't arrive as "(copy 4)".
  const askDuplicate = async (p: PlannerInfo) => {
    setDialog({ mode: "duplicate", planner: p, suggested: await suggestedCopyName(p) });
  };

  const doDuplicate = async (p: PlannerInfo, name: string, withInk: boolean) => {
    const t = toast.loading("Making a copy…");
    try {
      const meta = await duplicatePlanner(p, { name, withInk });
      await onChanged();
      toast.success(`Created “${meta.name}”`, {
        id: t,
        description: withInk ? "Your handwriting came with it — edit freely." : "A blank copy — write freely.",
      });
      return meta;
    } catch (e: any) {
      toast.error("Couldn't duplicate", { id: t, description: e?.message });
      return null;
    }
  };

  const doDelete = async (p: PlannerInfo) => {
    await deleteUserPlanner(p.id);
    if (getSelectedPlannerId() === p.id) setSelectedPlannerId(null);
    await onChanged();
    toast.success(`Deleted “${p.name}”`, { description: "Removed from this device." });
  };

  const doRename = async (p: PlannerInfo, name: string) => {
    if (!name || name === p.name) return;
    await renameUserPlanner(p.id, name.slice(0, 80));
    await onChanged();
    toast.success("Renamed");
  };

  const doCreate = async (opts: { name: string; paper: string; aspect: number; pages: number; tint: string }) => {
    const t = toast.loading("Creating notebook…");
    try {
      const meta = await createBlankNotebook(opts);
      await onChanged();
      toast.success(`Created “${meta.name}”`, { id: t, description: `${meta.pages} blank pages — add more any time.` });
      setSelectedPlannerId(meta.id);
      onOpen(meta.id);
    } catch (e: any) {
      toast.error("Couldn't create that notebook", { id: t, description: e?.message });
    }
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
        <div className="px-4 md:px-8 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setDialog({ mode: "new" })}
            className="rounded-3xl bg-white border-2 border-dashed border-black/10 p-10 text-center text-black/50 hover:border-[#7FB800]/60 hover:text-black/70 transition-colors"
          >
            <Plus className="w-8 h-8 mx-auto mb-3 text-[#7FB800]" />
            <span className="font-semibold" style={MARKER}>New blank notebook</span>
            <p className="text-[12px] mt-1">Pick lined, grid, dotted or Cornell paper and start writing.</p>
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            className="rounded-3xl bg-white border-2 border-dashed border-black/10 p-10 text-center text-black/50 hover:border-[#8A6DE9]/50 hover:text-black/70 transition-colors"
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
                      onDuplicate={() => askDuplicate(p)}
                      onDelete={isOwned(p) ? () => setDialog({ mode: "delete", planner: p }) : undefined}
                      onRename={isOwned(p) ? () => setDialog({ mode: "rename", planner: p }) : undefined}
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
      {/* Clears the app's mobile bottom nav, which is 4rem tall and sits above this. */}
      <div className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-2 py-2 rounded-full bg-white/85 backdrop-blur border border-black/5 shadow-lg">
        <button
          onClick={() => setDialog({ mode: "new" })}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-semibold text-black/70 hover:bg-black/5 transition-colors"
          style={MARKER}
        >
          <Plus className="w-4 h-4 text-[#7FB800]" /> New notebook
        </button>
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

      {dialog?.mode === "new" && (
        <NewNotebookDialog onClose={() => setDialog(null)} onCreate={async (o) => { setDialog(null); await doCreate(o); }} />
      )}
      {dialog?.mode === "duplicate" && (
        <DuplicateDialog
          planner={dialog.planner}
          suggested={dialog.suggested}
          onClose={() => setDialog(null)}
          onConfirm={async (name, withInk) => { setDialog(null); await doDuplicate(dialog.planner, name, withInk); }}
        />
      )}
      {dialog?.mode === "rename" && (
        <NameDialog
          title="Rename notebook"
          confirmLabel="Save"
          initial={dialog.planner.name}
          onClose={() => setDialog(null)}
          onConfirm={async (name) => { setDialog(null); await doRename(dialog.planner, name); }}
        />
      )}
      {dialog?.mode === "delete" && (
        <ConfirmDialog
          title={`Delete “${dialog.planner.name}”?`}
          // An import can be brought back — the ink is filed under the planner id
          // and re-importing the same PDF finds it again. A copy or a blank
          // notebook can't: its id disappears with it, so say so plainly.
          body={
            (dialog.planner as UserPlanner).kind === "import"
              ? "This removes the notebook from this device. Your handwriting stays in your account, so re-importing the same PDF brings it back."
              : "This removes the notebook and everything written in it. That can't be undone."
          }
          confirmLabel="Delete"
          danger
          onClose={() => setDialog(null)}
          onConfirm={async () => { setDialog(null); await doDelete(dialog.planner); }}
        />
      )}
    </div>
  );
}

// ---- dialogs -------------------------------------------------------------------
// Native prompt()/confirm() are blocked or ugly on iPad — where this app is
// mostly used — so naming and confirming happen in real dialogs.

function DialogShell({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-sm"} max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-black leading-tight" style={MARKER}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-black/40 hover:bg-black/5 shrink-0" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogButtons({ onClose, onConfirm, confirmLabel, danger, disabled }: {
  onClose: () => void; onConfirm: () => void; confirmLabel: string; danger?: boolean; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 mt-5">
      <button onClick={onClose} className="px-4 py-2 rounded-full text-[13px] font-semibold text-black/60 hover:bg-black/5" style={MARKER}>
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={disabled}
        className="px-4 py-2 rounded-full text-[13px] font-semibold text-black disabled:opacity-40 hover:brightness-105 transition-all"
        style={{ ...MARKER, background: danger ? "#ef4444" : "#FFB400", color: danger ? "#fff" : "#000" }}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function NameDialog({ title, initial, confirmLabel, onClose, onConfirm }: {
  title: string; initial: string; confirmLabel: string; onClose: () => void; onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const submit = () => { const n = name.trim(); if (n) onConfirm(n); };
  return (
    <DialogShell title={title} onClose={onClose}>
      <input
        autoFocus
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[14px] text-black outline-none focus:border-[#FFB400]"
        placeholder="Notebook name"
      />
      <DialogButtons onClose={onClose} onConfirm={submit} confirmLabel={confirmLabel} disabled={!name.trim()} />
    </DialogShell>
  );
}

function ConfirmDialog({ title, body, confirmLabel, danger, onClose, onConfirm }: {
  title: string; body: string; confirmLabel: string; danger?: boolean; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <DialogShell title={title} onClose={onClose}>
      <p className="text-[13px] text-black/55 leading-relaxed">{body}</p>
      <DialogButtons onClose={onClose} onConfirm={onConfirm} confirmLabel={confirmLabel} danger={danger} />
    </DialogShell>
  );
}

/** Duplicate: name the copy, and choose whether the handwriting comes along. */
function DuplicateDialog({ planner, suggested, onClose, onConfirm }: {
  planner: PlannerInfo; suggested: string; onClose: () => void; onConfirm: (name: string, withInk: boolean) => void;
}) {
  const [name, setName] = useState(suggested);
  const [withInk, setWithInk] = useState(true);
  const submit = () => { const n = name.trim(); if (n) onConfirm(n, withInk); };
  return (
    <DialogShell title={`Duplicate “${planner.name}”`} onClose={onClose}>
      <label className="block text-[12px] font-semibold text-black/50 mb-1.5" style={MARKER}>Name</label>
      <input
        autoFocus
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[14px] text-black outline-none focus:border-[#FFB400]"
      />
      <div className="mt-3 space-y-2">
        <RadioRow
          checked={withInk}
          onSelect={() => setWithInk(true)}
          title="Copy my handwriting too"
          hint="Everything already written in it comes across."
        />
        <RadioRow
          checked={!withInk}
          onSelect={() => setWithInk(false)}
          title="Start blank"
          hint="Same pages, nothing written on them."
        />
      </div>
      <DialogButtons onClose={onClose} onConfirm={submit} confirmLabel="Duplicate" disabled={!name.trim()} />
    </DialogShell>
  );
}

function RadioRow({ checked, onSelect, title, hint }: {
  checked: boolean; onSelect: () => void; title: string; hint: string;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex items-start gap-2.5 w-full text-left p-2.5 rounded-xl border transition-colors ${
        checked ? "border-[#FFB400] bg-[#FFB400]/[0.08]" : "border-black/10 hover:bg-black/[0.02]"
      }`}
    >
      <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${checked ? "border-[#c98a00]" : "border-black/25"}`}>
        {checked && <span className="block w-2 h-2 m-[3px] rounded-full bg-[#c98a00]" />}
      </span>
      <span>
        <span className="block text-[13px] font-semibold text-black/80">{title}</span>
        <span className="block text-[11.5px] text-black/45">{hint}</span>
      </span>
    </button>
  );
}

/** New blank notebook: paper template, page shape, tint and how many pages. */
function NewNotebookDialog({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (o: { name: string; paper: string; aspect: number; pages: number; tint: string }) => void;
}) {
  const [name, setName] = useState("New notebook");
  const [paper, setPaper] = useState(DEFAULT_PAPER);
  const [size, setSize] = useState(PAPER_SIZES[0]);
  const [tint, setTint] = useState(PAPER_TINTS[0].value);
  const [pages, setPages] = useState(20);

  const submit = () => {
    const n = name.trim();
    if (n) onCreate({ name: n, paper, aspect: size.aspect, pages, tint });
  };

  return (
    <DialogShell title="New notebook" onClose={onClose} wide>
      <label className="block text-[12px] font-semibold text-black/50 mb-1.5" style={MARKER}>Name</label>
      <input
        autoFocus
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[14px] text-black outline-none focus:border-[#FFB400]"
      />

      <label className="block text-[12px] font-semibold text-black/50 mt-4 mb-1.5" style={MARKER}>Paper</label>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {PAPER_TYPES.map((p) => (
          <button
            key={p.key}
            onClick={() => setPaper(p.key)}
            title={p.hint}
            className={`rounded-xl border-2 p-1.5 transition-colors ${paper === p.key ? "border-[#FFB400]" : "border-black/[0.07] hover:border-black/20"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={paperSrc(p.key, 0.72, tint)}
              alt={p.name}
              className="w-full rounded-md border border-black/[0.06]"
              style={{ aspectRatio: "0.72", objectFit: "cover" }}
            />
            <span className="block text-[11px] font-semibold text-black/65 mt-1 truncate">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-[12px] font-semibold text-black/50 mb-1.5" style={MARKER}>Page shape</label>
          <div className="flex flex-wrap gap-1.5">
            {PAPER_SIZES.map((s) => (
              <button
                key={s.key}
                onClick={() => setSize(s)}
                className={`px-2.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                  size.key === s.key ? "bg-[#FFB400]/25 text-black" : "text-black/50 hover:bg-black/5"
                }`}
                style={MARKER}
              >
                {s.name}
              </button>
            ))}
          </div>

          <label className="block text-[12px] font-semibold text-black/50 mt-3 mb-1.5" style={MARKER}>Paper colour</label>
          <div className="flex items-center gap-2">
            {PAPER_TINTS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTint(t.value)}
                title={t.name}
                className={`w-7 h-7 rounded-full border transition-transform ${
                  tint === t.value ? "ring-2 ring-offset-1 ring-[#c98a00] scale-110" : "border-black/15 hover:scale-105"
                }`}
                style={{ background: t.value }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-black/50 mb-1.5" style={MARKER}>Pages</label>
          <div className="flex flex-wrap gap-1.5">
            {[1, 20, 60, 120].map((n) => (
              <button
                key={n}
                onClick={() => setPages(n)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                  pages === n ? "bg-[#FFB400]/25 text-black" : "text-black/50 hover:bg-black/5"
                }`}
                style={MARKER}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[11.5px] text-black/40 mt-2 leading-relaxed">
            You can add more pages from inside the notebook at any time.
          </p>
        </div>
      </div>

      <DialogButtons onClose={onClose} onConfirm={submit} confirmLabel="Create" disabled={!name.trim()} />
    </DialogShell>
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
  const owned = isOwned(planner); // an import, a copy, or a blank notebook
  const kind = (planner as UserPlanner).kind;
  const pdfCover = Boolean(planner.pdfKey);
  const [cover, setCover] = useState<string | null>(null);

  // A duplicate reuses its source's WebP cover; a PDF has to render page 1.
  useEffect(() => {
    if (!pdfCover || !planner.pdfKey) return;
    let url: string | null = null;
    const renderer = new PdfRenderer(planner.pdfKey, 480);
    renderer.page(1).then((u) => { url = u; setCover(u); }).catch(() => {});
    return () => { renderer.destroy(); if (url) setCover(null); };
  }, [pdfCover, planner.pdfKey]);

  const coverSrc = isPaperBacked(planner)
    ? paperSrc(planner.paper, planner.aspect, planner.tint)
    : pdfCover
      ? cover
      : imageSrc(planner, 1);
  const badge = kind === "import" ? "Imported" : kind === "copy" ? "Copy" : kind === "blank" ? "Notebook" : null;
  const BadgeIcon = kind === "import" ? FilePlus2 : kind === "copy" ? Copy : NotebookPen;

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
          {owned && badge ? (
            <span
              className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
              style={{ background: accent }}
            >
              <BadgeIcon className="w-3 h-3" />
              {badge}
            </span>
          ) : (
            // Shipped planners are shared by everyone, so they're read-only —
            // the card says so before you open it and find the pen disabled.
            <span
              className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/55 text-white"
              title="Built-in planner — duplicate it to write in it"
            >
              <Lock className="w-3 h-3" /> Built-in
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
        <div className="absolute top-12 right-4 z-10 w-48 rounded-xl bg-white border border-black/10 shadow-lg py-1 text-[13px]">
          <MenuItem
            icon={<Copy className="w-3.5 h-3.5" />}
            label={owned ? "Duplicate" : "Make an editable copy"}
            onClick={() => { setMenu(false); onDuplicate(); }}
          />
          {onRename && <MenuItem icon={<Pencil className="w-3.5 h-3.5" />} label="Rename" onClick={() => { setMenu(false); onRename(); }} />}
          {onDelete && <MenuItem icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" danger onClick={() => { setMenu(false); onDelete(); }} />}
          {!owned && (
            <p className="px-3 pt-1.5 pb-1 text-[11px] text-black/40 leading-snug border-t border-black/5 mt-1">
              Built-in planners can&apos;t be edited or deleted.
            </p>
          )}
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
function PlannerViewer({ planner, onLibrary, onOpenPlanner }: {
  planner: PlannerManifest;
  onLibrary: () => void;
  onOpenPlanner: (id: string, page?: number) => Promise<void>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plannerId = planner.id;
  const template = planner.template ? PLANNER_TEMPLATES[planner.template] : undefined;
  const pdfBacked = isPdfBacked(planner);
  const paperBacked = isPaperBacked(planner);
  // Shipped planners are shared by every user, so they're read-only: you take a
  // copy to write in one. Anything already written in one still shows, so ink
  // from before this rule isn't hidden — it just can't be changed here.
  const readOnly = !isOwned(planner);
  // Any notebook you own can grow now, whatever its pages are made of: a new page
  // is a sheet of template paper, so you can add one to an imported PDF too.
  const canEditPages = !readOnly;

  const initialPage = (() => {
    const p = parseInt(searchParams.get("page") || "", 10);
    if (p >= 1 && p <= planner.pages) return p;
    return planner.template ? templateOpeningPage(planner.template) : 1;
  })();
  const debug = searchParams.get("debug") === "1";

  const [page, setPage] = useState(initialPage);
  // The page index: which pages this notebook has, in what order, and what each
  // one is made of. It starts as the plain "page N = source page N" arrangement so
  // the first frame renders without waiting on IndexedDB, then the saved
  // arrangement (if the user has rearranged anything) replaces it.
  const [index, setIndex] = useState<PageIndex>(() => defaultIndex(planner));
  const [sidebar, setSidebar] = useState(false);
  const [setupFor, setSetupFor] = useState<null | { positions: number[]; mode: "insert" | "apply" }>(null);
  const [customTemplates, setCustomTemplates] = useState<TemplateDefinition[]>([]);
  /** The user's saved stickers, and which one (if any) is armed to be stamped. */
  const [stickers, setStickers] = useState<SavedElement[]>([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const [armedSticker, setArmedSticker] = useState<SavedElement | null>(null);
  /** A selection on its way into the tray, waiting for a name. */
  const [namingSticker, setNamingSticker] = useState<Omit<SavedElement, "id" | "createdAt"> | null>(null);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const pages = index.pages.length;
  const pageMeta = index.pages[page - 1];
  /**
   * Where this page's content is stored. Deliberately *not* the page's position:
   * see the note at the top of src/lib/planner-pages.ts — the slot is what keeps
   * handwriting welded to its page when pages are inserted or reordered.
   */
  const slot = pageMeta?.slot ?? page;
  // Hand first, because most planners are things you tap around before you write
  // in — except a blank notebook, which has nothing to navigate to.
  const [tool, setTool] = useState<Tool>(paperBacked ? "pen" : "hand");
  const [copying, setCopying] = useState(false);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [size, setSize] = useState(PEN_SIZES[1]);
  const [font, setFont] = useState(PLANNER_FONTS[0].key);
  const [textSize, setTextSize] = useState(TEXT_SIZES[1]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "offline">("saved");
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  /**
   * How much of the page is in view. A pure view transform — see
   * src/lib/planner-viewport.ts — so nothing here is ever written to a page.
   */
  const [view, setView] = useState<Viewport>(FIT);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  /** What the selection tool has picked out, by element id. */
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => new Set());
  const [selMode, setSelMode] = useState<SelectMode>("lasso");
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender((n) => n + 1), []);

  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** The background <img>, so a page can be captured as a template. */
  const bgImgRef = useRef<HTMLImageElement>(null);
  const pageRef = useRef(page);
  pageRef.current = page;
  const elementsRef = useRef<PageElement[]>([]);
  const liveRef = useRef<Stroke | null>(null);
  const undoRef = useRef<HistoryOp[]>([]);
  const redoRef = useRef<HistoryOp[]>([]);
  /** Page content by slot, so flipping back and forth doesn't refetch. */
  const cacheRef = useRef<Map<number, PageElement[]>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);
  const lastToastAt = useRef(0);
  const drawingPointer = useRef<number | null>(null);
  const rendererRef = useRef<PdfRenderer | null>(null);
  // A pending tap. `chromeOnly` taps came from a stylus landing on page
  // furniture, so they may only activate tabs — never a writable day cell.
  // `flip` marks the pointer as one that's navigating rather than writing, so an
  // edge tap or a sideways drag may turn the page. `lx`/`ly` are where the pointer
  // was last seen, which is what a drag pans by while zoomed in.
  const tapStart = useRef<
    { x: number; y: number; t: number; chromeOnly: boolean; flip: boolean; lx: number; ly: number } | null
  >(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const indexRef = useRef(index);
  indexRef.current = index;
  /** Wheel travel banked since the last flip, so a trackpad's dribble of small deltas adds up. */
  const wheelAccum = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  /** Pointers currently down, so two fingers can be recognised as a pinch. */
  const pointers = useRef<Map<number, { x: number; y: number; type: string }>>(new Map());
  /** The pinch in progress: the last finger separation and midpoint. */
  const pinch = useRef<{ dist: number; x: number; y: number } | null>(null);
  const selectionRef = useRef<ReadonlySet<string>>(selection);
  selectionRef.current = selection;
  /** The loop or rectangle being swept right now. Drawn on the ink canvas. */
  const marquee = useRef<Region | null>(null);
  /** The sticker armed to be stamped, mirrored so the pointer handler sees it at once. */
  const armedStickerRef = useRef<SavedElement | null>(null);
  armedStickerRef.current = armedSticker;
  /** Set when the stroke being drawn is one the Shapes tool will snap on release. */
  const snapping = useRef(false);
  const [snapped, setSnapped] = useState<string | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * A transform in progress. `from` is the page as it was when the gesture started
   * and every frame is computed from it, so a long drag can't accumulate rounding
   * error and letting go needs no fix-up pass.
   */
  const dragSel = useRef<
    | {
        kind: "move" | "scale" | "rotate";
        handle?: Handle;
        from: PageElement[];
        bounds: Bounds;
        x: number;
        y: number;
      }
    | null
  >(null);
  /** Wrapped heights of the text boxes, reported by the DOM, as page fractions. */
  const textHeights = useRef<Map<string, number>>(new Map());
  // Edge taps and swipes only turn the page when nothing else wants the gesture:
  // the hand tool (and a read-only planner, where every tool is a hand) navigates
  // instead of drawing. Zoomed in, those same drags pan the page instead — there's
  // more page than frame, so getting around it is what the gesture is for.
  const flipGestures = (readOnly || tool === "hand") && isFit(view);

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

  const label = pageMeta?.label ?? (template ? template.label(page) : `Page ${page}`);

  // Page shape is per page, which is what lets one notebook hold an A5 portrait
  // dotted page and a Letter landscape weekly planner.
  const geometry = useMemo(() => pageGeometry(pageMeta, planner), [pageMeta, planner]);
  const aspect = geometry.w / geometry.h;
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;

  // What goes behind the page: generated paper, a rendered planner page, or a page
  // of the imported PDF. This is a *reference*, resolved at render time — changing
  // a page's paper never touches what's written on it.
  const background = useMemo(
    () => resolveBackground(pageMeta, planner, { customTemplates, imageUrl: bgImageUrl ?? undefined }),
    [pageMeta, planner, customTemplates, bgImageUrl],
  );
  const bgSrc = background.kind === "image" ? background.src : background.kind === "pdf" ? pdfSrc : null;

  /**
   * The same resolution for a thumbnail in the page rail. Picture templates use
   * whatever URL is already in hand rather than waiting on IndexedDB, so scrolling
   * the rail never blocks; the picture appears when the page itself loads it. The
   * ruling is thickened for the size it'll be drawn at, or a lined page would show
   * up in the rail as a blank one.
   */
  const thumbBackground = useCallback((p: PageMeta) => {
    const bg = p.background;
    const imageUrl = bg.kind === "template" && bg.templateId ? templateImageUrlNow(bg.templateId) : null;
    return resolveBackground(p, planner, {
      customTemplates,
      imageUrl: imageUrl ?? undefined,
      shrink: pageGeometry(p, planner).h / THUMB_H,
    });
  }, [planner, customTemplates]);

  /** A small render of one PDF page, on its own renderer so the rail can't evict
   *  the full-size render of the page being written on. */
  const thumbRendererRef = useRef<PdfRenderer | null>(null);
  const pdfThumb = useCallback(async (sourcePage: number) => {
    if (!planner.pdfKey) return "";
    thumbRendererRef.current ??= new PdfRenderer(planner.pdfKey, 240);
    return thumbRendererRef.current.page(sourcePage);
  }, [planner.pdfKey]);

  // The user's own templates, so a page can reference one by id.
  useEffect(() => {
    let alive = true;
    listUserTemplates().then((t) => { if (alive) setCustomTemplates(t); });
    return () => { alive = false; };
  }, []);

  // The user's saved stickers, shared across every notebook on this device.
  useEffect(() => {
    let alive = true;
    listSavedElements().then((s) => { if (alive) setStickers(s); });
    return () => { alive = false; };
  }, []);

  // A picture template (a saved page, or an imported image) keeps its picture in
  // IndexedDB, so it has to be fetched before the page can draw it.
  useEffect(() => {
    const bg = pageMeta?.background;
    const def = bg?.kind === "template" ? templateFor(bg.templateId, customTemplates) : null;
    if (!def?.imageKey) { setBgImageUrl(null); return; }
    setBgImageUrl(templateImageUrlNow(def.id)); // already loaded: no blank frame
    let alive = true;
    templateImageUrl(def).then((u) => { if (alive) setBgImageUrl(u); });
    return () => { alive = false; };
  }, [pageMeta, customTemplates]);

  // Load the saved arrangement. Keyed on the planner *id*, not the object: the
  // library hands down a fresh object for the same notebook, and reloading then
  // would throw away a rearrangement made a moment earlier.
  const plannerRef = useRef(planner);
  plannerRef.current = planner;
  useEffect(() => {
    let alive = true;
    loadPageIndex(plannerRef.current).then((i) => {
      if (!alive) return;
      setIndex(i);
      setPage((p) => Math.min(Math.max(1, p), i.pages.length));
    });
    return () => { alive = false; };
  }, [plannerId]);

  // A pointer let go of outside the page box never reaches the handlers below, and
  // a finger left behind in the list would make the next single touch look like a
  // pinch. Watching the window as well is what keeps that list honest.
  useEffect(() => {
    const forget = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pinch.current && [...pointers.current.values()].filter((p) => p.type === "touch").length < 2) {
        pinch.current = null;
      }
    };
    window.addEventListener("pointerup", forget);
    window.addEventListener("pointercancel", forget);
    return () => {
      window.removeEventListener("pointerup", forget);
      window.removeEventListener("pointercancel", forget);
    };
  }, []);

  // Opening a different notebook starts fitted. Turning a page deliberately does
  // *not*: staying zoomed is what lets you write the same corner of one page after
  // another without setting the zoom up again each time.
  useEffect(() => { setView(FIT); }, [plannerId]);

  /** Ink is allowed on paper only: inside the write area and clear of the tabs. */
  const inkAllowed = useCallback((x: number, y: number) => {
    if (!inside(writeAreaRef.current, x, y)) return false;
    return !hotspotsRef.current.some((h) => h.kind === "chrome" && inside(h, x, y));
  }, []);

  /**
   * What the selection maths needs to know about this page: its shape, and how tall
   * each text box's text has actually wrapped to.
   */
  const pageGeom = useCallback((): PageGeom => ({
    aspect: aspectRef.current,
    textHeight: (t) => textHeights.current.get(t.id),
  }), []);

  // ---- rendering ----
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    // The *displayed* size, zoom included: the canvas is sized to how big the page
    // currently is on screen, so ink zoomed into stays as sharp as the paper behind
    // it rather than being a magnified bitmap. `inkPixelRatio` caps that.
    const rect = box.getBoundingClientRect();
    const dpr = inkPixelRatio(rect.width, rect.height, window.devicePixelRatio || 1);
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

    // Selection furniture, drawn outside the clip: a lasso often strays over a
    // margin on its way round a word, and cutting it off there looks broken.
    const W = rect.width, H = rect.height;
    const sel = selectionRef.current;
    if (sel.size) {
      // Every picked element gets its own outline, so it's clear *what* is coming
      // along, and one box round the lot for the handles to sit on.
      ctx.save();
      ctx.strokeStyle = "#8A6DE9";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([3, 3]);
      for (const el of elementsRef.current) {
        if (isText(el) || !sel.has(elementId(el))) continue; // text boxes outline themselves
        const b = elementBounds(el, pageGeom());
        ctx.strokeRect(b.x * W, b.y * H, b.w * W, b.h * H);
      }
      ctx.restore();
    }
    const m = marquee.current;
    if (m) {
      ctx.save();
      ctx.strokeStyle = "#8A6DE9";
      ctx.fillStyle = "rgba(138,109,233,0.10)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      if (m.mode === "rect") {
        ctx.rect(m.a[0] * W, m.a[1] * H, (m.b[0] - m.a[0]) * W, (m.b[1] - m.a[1]) * H);
      } else {
        m.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }, [pageGeom]);

  // The page box's *layout* size — its size at zoom 1, which is what normalised
  // coordinates are a fraction of. Deliberately not the bounding rect: that one
  // carries the zoom transform, and a text box's font size would then be scaled
  // twice. ResizeObserver reports the layout box, so a zoom doesn't fire it.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const apply = () => {
      const w = box.offsetWidth, h = box.offsetHeight;
      setBoxSize({ w, h });
      // A window resize changes how far the page may be panned.
      setView((v) => clampViewport(v, { w, h }));
      redraw();
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(box);
    return () => ro.disconnect();
  }, [redraw]);

  // Zoom changes the canvas's displayed size without touching its layout size, so
  // the observer above can't see it: resize the backing store here instead.
  useEffect(() => { redraw(); }, [view.z, redraw]);

  /** The page box's layout size: what the pan limits are measured against. */
  const layout = () => ({ w: boxRef.current?.offsetWidth ?? 0, h: boxRef.current?.offsetHeight ?? 0 });

  /** Zoom, keeping the given page point (default: the middle) where it is. */
  const zoomTo = useCallback((z: number, at: { x: number; y: number } = { x: 0.5, y: 0.5 }) => {
    const box = { w: boxRef.current?.offsetWidth ?? 0, h: boxRef.current?.offsetHeight ?? 0 };
    setView((v) => zoomAbout(v, z, box, at));
  }, []);

  // ---- persistence ----
  // Every edit is mirrored to localStorage *before* the network call and the
  // mirror is cleared only once the server acknowledges. A failed save therefore
  // degrades to "not synced yet" and survives a reload, rather than losing ink.
  //
  // Content is keyed by slot, so a page keeps its handwriting when it moves.
  const saveNow = useCallback(async (forSlot: number) => {
    const json = serializeElements(cacheRef.current.get(forSlot) ?? []);
    writeLocal(planner.id, forSlot, json);
    if (forSlot === slotRef.current) setSaveState("saving");
    const res = await pushPage(planner.id, forSlot, json);
    if (res.ok) {
      clearLocal(planner.id, forSlot);
      retryAttempt.current = 0;
      if (forSlot === slotRef.current && !saveTimer.current) setSaveState("saved");
      return true;
    }
    // Left on disk; reflect the failure and back off before retrying.
    if (forSlot === slotRef.current) setSaveState(res.status === 0 ? "offline" : "unsaved");
    const now = Date.now();
    if (now - lastToastAt.current > 8000) {
      lastToastAt.current = now;
      toast.error(saveErrorMessage(res));
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveNow(forSlot);
    }, retryDelay(retryAttempt.current++));
    return false;
  }, [planner.id]);

  const scheduleSave = useCallback((forSlot: number) => {
    setSaveState("unsaved");
    writeLocal(planner.id, forSlot, serializeElements(cacheRef.current.get(forSlot) ?? []));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveNow(forSlot);
    }, 1000);
  }, [planner.id, saveNow]);

  /**
   * Record one undoable step. History is a list of operations rather than of page
   * snapshots: a content edit remembers the slot it happened on (so undo still
   * works after flipping the page), and a page operation remembers the index
   * either side, which is a few hundred bytes of metadata — no rasterising, and
   * undoing a page deletion brings its handwriting back with it.
   */
  /**
   * A run of small edits that should undo as one step — a typing session, a text
   * box being dragged. `before` is the state the burst started from; `op` is the
   * single history entry it feeds, created on the first change so an empty burst
   * leaves no trace.
   */
  const burstRef = useRef<
    { slot: number; before: PageElement[]; op: Extract<HistoryOp, { kind: "content" }> | null } | null
  >(null);

  const pushOp = useCallback((op: HistoryOp) => {
    undoRef.current.push(op);
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
    rerender();
  }, [rerender]);

  const setElements = useCallback((next: PageElement[], { history = true }: { history?: boolean } = {}) => {
    if (readOnly) return; // built-in planner: nothing here is editable
    const forSlot = slotRef.current;
    if (history) {
      burstRef.current = null;
      pushOp({ kind: "content", slot: forSlot, before: elementsRef.current, after: next });
    } else {
      // Part of a burst (typing a word, dragging a text box): the burst's single op
      // keeps up with each change, so one undo takes the whole thing back rather
      // than a keystroke at a time.
      const burst = burstRef.current;
      if (burst && burst.slot === forSlot) {
        if (burst.op) burst.op.after = next;
        else {
          burst.op = { kind: "content", slot: forSlot, before: burst.before, after: next };
          pushOp(burst.op);
        }
      }
    }
    elementsRef.current = next;
    cacheRef.current.set(forSlot, next);
    scheduleSave(forSlot);
    redraw();
    rerender();
  }, [readOnly, redraw, rerender, scheduleSave, pushOp]);

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
  // Keyed on the slot: two positions never share one, and moving a page doesn't
  // change it, so this doesn't refetch after a reorder.
  useEffect(() => {
    let cancelled = false;
    liveRef.current = null;
    setSelectedText(null);
    // A selection is a set of things on *this* page, and the measured text heights
    // go with them.
    selectionRef.current = new Set();
    setSelection(selectionRef.current);
    textHeights.current.clear();
    burstRef.current = null; // a typing session doesn't span pages

    const cached = cacheRef.current.get(slot);
    if (cached) {
      elementsRef.current = cached;
      redraw();
      rerender();
      return;
    }
    const local = readLocal(planner.id, slot);
    if (local) {
      const parsed = parseElements(local.json);
      elementsRef.current = parsed;
      cacheRef.current.set(slot, parsed);
      redraw();
      rerender();
      setSaveState("unsaved");
      saveNow(slot);
      return;
    }
    elementsRef.current = [];
    redraw();
    rerender();
    (async () => {
      try {
        const res = await fetch(`/api/planner?planner=${planner.id}&page=${slot}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const parsed = parseElements(data.strokes);
        cacheRef.current.set(slot, parsed);
        elementsRef.current = parsed;
        redraw();
        rerender();
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [slot, planner.id, redraw, rerender, saveNow]);

  // Render the current page's PDF page on demand. A page of this notebook that
  // isn't from the PDF (an inserted template page) resolves to an image instead,
  // so there's nothing to render.
  useEffect(() => {
    if (background.kind !== "pdf" || !planner.pdfKey) return;
    rendererRef.current ??= new PdfRenderer(planner.pdfKey);
    let alive = true;
    setPdfSrc(null);
    rendererRef.current.page(background.page).then((url) => { if (alive) setPdfSrc(url); }).catch(() => {});
    return () => { alive = false; };
  }, [background, planner.pdfKey]);

  useEffect(() => () => {
    rendererRef.current?.destroy();
    rendererRef.current = null;
    thumbRendererRef.current?.destroy();
    thumbRendererRef.current = null;
  }, []);

  // Flush any pending save if the tab is closed or backgrounded.
  useEffect(() => {
    const flush = () => {
      if (!saveTimer.current) return;
      const json = serializeElements(cacheRef.current.get(slot) ?? []);
      writeLocal(planner.id, slot, json);
      navigator.sendBeacon?.(
        "/api/planner",
        new Blob([JSON.stringify({ planner: planner.id, page: slot, strokes: json })], { type: "application/json" }),
      );
    };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [slot, planner.id]);

  // Keep the URL shareable. Deliberately keyed on the planner *id*, not the
  // planner object: reloading the library hands down a fresh object for the same
  // notebook, and rewriting the URL then would stomp a navigation in flight (e.g.
  // "make a copy to write", which points the URL at the new notebook).
  useEffect(() => {
    // `debug` rides along, or this rewrite would switch the overlays off the
    // moment you opened a planner with ?debug=1.
    router.replace(`/planner?planner=${plannerId}&page=${page}${debug ? "&debug=1" : ""}`, { scroll: false });
  }, [page, plannerId, router, debug]);

  // Preload the neighbouring pages for snappy flips. Generated paper is a data URL
  // built on the spot, so only fetched backgrounds are worth warming.
  useEffect(() => {
    for (const p of [page + 1, page - 1]) {
      if (p < 1 || p > pages) continue;
      const bg = resolveBackground(index.pages[p - 1], planner, { customTemplates });
      if (bg.kind === "pdf") rendererRef.current?.page(bg.page).catch(() => {});
      else if (bg.kind === "image" && !bg.src.startsWith("data:")) {
        const img = new Image();
        img.src = bg.src;
      }
    }
  }, [page, pages, planner, index, customTemplates]);

  /** Persist the page being left right away, keeping its mirror until acked. */
  const flushPending = useCallback(() => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    saveNow(slotRef.current);
  }, [saveNow]);

  const go = useCallback((p: number) => {
    if (p < 1 || p > pages || p === page) return;
    flushPending();
    setPage(p);
  }, [page, pages, flushPending]);

  // ---- text boxes ----
  /** Start treating the edits that follow as one undo step. */
  const beginBurst = useCallback(() => {
    burstRef.current = { slot: slotRef.current, before: elementsRef.current, op: null };
  }, []);
  /** Close the burst, so the next edit starts a new step. */
  const endBurst = useCallback(() => { burstRef.current = null; }, []);

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

  // ---- selection ----
  // A selection is a set of element identities, and every action on it rewrites
  // those elements: a moved word is still a stroke with pressure behind it, so it
  // stays sharp at any zoom, can be moved again, recoloured, or undone. Nothing is
  // ever flattened to a picture. See src/lib/planner-select.ts.

  /** Change the selection, keeping the ref in step so `redraw` sees it at once. */
  const applySelection = useCallback((ids: ReadonlySet<string>) => {
    selectionRef.current = ids;
    setSelection(ids);
    redraw();
  }, [redraw]);

  const selBoundsNow = useCallback(
    () => (selectionRef.current.size ? selectionBounds(elementsRef.current, selectionRef.current, pageGeom()) : null),
    [pageGeom],
  );

  /** A text box reporting how tall it wrapped to. */
  const measureText = useCallback((id: string, height: number) => {
    const prev = textHeights.current.get(id);
    if (prev !== undefined && Math.abs(prev - height) < 1e-4) return;
    textHeights.current.set(id, height);
    // Only worth a repaint if it changes a box that's currently outlined.
    if (selectionRef.current.has(id)) { redraw(); rerender(); }
  }, [redraw, rerender]);

  /** Nudge the selection by a fraction of the page, as the arrow keys do. */
  const nudgeSelection = useCallback((dx: number, dy: number) => {
    const ids = selectionRef.current;
    const b = selBoundsNow();
    if (!ids.size || !b) return;
    const d = clampMove(b, dx, dy, writeAreaRef.current);
    setElements(translate(elementsRef.current, ids, d.dx, d.dy));
  }, [selBoundsNow, setElements]);

  type SelAction = "duplicate" | "copy" | "cut" | "paste" | "delete" | "front" | "back";

  const selAction = useCallback((action: SelAction) => {
    const ids = selectionRef.current;
    const els = elementsRef.current;
    if (action === "paste") {
      const clip = getClipboard();
      if (!clip.length) return;
      const { elements, ids: pasted } = addCopies(els, clip, { dx: 0.02, dy: 0.02 });
      setElements(elements);
      applySelection(pasted);
      return;
    }
    if (!ids.size) return;
    const picked = selectedElements(els, ids);
    switch (action) {
      case "duplicate": {
        const { elements, ids: copies } = addCopies(els, picked, { dx: 0.02, dy: 0.02 });
        setElements(elements);
        applySelection(copies);
        return;
      }
      case "copy":
        setClipboard(picked);
        rerender(); // the paste button lights up
        return;
      case "cut":
        setClipboard(picked);
        setElements(removeSelected(els, ids));
        applySelection(new Set());
        return;
      case "delete":
        setElements(removeSelected(els, ids));
        applySelection(new Set());
        return;
      case "front":
      case "back":
        setElements(reorder(els, ids, action));
        return;
    }
  }, [applySelection, rerender, setElements]);

  const recolorSelection = useCallback((c: string) => {
    if (!selectionRef.current.size) return;
    setElements(recolor(elementsRef.current, selectionRef.current, c));
  }, [setElements]);

  // ---- stickers ----
  // A saved element is the selection's own strokes and text boxes, lifted into their
  // own coordinate space (see src/lib/planner-elements.ts). Nothing is flattened, so a
  // stamped copy is ordinary ink that moves, resizes, recolours and undoes like the
  // rest.

  /** Offer to save the selection as a reusable sticker. */
  const saveSelectionAsSticker = useCallback(() => {
    const picked = selectedElements(elementsRef.current, selectionRef.current);
    if (!picked.length) return;
    try {
      setNamingSticker(captureElements(picked, pageGeom(), "Saved element"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that as a sticker.");
    }
  }, [pageGeom]);

  const confirmSaveSticker = useCallback(async (name: string) => {
    const draft = namingSticker;
    setNamingSticker(null);
    if (!draft) return;
    try {
      const saved = await saveElement({ ...draft, name });
      setStickers((prev) => [saved, ...prev]);
      setTrayOpen(true);
      toast.success("Saved to your stickers.");
    } catch {
      toast.error("Couldn't save that sticker — your device storage may be full.");
    }
  }, [namingSticker]);

  /** Drop an armed sticker onto the page at a page-coordinate point. */
  const stampAt = useCallback((sticker: SavedElement, x: number, y: number) => {
    const A = aspectRef.current;
    const place = clampStamp(sticker, { x, y, height: STAMP_HEIGHT, aspect: A }, writeAreaRef.current);
    const stamped = stampElements(sticker, { x: place.x, y: place.y, height: STAMP_HEIGHT, aspect: A });
    beginBurst();
    setElements([...elementsRef.current, ...stamped]);
    endBurst();
    // Select what was just placed, so it can be nudged into position at once.
    applySelection(new Set(stamped.map((el) => elementId(el))));
    setTool("select");
    setArmedSticker(null);
  }, [applySelection, setElements, beginBurst, endBurst]);

  const renameSticker = useCallback((id: string, name: string) => {
    setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, name: name.trim().slice(0, 40) || s.name } : s)));
    renameSavedElement(id, name).catch(() => {});
  }, []);

  const deleteSticker = useCallback((id: string) => {
    setStickers((prev) => prev.filter((s) => s.id !== id));
    setArmedSticker((a) => (a?.id === id ? null : a));
    deleteSavedElement(id).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
      const picked = selectionRef.current.size > 0;
      // ⌘/ctrl with +, − and 0, as every document viewer does it — and the
      // clipboard keys, which act on the selection.
      if (e.metaKey || e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomTo(stepZoom(viewRef.current.z, 1)); }
        else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomTo(stepZoom(viewRef.current.z, -1)); }
        else if (e.key === "0") { e.preventDefault(); setView(FIT); }
        else if (key === "c" && picked) { e.preventDefault(); selAction("copy"); }
        else if (key === "x" && picked) { e.preventDefault(); selAction("cut"); }
        else if (key === "v" && !readOnly) { e.preventDefault(); setTool("select"); selAction("paste"); }
        else if (key === "a" && !readOnly && elementsRef.current.length) {
          e.preventDefault();
          setTool("select");
          applySelection(new Set(elementsRef.current.map(elementId)));
        }
        return;
      }
      if (picked) {
        if (e.key === "Escape") { applySelection(new Set()); return; }
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); selAction("delete"); return; }
        // Arrows nudge what's selected instead of turning the page: with something
        // in hand, that's what they're for.
        const step = e.shiftKey ? 0.02 : 0.004;
        if (e.key === "ArrowLeft") { e.preventDefault(); nudgeSelection(-step, 0); return; }
        if (e.key === "ArrowRight") { e.preventDefault(); nudgeSelection(step, 0); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); nudgeSelection(0, -step * aspectRef.current); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); nudgeSelection(0, step * aspectRef.current); return; }
      }
      if (e.key === "ArrowLeft") go(page - 1);
      if (e.key === "ArrowRight") go(page + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, go, zoomTo, readOnly, selAction, nudgeSelection, applySelection]);

  // The selection belongs to the tool that made it: switching away lets it go, so
  // no invisible handles are left holding a page's ink.
  useEffect(() => {
    if (tool !== "select" && selectionRef.current.size) applySelection(new Set());
  }, [tool, applySelection]);

  useEffect(() => () => { if (snapTimer.current) clearTimeout(snapTimer.current); }, []);

  // ---- pointer handling ----
  // GoodNotes-style input routing: Apple Pencil (pointerType "pen") draws on
  // paper and taps tabs; fingers always navigate (tap hotspots); the mouse
  // follows the selected tool.
  //
  // Zoom needs no term in any of this. It's a CSS transform on the page box, so
  // the box's bounding rect is already the zoomed rect and a client point divided
  // by it is still the page coordinate — see src/lib/planner-viewport.ts.
  const norm = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = boxRef.current!.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };


  const shouldDraw = (e: React.PointerEvent) =>
    !readOnly && (e.pointerType === "pen" || (e.pointerType === "mouse" && toolRef.current !== "hand"));

  const eraseAt = useCallback((x: number, y: number) => {
    const R = 0.012; // eraser radius as a fraction of page width
    const before = elementsRef.current;
    const after = before.filter((el) => {
      if (!isStroke(el)) return true;
      return !el.points.some(([px, py]) => {
        // Normalised coordinates squash the page, so the vertical distance is
        // corrected by the aspect ratio of the page you're actually on.
        const dx = px - x, dy = (py - y) / aspectRef.current;
        return dx * dx + dy * dy < R * R;
      });
    });
    if (after.length !== before.length) setElements(after);
  }, [setElements]);

  /** A pending tap from this pointer, recorded so a drag can pan and a tap can navigate. */
  const beginTap = (e: React.PointerEvent, opts: { chromeOnly: boolean; flip: boolean }) => {
    tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now(), lx: e.clientX, ly: e.clientY, ...opts };
    // Zoomed in this pointer is going to pan, and a pan mustn't stop the moment it
    // leaves the page box.
    if (!isFit(viewRef.current)) boxRef.current?.setPointerCapture(e.pointerId);
  };

  /** Recompute a transform in progress from the snapshot it started with. */
  const applyDrag = (x: number, y: number, shift: boolean) => {
    const g = dragSel.current;
    const ids = selectionRef.current;
    if (!g || !ids.size) return;
    if (g.kind === "move") {
      const { dx, dy } = clampMove(g.bounds, x - g.x, y - g.y, writeAreaRef.current);
      setElements(translate(g.from, ids, dx, dy), { history: false });
      return;
    }
    if (g.kind === "scale") {
      setElements(scaleSelection(g.from, ids, resizeScale(g.bounds, g.handle!, x, y)), { history: false });
      return;
    }
    const geom = pageGeom();
    const centre = { x: g.bounds.x + g.bounds.w / 2, y: g.bounds.y + g.bounds.h / 2 };
    let angle = angleTo(centre, x, y, geom.aspect) - angleTo(centre, g.x, g.y, geom.aspect);
    if (shift) angle = snapAngle(angle);
    setElements(rotateSelection(g.from, ids, centre, angle, geom), { history: false });
  };

  /**
   * A resize or rotate handle taking over. Capture goes to the page box, so the rest
   * of the gesture arrives at the handlers below however far it strays.
   */
  const startHandle = (e: React.PointerEvent, kind: "scale" | "rotate", handle?: Handle) => {
    const b = selBoundsNow();
    if (!b) return;
    e.stopPropagation();
    e.preventDefault();
    const [x, y] = norm(e);
    boxRef.current?.setPointerCapture(e.pointerId);
    drawingPointer.current = e.pointerId;
    beginBurst(); // the whole gesture is one undo step
    dragSel.current = { kind, handle, from: elementsRef.current, bounds: b, x, y };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    // A second finger is a pinch, not a tap: two fingers zoom and pan the page.
    const touches = [...pointers.current.values()].filter((p) => p.type === "touch");
    if (touches.length >= 2) {
      tapStart.current = null;
      const [a, b] = touches;
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return;
    }

    // A finger or palm landing while the pen is writing is the hand resting on the
    // page. Ignoring it outright is what stops a stroke turning into a page flip.
    if (drawingPointer.current !== null && e.pointerType === "touch") return;

    const [x, y] = norm(e);

    // Read-only planner: every input is navigation, whatever the tool says.
    if (readOnly) {
      beginTap(e, { chromeOnly: false, flip: true });
      return;
    }

    // A sticker armed for placement: the next tap on the paper stamps it. Off the
    // paper (a tab or the margin) it's ignored, so it can't land where ink is clipped.
    if (armedStickerRef.current && inkAllowed(x, y)) {
      e.preventDefault();
      stampAt(armedStickerRef.current, x, y);
      return;
    }

    // Selection tool: grab what's already picked to move it, or sweep a new region.
    // Fingers are left out deliberately — they go on panning and tapping tabs, so
    // the page never feels locked while the tool is armed.
    if (toolRef.current === "select" && shouldDraw(e)) {
      e.preventDefault();
      boxRef.current?.setPointerCapture(e.pointerId);
      drawingPointer.current = e.pointerId; // also makes a resting hand a no-op
      const b = selBoundsNow();
      if (b && boundsContain(b, x, y, 0.008)) {
        beginBurst();
        dragSel.current = { kind: "move", from: elementsRef.current, bounds: b, x, y };
        return;
      }
      marquee.current =
        selMode === "rect" ? { mode: "rect", a: [x, y], b: [x, y] } : { mode: "lasso", points: [[x, y]] };
      redraw();
      return;
    }

    // Tapping the paper while a text box is selected just deselects it.
    if (selectedText) { setSelectedText(null); return; }

    // Text tool: a tap on the paper drops a new box; taps elsewhere navigate.
    if (toolRef.current === "text") {
      if (inkAllowed(x, y)) { e.preventDefault(); addTextAt(x, y); }
      else beginTap(e, { chromeOnly: e.pointerType === "pen", flip: false });
      return;
    }

    if (e.pointerType === "touch" || !shouldDraw(e)) {
      // Fingers and the hand tool navigate anywhere on the page — and pan it when
      // there's more page than frame.
      beginTap(e, { chromeOnly: false, flip: true });
      return;
    }
    if (!inkAllowed(x, y)) {
      // Landed on a tab or the outer margin: no ink here, but a tab tap counts.
      beginTap(e, { chromeOnly: true, flip: false });
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
    snapping.current = activeTool === "shape";
    liveRef.current = {
      tool: activeTool === "highlighter" ? "highlighter" : "pen",
      color, size,
      points: [[x, y, e.pressure || 0.5]],
    };
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const tracked = pointers.current.get(e.pointerId);
    if (tracked) { tracked.x = e.clientX; tracked.y = e.clientY; }

    // Two fingers: the change in their separation zooms about their midpoint, and
    // the midpoint's own travel pans. Both are measured against the last frame, so
    // the gesture follows the fingers however it's combined.
    if (pinch.current) {
      const touches = [...pointers.current.values()].filter((p) => p.type === "touch");
      if (touches.length < 2) return;
      const [a, b] = touches;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const prev = pinch.current;
      pinch.current = { dist, x: mx, y: my };
      if (prev.dist > 8 && dist > 8) {
        const box = layout();
        const [ax, ay] = norm({ clientX: mx, clientY: my });
        setView((v) =>
          panBy(zoomAbout(v, v.z * (dist / prev.dist), box, { x: ax, y: ay }), mx - prev.x, my - prev.y, box),
        );
      }
      return;
    }

    // A selection gesture: sweeping a region, or transforming what's picked.
    if (drawingPointer.current === e.pointerId && (marquee.current || dragSel.current)) {
      e.preventDefault();
      const [x, y] = norm(e);
      const m = marquee.current;
      if (m) {
        if (m.mode === "rect") marquee.current = { mode: "rect", a: m.a, b: [x, y] };
        else m.points.push([x, y]);
        redraw();
        return;
      }
      applyDrag(x, y, e.shiftKey);
      return;
    }

    // Zoomed in, a navigating pointer drags the page about.
    const tap = tapStart.current;
    if (tap && !isFit(viewRef.current)) {
      const dx = e.clientX - tap.lx, dy = e.clientY - tap.ly;
      tap.lx = e.clientX;
      tap.ly = e.clientY;
      if (dx || dy) setView((v) => panBy(v, dx, dy, layout()));
      return;
    }

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
    pointers.current.delete(e.pointerId);
    // A pinch ends when a finger lifts, and the finger still down isn't a tap.
    if (pinch.current) {
      if ([...pointers.current.values()].filter((p) => p.type === "touch").length < 2) pinch.current = null;
      tapStart.current = null;
      return;
    }

    // A selection gesture finishing.
    if (marquee.current || dragSel.current) {
      const m = marquee.current;
      const transform = dragSel.current;
      marquee.current = null;
      dragSel.current = null;
      if (drawingPointer.current === e.pointerId) drawingPointer.current = null;
      if (transform) {
        endBurst(); // the next gesture is a new undo step
        redraw();
        return;
      }
      if (!m) return;
      const [x, y] = norm(e);
      const travel =
        m.mode === "rect"
          ? Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1])
          : m.points.reduce((d, p, i) => (i ? d + Math.hypot(p[0] - m.points[i - 1][0], p[1] - m.points[i - 1][1]) : 0), 0);
      // A tap rather than a sweep: take whatever is under it — or nothing, which is
      // how you let a selection go.
      if (travel < 0.015) {
        const hit = pickAt(elementsRef.current, x, y, pageGeom());
        applySelection(hit ? new Set([hit]) : new Set());
        return;
      }
      applySelection(pick(elementsRef.current, m, pageGeom()));
      return;
    }

    if (drawingPointer.current === e.pointerId) {
      drawingPointer.current = null;
      if (liveRef.current) {
        const live = liveRef.current;
        liveRef.current = null;
        // The Shapes tool: if the path was meant to be a circle, a box, a line or an
        // arrow, commit the ideal one instead. It's still a stroke either way — see
        // src/lib/planner-shapes.ts — so nothing downstream can tell the difference.
        const snap = snapping.current ? snapStroke(live, aspectRef.current) : null;
        snapping.current = false;
        if (snap?.kind) {
          setSnapped(SHAPE_LABEL[snap.kind]);
          if (snapTimer.current) clearTimeout(snapTimer.current);
          snapTimer.current = setTimeout(() => setSnapped(null), 1200);
        }
        setElements([...elementsRef.current, snap?.kind ? snap.stroke : simplifyStroke(live)]);
      }
      return;
    }
    // Tap navigation (finger, hand tool, or a stylus tap on a tab).
    const start = tapStart.current;
    tapStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const moved = Math.hypot(dx, dy);
    const [x, y] = norm(e);
    // Zoomed in, that drag was a pan and the edges are somewhere off-screen, so
    // neither gesture turns the page — the arrows and the page rail still do.
    const flip = start.flip && isFit(viewRef.current);

    // A sideways drag turns the page, the way you'd flick a paper one over.
    if (flip && Math.abs(dx) >= SWIPE_FLIP_PX && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? page + 1 : page - 1);
      return;
    }
    if (moved > 12 || Date.now() - start.t > 600) return;
    const hit = hotspots.find((h) => inside(h, x, y) && (!start.chromeOnly || h.kind === "chrome"));
    if (hit) { go(hit.page); return; }
    // Nothing to jump to here. A tap on the outer edge turns the page — checked
    // after the hotspots, because tab strips run down the edges too and a tab
    // has to win.
    if (flip) {
      if (x >= 1 - EDGE_FLIP) go(page + 1);
      else if (x <= EDGE_FLIP) go(page - 1);
    }
  };

  // Wheel and trackpad: pinch (which arrives as ctrl+wheel) and ⌘/ctrl+scroll
  // zoom about the pointer; plain scrolling pans a zoomed page and turns a fitted
  // one. Attached natively rather than through React's onWheel because React's is
  // passive, and preventDefault is what stops the browser zooming the whole app
  // instead — and the page behind from scrolling as you pan.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      if (drawingPointer.current !== null) return;
      // Don't yank the page out from under someone scrolling a text box they're typing in.
      if ((e.target as HTMLElement)?.closest?.("textarea, input, [contenteditable='true']")) return;

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = box.getBoundingClientRect();
        // Exponential so each notch is the same proportional change, and the same
        // gesture zooms by the same amount from 1× as from 4×.
        zoomTo(viewRef.current.z * Math.exp(-e.deltaY / 240), {
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        });
        return;
      }

      // Zoomed in, scrolling moves about the page. Only once it can't move any
      // further in that direction does the scroll go on to turn the page, so
      // reaching the bottom and carrying on lands you on the next page.
      if (!isFit(viewRef.current)) {
        const next = panBy(viewRef.current, -e.deltaX, -e.deltaY, { w: box.offsetWidth, h: box.offsetHeight });
        if (viewMoved(next, viewRef.current)) {
          e.preventDefault();
          wheelAccum.current = 0;
          setView(next);
          return;
        }
      }

      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; // sideways scroll: not ours
      if (wheelAccum.current !== 0 && Math.sign(e.deltaY) !== Math.sign(wheelAccum.current)) wheelAccum.current = 0;
      wheelAccum.current += e.deltaY;
      if (Math.abs(wheelAccum.current) < WHEEL_FLIP_PX) return;
      const forward = wheelAccum.current > 0;
      wheelAccum.current = 0;
      go(forward ? pageRef.current + 1 : pageRef.current - 1);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [go, zoomTo]);

  // ---- undo / redo ----
  // One history for the whole notebook, holding operations rather than snapshots:
  // strokes, erasing, text, and every page operation go through here.
  const applyOp = useCallback((op: HistoryOp, direction: "undo" | "redo") => {
    setSelectedText(null);
    if (op.kind === "content") {
      const next = direction === "undo" ? op.before : op.after;
      cacheRef.current.set(op.slot, next);
      scheduleSave(op.slot);
      // Undoing an edit you made on another page takes you back to it, so what
      // changes is always what you can see.
      const pos = indexRef.current.pages.findIndex((p) => p.slot === op.slot) + 1;
      if (pos >= 1 && pos !== pageRef.current) setPage(pos);
      else {
        elementsRef.current = next;
        redraw();
      }
      rerender();
      return;
    }
    const next = direction === "undo" ? op.before : op.after;
    setIndex(next);
    indexRef.current = next;
    savePageIndex(next).catch(() => {});
    setPage(Math.min(Math.max(1, direction === "undo" ? op.page : op.toPage), next.pages.length));
    rerender();
  }, [redraw, rerender, scheduleSave]);

  const undo = () => {
    const op = undoRef.current.pop();
    if (!op) return;
    redoRef.current.push(op);
    applyOp(op, "undo");
  };
  const redo = () => {
    const op = redoRef.current.pop();
    if (!op) return;
    undoRef.current.push(op);
    applyOp(op, "redo");
  };

  // ---- page operations ----
  /**
   * Commit a new arrangement: remember it for undo, land on the right page, and
   * persist it. `clear` lists slots that were recycled from long-deleted pages and
   * so have to be emptied before they're written in again.
   */
  /**
   * Empty a slot everywhere: memory, the unsynced mirror, and the server. Seeding
   * the cache with an empty page rather than dropping the entry matters — the page
   * loader treats a missing entry as "go and fetch", and that fetch can land ahead
   * of this clear and put a deleted page's handwriting onto a brand new one.
   */
  const blankSlot = useCallback(async (s: number) => {
    cacheRef.current.set(s, []);
    clearLocal(planner.id, s);
    await clearSlot(planner.id, s);
  }, [planner.id]);

  const applyPageOp = useCallback(async (
    label: string,
    next: PageIndex,
    { toPage, clear = [] }: { toPage?: number; clear?: number[] } = {},
  ) => {
    const before = indexRef.current;
    if (next === before) return;
    const land = Math.min(Math.max(1, toPage ?? pageRef.current), next.pages.length);
    setIndex(next);
    indexRef.current = next;
    pushOp({ kind: "pages", label, before, after: next, page: pageRef.current, toPage: land });
    setPage(land);
    for (const s of clear) await blankSlot(s);
    try {
      await savePageIndex(next);
    } catch {
      toast.error("Couldn't save the page layout on this device.");
    }
  }, [blankSlot, pushOp]);

  const addPages = useCallback((spec: NewPageSpec, at: number, count = 1) => {
    const res = insertPages(indexRef.current, at, count, spec);
    if (res.index.pages.length === indexRef.current.pages.length) {
      toast.error(`This notebook is at the ${MAX_SLOT}-page limit.`);
      return;
    }
    const added = res.index.pages.length - indexRef.current.pages.length;
    applyPageOp(added > 1 ? `Added ${added} pages` : "Added a page", res.index, { toPage: res.at, clear: res.clear });
    toast.success(added > 1 ? `${added} pages added` : `Page ${res.at} added`);
  }, [applyPageOp]);

  /** A new page like the one you're on, which is what "add page" should mean. */
  const specLikeCurrentPage = useCallback((): NewPageSpec => {
    const from = indexRef.current.pages[pageRef.current - 1];
    const bg = from?.background;
    return {
      // A page of the source PDF can't be duplicated as a background, so a new
      // page after one is blank paper of the same shape and colour.
      background:
        bg?.kind === "template"
          ? { ...bg }
          : { kind: "template", templateId: (planner as UserPlanner).paper ?? DEFAULT_TEMPLATE },
      color: from?.color,
      size: from?.size,
      orientation: from?.orientation,
      custom: from?.custom,
    };
  }, [planner]);

  const duplicatePagesAt = useCallback(async (positions: number[]) => {
    flushPending();
    const res = duplicatePages(indexRef.current, positions);
    if (!res.copies.length) return;
    const targets = new Set(res.copies.map((c) => c.to));

    // A recycled target can still hold a deleted page's handwriting. Blank it here,
    // before anything is copied in, so an empty source doesn't leave the old ink
    // sitting on the copy. applyPageOp is told to skip these for the same reason.
    for (const s of res.clear) if (targets.has(s)) await blankSlot(s);

    // The copy we're about to land on needs its content in the cache *before* the
    // page changes: the loader would otherwise find the slot empty, show a blank
    // page, and its fetch would land after the copy and wipe it again.
    const landing = res.index.pages[res.at - 1]?.slot;
    const seeded = new Map<number, PageElement[]>();
    const landingCopy = res.copies.find((c) => c.to === landing);
    if (landingCopy) {
      const content = cacheRef.current.get(landingCopy.from) ?? (await fetchSlot(planner.id, landingCopy.from));
      seeded.set(landingCopy.to, content);
      cacheRef.current.set(landingCopy.to, content);
    }

    await applyPageOp(
      res.copies.length > 1 ? `Duplicated ${res.copies.length} pages` : "Duplicated a page",
      res.index,
      { toPage: res.at, clear: res.clear.filter((s) => !targets.has(s)) },
    );

    // Content is copied slot by slot. What's already in memory is newer than the
    // server (it may not have synced yet), so it wins when we have it; otherwise
    // the server copies the row across without downloading the page.
    for (const { from, to } of res.copies) {
      const content = seeded.get(to) ?? cacheRef.current.get(from);
      if (content) {
        cacheRef.current.set(to, content);
        if (content.length) await saveNow(to);
      } else if (!(await copySlot(planner.id, from, to))) {
        toast.error("The copy's handwriting didn't save — check your connection.");
      }
    }
    redraw();
    rerender();
  }, [applyPageOp, blankSlot, flushPending, planner.id, saveNow, redraw, rerender]);

  const deletePagesAt = useCallback((positions: number[]) => {
    const next = deletePages(indexRef.current, positions);
    if (next === indexRef.current) {
      toast.error("A notebook needs at least one page.");
      return;
    }
    const removed = indexRef.current.pages.length - next.pages.length;
    applyPageOp(removed > 1 ? `Deleted ${removed} pages` : "Deleted a page", next, {
      toPage: Math.min(...positions),
    });
    toast.success(removed > 1 ? `${removed} pages deleted` : "Page deleted", { description: "Undo brings it back with its handwriting." });
  }, [applyPageOp]);

  const movePagesTo = useCallback((positions: number[], before: number) => {
    const next = movePages(indexRef.current, positions, before);
    // Follow the page that was being dragged.
    const followed = indexRef.current.pages[positions[0] - 1];
    const land = next.pages.findIndex((p) => p === followed) + 1;
    applyPageOp("Moved pages", next, { toPage: land || undefined });
  }, [applyPageOp]);

  const applyPageSetup = useCallback((positions: number[], patch: Partial<Omit<PageMeta, "slot">>) => {
    const next = setPageProps(indexRef.current, positions, patch);
    applyPageOp("Changed paper", next, { toPage: positions[0] });
  }, [applyPageOp]);

  /** Save the page you're on as a template you can start new pages from. */
  const saveAsTemplate = useCallback(async (name: string) => {
    const t = toast.loading("Saving this page as a template…");
    try {
      const blob = await capturePage(bgImgRef.current, canvasRef.current);
      const def = await saveUserTemplate({ name, image: blob, hint: "Saved from a page" });
      setCustomTemplates(await listUserTemplates());
      toast.success(`“${def.name}” saved`, { id: t, description: "It's under Custom in the paper picker." });
    } catch (e: any) {
      toast.error("Couldn't save that as a template", { id: t, description: e?.message });
    }
  }, []);

  // Read-only escape hatch: take an editable copy, carrying any ink already in
  // it, and land on the page you were looking at.
  const makeCopy = async () => {
    setCopying(true);
    const t = toast.loading(`Making your copy of “${planner.name}”…`);
    try {
      const meta = await duplicatePlanner(planner, { withInk: true });
      toast.success(`Created “${meta.name}”`, { id: t, description: "This one's yours — write anywhere." });
      await onOpenPlanner(meta.id, page);
    } catch (e: any) {
      toast.error("Couldn't make a copy", { id: t, description: e?.message });
    } finally {
      setCopying(false);
    }
  };

  /** Add one page like the current one, straight after it. */
  const onAddPage = () => addPages(specLikeCurrentPage(), page + 1);

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
  const showInkControls = tool === "pen" || tool === "highlighter" || tool === "shape";
  // The box round the selection, in page coordinates: where the handles and the
  // action bar hang. Recomputed each render, so it follows a drag frame by frame.
  const selBounds = tool === "select" && selection.size ? selectionBounds(elementsRef.current, selection, pageGeom()) : null;
  /**
   * Selection furniture counter-scales with the zoom, so a handle stays the size of
   * a finger at 6× instead of covering a quarter of the page. `scale()` comes first
   * in the transform so the offsets after it are scaled too — that's what keeps a
   * handle centred on its corner and the bar a constant gap above the box.
   */
  const unzoom = (offset: string) => `scale(${1 / view.z}) ${offset}`;

  return (
    // The viewer owns the viewport: a definite height is what lets the page rail
    // scroll inside itself instead of stretching this column and pushing the paper
    // off the bottom of the screen. The negative margins cancel the app shell's
    // padding, and the height allows for the mobile header and bottom nav it leaves
    // room for (pt-16 + pb-20) — at md the shell's padding is even all round.
    <div
      className="-mx-4 md:-mx-8 md:-my-8 [--planner-vh:calc(100dvh-9rem)] md:[--planner-vh:100dvh] h-[var(--planner-vh)] flex flex-col overflow-hidden relative z-20"
      style={{ background: "#F2E8DC" }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 flex-wrap bg-white/80 backdrop-blur border-b border-black/5 shrink-0 z-30">
        <button onClick={onLibrary} className="p-2 rounded-xl text-black/50 hover:bg-black/5" title="All planners">
          <Library className="w-4 h-4" />
        </button>
        <button
          onClick={() => setSidebar((s) => !s)}
          className={`p-2 rounded-xl transition-colors ${sidebar ? "bg-black/[0.07] text-black/70" : "text-black/50 hover:bg-black/5"}`}
          title={sidebar ? "Hide the page rail" : "Show every page"}
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold mr-1 text-black" style={MARKER}>{planner.name}</span>
        <span className="text-xs text-black/45 mr-2 hidden sm:inline">{label}</span>

        {readOnly ? (
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11.5px] font-semibold bg-black/[0.06] text-black/55"
              title="Built-in planners are shared, so they stay as printed. Make a copy to write in one."
              style={MARKER}
            >
              <Lock className="w-3.5 h-3.5" /> Read-only
            </span>
            <button
              onClick={makeCopy}
              disabled={copying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[#8A6DE9] text-white hover:brightness-110 transition-all disabled:opacity-60"
              style={MARKER}
            >
              <Copy className="w-3.5 h-3.5" /> {copying ? "Copying…" : "Make a copy to write"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5 rounded-2xl bg-black/[0.04] p-0.5">
            <ToolButton t="hand" icon={<Hand className="w-4 h-4" />} title="Navigate (tap tabs & days)" />
            <ToolButton t="pen" icon={<Pen className="w-4 h-4" />} title="Pen" />
            <ToolButton t="highlighter" icon={<Highlighter className="w-4 h-4" />} title="Highlighter" />
            <ToolButton t="shape" icon={<Shapes className="w-4 h-4" />} title="Shapes — draw roughly and it snaps to a circle, box, triangle, line or arrow" />
            <ToolButton t="text" icon={<Type className="w-4 h-4" />} title="Text box (tap the paper to type)" />
            <ToolButton t="select" icon={<Lasso className="w-4 h-4" />} title="Select — move, resize, recolour or copy what you've written" />
            <ToolButton t="eraser" icon={<Eraser className="w-4 h-4" />} title="Eraser (removes whole strokes)" />
          </div>
        )}

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

        {tool === "shape" && (
          <span
            className={`ml-1 text-[11px] font-semibold px-2 py-1 rounded-full transition-opacity ${snapped ? "bg-[#8A6DE9]/12 text-[#6F55C7] opacity-100" : "text-black/35 opacity-100"}`}
            style={MARKER}
          >
            {snapped ?? "draw roughly — it'll snap"}
          </span>
        )}

        {tool === "select" && (
          <div className="flex items-center gap-1 ml-1">
            <div className="flex items-center gap-0.5 rounded-xl bg-black/[0.04] p-0.5">
              {([["lasso", Lasso, "Lasso — draw a loop round what you want"], ["rect", SquareDashed, "Box — drag a rectangle over it"]] as const).map(
                ([m, Icon, title]) => (
                  <button
                    key={m}
                    onClick={() => setSelMode(m)}
                    title={title}
                    className={`p-1.5 rounded-lg transition-colors ${selMode === m ? "bg-white shadow-sm text-black/70" : "text-black/40 hover:bg-black/5"}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ),
              )}
            </div>
            <button
              onClick={() => selAction("paste")}
              disabled={clipboardSize() === 0}
              className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30"
              title="Paste (⌘V) — works across pages and notebooks"
            >
              <ClipboardPaste className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-black/35 hidden lg:inline">
              {selection.size ? `${selection.size} selected` : "draw round some writing to pick it up"}
            </span>
          </div>
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

        {!readOnly && (
          <div className="relative flex items-center ml-1">
            <button
              data-sticker-toggle
              onClick={() => { setTrayOpen((o) => !o); if (trayOpen) setArmedSticker(null); }}
              className={`p-2 rounded-xl transition-colors ${armedSticker ? "bg-[#8A6DE9] text-white" : trayOpen ? "bg-black/[0.07] text-black/70" : "text-black/50 hover:bg-black/5"}`}
              title={armedSticker ? "Tap the page to place your sticker" : "My stickers — reusable bits you've saved"}
            >
              <Stamp className="w-4 h-4" />
            </button>
            {trayOpen && (
              <StickerTray
                stickers={stickers}
                armed={armedSticker?.id ?? null}
                onArm={(s) => setArmedSticker(s)}
                onRename={renameSticker}
                onDelete={deleteSticker}
                onClose={() => setTrayOpen(false)}
              />
            )}
          </div>
        )}

        {!readOnly && (
          <div className="flex items-center ml-1">
            <button onClick={undo} disabled={undoRef.current.length === 0} className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30" title="Undo">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={redo} disabled={redoRef.current.length === 0} className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30" title="Redo">
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* Nothing can change in a read-only planner, so a save indicator would
            only ever say "Saved" — it's noise. */}
        {!readOnly && (
          <span className={`flex items-center gap-1 text-[10px] mr-2 ${saveState === "saved" ? "text-black/30" : "text-[#c98a00]"}`} title={saveState === "offline" ? "Saved on this device — will sync when you reconnect" : undefined}>
            {saveState === "offline" && <CloudOff className="w-3 h-3" />}
            {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "offline" ? "Offline" : "Unsaved"}
          </span>
        )}
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
      </div>

      {/* Page rail + page */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {sidebar && (
          <PageSidebar
            pages={index.pages}
            current={page}
            editable={canEditPages}
            background={thumbBackground}
            pdfThumb={pdfBacked ? pdfThumb : undefined}
            aspect={(p) => pageAspect(p, planner)}
            onJump={go}
            onClose={() => setSidebar(false)}
            onInsertAt={(at) => setSetupFor({ positions: [at], mode: "insert" })}
            onDuplicate={duplicatePagesAt}
            onDelete={deletePagesAt}
            onMove={movePagesTo}
            onSetup={(positions) => setSetupFor({ positions, mode: "apply" })}
          />
        )}

        <div className="flex-1 flex items-center justify-center p-2 md:p-4 overflow-hidden">
          <div
            ref={boxRef}
            className="group relative w-full max-h-full shadow-xl rounded-lg overflow-hidden select-none"
            // The width cap is what keeps the shape: with `width: 100%` a max-height
            // alone would squash the page rather than shrink it. It's measured off the
            // viewer's own height, so it's right on a phone too.
            style={{
              aspectRatio: `${aspect}`,
              maxWidth: `min(100%, calc((var(--planner-vh) - 150px) * ${aspect}))`,
              touchAction: "none",
              background: "#fff",
              // Zoom and pan are one composited transform on the whole page, paper,
              // ink and text boxes together — so panning is smooth, and normalised
              // coordinates go on meaning the same thing at any zoom.
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
              transformOrigin: "center center",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          >
            {bgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={bgImgRef}
                src={bgSrc}
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
                scale={view.z}
                selected={selectedText === t.id}
                editable={tool === "text" && !readOnly}
                outlined={selection.has(t.id)}
                onMeasure={measureText}
                onSelect={() => setSelectedText(t.id)}
                onChange={(patch, history) => {
                  // An empty patch with `history` is a gesture letting go: the burst
                  // already recorded the whole drag, so just close it.
                  if (history) endBurst();
                  if (history && Object.keys(patch).length === 0) return;
                  updateText(t.id, patch, history);
                }}
                onBeginEdit={beginBurst}
                onRemove={() => removeText(t.id)}
              />
            ))}

            {/* What's selected: a box, resize handles, a rotate knob, and the
                actions for it. Every one of these edits the objects themselves —
                the page is never flattened into a picture to move a word. */}
            {selBounds && (
              <>
                <div
                  className="absolute pointer-events-none border border-[#8A6DE9]/70 rounded-[3px]"
                  style={{
                    left: `${selBounds.x * 100}%`,
                    top: `${selBounds.y * 100}%`,
                    width: `${selBounds.w * 100}%`,
                    height: `${selBounds.h * 100}%`,
                  }}
                />
                {HANDLES.map((h) => {
                  const at = handleAt(h);
                  return (
                    <div
                      key={h}
                      onPointerDown={(e) => startHandle(e, "scale", h)}
                      className="absolute w-3.5 h-3.5 rounded-sm bg-white border border-[#8A6DE9] shadow-sm touch-none z-10"
                      style={{
                        left: `${(selBounds.x + selBounds.w * at.x) * 100}%`,
                        top: `${(selBounds.y + selBounds.h * at.y) * 100}%`,
                        transform: unzoom("translate(-50%, -50%)"),
                        cursor: HANDLE_CURSOR[h],
                      }}
                      title="Drag to resize — corners keep the proportions"
                    />
                  );
                })}
                <div
                  onPointerDown={(e) => startHandle(e, "rotate")}
                  className="absolute w-7 h-7 flex items-center justify-center rounded-full bg-white border border-[#8A6DE9] text-[#8A6DE9] shadow-sm touch-none cursor-grab z-10"
                  style={{
                    left: `${(selBounds.x + selBounds.w / 2) * 100}%`,
                    top: `${(selBounds.y + selBounds.h) * 100}%`,
                    transform: unzoom("translate(-50%, 60%)"),
                  }}
                  title="Drag to rotate — hold shift to snap to 15°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </div>

                <div
                  className="absolute flex items-center gap-0.5 px-1 py-1 rounded-xl bg-white border border-black/10 shadow-lg z-20 whitespace-nowrap"
                  style={{
                    left: `${(selBounds.x + selBounds.w / 2) * 100}%`,
                    top: `${selBounds.y * 100}%`,
                    transform: unzoom("translate(-50%, -120%)"),
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button onClick={() => selAction("duplicate")} className="p-1.5 rounded-lg text-black/60 hover:bg-black/5" title="Duplicate">
                    <CopyPlus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => selAction("copy")} className="p-1.5 rounded-lg text-black/60 hover:bg-black/5" title="Copy (⌘C)">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => selAction("cut")} className="p-1.5 rounded-lg text-black/60 hover:bg-black/5" title="Cut (⌘X)">
                    <Scissors className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={saveSelectionAsSticker} className="p-1.5 rounded-lg text-black/60 hover:bg-black/5" title="Save as a sticker to reuse">
                    <Stamp className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-px h-4 bg-black/10 mx-0.5" />
                  {PEN_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => recolorSelection(c)}
                      className="w-4 h-4 rounded-full hover:scale-110 transition-transform"
                      style={{ background: c }}
                      title="Recolour"
                    />
                  ))}
                  <span className="w-px h-4 bg-black/10 mx-0.5" />
                  <button onClick={() => selAction("front")} className="p-1.5 rounded-lg text-black/60 hover:bg-black/5" title="Bring to front">
                    <BringToFront className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => selAction("back")} className="p-1.5 rounded-lg text-black/60 hover:bg-black/5" title="Send to back">
                    <SendToBack className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-px h-4 bg-black/10 mx-0.5" />
                  <button onClick={() => selAction("delete")} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50" title="Delete (⌫)">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}

            {/* Which edges will turn the page. Purely a hint — the tap itself is
                handled by endStroke, so these must never eat the pointer (a month
                tab often sits right underneath). */}
            {flipGestures && (
              <>
                {page > 1 && (
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-70 transition-opacity">
                    <div className="w-7 h-7 rounded-full bg-white/85 shadow ring-1 ring-black/10 flex items-center justify-center">
                      <ChevronLeft className="w-4 h-4 text-black/60" />
                    </div>
                  </div>
                )}
                {page < pages && (
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-70 transition-opacity">
                    <div className="w-7 h-7 rounded-full bg-white/85 shadow ring-1 ring-black/10 flex items-center justify-center">
                      <ChevronRight className="w-4 h-4 text-black/60" />
                    </div>
                  </div>
                )}
              </>
            )}

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
      </div>

      {/* Page navigation and zoom, at the bottom where a thumb can reach them. */}
      <div className="shrink-0 flex items-center gap-1 px-2 md:px-3 py-1 bg-white/80 backdrop-blur border-t border-black/5 relative z-30">
        <button onClick={() => go(page - 1)} disabled={page <= 1} className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30" title="Previous page">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[11px] text-black/45 tabular-nums w-16 text-center">{page} / {pages}</span>
        <button onClick={() => go(page + 1)} disabled={page >= pages} className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30" title="Next page">
          <ChevronRight className="w-4 h-4" />
        </button>
        {canEditPages && (
          <>
            <button
              onClick={() => setSetupFor({ positions: [page], mode: "apply" })}
              className="p-2 rounded-xl text-black/50 hover:bg-black/5"
              title="Change this page's paper, colour or size"
            >
              <LayoutTemplate className="w-4 h-4" />
            </button>
            <button
              onClick={onAddPage}
              className="p-2 rounded-xl text-black/50 hover:bg-black/5"
              title="Add a page like this one, straight after it"
            >
              <Plus className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => zoomTo(stepZoom(view.z, -1))}
            disabled={isFit(view)}
            className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30"
            title="Zoom out (⌘−)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          {/* One tap in and back out again — the two zooms people actually want. */}
          <button
            onClick={() => (isFit(view) ? zoomTo(2) : setView(FIT))}
            className="text-[11px] text-black/45 tabular-nums w-12 text-center py-1.5 rounded-lg hover:bg-black/5"
            title={isFit(view) ? "Zoom to 200%" : "Back to the whole page (⌘0)"}
          >
            {Math.round(view.z * 100)}%
          </button>
          <button
            onClick={() => zoomTo(stepZoom(view.z, 1))}
            disabled={view.z >= MAX_ZOOM - 1e-3}
            className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30"
            title="Zoom in (⌘+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView(FIT)}
            disabled={isFit(view)}
            className="p-2 rounded-xl text-black/50 hover:bg-black/5 disabled:opacity-30"
            title="Fit the whole page (⌘0)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-black/35 pb-1.5 pt-1 px-4 line-clamp-2 md:line-clamp-none">
        {readOnly
          ? "This is a built-in planner, so it stays as printed — tap the tabs or a day to look around, and make a copy when you want to write in it · tap the side edges, swipe or scroll to turn one page · pinch to zoom in"
          : tool === "shape"
            ? "Draw a shape roughly and let go — a rough circle, box, triangle, line or one-stroke arrow snaps to a clean one · it stays ink, so the lasso can still move, resize and recolour it · anything that isn't a shape is kept exactly as you drew it"
            : tool === "select"
            ? "Draw a loop round some writing (or drag a box) to pick it up · drag it to move, the handles to resize, the knob to rotate · ⌘C, ⌘X and ⌘V move it between pages · ⌫ deletes it · Esc lets it go"
            : paperBacked
              ? "Write anywhere with your Apple Pencil · the Text tool drops a box you can type in · the lasso moves, resizes and recolours what you've written · the page rail adds, copies, reorders and re-papers pages · scroll to turn one page · pinch, or ⌘+scroll, to zoom in and write smaller"
              : "Tap the tabs or a day to jump around · write with your Apple Pencil on the paper · the Text tool drops a box you can type in — tabs and margins stay clear · the lasso picks writing up to move or recolour · scroll, or pick the hand and tap the side edges, to turn one page · pinch to zoom in"}
      </p>

      {setupFor && (
        <PageSetupDialog
          mode={setupFor.mode}
          positions={setupFor.positions}
          initial={index.pages[(setupFor.mode === "insert" ? Math.max(1, setupFor.positions[0] - 1) : setupFor.positions[0]) - 1]}
          planner={planner}
          customTemplates={customTemplates}
          onClose={() => setSetupFor(null)}
          onCreate={(spec, count) => addPages(spec, setupFor.positions[0], count)}
          onApply={(patch) => applyPageSetup(setupFor.positions, patch)}
          onTemplatesChanged={() => { listUserTemplates().then(setCustomTemplates); }}
          onSaveCurrentAsTemplate={saveAsTemplate}
        />
      )}

      {namingSticker && (
        <StickerNameDialog
          initial={namingSticker.name}
          onCancel={() => setNamingSticker(null)}
          onSave={confirmSaveSticker}
        />
      )}
    </div>
  );
}

// ---- text box overlay ----------------------------------------------------------
// A text box lives in normalised page coordinates. It renders as plain positioned
// text; the Text tool turns it into an editable textarea with a drag handle, a
// width handle, and a small format bar. Font size is a fraction of page height so
// it scales with the page.
function TextBoxView({ box, boxSize, scale, selected, editable, outlined, onSelect, onChange, onBeginEdit, onRemove, onMeasure }: {
  box: TextBox;
  boxSize: { w: number; h: number };
  /** The viewer's zoom. The box itself is scaled by it; its handles aren't. */
  scale: number;
  selected: boolean;
  editable: boolean;
  /** Picked out by the selection tool. */
  outlined?: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TextBox>, history?: boolean) => void;
  onBeginEdit: () => void;
  onRemove: () => void;
  /** Report the box's wrapped height (a fraction of page height) for selection. */
  onMeasure?: (id: string, height: number) => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const widthDrag = useRef<{ px: number; w: number } | null>(null);

  useEffect(() => {
    if (selected && editable) areaRef.current?.focus();
  }, [selected, editable]);

  // How tall the text actually wraps to is something only the DOM knows, and the
  // selection tool needs it to draw a box that fits. Layout height, so the viewer's
  // zoom doesn't come into it.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !boxSize.h || !onMeasure) return;
    const report = () => onMeasure(box.id, el.offsetHeight / boxSize.h);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [box.id, boxSize.h, onMeasure]);

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
  // Rotated by the selection tool: still live text, turned about its own middle.
  const spin: React.CSSProperties = box.rot
    ? { transform: `rotate(${box.rot}rad)`, transformOrigin: "center center" }
    : {};

  const startDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    // The whole drag is one undo step, so the box goes back where it came from.
    onBeginEdit();
    drag.current = { px: e.clientX, py: e.clientY, x: box.x, y: box.y };
  };
  // Screen pixels per page unit: the box's layout size times the viewer's zoom, so
  // dragging tracks the pointer whether the page is fitted or zoomed into.
  const perX = boxSize.w * scale;
  const perY = boxSize.h * scale;

  const onDragMove = (e: React.PointerEvent) => {
    if (!drag.current || !perX) return;
    const nx = drag.current.x + (e.clientX - drag.current.px) / perX;
    const ny = drag.current.y + (e.clientY - drag.current.py) / perY;
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
    onBeginEdit();
    widthDrag.current = { px: e.clientX, w: box.w };
  };
  const onWidthMove = (e: React.PointerEvent) => {
    if (!widthDrag.current || !perX) return;
    const nw = widthDrag.current.w + (e.clientX - widthDrag.current.px) / perX;
    onChange({ w: Math.max(0.08, Math.min(1 - box.x, nw)) }, false);
  };

  if (!selected || !editable) {
    // Static text. Clickable to select when the Text tool is active.
    return (
      <div
        ref={rootRef}
        className={`absolute whitespace-pre-wrap break-words ${outlined ? "outline-dashed outline-1 outline-[#8A6DE9]/70" : ""}`}
        style={{ left, top, width, ...common, ...spin, pointerEvents: editable ? "auto" : "none" }}
        onPointerDown={editable ? (e) => { e.stopPropagation(); onSelect(); } : undefined}
      >
        {box.text || (editable ? "" : "")}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="absolute" style={{ left, top, width, ...spin }} onPointerDown={(e) => e.stopPropagation()}>
      {/* Format bar. Counter-scaled, along with the handles below: the text should
          grow with the zoom, but the furniture for editing it stays the size your
          finger is. */}
      <div
        className="absolute -top-10 left-0 flex items-center gap-0.5 px-1 py-1 rounded-xl bg-white border border-black/10 shadow-lg z-10 whitespace-nowrap"
        style={{ transform: `scale(${1 / scale})`, transformOrigin: "left bottom" }}
      >
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
        style={{ transform: `scale(${1 / scale})`, transformOrigin: "top right" }}
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
        onChange={(e) => onChange({ text: e.target.value }, false)}
        // Each visit to the box is its own undo step: focus opens one, leaving ends it.
        onFocus={onBeginEdit}
        onBlur={() => { if (!box.text.trim()) onRemove(); else onChange({}, true); }}
        rows={1}
        placeholder="Type…"
        className="w-full bg-[#8A6DE9]/[0.06] outline outline-1 outline-[#8A6DE9]/60 rounded-md resize-none overflow-hidden px-1 py-0.5"
        style={{ ...common }}
        onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
      />

      {/* Width handle */}
      <div
        className="absolute top-1/2 -right-2 w-4 h-8 -mt-4 flex items-center justify-center rounded bg-white border border-black/10 shadow cursor-ew-resize touch-none z-10"
        style={{ transform: `scale(${1 / scale})`, transformOrigin: "left center" }}
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
