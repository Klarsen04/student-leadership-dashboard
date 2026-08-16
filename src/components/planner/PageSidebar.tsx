"use client";

// The page rail: every page of the notebook down the left, in order.
//
// This is where a notebook stops being a stack of images and starts being a
// document you can rearrange — jump, insert, duplicate, reorder, delete, and
// re-paper a run of pages at once. Each row is the page's real background at
// thumbnail size, so a dotted page looks dotted here too.
//
// Two things keep it usable with a finger on an iPad rather than a mouse:
// reordering happens from a dedicated grip (so a flick still scrolls the list),
// and multi-select is a mode you turn on rather than a modifier key you hold.
// Only the rows near the viewport are rendered, because a planner runs to
// hundreds of pages.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  CornerDownRight,
  FilePlus2,
  GripVertical,
  MoreVertical,
  Plus,
  SquareDashed,
  Trash2,
  X,
} from "lucide-react";
import type { PageMeta, ResolvedBackground } from "@/lib/planner-pages";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

/** Row height in px. Uniform, which is what makes the windowing arithmetic honest. */
const ROW_H = 132;
/** Thumbnail height in px. Exported so the caller can render paper that reads at this size. */
export const THUMB_H = 96;
const OVERSCAN = 4;

export interface PageSidebarProps {
  pages: PageMeta[];
  /** 1-based page being viewed. */
  current: number;
  /** Read-only notebooks can be browsed here but not rearranged. */
  editable: boolean;
  /** Where a page's background comes from — the viewer owns the PDF renderer. */
  background: (page: PageMeta, position: number) => ResolvedBackground;
  /** Render one page of the imported PDF to an image URL. */
  pdfThumb?: (sourcePage: number) => Promise<string>;
  /**
   * What's written on a page, painted at thumbnail size and laid over its paper.
   *
   * `key` is that page's content identity: the rail paints a key once and never again,
   * so writing on one page can't repaint the whole notebook. `tick` changes when some
   * key has changed, which is the rail's cue to look again.
   */
  pageInk?: {
    tick: number;
    key: (page: PageMeta, position: number) => string;
    render: (page: PageMeta, position: number) => Promise<string>;
  };
  /** Page shape, so thumbnails aren't all the same proportions. */
  aspect: (page: PageMeta) => number;
  onJump: (page: number) => void;
  onClose: () => void;
  /** Open the paper picker to insert new pages at this 1-based position. */
  onInsertAt: (at: number) => void;
  onDuplicate: (positions: number[]) => void;
  /** Same paper, nothing written on it — a fresh copy of a page you use as a form. */
  onDuplicateBlank: (positions: number[]) => void;
  onDelete: (positions: number[]) => void;
  onMove: (positions: number[], before: number) => void;
  /** Open the paper picker to re-paper these pages. */
  onSetup: (positions: number[]) => void;
}

export function PageSidebar({
  pages,
  current,
  editable,
  background,
  pdfThumb,
  pageInk,
  aspect,
  onJump,
  onClose,
  onInsertAt,
  onDuplicate,
  onDuplicateBlank,
  onDelete,
  onMove,
  onSetup,
}: PageSidebarProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(720);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ positions: number[]; gap: number } | null>(null);
  // The live drag, mirrored where an event handler can both read and end it. `drag` alone
  // isn't enough: one pointerup reaches `endDrag` twice — once on the grip, once on the
  // list it bubbles to — and both see the same pre-render `drag`, so the page was moved
  // twice. The second move dragged whatever page had shifted into the vacated position,
  // which looked exactly like handwriting being left behind by a reorder.
  const dragRef = useRef<{ positions: number[]; gap: number } | null>(null);

  const count = pages.length;

  // ---- windowing ----
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setViewH(el.clientHeight || 720);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(count, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);
  const visible = useMemo(
    () => pages.slice(start, end).map((page, i) => ({ page, position: start + i + 1 })),
    [pages, start, end],
  );

  // Keep the page you're on in view when it changes from outside (page turn, undo).
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const top = (current - 1) * ROW_H;
    if (top < el.scrollTop || top + ROW_H > el.scrollTop + el.clientHeight) {
      el.scrollTo({ top: Math.max(0, top - el.clientHeight / 2 + ROW_H / 2), behavior: "smooth" });
    }
  }, [current]);

  // ---- PDF thumbnails, fetched only for rows in view ----
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map());
  const asked = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!pdfThumb) return;
    for (const { page, position } of visible) {
      const bg = background(page, position);
      if (bg.kind !== "pdf" || asked.current.has(bg.page)) continue;
      asked.current.add(bg.page);
      const n = bg.page;
      pdfThumb(n)
        .then((src) => { if (src) setThumbs((m) => new Map(m).set(n, src)); })
        .catch(() => asked.current.delete(n));
    }
  }, [visible, background, pdfThumb]);

  // ---- handwriting on the visible rows ----
  // Held per *row*, with the content key alongside it as the staleness test: a row is
  // repainted only when its page's key has moved on, so writing on page 4 leaves pages
  // 1-3 exactly as they were.
  //
  // Keying the store itself by content key looked tidier and was wrong. Painting a page
  // reads its ink, which the viewer then caches — and caching is a content change, so the
  // key ticked over between asking and storing, and the row spent forever looking up a key
  // nothing was ever filed under. By position, a late key just means one more repaint.
  const [inkByPos, setInkByPos] = useState<Map<number, { key: string; src: string }>>(new Map());
  const inkAsked = useRef<Set<string>>(new Set());
  // Guarded on being mounted, not on this effect run: the run is torn down whenever the
  // rail scrolls or a page changes, and a key is only ever asked for once, so dropping
  // in-flight results with the run would lose that page's thumbnail for good.
  // Set on mount as well as cleared on unmount: React remounts every component once in
  // development, and a flag that was only ever cleared stayed cleared.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const tick = pageInk?.tick;
  useEffect(() => {
    if (!pageInk) return;
    for (const { page, position } of visible) {
      const key = pageInk.key(page, position);
      // Up to date already? This is what stops the rail repainting, and it's per *row*:
      // reordering hands a key that has already been painted to a different row, and that
      // row still has to be told about it.
      if (inkByPos.get(position)?.key === key) continue;
      // ...whereas this only stops the same work being started twice while it's in flight,
      // so it's cleared either way when the work finishes. A guard that outlived the
      // request would freeze a row: after a reorder or an undo, the row that inherits an
      // already-painted key would be skipped and keep showing the wrong page's writing.
      const pending = `${position}:${key}`;
      if (inkAsked.current.has(pending)) continue;
      inkAsked.current.add(pending);
      pageInk
        .render(page, position)
        .then((src) => {
          inkAsked.current.delete(pending);
          if (!mounted.current) return;
          setInkByPos((m) => new Map(m).set(position, { key, src }));
        })
        .catch(() => inkAsked.current.delete(pending));
    }
    // `tick` is the signal that some key changed; `pageInk` itself is stable per tick.
  }, [visible, pageInk, tick, inkByPos]);

  // ---- selection ----
  const isSelected = (p: number) => selected.includes(p);
  const toggle = (p: number) =>
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p].sort((a, b) => a - b)));
  const activeSelection = useCallback(
    (p: number) => (selecting && selected.length ? selected : [p]),
    [selecting, selected],
  );
  const clearSelection = () => { setSelected([]); setSelecting(false); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menuFor !== null) setMenuFor(null);
      else if (selecting) clearSelection();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuFor, selecting, onClose]);

  const rowClick = (p: number) => {
    if (selecting) { toggle(p); return; }
    onJump(p);
  };

  // ---- reordering ----
  // Dragging is from the grip only, so the list still scrolls under a finger.
  const gapAt = (clientY: number) => {
    const el = listRef.current;
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top + el.scrollTop;
    return Math.max(1, Math.min(count + 1, Math.round(y / ROW_H) + 1));
  };

  const startDrag = (e: React.PointerEvent, position: number) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const positions = selecting && selected.includes(position) ? selected : [position];
    dragRef.current = { positions, gap: position };
    setDrag(dragRef.current);
    setMenuFor(null);
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const el = listRef.current;
    if (el) {
      // Nudge the list when the pointer reaches either end, so a long notebook can
      // be reordered without letting go.
      const rect = el.getBoundingClientRect();
      if (e.clientY < rect.top + 44) el.scrollTop -= 14;
      else if (e.clientY > rect.bottom - 44) el.scrollTop += 14;
    }
    const gap = gapAt(e.clientY);
    dragRef.current = { ...dragRef.current, gap };
    setDrag((d) => (d ? { ...d, gap } : d));
  };

  const endDrag = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    const live = dragRef.current;
    dragRef.current = null;
    if (!live) return;
    const { positions, gap } = live;
    setDrag(null);
    // Dropping a page back where it already is isn't a move.
    const noop = positions.length === 1 && (gap === positions[0] || gap === positions[0] + 1);
    if (!noop) onMove(positions, gap);
    clearSelection();
  };

  return (
    <aside className="w-[188px] shrink-0 flex flex-col bg-white/85 backdrop-blur border-r border-black/5 relative z-20">
      {/* Header */}
      <div className="flex items-center gap-1 px-2.5 py-2 border-b border-black/5">
        <span className="text-[12.5px] font-bold text-black" style={MARKER}>Pages</span>
        <span className="text-[11px] text-black/35 tabular-nums">{count}</span>
        <div className="flex-1" />
        {editable && (
          <button
            onClick={() => (selecting ? clearSelection() : setSelecting(true))}
            className={`p-1.5 rounded-lg transition-colors ${selecting ? "bg-[#8A6DE9] text-white" : "text-black/40 hover:bg-black/5"}`}
            title={selecting ? "Done selecting" : "Select several pages"}
          >
            <SquareDashed className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={onClose} className="p-1.5 rounded-lg text-black/40 hover:bg-black/5" title="Hide pages">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* The rail */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="relative" style={{ height: count * ROW_H }}>
          {visible.map(({ page, position }) => {
            const bg = background(page, position);
            const src = bg.kind === "image" ? bg.src : bg.kind === "pdf" ? thumbs.get(bg.page) : undefined;
            const ink = inkByPos.get(position)?.src;
            const a = aspect(page) || 0.7;
            const chosen = selecting && isSelected(position);
            const here = position === current;
            return (
              <div
                key={`${page.slot}-${position}`}
                className="absolute left-0 right-0"
                style={{ top: (position - 1) * ROW_H, height: ROW_H }}
                data-page-row={position}
              >
                {/* Insert between pages: a hairline that grows a + on hover. */}
                {editable && (
                  <button
                    onClick={() => onInsertAt(position)}
                    className="group absolute -top-1.5 left-0 right-0 h-3 flex items-center justify-center z-10"
                    title={`Insert a page before page ${position}`}
                  >
                    <span className="h-[2px] flex-1 rounded bg-[#8A6DE9]/0 group-hover:bg-[#8A6DE9]/50 transition-colors" />
                    <span className="mx-1 w-4 h-4 rounded-full bg-[#8A6DE9] text-white items-center justify-center hidden group-hover:flex">
                      <Plus className="w-2.5 h-2.5" />
                    </span>
                    <span className="h-[2px] flex-1 rounded bg-[#8A6DE9]/0 group-hover:bg-[#8A6DE9]/50 transition-colors" />
                  </button>
                )}

                {/* Drop indicator while reordering. */}
                {drag?.gap === position && (
                  <div className="absolute -top-[3px] left-0 right-0 h-[3px] rounded bg-[#FFB400] z-20" />
                )}
                {drag?.gap === count + 1 && position === count && (
                  <div className="absolute -bottom-[3px] left-0 right-0 h-[3px] rounded bg-[#FFB400] z-20" />
                )}

                <div className="group relative flex items-start gap-1.5 pt-1.5">
                  <button
                    onClick={() => rowClick(position)}
                    className="flex flex-col items-center gap-1 flex-1 min-w-0"
                    title={page.label ?? `Page ${position}`}
                    data-page-open={position}
                  >
                    <span
                      className={`relative rounded-md overflow-hidden bg-white transition-all ${
                        here
                          ? "ring-2 ring-[#8A6DE9] shadow-md"
                          : chosen
                            ? "ring-2 ring-[#FFB400]"
                            : "ring-1 ring-black/10 group-hover:ring-black/25"
                      } ${drag?.positions.includes(position) ? "opacity-40" : ""}`}
                      style={{ height: THUMB_H, width: THUMB_H * a }}
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="" className="w-full h-full" draggable={false} loading="lazy" />
                      ) : (
                        <span className="absolute inset-0 bg-black/[0.03]" />
                      )}
                      {/* The handwriting, over the paper — the same vectors the page and
                          an export are drawn from. */}
                      {ink && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ink}
                          alt=""
                          className="absolute inset-0 w-full h-full"
                          draggable={false}
                          data-page-ink={position}
                        />
                      )}
                    </span>
                    <span className={`text-[10.5px] tabular-nums truncate max-w-full ${here ? "text-black font-bold" : "text-black/40"}`}>
                      {page.label ?? position}
                    </span>
                  </button>

                  {editable && (
                    <span className="absolute right-0 top-1.5 flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onPointerDown={(e) => startDrag(e, position)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        className="p-0.5 rounded text-black/30 hover:text-black/60 cursor-grab touch-none"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setMenuFor(menuFor === position ? null : position)}
                        className="p-0.5 rounded text-black/30 hover:text-black/60"
                        title="More"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}

                  {menuFor === position && (
                    <div className="absolute right-1 top-6 z-30 w-[168px] rounded-xl bg-white shadow-xl ring-1 ring-black/10 py-1 text-[12px]">
                      {[
                        { label: "Insert before", icon: Plus, hint: "", run: () => onInsertAt(position) },
                        { label: "Insert after", icon: CornerDownRight, hint: "", run: () => onInsertAt(position + 1) },
                        {
                          label: "Duplicate",
                          icon: Copy,
                          hint: "with the handwriting",
                          run: () => onDuplicate(activeSelection(position)),
                        },
                        {
                          label: "Blank copy",
                          icon: FilePlus2,
                          hint: "same paper, nothing on it",
                          run: () => onDuplicateBlank(activeSelection(position)),
                        },
                        {
                          label: "Change paper",
                          icon: SquareDashed,
                          hint: "template, size or colour",
                          run: () => onSetup(activeSelection(position)),
                        },
                      ].map(({ label, icon: Icon, hint, run }) => (
                        <button
                          key={label}
                          onClick={() => { setMenuFor(null); run(); }}
                          title={hint ? `${label} — ${hint}` : label}
                          data-page-menu={label.toLowerCase().replace(/\s+/g, "-")}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-black/70 hover:bg-black/[0.04]"
                        >
                          <Icon className="w-3.5 h-3.5 text-black/40 shrink-0" />
                          <span className="min-w-0">
                            {label}
                            {hint && <span className="block text-[10px] leading-tight text-black/35">{hint}</span>}
                          </span>
                        </button>
                      ))}
                      <span className="block h-px my-1 bg-black/5" />
                      <button
                        onClick={() => { setMenuFor(null); onDelete(activeSelection(position)); }}
                        disabled={count <= 1}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bulk actions, only once something is picked. */}
      {selecting && selected.length > 0 && (
        <div className="border-t border-black/5 p-2">
          <p className="text-[11px] text-black/45 mb-1.5 px-0.5">
            {selected.length} page{selected.length > 1 ? "s" : ""} selected
          </p>
          <div className="grid grid-cols-4 gap-1">
            <BulkButton icon={Copy} label="Copy" onClick={() => { onDuplicate(selected); clearSelection(); }} />
            <BulkButton
              icon={FilePlus2}
              label="Blank"
              onClick={() => { onDuplicateBlank(selected); clearSelection(); }}
            />
            <BulkButton icon={SquareDashed} label="Paper" onClick={() => { onSetup(selected); clearSelection(); }} />
            <BulkButton
              icon={Trash2}
              label="Delete"
              danger
              disabled={selected.length >= count}
              onClick={() => { onDelete(selected); clearSelection(); }}
            />
          </div>
          <p className="text-[10.5px] text-black/30 mt-1.5 px-0.5">Drag any grip to move them together.</p>
        </div>
      )}

      {editable && !(selecting && selected.length) && (
        <div className="border-t border-black/5 p-2">
          <button
            onClick={() => onInsertAt(count + 1)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold bg-[#FFB400] text-black hover:brightness-105 transition-all"
            style={MARKER}
          >
            <Plus className="w-3.5 h-3.5" /> New page
          </button>
        </div>
      )}
    </aside>
  );
}

function BulkButton({ icon: Icon, label, onClick, danger, disabled }: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[10.5px] font-semibold transition-colors disabled:opacity-40 ${
        danger ? "text-red-600 hover:bg-red-50" : "text-black/60 hover:bg-black/[0.05]"
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
