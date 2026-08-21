"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Hand,
  Pen,
  Brush,
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
  Slash,
  ArrowUpRight,
  Square,
  Circle,
  Triangle,
  Wand2,
  Stamp,
  Download,
  FileText,
  FileImage,
  FileUp,
  Files,
  Loader2,
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
import { isInkTool, marksPaper, routePointer, type InkTool, type InputMode, type Tool } from "@/lib/planner-input";
import {
  DRAG_SHAPE_LABEL,
  DRAG_SHAPES,
  dragShape,
  SHAPE_LABEL,
  snapStroke,
  type DragShape,
} from "@/lib/planner-shapes";
import {
  type UserPlanner,
  PdfRenderer,
  USER_CATEGORY,
  createBlankNotebook,
  deleteUserPlanner,
  attachPdf,
  duplicatePlanner,
  importPdf,
  fileMissing,
  isOwned,
  listUserPlanners,
  renameUserPlanner,
  suggestedCopyName,
  syncUserPlanners,
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
  syncUserTemplates,
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
  placementOffset,
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
  syncSavedElements,
} from "@/lib/planner-elements";
import { ColorPickerButton } from "@/components/planner/ColorPicker";
import { PageSidebar, THUMB_H } from "@/components/planner/PageSidebar";
import { cachedThumb, paintThumb, thumbKey } from "@/lib/planner-thumbs";
import { PageSetupDialog } from "@/components/planner/PageSetupDialog";
import { TOOL_ALPHA, drawStroke, isFlattened, paintElements, paintStrokes, strokeAlpha } from "@/lib/planner-render";
import { type EraserMode, ERASER_SIZES, eraseAt as eraseElements } from "@/lib/planner-erase";
import {
  EXPORT_LONG_EDGE,
  annotatePdf,
  canvasToBlob,
  canvasesToPdf,
  downloadBlob,
  loadImage,
  renderPageCanvas,
  renderSelectionCanvas,
  safeName,
} from "@/lib/planner-export";
import { getFile } from "@/lib/planner-library";
import { StickerNameDialog, StickerTray } from "@/components/planner/StickerTray";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

// ---- page content ------------------------------------------------------------
// Strokes and text boxes are normalised to the page (0..1 in both axes) so
// content stays put at any screen size. See src/lib/planner-ink.ts.
// What each pointer is allowed to do lives in src/lib/planner-input.ts.

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
const HIGHLIGHTER_COLORS = ["#ffd43b", "#a9e34b", "#66d9e8", "#ffa8a8", "#d0bfff", "#ffc078"];

/**
 * Each drawing tool remembers its own colour, thickness and opacity.
 *
 * One shared colour was actively wrong once there was more than one pen: reaching for the
 * highlighter gave you a black highlighter, and going back to the pen gave you a yellow
 * pen. `text` is in here too, so a coloured heading doesn't change what your pen writes in.
 */
type InkPrefKey = InkTool | "shape" | "text";
interface InkPref {
  color: string;
  size: number;
  /** 0..1. Starts at the tool's own default — see TOOL_ALPHA. */
  opacity: number;
}

const DEFAULT_INK_PREFS: Record<InkPrefKey, InkPref> = {
  pen: { color: PEN_COLORS[0], size: PEN_SIZES[1], opacity: TOOL_ALPHA.pen },
  pencil: { color: "#55504a", size: PEN_SIZES[1], opacity: TOOL_ALPHA.pencil },
  marker: { color: PEN_COLORS[1], size: PEN_SIZES[1], opacity: TOOL_ALPHA.marker },
  highlighter: { color: HIGHLIGHTER_COLORS[0], size: PEN_SIZES[1], opacity: TOOL_ALPHA.highlighter },
  shape: { color: PEN_COLORS[0], size: PEN_SIZES[1], opacity: 1 },
  text: { color: PEN_COLORS[0], size: TEXT_SIZES[1], opacity: 1 },
};

/** What to call each tool's ink in a tooltip. */
const TOOL_NAME: Record<InkPrefKey, string> = {
  pen: "Pen",
  pencil: "Pencil",
  marker: "Marker",
  highlighter: "Highlighter",
  shape: "Shape",
  text: "Text",
};

/**
 * The Shapes tool's palette. Keyed by shape rather than listed, so adding one to
 * `DRAG_SHAPES` won't compile until it has an icon and a tooltip here — the picker can't
 * quietly go one shape short of the library.
 */
const SHAPE_PICKER: Record<DragShape, { icon: typeof Slash; title: string }> = {
  line: { icon: Slash, title: "Line — drag from end to end · hold Shift for 45°" },
  arrow: { icon: ArrowUpRight, title: "Arrow — drag from tail to tip · hold Shift for 45°" },
  rectangle: { icon: Square, title: "Rectangle — drag corner to corner · hold Shift for a square" },
  ellipse: { icon: Circle, title: "Ellipse — drag corner to corner · hold Shift for a circle" },
  triangle: { icon: Triangle, title: "Triangle — drag from the apex" },
};

/** Which tool's settings the ink controls are editing. Anything else falls back to the pen. */
const prefKeyFor = (t: Tool): InkPrefKey =>
  t === "shape" || t === "text" || isInkTool(t) ? (t as InkPrefKey) : "pen";

/** What a stroke made by this tool is: the shape tool draws in ordinary pen ink. */
const strokeToolFor = (t: Tool): Stroke["tool"] => (isInkTool(t) ? t : "pen");

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
/** The rotate knob's size on screen (`w-7 h-7`), which its clamp onto the paper needs. */
const KNOB_PX = 28;

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

  // The library is the shipped planners plus the user's own notebooks. Their
  // notebooks come first so they're the first thing seen.
  //
  // This device's copy is shown as soon as it's read, then reconciled with the
  // account: a notebook made on another device appears a moment later rather
  // than the shelf sitting empty while the network answers.
  const reload = useCallback(async () => {
    const [builtIn, mine] = await Promise.all([fetchPlannerIndex(), listUserPlanners()]);
    setPlanners([...mine, ...builtIn]);
    const synced = await syncUserPlanners();
    setPlanners([...synced, ...builtIn]);
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
    (async () => {
      // An import synced from another device has no PDF here, so there's nothing
      // to render. Send it to the library, which offers to add the file — better
      // than opening a notebook that shows blank pages with no explanation.
      if (await fileMissing(info)) {
        if (!cancelled) router.replace("/planner?library=1");
        return;
      }
      const m = await fetchPlannerManifest(info);
      if (!cancelled) setActive(m);
    })();
    return () => { cancelled = true; };
  }, [planners, urlPlanner, showLibrary, router]);

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
  // Which import is waiting for a file, so the same picker serves both "import a
  // new PDF" and "add the PDF for this one".
  const attachTo = useRef<UserPlanner | null>(null);

  useEffect(() => setSelectedId(getSelectedPlannerId()), []);

  const sections = useMemo(() => groupByCategory(planners), [planners]);
  const shown = filter ? sections.filter((s) => s.category === filter) : sections;

  // Imports that reached this device through the account without their PDF. The
  // check reads IndexedDB, so it's done once per library load rather than per card.
  const [missing, setMissing] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    (async () => {
      const ids: string[] = [];
      for (const p of planners) if (await fileMissing(p)) ids.push(p.id);
      if (alive) setMissing(new Set(ids));
    })();
    return () => { alive = false; };
  }, [planners]);

  /** Re-add the PDF for a notebook imported on another device. */
  const onAttach = async (meta: UserPlanner, file: File) => {
    const t = toast.loading(`Adding “${file.name}”…`);
    try {
      await attachPdf(meta, file);
      await onChanged();
      toast.success(`“${meta.name}” is ready on this device`, {
        id: t,
        description: "Your handwriting was waiting on your account.",
      });
      setSelectedPlannerId(meta.id);
      onOpen(meta.id);
    } catch (e: any) {
      toast.error("Couldn't use that PDF", { id: t, description: e?.message?.slice(0, 180) });
    }
  };

  const onImport = async (file: File | undefined) => {
    const attach = attachTo.current;
    attachTo.current = null;
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      toast.error("Please choose a PDF file.");
      return;
    }
    if (attach) {
      if (fileInput.current) fileInput.current.value = "";
      await onAttach(attach, file);
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
                      needsFile={missing.has(p.id)}
                      onOpen={() => onOpen(p.id)}
                      onDuplicate={() => askDuplicate(p)}
                      onDelete={isOwned(p) ? () => setDialog({ mode: "delete", planner: p }) : undefined}
                      onRename={isOwned(p) ? () => setDialog({ mode: "rename", planner: p }) : undefined}
                      onAddFile={() => {
                        attachTo.current = p as UserPlanner;
                        fileInput.current?.click();
                      }}
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
                data-swatch={t.value}
                aria-pressed={tint === t.value}
              />
            ))}
            <ColorPickerButton
              name="tint"
              title="Any colour"
              label="Paper colour"
              color={tint}
              onChange={setTint}
              presets={PAPER_TINTS.map((t) => t.value)}
              className="w-7 h-7 rounded-full ring-1 ring-black/15 flex items-center justify-center hover:scale-105 transition-transform"
            />
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

function PlannerCard({ planner, accent, current, needsFile, onOpen, onDuplicate, onDelete, onRename, onAddFile }: {
  planner: PlannerInfo; accent: string; current: boolean; needsFile?: boolean; onOpen: () => void;
  onDuplicate: () => void; onDelete?: () => void; onRename?: () => void; onAddFile?: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const owned = isOwned(planner); // an import, a copy, or a blank notebook
  const kind = (planner as UserPlanner).kind;
  // No point asking pdf.js for a cover when the file isn't on this device.
  const pdfCover = Boolean(planner.pdfKey) && !needsFile;
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
    : needsFile
      ? null
      : pdfCover
        ? cover
        : imageSrc(planner, 1);
  const badge = kind === "import" ? "Imported" : kind === "copy" ? "Copy" : kind === "blank" ? "Notebook" : null;
  const BadgeIcon = kind === "import" ? FilePlus2 : kind === "copy" ? Copy : NotebookPen;

  return (
    <div
      className="group relative snap-start shrink-0 w-[230px] sm:w-[248px] rounded-3xl bg-white border border-black/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all p-3"
    >
      <button
        onClick={needsFile ? onAddFile : onOpen}
        title={
          needsFile
            ? `“${planner.name}” was imported on another device — add the PDF here to open it`
            : planner.credit ? `${planner.name} — ${planner.credit}` : planner.name
        }
        className="block w-full text-left"
      >
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
          ) : needsFile ? (
            // Imported on another device: the notebook and its handwriting are on
            // the account, but a PDF is too big to sync, so the file is re-added here.
            <div className="px-4 text-center text-black/45">
              <FileUp className="w-7 h-7 mx-auto mb-2 text-[#8A6DE9]" />
              <p className="text-[12px] font-semibold text-black/60" style={MARKER}>Add the PDF</p>
              <p className="text-[11px] mt-0.5 leading-snug">Imported on another device. Your handwriting is safe.</p>
            </div>
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
          {needsFile && onAddFile && (
            <MenuItem
              icon={<FileUp className="w-3.5 h-3.5" />}
              label="Add the PDF"
              onClick={() => { setMenu(false); onAddFile(); }}
            />
          )}
          {!needsFile && (
            <MenuItem
              icon={<Copy className="w-3.5 h-3.5" />}
              label={owned ? "Duplicate" : "Make an editable copy"}
              onClick={() => { setMenu(false); onDuplicate(); }}
            />
          )}
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
  /**
   * Content waiting to be put down: a paste, armed for placement. The next contact on the
   * paper drops it there, and a ghost follows the pointer until then. Paste used to land the
   * copy at the coordinates it was cut from — on another page, that's "somewhere near the
   * top", nowhere near what you were looking at — and then the first press meant to nudge it
   * into place started a fresh lasso instead.
   */
  const [armedPaste, setArmedPaste] = useState<PageElement[] | null>(null);
  /** A selection on its way into the tray, waiting for a name. */
  const [namingSticker, setNamingSticker] = useState<Omit<SavedElement, "id" | "createdAt"> | null>(null);
  /** Export menu open, and a running-export message for the busy overlay. */
  const [exportMenu, setExportMenu] = useState(false);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
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
  /**
   * Per-tool ink settings. The controls in the toolbar read and write the armed tool's
   * entry, so `color`/`size`/`opacity` below are always "what this tool draws with".
   */
  const [inkPrefs, setInkPrefs] = useState<Record<InkPrefKey, InkPref>>(DEFAULT_INK_PREFS);
  const prefKey = prefKeyFor(tool);
  const { color, size, opacity } = inkPrefs[prefKey];
  const setPref = (patch: Partial<InkPref>, key: InkPrefKey = prefKey) =>
    setInkPrefs((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
  const setColor = (c: string) => setPref({ color: c });
  const setSize = (s: number) => setPref({ size: s });
  /** Which way the eraser works, and how big its tip is. */
  const [eraserMode, setEraserMode] = useState<EraserMode>("precise");
  const [eraserSize, setEraserSize] = useState(ERASER_SIZES[1]);
  const [font, setFont] = useState(PLANNER_FONTS[0].key);
  const textSize = inkPrefs.text.size;
  const setTextSize = (s: number) => setPref({ size: s }, "text");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "offline">("saved");
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  /**
   * The selection's action bar, measured: it has to be kept on the paper, and how far in it
   * has to sit depends on how wide it is (which the colour picker and the sticker button make
   * a matter of the build, not a number worth hardcoding).
   */
  const selBarRef = useRef<HTMLDivElement>(null);
  const [selBarSize, setSelBarSize] = useState({ w: 240, h: 36 });
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
  /**
   * The room the page has to fit into, measured rather than guessed.
   *
   * The paper is `aspect-ratio` + `width: 100%` capped by a max-width, and the cap is what
   * keeps its shape: too generous a cap and `max-h-full` clamps the height while the width
   * stays where it was, which stretches the page. A guess at the chrome's height ("viewport
   * minus 150px") was 56px out, so every page rendered ~7% wide — circles weren't round,
   * the eraser tip wasn't circular, and on-screen ink disagreed with the export, which
   * measures against the paper. This is the frame's own content height, so the cap is
   * exact on any screen and after any toolbar reflow.
   */
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameH, setFrameH] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /**
   * Committed strokes are painted once to this offscreen canvas and blitted each frame;
   * the stroke being written goes on its own layer above. Without it, drawing on a page
   * that already holds thousands of strokes repaints every one of them on every pointer
   * move. It's rebuilt only when the committed set, the page size or the zoom changes.
   */
  const inkCacheRef = useRef<HTMLCanvasElement | null>(null);
  /**
   * The element list the cache was painted from. Invalidation is by *identity*, not a
   * flag someone has to remember to set: every path that changes a page swaps in a
   * fresh array, so anything that repaints is compared against this and rebuilt when
   * it differs. The flag version silently missed undo — the cache still held the
   * stroke you'd just taken back, and it stayed on screen until the next edit.
   */
  const inkCachePainted = useRef<PageElement[] | null>(null);
  /**
   * The stroke being drawn right now lives on its own canvas above the committed ink,
   * and only the newest segments are painted to it. Nothing is cleared and nothing is
   * blitted while the pen is down, so the cost of a frame is the length of the last
   * flick rather than the length of the whole stroke.
   */
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  /** The ring showing where the eraser will rub, moved without re-rendering. */
  const eraserTipRef = useRef<HTMLDivElement>(null);
  /** How many of the live stroke's points have already been painted. */
  const livePainted = useRef(0);
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
  /**
   * The gesture in progress: which pointer owns the page, and what it's doing. One at
   * a time (a pinch is the exception, handled on its own). Every pointer event checks
   * this before acting, which is what stops a second pointer — a palm, a stray finger
   * — being handled as if it were the one writing.
   *
   * `rect` is the page box as it was when the gesture began: it can't change mid-
   * gesture (nothing pans or zooms while a pointer owns the page), so measuring it
   * once keeps a layout read out of the per-move path.
   */
  const gestureRef = useRef<{ id: number; mode: InputMode; rect: DOMRect } | null>(null);
  /** True while a pointer is marking the paper, so chrome can ignore a resting hand. */
  const drawingRef = useRef(false);
  const rendererRef = useRef<PdfRenderer | null>(null);
  /** A high-resolution PDF renderer used only while exporting. */
  const exportRendererRef = useRef<PdfRenderer | null>(null);
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
  /** The paste waiting to be placed, mirrored for the same reason. */
  const armedPasteRef = useRef<PageElement[] | null>(null);
  armedPasteRef.current = armedPaste;
  /** Where the ghost of an armed paste is being drawn, so hover can rub it out again. */
  const ghostAt = useRef<[number, number] | null>(null);
  /** The tool the paste was armed under, so arming's own switch to Select isn't a change. */
  const armedTool = useRef<Tool | null>(null);
  /** Set when the stroke being drawn is one the Shapes tool will snap on release. */
  const snapping = useRef(false);
  const [snapped, setSnapped] = useState<string | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Which shape the Shapes tool makes: one you name and drag out, or "auto", where you
   * sketch it and recognition decides. Named is the reliable one and the default —
   * recognition can always decline, and a tool that sometimes refuses is a poor way to
   * draw a box you definitely want.
   */
  const [shapeKind, setShapeKind] = useState<DragShape | "auto">("rectangle");
  const shapeKindRef = useRef(shapeKind);
  shapeKindRef.current = shapeKind;
  /** A named shape being dragged out: where it started, and how hard. */
  const shapeDrag = useRef<{ from: [number, number]; pressure: number } | null>(null);
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

  /**
   * A content stamp per slot, so the rail can tell which page's thumbnail is stale.
   * Bumped wherever a page's elements are replaced — writing, erasing, undo, redo,
   * pasting, duplicating, clearing — and the tick that follows is debounced, because a
   * single eraser drag replaces the page's elements many times over.
   */
  const inkVersions = useRef(new Map<number, number>());
  const [thumbTick, setThumbTick] = useState(0);
  const thumbTimer = useRef<number | null>(null);
  const bumpThumb = useCallback((s: number) => {
    inkVersions.current.set(s, (inkVersions.current.get(s) ?? 0) + 1);
    if (thumbTimer.current !== null) return;
    thumbTimer.current = window.setTimeout(() => {
      thumbTimer.current = null;
      setThumbTick((t) => t + 1);
    }, 180);
  }, []);
  useEffect(() => () => { if (thumbTimer.current !== null) window.clearTimeout(thumbTimer.current); }, []);

  /** Put a slot's content in the cache. The one place that happens, so the rail can't
   *  be left showing a thumbnail of what a page used to hold. */
  const putSlot = useCallback((s: number, els: PageElement[]) => {
    cacheRef.current.set(s, els);
    bumpThumb(s);
  }, [bumpThumb]);

  // The user's own templates, so a page can reference one by id. Pulled from the
  // account, so a template made on one device is there on the next.
  useEffect(() => {
    let alive = true;
    listUserTemplates().then((t) => { if (alive && t.length) setCustomTemplates(t); });
    syncUserTemplates().then((t) => { if (alive) setCustomTemplates(t); });
    return () => { alive = false; };
  }, []);

  // The user's saved stickers, shared across every notebook and every device.
  useEffect(() => {
    let alive = true;
    listSavedElements().then((s) => { if (alive && s.length) setStickers(s); });
    syncSavedElements().then((s) => { if (alive) setStickers(s); });
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

  // While the pen is marking the paper, a touch landing anywhere else is the hand
  // holding the tablet steady — not a button press. It's swallowed in the capture phase,
  // before it reaches whatever it came down on, along with the click the browser would
  // synthesise from it. That's what stops the toolbar and the page rail being pressed at
  // random while writing near them.
  //
  // Deliberately narrow: only touch, only while a stroke is actually in progress, and
  // never for the page box, which sorts its own pointers out. Nothing about the UI
  // changes the rest of the time — it stays as clickable as it ever was.
  useEffect(() => {
    const swallow = (e: Event) => {
      if (!drawingRef.current) return;
      const pt = (e as PointerEvent).pointerType;
      if (pt && pt !== "touch") return; // a real stylus or mouse elsewhere is meant
      if (boxRef.current?.contains(e.target as Node)) return;
      e.stopPropagation();
      e.preventDefault();
    };
    const types = ["pointerdown", "mousedown", "click"];
    for (const t of types) document.addEventListener(t, swallow, true);
    return () => { for (const t of types) document.removeEventListener(t, swallow, true); };
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
    const pw = Math.round(rect.width * dpr);
    const ph = Math.round(rect.height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
      inkCachePainted.current = null; // a resize invalidates the cached bitmap
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Clip strokes to the writable paper so one that strays into the tabs or the outer
    // margin is trimmed rather than painted over the furniture. Text boxes are DOM
    // overlays and clip themselves.
    const wa = writeAreaRef.current;
    const clipPaper = (c: CanvasRenderingContext2D) => {
      c.beginPath();
      c.rect(wa.x * rect.width, wa.y * rect.height, wa.w * rect.width, wa.h * rect.height);
      c.clip();
    };

    // Rebuild the committed-stroke cache only when the set it was painted from is no
    // longer the set on the page — see `inkCachePainted`.
    if (inkCachePainted.current !== elementsRef.current) {
      let cache = inkCacheRef.current;
      if (!cache) { cache = document.createElement("canvas"); inkCacheRef.current = cache; }
      if (cache.width !== pw || cache.height !== ph) { cache.width = pw; cache.height = ph; }
      const cc = cache.getContext("2d");
      if (cc) {
        cc.setTransform(dpr, 0, 0, dpr, 0, 0);
        cc.clearRect(0, 0, rect.width, rect.height);
        cc.save();
        clipPaper(cc);
        // Through `paintStrokes`, so a pencil or a highlighter is laid down whole and
        // looks the same here as it does in an export.
        paintStrokes(cc, elementsRef.current.filter(isStroke), rect.width, rect.height);
        cc.restore();
      }
      inkCachePainted.current = elementsRef.current;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    // Blit the cached committed strokes 1:1 in device pixels, then paint only the live
    // stroke on top — the whole point of the cache.
    if (inkCacheRef.current) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(inkCacheRef.current, 0, 0);
      ctx.restore();
    }
    // The stroke in progress isn't painted here at all — it has its own canvas above
    // this one (see `paintLive`), so a pointer move never touches the committed ink.

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

  /**
   * Paint the stroke being written, on its own canvas above the committed ink.
   *
   * Only the points added since the last call are drawn: nothing is cleared, nothing is
   * blitted, and no React state is touched — so the cost of a frame is the last flick of
   * the pen rather than the length of the stroke or the contents of the page. Called
   * straight from the pointer handler rather than on a frame callback, because the move
   * events are already delivered a frame at a time and waiting for another one only adds
   * latency. Called with no live stroke, it wipes the layer.
   */
  const paintLive = useCallback(() => {
    const canvas = liveCanvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    // The box can't move or resize mid-gesture, so the rect measured at pointerdown is
    // still good — that keeps a layout read out of the hot path.
    const rect = gestureRef.current?.rect ?? box.getBoundingClientRect();
    const dpr = inkPixelRatio(rect.width, rect.height, window.devicePixelRatio || 1);
    const pw = Math.round(rect.width * dpr);
    const ph = Math.round(rect.height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
      livePainted.current = 0; // a resized backing store is a blank one
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const live = liveRef.current;
    if (!live) {
      ctx.clearRect(0, 0, rect.width, rect.height);
      canvas.style.opacity = "1";
      canvas.style.mixBlendMode = "normal";
      livePainted.current = 0;
      return;
    }
    // A see-through stroke (pencil, highlighter, anything with its opacity turned down)
    // is painted at full strength and the *layer* is made see-through, exactly as
    // `paintStrokes` flattens it when it's committed. Painting each new segment at a
    // fraction of alpha instead would darken every join as the pen slowed down, and the
    // stroke would visibly change the moment you lifted the pen.
    const flat = isFlattened(live);
    canvas.style.opacity = flat ? String(strokeAlpha(live)) : "1";
    canvas.style.mixBlendMode = live.tool === "highlighter" ? "multiply" : "normal";
    if (livePainted.current === 0) ctx.clearRect(0, 0, rect.width, rect.height);
    if (live.points.length <= livePainted.current) return;
    const wa = writeAreaRef.current;
    ctx.save();
    ctx.beginPath();
    ctx.rect(wa.x * rect.width, wa.y * rect.height, wa.w * rect.width, wa.h * rect.height);
    ctx.clip();
    drawStroke(ctx, flat ? { ...live, opacity: 1 } : live, rect.width, rect.height, livePainted.current);
    ctx.restore();
    livePainted.current = live.points.length;
  }, []);

  /**
   * A see-through preview of an armed paste, following the pointer. Drawn on the live
   * layer, which is idle while something is armed (a press places it rather than drawing),
   * and from the same `placementOffset` the placement itself uses — so the ghost isn't an
   * approximation of where it will land, it's a picture of it.
   */
  const paintGhost = useCallback((x: number | null, y = 0) => {
    const canvas = liveCanvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const rect = box.getBoundingClientRect();
    const dpr = inkPixelRatio(rect.width, rect.height, window.devicePixelRatio || 1);
    const pw = Math.round(rect.width * dpr);
    const ph = Math.round(rect.height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    canvas.style.opacity = "1";
    canvas.style.mixBlendMode = "normal";
    const clip = armedPasteRef.current;
    if (x === null || !clip?.length) { ghostAt.current = null; return; }
    const off = placementOffset(clip, x, y, pageGeom(), writeAreaRef.current);
    const ghost = translate(clip, new Set(clip.map((el) => elementId(el))), off.dx, off.dy);
    ctx.save();
    ctx.globalAlpha = 0.45;
    paintElements(ctx, ghost, rect.width, rect.height);
    ctx.restore();
    ghostAt.current = [x, y];
  }, [pageGeom]);

  /**
   * A repaint at most once a frame. The pointer handlers that redraw whole-canvas
   * furniture — a lasso being swept, an eraser rubbing strokes out — go through this, so
   * a fast pointer can't queue up more full repaints than the display can show.
   */
  const redrawFrame = useRef(0);
  const scheduleRedraw = useCallback(() => {
    if (redrawFrame.current) return;
    redrawFrame.current = requestAnimationFrame(() => {
      redrawFrame.current = 0;
      redraw();
    });
  }, [redraw]);
  useEffect(() => () => { if (redrawFrame.current) cancelAnimationFrame(redrawFrame.current); }, []);

  /**
   * The style a new stroke starts out with: the tool it was drawn by, and that tool's own
   * colour, thickness and opacity. `opacity` is left off when it's the tool's default, so
   * a stroke drawn now serialises exactly as one drawn before the control existed.
   */
  const strokeStyle = useCallback(
    (t: Tool): Omit<Stroke, "points"> => {
      const pref = inkPrefs[prefKeyFor(t)];
      const tool = strokeToolFor(t);
      return {
        tool,
        color: pref.color,
        size: pref.size,
        ...(pref.opacity === TOOL_ALPHA[tool] ? {} : { opacity: pref.opacity }),
      };
    },
    [inkPrefs],
  );

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

  // How tall the page may be. Watching the frame rather than the page avoids the loop the
  // other way round: the frame is `flex-1` inside a fixed-height column, so its size never
  // depends on the page's. `contentRect` is inside the padding, which is what the page's
  // own `max-h-full` resolves against.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const ro = new ResizeObserver(([entry]) => setFrameH(entry.contentRect.height));
    ro.observe(frame);
    return () => ro.disconnect();
  }, []);

  // The action bar's own size, so the clamp that keeps it on the paper knows how far in it
  // has to sit. Measured while it's up: it only exists when something is selected.
  useEffect(() => {
    const el = selBarRef.current;
    if (!el) return;
    const measure = () => setSelBarSize((s) =>
      s.w === el.offsetWidth && s.h === el.offsetHeight ? s : { w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selection]);

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
    putSlot(forSlot, next);
    scheduleSave(forSlot);
    redraw();
    rerender();
  }, [readOnly, redraw, rerender, scheduleSave, pushOp, putSlot]);

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
    // A page turn is the one case identity can't catch: flipping back to a page reuses
    // the very array the cache was last painted from, while the bitmap now holds the
    // page in between. Say so outright.
    inkCachePainted.current = null;

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
      putSlot(slot, parsed);
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
        putSlot(slot, parsed);
        elementsRef.current = parsed;
        redraw();
        rerender();
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [slot, planner.id, redraw, rerender, saveNow, putSlot]);

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
    exportRendererRef.current?.destroy();
    exportRendererRef.current = null;
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
      // Armed, not dropped: the next contact on the paper decides where it goes. Landing it
      // straight away can only guess, and its old coordinates are the worst guess of all.
      setTool("select");
      applySelection(new Set());
      setArmedSticker(null);
      setArmedPaste(clip);
      armedPasteRef.current = clip;
      // Arming *is* a switch to Select, so remember what it was armed under: only a later
      // change of tool means "never mind".
      armedTool.current = "select";
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

  /**
   * Recolour what's selected. `live` is for a colour being dragged in the picker: the
   * whole drag is folded into one undo step, closed when the picker settles, so undo
   * doesn't have to walk back through every shade the pointer passed over.
   */
  const recolorSelection = useCallback((c: string, live = false) => {
    if (!selectionRef.current.size) return;
    if (live && !burstRef.current) beginBurst();
    setElements(recolor(elementsRef.current, selectionRef.current, c), { history: !live });
  }, [setElements, beginBurst]);

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

  /**
   * Put an armed paste down with its middle at a page-coordinate point, and hand it to the
   * selection so it can be nudged, resized or rotated straight away — one undo step for the
   * whole thing.
   */
  const placePasteAt = useCallback((clip: PageElement[], x: number, y: number) => {
    const off = placementOffset(clip, x, y, pageGeom(), writeAreaRef.current);
    const { elements, ids } = addCopies(elementsRef.current, clip, off);
    beginBurst();
    setElements(elements);
    endBurst();
    applySelection(ids);
    setArmedPaste(null);
    ghostAt.current = null;
  }, [applySelection, setElements, beginBurst, endBurst, pageGeom]);

  /**
   * Change your mind about a paste: it stops waiting, and the ghost goes with it. Escape does
   * this, and so does picking another tool — an armed paste that survived a tool change would
   * swallow the first stroke of whatever you picked instead.
   */
  const cancelPaste = useCallback(() => {
    if (!armedPasteRef.current) return;
    armedPasteRef.current = null;
    armedTool.current = null;
    setArmedPaste(null);
    paintGhost(null);
  }, [paintGhost]);

  /** Escape: nothing is waiting to be placed any more, sticker or paste. */
  const cancelPlacement = useCallback(() => {
    setArmedSticker(null);
    cancelPaste();
  }, [cancelPaste]);

  const renameSticker = useCallback((id: string, name: string) => {
    setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, name: name.trim().slice(0, 40) || s.name } : s)));
    renameSavedElement(id, name).catch(() => {});
  }, []);

  const deleteSticker = useCallback((id: string) => {
    setStickers((prev) => prev.filter((s) => s.id !== id));
    setArmedSticker((a) => (a?.id === id ? null : a));
    deleteSavedElement(id).catch(() => {});
  }, []);

  // ---- export ----
  // Every export is composited fresh from the page's background image and its vector
  // ink — never a screenshot — so it's as crisp as the paper allows. See
  // src/lib/planner-export.ts. A whole-notebook export is capped so a 400-page built-in
  // planner can't try to build a half-gigabyte PDF; what's left out is reported.

  const EXPORT_PAGE_CAP = 120;

  /** Ink for a slot: the cache and the offline mirror first, then the server. */
  const fetchInkFor = useCallback(async (s: number): Promise<PageElement[]> => {
    const cached = cacheRef.current.get(s);
    if (cached) return cached;
    const local = readLocal(planner.id, s);
    if (local) return parseElements(local.json);
    return fetchSlot(planner.id, s);
  }, [planner.id]);

  /**
   * Thumbnails for the page rail: the handwriting on a page, painted small over the
   * paper the rail already draws.
   *
   * `key` is the page's content identity, so the rail paints a version once and holds
   * it — writing on one page never repaints the notebook. Only rows the rail can see
   * ask for one, and the ink comes from the same cache/mirror/server ladder an export
   * uses, so the page being written on costs nothing to keep current.
   */
  const pageInk = useMemo(() => ({
    tick: thumbTick,
    key: (pm: PageMeta, position: number) => {
      const s = pm.slot ?? position;
      return thumbKey(planner.id, s, inkVersions.current.get(s) ?? 0);
    },
    render: async (pm: PageMeta, position: number) => {
      const s = pm.slot ?? position;
      const key = thumbKey(planner.id, s, inkVersions.current.get(s) ?? 0);
      const hit = cachedThumb(key);
      if (hit !== undefined) return hit;
      const els = await fetchInkFor(s);
      return paintThumb(key, els, pageAspect(pm, planner), THUMB_H);
    },
  }), [thumbTick, planner, fetchInkFor]);

  /** The background image for a page, resolved at export resolution. */
  const exportBackground = useCallback(async (pm: PageMeta): Promise<HTMLImageElement | null> => {
    const bg = pm.background;
    let imageUrl: string | undefined;
    if (bg.kind === "template" && bg.templateId) {
      const def = templateFor(bg.templateId, customTemplates);
      if (def?.imageKey) imageUrl = (await templateImageUrl(def)) ?? undefined;
    }
    const resolved = resolveBackground(pm, planner, { customTemplates, imageUrl });
    if (resolved.kind === "image") return loadImage(resolved.src).catch(() => null);
    if (resolved.kind === "pdf" && planner.pdfKey) {
      exportRendererRef.current ??= new PdfRenderer(planner.pdfKey, EXPORT_LONG_EDGE);
      const url = await exportRendererRef.current.page(resolved.page).catch(() => "");
      return url ? loadImage(url).catch(() => null) : null;
    }
    return null;
  }, [customTemplates, planner]);

  /** A finished canvas for one page of the notebook, background and ink composited. */
  const exportPageCanvas = useCallback(async (idx: number) => {
    const pm = indexRef.current.pages[idx];
    const [bg, elements] = await Promise.all([exportBackground(pm), fetchInkFor(pm.slot ?? idx + 1)]);
    return renderPageCanvas({ background: bg, elements, aspect: pageAspect(pm, planner) });
  }, [exportBackground, fetchInkFor, planner]);

  const runExport = useCallback(async (message: string, job: () => Promise<void>) => {
    setExportMenu(false);
    setExportBusy(message);
    try {
      await job();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That export didn't work.");
    } finally {
      setExportBusy(null);
    }
  }, []);

  const exportCurrentPage = useCallback((kind: "png" | "pdf") => {
    runExport(kind === "png" ? "Saving this page as an image…" : "Saving this page as a PDF…", async () => {
      // The on-screen background is already decoded; fall back to a fresh render only if
      // it isn't (a page that hasn't finished loading its picture).
      const bg = bgImgRef.current?.complete ? bgImgRef.current : await exportBackground(pageMeta);
      const canvas = renderPageCanvas({
        background: bg,
        elements: elementsRef.current,
        aspect,
        textHeight: (t) => textHeights.current.get(t.id),
      });
      const stem = `${safeName(planner.name)}-p${page}`;
      if (kind === "png") downloadBlob(await canvasToBlob(canvas), `${stem}.png`);
      else downloadBlob(await canvasesToPdf([{ canvas, hasPhoto: pdfBacked }]), `${stem}.pdf`);
    });
  }, [runExport, exportBackground, pageMeta, aspect, planner.name, page, pdfBacked]);

  const exportSelection = useCallback(() => {
    const ids = selectionRef.current;
    if (!ids.size) return;
    runExport("Saving your selection as an image…", async () => {
      const picked = selectedElements(elementsRef.current, ids);
      const b = selectionBounds(elementsRef.current, ids, pageGeom());
      if (!b) throw new Error("Nothing to export.");
      const canvas = renderSelectionCanvas(picked, b, aspect, (t) => textHeights.current.get(t.id));
      downloadBlob(await canvasToBlob(canvas), `${safeName(planner.name)}-selection.png`);
    });
  }, [runExport, aspect, planner.name, pageGeom]);

  const exportNotebook = useCallback(() => {
    const total = indexRef.current.pages.length;
    const count = Math.min(total, EXPORT_PAGE_CAP);
    runExport(`Building a PDF of ${count} page${count === 1 ? "" : "s"}…`, async () => {
      const canvases: { canvas: HTMLCanvasElement; hasPhoto?: boolean }[] = [];
      for (let i = 0; i < count; i++) canvases.push({ canvas: await exportPageCanvas(i), hasPhoto: pdfBacked });
      downloadBlob(await canvasesToPdf(canvases), `${safeName(planner.name)}.pdf`);
      if (count < total) {
        toast.message(`Exported the first ${count} pages of ${total}.`, {
          description: "That's the per-file limit — export a shorter range if you need the rest.",
        });
      }
    });
  }, [runExport, exportPageCanvas, planner.name, pdfBacked]);

  /** Ink drawn back onto the original PDF, keeping its own text selectable underneath. */
  const exportAnnotatedPdf = useCallback(() => {
    if (!planner.pdfKey) return;
    runExport("Adding your notes to the original PDF…", async () => {
      const blob = await getFile(planner.pdfKey!);
      if (!blob) throw new Error("This notebook's PDF isn't on this device to annotate.");
      const pages = indexRef.current.pages;
      const inkByPage = new Map<number, HTMLCanvasElement>();
      for (const pm of pages) {
        // Only pages that map to a real page of the original PDF can be annotated onto
        // it — inserted template pages have no home in the source document, so they're
        // left out (the whole-notebook PDF export carries those).
        if (pm.background.kind !== "source") continue;
        const sourcePage = pm.background.sourcePage ?? 1;
        const elements = await fetchInkFor(pm.slot ?? sourcePage);
        if (!elements.length) continue;
        // Ink on transparency at the PDF page's own aspect, so it drops on 1:1.
        const canvas = renderPageCanvas({ background: null, elements, aspect: pageAspect(pm, planner), fill: "rgba(0,0,0,0)" });
        inkByPage.set(sourcePage, canvas);
      }
      if (!inkByPage.size) throw new Error("There are no notes on this PDF yet.");
      downloadBlob(await annotatePdf(await blob.arrayBuffer(), inkByPage), `${safeName(planner.name)}-annotated.pdf`);
    });
  }, [runExport, planner, fetchInkFor]);

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
      // Escape first cancels whatever is waiting to be put down, then lets a selection go.
      if (e.key === "Escape" && (armedPasteRef.current || armedStickerRef.current)) {
        cancelPlacement();
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
  }, [page, go, zoomTo, readOnly, selAction, nudgeSelection, applySelection, cancelPlacement]);

  // The selection belongs to the tool that made it: switching away lets it go, so
  // no invisible handles are left holding a page's ink.
  useEffect(() => {
    if (tool !== "select" && selectionRef.current.size) applySelection(new Set());
  }, [tool, applySelection]);

  // A paste doesn't stay armed across a change of tool or a page turn: it would eat the next
  // press, which by then means something else entirely. Arming switches to Select itself, so
  // only a tool other than the one it was armed under counts as a change of mind.
  useEffect(() => {
    if (armedTool.current && armedTool.current !== tool) cancelPaste();
  }, [tool, cancelPaste]);
  useEffect(() => { cancelPaste(); }, [page, plannerId, cancelPaste]);

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


  /** Take ownership of the page for this pointer, and keep the events coming. */
  const beginGesture = (e: React.PointerEvent, mode: InputMode) => {
    const rect = boxRef.current?.getBoundingClientRect() ?? new DOMRect(0, 0, 1, 1);
    gestureRef.current = { id: e.pointerId, mode, rect };
    drawingRef.current = marksPaper(mode);
    // Capture on the box, not the event target: a text box or a handle under the
    // pointer can be re-rendered mid-gesture, and capture on it would be lost.
    boxRef.current?.setPointerCapture(e.pointerId);
  };

  /**
   * The page coordinate of an event, measured against the gesture's own page rect — the
   * box as it was when the gesture began, since it can't move while a pointer owns it.
   * `rect` is passed explicitly where the gesture has already been handed back.
   */
  const gestureNorm = (
    e: { clientX: number; clientY: number },
    rect = gestureRef.current?.rect,
  ): [number, number] => {
    const r = rect ?? boxRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  /**
   * Rub out at one point. The whole drag is one undo step (a burst), so taking back an
   * erase restores everything that gesture removed rather than one tip-width of it.
   * Positions where the tip touched nothing don't reach `setElements` at all.
   */
  const eraseAt = useCallback((x: number, y: number) => {
    const next = eraseElements(
      elementsRef.current,
      { x, y, r: eraserSize, aspect: aspectRef.current },
      eraserMode,
    );
    if (next) setElements(next, { history: false });
  }, [eraserMode, eraserSize, setElements]);

  /**
   * Show the eraser's tip where the pointer is. Positioned straight from the pointer
   * handler — no state, no re-render — so it keeps up with the pen. The tip is a circle
   * on screen: its radius is in width units, so the height has to be corrected by the
   * page's aspect ratio.
   */
  const showEraserTip = useCallback((x: number | null, y = 0) => {
    const tip = eraserTipRef.current;
    if (!tip) return;
    if (x === null) { tip.style.display = "none"; return; }
    const r = eraserSize;
    tip.style.display = "block";
    tip.style.left = `${x * 100}%`;
    tip.style.top = `${y * 100}%`;
    tip.style.width = `${r * 2 * 100}%`;
    tip.style.height = `${r * 2 * aspectRef.current * 100}%`;
  }, [eraserSize]);

  /** A pending tap from this pointer, recorded so a drag can pan and a tap can navigate. */
  const beginTap = (e: React.PointerEvent, opts: { chromeOnly: boolean; flip: boolean }) => {
    beginGesture(e, "navigate");
    tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now(), lx: e.clientX, ly: e.clientY, ...opts };
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
    // A handle is grabbed by whatever is nearest to hand — a finger as readily as the
    // stylus — so this deliberately doesn't ask which kind of pointer it was.
    beginGesture(e, "select");
    const [x, y] = gestureNorm(e);
    beginBurst(); // the whole gesture is one undo step
    dragSel.current = { kind, handle, from: elementsRef.current, bounds: b, x, y };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    // A palm or finger landing while the pen is marking the paper is the hand resting
    // on it. It's swallowed here — and `preventDefault` matters as much as the early
    // return, because without it the browser goes on to synthesise a tap, which is
    // how a resting hand used to press whatever was under it.
    if (drawingRef.current && e.pointerType === "touch") {
      e.preventDefault();
      return;
    }

    // A second finger is a pinch, not a tap: two fingers zoom and pan the page.
    const touches = [...pointers.current.values()].filter((p) => p.type === "touch");
    if (touches.length >= 2) {
      tapStart.current = null;
      gestureRef.current = null;
      const [a, b] = touches;
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return;
    }

    // A pointer already owns the page. A second one doesn't get to interfere.
    if (gestureRef.current) return;

    const [x, y] = norm(e);
    const mode = routePointer({ tool: toolRef.current, pointerType: e.pointerType, readOnly });

    // A sticker or a paste armed for placement: the next contact on the paper puts it
    // down. Off the paper (a tab or the margin) it's ignored, so it can't land where ink
    // is clipped, and the tap goes on to mean whatever it usually means.
    //
    // This comes before every other branch on purpose. While something is armed the next
    // contact has one meaning — "here" — whatever it's made with: a press mustn't start a
    // lasso instead, and a finger mustn't turn the page out from under the thing it was
    // about to place.
    if (!readOnly && (armedStickerRef.current || armedPasteRef.current) && inkAllowed(x, y)) {
      e.preventDefault();
      if (armedStickerRef.current) stampAt(armedStickerRef.current, x, y);
      else placePasteAt(armedPasteRef.current!, x, y);
      return;
    }

    // Anything that isn't marking the paper navigates: taps on tabs and day cells,
    // page turns, and panning a zoomed page.
    if (mode === "navigate") {
      // A stylus in navigate mode is still a stylus: it may only work the printed
      // furniture, never a writable day cell — unless the whole planner is read-only,
      // where there's nothing to write on anyway.
      beginTap(e, { chromeOnly: !readOnly && e.pointerType === "pen", flip: true });
      return;
    }

    if (mode === "select") {
      e.preventDefault();
      beginGesture(e, "select");
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

    if (mode === "text") {
      if (inkAllowed(x, y)) { e.preventDefault(); addTextAt(x, y); }
      else beginTap(e, { chromeOnly: e.pointerType === "pen", flip: false });
      return;
    }

    if (!inkAllowed(x, y)) {
      // Landed on a tab or the outer margin: no ink here, but a tab tap counts.
      beginTap(e, { chromeOnly: true, flip: false });
      return;
    }

    e.preventDefault();
    beginGesture(e, mode);
    if (mode === "erase") {
      beginBurst(); // one drag of the eraser is one undo step
      showEraserTip(x, y);
      eraseAt(x, y);
      return;
    }
    // A named shape is dragged out from here: the stroke is rebuilt from the two ends on
    // every move rather than accumulating the path the pointer took.
    const named = toolRef.current === "shape" && shapeKindRef.current !== "auto";
    shapeDrag.current = named ? { from: [x, y], pressure: e.pressure || 0.5 } : null;
    snapping.current = toolRef.current === "shape" && !named;
    liveRef.current = {
      ...strokeStyle(toolRef.current),
      points: [[x, y, e.pressure || 0.5]],
    };
    livePainted.current = 0;
    paintLive();
  };

  /** Redraw the shape being dragged out, from where it started to where the pointer is. */
  const trackShape = (to: [number, number], constrain: boolean) => {
    const drag = shapeDrag.current;
    const live = liveRef.current;
    if (!drag || !live) return;
    const kind = shapeKindRef.current;
    if (kind === "auto") return;
    const points = dragShape(kind, drag.from, to, aspectRef.current, {
      constrain,
      pressure: drag.pressure,
    });
    live.points = points ?? [[drag.from[0], drag.from[1], drag.pressure]];
    // The whole shape changes shape every frame, so the live layer is repainted rather
    // than extended. It's one shape of at most a hundred points — cheaper than the
    // freehand path it replaces.
    livePainted.current = 0;
    paintLive();
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

    // The eraser tip follows a hovering pointer too, so you can see what it'll take
    // before you touch the paper.
    if (toolRef.current === "eraser" && !readOnly && !gestureRef.current && e.pointerType !== "touch") {
      const [hx, hy] = norm(e);
      showEraserTip(hx, hy);
    }

    // So does an armed paste, so you can see where it's about to land.
    if (armedPasteRef.current && !gestureRef.current) {
      const [hx, hy] = norm(e);
      paintGhost(inkAllowed(hx, hy) ? hx : null, hy);
    }

    // From here on, only the pointer that owns the page is listened to, and only in the
    // mode it claimed at pointerdown. This is what stops one gesture being handled as
    // another: before, a palm's pan was checked ahead of the pen's own moves, so while
    // zoomed in a resting hand quietly ate the stroke being written.
    const g = gestureRef.current;
    if (!g || g.id !== e.pointerId) return;

    if (g.mode === "draw") {
      e.preventDefault();
      const live = liveRef.current;
      if (!live) return;
      if (shapeDrag.current) {
        trackShape(gestureNorm(e), e.shiftKey);
        return;
      }
      // Coalesced events give the full high-frequency pen path — every sample the
      // digitiser took between frames, pressure included. Some inputs and browsers hand
      // back an empty list, so fall back to the event itself.
      const coalesced = (e.nativeEvent as PointerEvent).getCoalescedEvents?.();
      const events = coalesced?.length ? coalesced : [e.nativeEvent as PointerEvent];
      const { rect } = g;
      for (const ev of events) {
        live.points.push([
          (ev.clientX - rect.left) / rect.width,
          (ev.clientY - rect.top) / rect.height,
          ev.pressure || 0.5,
        ]);
      }
      // Straight to the canvas: no React state is touched while the pen is down, so
      // nothing here re-renders the page.
      paintLive();
      return;
    }

    if (g.mode === "erase") {
      e.preventDefault();
      const [x, y] = gestureNorm(e);
      showEraserTip(x, y);
      eraseAt(x, y);
      return;
    }

    // A selection gesture: sweeping a region, or transforming what's picked.
    if (g.mode === "select") {
      e.preventDefault();
      const [x, y] = gestureNorm(e);
      const m = marquee.current;
      if (m) {
        if (m.mode === "rect") marquee.current = { mode: "rect", a: m.a, b: [x, y] };
        else m.points.push([x, y]);
        scheduleRedraw();
        return;
      }
      applyDrag(x, y, e.shiftKey);
      return;
    }

    // Zoomed in, a navigating pointer drags the page about.
    const tap = tapStart.current;
    if (g.mode === "navigate" && tap && !isFit(viewRef.current)) {
      const dx = e.clientX - tap.lx, dy = e.clientY - tap.ly;
      tap.lx = e.clientX;
      tap.ly = e.clientY;
      if (dx || dy) setView((v) => panBy(v, dx, dy, layout()));
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

    // Only the pointer holding the page finishes anything, and the page is handed back
    // here — before any of the work below — so no mode can outlive the pointer that
    // claimed it. Everything else (a palm that was swallowed, a stray finger) lifts
    // without effect.
    const g = gestureRef.current;
    if (!g || g.id !== e.pointerId) return;
    gestureRef.current = null;
    drawingRef.current = false;

    // A selection gesture finishing.
    if (g.mode === "select") {
      const m = marquee.current;
      const transform = dragSel.current;
      marquee.current = null;
      dragSel.current = null;
      if (transform) {
        endBurst(); // the next gesture is a new undo step
        redraw();
        return;
      }
      if (!m) return;
      const [x, y] = gestureNorm(e, g.rect);
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

    if (g.mode === "draw") {
      const live = liveRef.current;
      liveRef.current = null;
      // A named shape: what's on the live layer is already the shape, ideal points and
      // all, so it's committed as it stands — no recognition, nothing to decline. A drag
      // too short to be a shape commits nothing rather than leaving a dot behind.
      const named = shapeDrag.current;
      shapeDrag.current = null;
      if (named && live) {
        const kind = shapeKindRef.current;
        const points =
          kind === "auto"
            ? null
            : dragShape(kind, named.from, gestureNorm(e, g.rect), aspectRef.current, {
                constrain: e.shiftKey,
                pressure: named.pressure,
              });
        if (points) {
          setElements([...elementsRef.current, { ...live, points }]);
          setSnapped(kind === "auto" ? null : DRAG_SHAPE_LABEL[kind]);
          if (snapTimer.current) clearTimeout(snapTimer.current);
          snapTimer.current = setTimeout(() => setSnapped(null), 900);
        }
        paintLive();
        return;
      }
      if (live) {
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
        // Commit first — that repaints the committed ink with this stroke in it — and
        // only then wipe the live layer, so the stroke is never off both canvases at once.
        setElements([...elementsRef.current, snap?.kind ? snap.stroke : simplifyStroke(live)]);
      }
      paintLive();
      return;
    }

    if (g.mode === "erase") {
      endBurst(); // the next drag is a new undo step
      showEraserTip(null);
      return;
    }
    if (g.mode === "text") return;

    // Tap navigation (finger, hand tool, or a stylus tap on a tab).
    const start = tapStart.current;
    tapStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const moved = Math.hypot(dx, dy);
    const [x, y] = gestureNorm(e, g.rect);
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
      if (gestureRef.current) return; // a gesture owns the page; don't move it under them
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
      putSlot(op.slot, next);
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
  }, [redraw, rerender, scheduleSave, putSlot]);

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
    putSlot(s, []);
    clearLocal(planner.id, s);
    await clearSlot(planner.id, s);
  }, [planner.id, putSlot]);

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

  /**
   * Duplicate pages, with or without what's written on them.
   *
   * Both are real operations on the same page metadata — same paper, colour, size and
   * orientation — and they differ only in whether the handwriting comes too. A blank
   * duplicate is how you use a page you've laid out as a form: a fresh copy to fill in,
   * not a copy of last week's answers.
   */
  const duplicatePagesAt = useCallback(async (positions: number[], withContent = true) => {
    flushPending();
    const res = duplicatePages(indexRef.current, positions, { content: withContent });
    if (!res.slots.length) return;
    const targets = new Set(res.slots);

    // A recycled target can still hold a deleted page's handwriting. Blank it here,
    // before anything is copied in, so an empty source doesn't leave the old ink
    // sitting on the copy. applyPageOp is told to skip these for the same reason.
    // For a blank duplicate every target is blanked, recycled or not, because "blank"
    // has to be true of the page on the server as well as in this tab.
    for (const s of res.slots) if (!withContent || res.clear.includes(s)) await blankSlot(s);

    // The copy we're about to land on needs its content in the cache *before* the
    // page changes: the loader would otherwise find the slot empty, show a blank
    // page, and its fetch would land after the copy and wipe it again.
    const landing = res.index.pages[res.at - 1]?.slot;
    const seeded = new Map<number, PageElement[]>();
    const landingCopy = res.copies.find((c) => c.to === landing);
    if (landingCopy) {
      const content = cacheRef.current.get(landingCopy.from) ?? (await fetchSlot(planner.id, landingCopy.from));
      seeded.set(landingCopy.to, content);
      putSlot(landingCopy.to, content);
    }

    await applyPageOp(
      withContent
        ? res.slots.length > 1 ? `Duplicated ${res.slots.length} pages` : "Duplicated a page"
        : res.slots.length > 1 ? `Added ${res.slots.length} blank pages` : "Added a blank page",
      res.index,
      { toPage: res.at, clear: res.clear.filter((s) => !targets.has(s)) },
    );

    // Content is copied slot by slot. What's already in memory is newer than the
    // server (it may not have synced yet), so it wins when we have it; otherwise
    // the server copies the row across without downloading the page.
    for (const { from, to } of res.copies) {
      const content = seeded.get(to) ?? cacheRef.current.get(from);
      if (content) {
        putSlot(to, content);
        if (content.length) await saveNow(to);
      } else if (!(await copySlot(planner.id, from, to))) {
        toast.error("The copy's handwriting didn't save — check your connection.");
      }
    }
    redraw();
    rerender();
  }, [applyPageOp, blankSlot, flushPending, planner.id, saveNow, redraw, rerender, putSlot]);

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
      onClick={() => { setTool(t); setSelectedText(null); if (t !== "eraser") showEraserTip(null); }}
      title={title}
      // A stable handle for tests: the tooltip explains the tool, so its wording changes.
      data-tool={t}
      aria-pressed={tool === t}
      className={`p-2 rounded-xl transition-colors ${tool === t ? "bg-[#FFB400] text-black shadow-sm" : "text-black/50 hover:bg-black/5"}`}
    >
      {icon}
    </button>
  );

  const textBoxes = elementsRef.current.filter(isText);
  const showInkControls = isInkTool(tool) || tool === "shape";
  /** The swatches offered for the armed tool: a highlighter wants bright, not black. */
  const swatches = tool === "highlighter" ? HIGHLIGHTER_COLORS : PEN_COLORS;
  // The box round the selection, in page coordinates: where the handles and the
  // action bar hang. Recomputed each render, so it follows a drag frame by frame.
  const selBounds = tool === "select" && selection.size ? selectionBounds(elementsRef.current, selection, pageGeom()) : null;
  /** What the selection is currently coloured, so the picker opens on it rather than black. */
  const selectionColor = selBounds ? selectedElements(elementsRef.current, selection)[0]?.color : undefined;
  /**
   * Selection furniture counter-scales with the zoom, so a handle stays the size of
   * a finger at 6× instead of covering a quarter of the page. `scale()` comes first
   * in the transform so the offsets after it are scaled too — that's what keeps a
   * handle centred on its corner and the bar a constant gap above the box.
   */
  const unzoom = (offset: string) => `scale(${1 / view.z}) ${offset}`;

  /**
   * A screen size, as a fraction of the page. Selection furniture is counter-scaled, so its
   * footprint on the page shrinks as you zoom in — which is why the zoom is in here.
   */
  const asFraction = (px: number, axis: "w" | "h") =>
    boxSize[axis] ? px / (view.z * boxSize[axis]) : 0;

  /**
   * Where the knob and the action bar are anchored. Both hang *outside* the selection's box,
   * and the paper clips what leaves it (`overflow-hidden`), so writing along an edge used to
   * put its own controls off the page: a stroke at the foot of a page had its rotate knob cut
   * off and simply couldn't be turned. The anchors are pulled back inside instead — at the
   * page's edge the control overlaps the selection rather than disappearing off it.
   */
  const knobAnchor = selBounds && {
    x: Math.min(Math.max(selBounds.x + selBounds.w / 2, asFraction(KNOB_PX / 2, "w")), 1 - asFraction(KNOB_PX / 2, "w")),
    y: Math.min(selBounds.y + selBounds.h, 1 - asFraction(KNOB_PX * 1.6, "h")),
  };
  const barAnchor = selBounds && {
    x: Math.min(Math.max(selBounds.x + selBounds.w / 2, asFraction(selBarSize.w / 2, "w")), 1 - asFraction(selBarSize.w / 2, "w")),
    y: Math.max(selBounds.y, asFraction(selBarSize.h * 1.2, "h")),
  };

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
            <ToolButton t="pen" icon={<Pen className="w-4 h-4" />} title="Pen — crisp ink, pressure-sensitive" />
            <ToolButton t="pencil" icon={<Pencil className="w-4 h-4" />} title="Pencil — soft graphite, shades with pressure" />
            <ToolButton t="marker" icon={<Brush className="w-4 h-4" />} title="Marker — a broad felt tip, one steady width" />
            <ToolButton t="highlighter" icon={<Highlighter className="w-4 h-4" />} title="Highlighter — see-through, never covers your writing" />
            <ToolButton t="shape" icon={<Shapes className="w-4 h-4" />} title="Shapes — pick a line, arrow, box, ellipse or triangle and drag it out, or sketch one roughly and let it snap" />
            <ToolButton t="text" icon={<Type className="w-4 h-4" />} title="Text box (tap the paper to type)" />
            <ToolButton t="select" icon={<Lasso className="w-4 h-4" />} title="Select — move, resize, recolour or copy what you've written" />
            <ToolButton t="eraser" icon={<Eraser className="w-4 h-4" />} title="Eraser" />
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
        <div className="relative">
          <button
            data-export-toggle
            onClick={() => setExportMenu((o) => !o)}
            className={`p-2 rounded-xl transition-colors ${exportMenu ? "bg-black/[0.07] text-black/70" : "text-black/50 hover:bg-black/5"}`}
            title="Export as PNG or PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          {exportMenu && (
            <ExportMenu
              onClose={() => setExportMenu(false)}
              hasSelection={tool === "select" && selection.size > 0}
              pdfBacked={pdfBacked}
              onPagePng={() => exportCurrentPage("png")}
              onPagePdf={() => exportCurrentPage("pdf")}
              onSelectionPng={exportSelection}
              onNotebookPdf={exportNotebook}
              onAnnotatedPdf={exportAnnotatedPdf}
            />
          )}
        </div>
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

      {/* Tool options.

          Its own row, always present, always the same height. When these controls
          shared the row above, switching from the pen to the eraser dropped the
          toolbar from two lines to one and the paper jumped 36px up the screen —
          so a stylus that had been resting on a word was suddenly over a different
          one. The row never wraps either; it scrolls sideways if it has to.

          It ranks below the row above, so the export and sticker menus hanging down
          from that row aren't covered by this one. */}
      {!readOnly && (
        <div className="flex items-center gap-1 px-3 h-11 bg-white/80 backdrop-blur border-b border-black/5 shrink-0 z-20 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {showInkControls && (
            <>
              <div className="flex items-center gap-1 ml-1">
                {swatches.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-1 ring-black/40 scale-110" : "hover:scale-110"}`}
                    style={{ background: c }}
                    title={`${TOOL_NAME[prefKey]} colour`}
                    data-swatch={c}
                    aria-pressed={color === c}
                  />
                ))}
                {/* Any colour at all, kept per tool like the presets are. */}
                <ColorPickerButton
                  name={prefKey}
                  title={`${TOOL_NAME[prefKey]} — any colour`}
                  label={`${TOOL_NAME[prefKey]} colour`}
                  color={color}
                  onChange={setColor}
                  presets={swatches}
                  alpha={opacity}
                  onAlphaChange={(a) => setPref({ opacity: a })}
                />
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
              {/* How see-through this tool is. Kept per tool, so turning the highlighter
                  down doesn't fade the pen. */}
              <label className="flex items-center gap-1.5 ml-1" title="How see-through this tool is">
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={Math.round(opacity * 100)}
                  onChange={(e) => setPref({ opacity: Number(e.target.value) / 100 })}
                  className="w-16 accent-[#8A6DE9]"
                  aria-label="Opacity"
                />
                <span className="text-[10px] text-black/40 tabular-nums w-7">{Math.round(opacity * 100)}%</span>
              </label>
            </>
          )}

          {tool === "eraser" && (
            <div className="flex items-center gap-1 ml-1">
              <div className="flex items-center gap-0.5 rounded-xl bg-black/[0.04] p-0.5">
                {([
                  ["precise", "Precise", "Precise — rubs out only the bit you touch, and leaves the rest of the stroke exactly as you drew it"],
                  ["stroke", "Whole stroke", "Whole stroke — touch a stroke anywhere and all of it goes"],
                ] as const).map(([m, label, title]) => (
                  <button
                    key={m}
                    onClick={() => setEraserMode(m)}
                    title={title}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${eraserMode === m ? "bg-white shadow-sm text-black/75" : "text-black/40 hover:bg-black/5"}`}
                    style={MARKER}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-0.5">
                {ERASER_SIZES.map((r, i) => (
                  <button
                    key={r}
                    onClick={() => setEraserSize(r)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${eraserSize === r ? "bg-black/10" : "hover:bg-black/5"}`}
                    title={`${["Small", "Medium", "Large"][i]} tip`}
                  >
                    <span className="rounded-full border border-black/50" style={{ width: 5 + i * 4, height: 5 + i * 4 }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool === "shape" && (
            <div className="flex items-center gap-1 ml-1">
              {/* Which shape. Pick one and drag it out; "Sketch" hands the drawing to
                  recognition instead, which is the older, cleverer, less certain way. */}
              <div className="flex items-center gap-0.5 rounded-xl bg-black/[0.04] p-0.5">
                {DRAG_SHAPES.map((k) => {
                  const { icon: Icon, title } = SHAPE_PICKER[k];
                  return (
                    <button
                      key={k}
                      onClick={() => setShapeKind(k)}
                      title={title}
                      data-shape={k}
                      aria-pressed={shapeKind === k}
                      className={`p-1.5 rounded-lg transition-colors ${shapeKind === k ? "bg-white shadow-sm text-black/75" : "text-black/40 hover:bg-black/5"}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
                <span className="w-px h-4 bg-black/10 mx-0.5" />
                <button
                  onClick={() => setShapeKind("auto")}
                  title="Sketch — draw a shape roughly and let go, and it snaps to whichever one it was · anything that isn't a shape is kept as you drew it"
                  data-shape="auto"
                  aria-pressed={shapeKind === "auto"}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${shapeKind === "auto" ? "bg-white shadow-sm text-black/75" : "text-black/40 hover:bg-black/5"}`}
                  style={MARKER}
                >
                  <Wand2 className="w-3.5 h-3.5" /> Sketch
                </button>
              </div>
              <span
                className={`text-[11px] font-semibold px-2 py-1 rounded-full ${snapped ? "bg-[#8A6DE9]/12 text-[#6F55C7]" : "text-black/35"}`}
                style={MARKER}
              >
                {snapped ??
                  (shapeKind === "auto"
                    ? "draw roughly — it'll snap"
                    : `drag out a ${DRAG_SHAPE_LABEL[shapeKind].toLowerCase()}`)}
              </span>
            </div>
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
                    data-swatch={c}
                    aria-pressed={color === c}
                  />
                ))}
                <ColorPickerButton
                  name="text"
                  title="Text — any colour"
                  label="Text colour"
                  color={color}
                  onChange={setColor}
                  presets={PEN_COLORS}
                />
              </div>
            </div>
          )}
          {tool === "hand" && (
            <span className="text-[11px] text-black/35" style={MARKER}>
              Tap tabs, days and links — or drag to move the page
            </span>
          )}
        </div>
      )}

      {/* Page rail + page */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {sidebar && (
          <PageSidebar
            pages={index.pages}
            current={page}
            editable={canEditPages}
            background={thumbBackground}
            pdfThumb={pdfBacked ? pdfThumb : undefined}
            pageInk={pageInk}
            aspect={(p) => pageAspect(p, planner)}
            onJump={go}
            onClose={() => setSidebar(false)}
            onInsertAt={(at) => setSetupFor({ positions: [at], mode: "insert" })}
            onDuplicate={(positions) => duplicatePagesAt(positions, true)}
            onDuplicateBlank={(positions) => duplicatePagesAt(positions, false)}
            onDelete={deletePagesAt}
            onMove={movePagesTo}
            onSetup={(positions) => setSetupFor({ positions, mode: "apply" })}
          />
        )}

        <div ref={frameRef} className="flex-1 flex items-center justify-center p-2 md:p-4 overflow-hidden">
          <div
            ref={boxRef}
            className="group relative w-full max-h-full shadow-xl rounded-lg overflow-hidden select-none"
            // The width cap is what keeps the shape: with `width: 100%` a max-height
            // alone would clamp the height and leave the page stretched. It comes from
            // the frame's measured height (see `frameH`), with the old estimate standing
            // in for the one frame before the observer has reported.
            style={{
              aspectRatio: `${aspect}`,
              maxWidth: frameH
                ? `min(100%, ${frameH * aspect}px)`
                : `min(100%, calc((var(--planner-vh) - 150px) * ${aspect}))`,
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
            onPointerLeave={() => {
              if (gestureRef.current) return;
              showEraserTip(null);
              if (armedPasteRef.current) paintGhost(null);
            }}
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
            {/* The stroke being written, on its own layer directly above the committed
                ink: while the pen is down only this canvas is touched, and only its
                newest segments. Nothing below it is cleared, blitted or re-rendered. */}
            <canvas ref={liveCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

            {/* Where the eraser will rub. Hidden until the eraser is over the page, and
                moved by `showEraserTip` rather than by rendering. */}
            <div
              ref={eraserTipRef}
              className="absolute rounded-full pointer-events-none border border-black/40 bg-black/[0.06]"
              style={{ display: "none", transform: "translate(-50%, -50%)" }}
            />

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
                    left: `${knobAnchor!.x * 100}%`,
                    top: `${knobAnchor!.y * 100}%`,
                    transform: unzoom("translate(-50%, 60%)"),
                  }}
                  title="Drag to rotate — hold shift to snap to 15°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </div>

                <div
                  ref={selBarRef}
                  className="absolute flex items-center gap-0.5 px-1 py-1 rounded-xl bg-white border border-black/10 shadow-lg z-20 whitespace-nowrap"
                  style={{
                    left: `${barAnchor!.x * 100}%`,
                    top: `${barAnchor!.y * 100}%`,
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
                      data-recolor={c}
                    />
                  ))}
                  <ColorPickerButton
                    name="selection"
                    title="Recolour — any colour"
                    label="Recolour"
                    color={selectionColor ?? color}
                    onChange={(c) => recolorSelection(c, true)}
                    onCommit={endBurst}
                    presets={PEN_COLORS}
                    className="relative w-4 h-4 rounded-full ring-1 ring-black/15 flex items-center justify-center hover:scale-110 transition-transform"
                  />
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
            data-zoom
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

      {/* The hint changes with the tool, and a two-line hint gave the paper less room
          than a one-line one — so picking the lasso resized the page. Two lines are
          reserved whatever it says, and anything longer is clamped. */}
      <p className="h-9 shrink-0 flex items-center justify-center text-center text-[11px] leading-[1.15] text-black/35 px-4">
        <span className="line-clamp-2">
        {armedPaste
          ? `${armedPaste.length === 1 ? "That copy is" : `Those ${armedPaste.length} pieces are`} waiting to be placed — tap the page where you want the middle of it and it lands there, picked up ready to nudge, resize or rotate · Esc leaves it on the clipboard`
          : readOnly
          ? "This is a built-in planner, so it stays as printed — tap the tabs or a day to look around, and make a copy when you want to write in it · tap the side edges, swipe or scroll to turn one page · pinch to zoom in"
          : tool === "shape"
            ? shapeKind === "auto"
              ? "Draw a shape roughly and let go — a rough circle, box, triangle, line or one-stroke arrow snaps to a clean one · anything that isn't a shape is kept exactly as you drew it"
              : `Drag out a ${DRAG_SHAPE_LABEL[shapeKind].toLowerCase()} — it follows the pointer until you let go, hold Shift to keep it regular · it stays ink, so the lasso can still move, resize, rotate and recolour it`
            : tool === "select"
            ? "Draw a loop round some writing (or drag a box) to pick it up · drag it to move, the handles to resize, the knob to rotate · ⌘C, ⌘X and ⌘V move it between pages · ⌫ deletes it · Esc lets it go"
            : paperBacked
              ? "Write anywhere with your Apple Pencil · the Text tool drops a box you can type in · the lasso moves, resizes and recolours what you've written · the page rail adds, copies, reorders and re-papers pages · scroll to turn one page · pinch, or ⌘+scroll, to zoom in and write smaller"
              : "Tap the tabs or a day to jump around · write with your Apple Pencil on the paper · the Text tool drops a box you can type in — tabs and margins stay clear · the lasso picks writing up to move or recolour · scroll, or pick the hand and tap the side edges, to turn one page · pinch to zoom in"}
        </span>
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

      {exportBusy && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white shadow-xl">
            <Loader2 className="w-4 h-4 animate-spin text-[#8A6DE9]" />
            <span className="text-[13px] font-semibold text-black/70" style={MARKER}>{exportBusy}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- export menu ---------------------------------------------------------------
function ExportMenu({
  onClose,
  hasSelection,
  pdfBacked,
  onPagePng,
  onPagePdf,
  onSelectionPng,
  onNotebookPdf,
  onAnnotatedPdf,
}: {
  onClose: () => void;
  hasSelection: boolean;
  pdfBacked: boolean;
  onPagePng: () => void;
  onPagePdf: () => void;
  onSelectionPng: () => void;
  onNotebookPdf: () => void;
  onAnnotatedPdf: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let armed = false;
    const t = setTimeout(() => { armed = true; }, 0);
    const away = (e: PointerEvent) => {
      if (!armed) return;
      const el = e.target as HTMLElement;
      if (box.current?.contains(el) || el.closest?.("[data-export-toggle]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", away);
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", away); };
  }, [onClose]);

  const Item = ({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-black/[0.05] transition-colors"
    >
      <span className="text-black/45">{icon}</span>
      <span className="flex flex-col">
        <span className="text-[12.5px] font-semibold text-black/75" style={MARKER}>{label}</span>
        {hint && <span className="text-[10.5px] text-black/40">{hint}</span>}
      </span>
    </button>
  );

  return (
    <div
      ref={box}
      className="absolute right-0 top-full mt-1 z-40 w-60 rounded-2xl bg-white border border-black/10 shadow-xl p-1.5"
    >
      <p className="px-2.5 pt-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-black/35">This page</p>
      <Item icon={<FileImage className="w-4 h-4" />} label="Image (PNG)" onClick={onPagePng} />
      <Item icon={<FileText className="w-4 h-4" />} label="PDF" onClick={onPagePdf} />
      {hasSelection && (
        <Item icon={<FileImage className="w-4 h-4" />} label="Selection (PNG)" hint="Just what's selected" onClick={onSelectionPng} />
      )}
      <div className="my-1 h-px bg-black/[0.06]" />
      <p className="px-2.5 pt-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-black/35">Whole notebook</p>
      <Item icon={<Files className="w-4 h-4" />} label="PDF" hint="Every page, background and notes" onClick={onNotebookPdf} />
      {pdfBacked && (
        <Item
          icon={<FileText className="w-4 h-4" />}
          label="Annotated PDF"
          hint="Original PDF with your notes on top"
          onClick={onAnnotatedPdf}
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
