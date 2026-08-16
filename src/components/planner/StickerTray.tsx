"use client";

// The sticker tray: things you've saved off a page, ready to stamp down again.
//
// Every thumbnail here is the sticker's own vector data drawn as SVG — not a picture
// taken of it. So a thumbnail costs nothing to store, can't go stale, and is sharp on
// any screen. See src/lib/planner-elements.ts.

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Stamp, Trash2, X } from "lucide-react";
import { fontStack } from "@/lib/planner-ink";
import { stickerPreview, type SavedElement } from "@/lib/planner-elements";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

/** The sticker drawn as SVG, in its own coordinate space. */
export function StickerThumb({ sticker, className }: { sticker: SavedElement; className?: string }) {
  const p = stickerPreview(sticker);
  return (
    <svg
      viewBox={p.viewBox}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      // A stroke's width is a fraction of the sticker's height, which is exactly what a
      // non-scaling viewBox unit is here, so the nib stays in proportion at any size.
      style={{ overflow: "visible" }}
    >
      {p.strokes.map((s, i) => (
        <path
          key={i}
          d={s.d}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width}
          strokeOpacity={s.opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {p.texts.map((t, i) => (
        <text
          key={`t${i}`}
          x={t.x}
          y={t.y}
          fill={t.color}
          fontSize={t.size}
          style={{ fontFamily: fontStack(t.font) }}
        >
          {t.text}
        </text>
      ))}
    </svg>
  );
}

export interface StickerTrayProps {
  stickers: SavedElement[];
  /** The sticker waiting for a tap on the page, if any. */
  armed: string | null;
  onArm: (sticker: SavedElement | null) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function StickerTray({ stickers, armed, onArm, onRename, onDelete, onClose }: StickerTrayProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const box = useRef<HTMLDivElement>(null);

  // Click-away, so the tray behaves like the popover it looks like. Pointerdown
  // rather than click: the page underneath handles pointer events, and a tray still
  // open over a tap that landed on paper looks stuck. The listener is armed a tick
  // late so the very click that opened the tray doesn't immediately shut it, and it
  // ignores the toggle button (marked below) so that button stays a clean toggle.
  useEffect(() => {
    let armed = false;
    const arm = setTimeout(() => { armed = true; }, 0);
    const away = (e: PointerEvent) => {
      if (!armed) return;
      const t = e.target as HTMLElement;
      if (box.current?.contains(t) || t.closest?.("[data-sticker-toggle]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", away);
    return () => { clearTimeout(arm); document.removeEventListener("pointerdown", away); };
  }, [onClose]);

  return (
    <div
      ref={box}
      className="absolute left-2 top-full mt-1 z-40 w-[19rem] max-h-[60vh] overflow-y-auto rounded-2xl bg-white border border-black/10 shadow-xl p-2.5"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Stamp className="w-3.5 h-3.5 text-black/45" />
        <span className="text-[12.5px] font-bold text-black/70" style={MARKER}>My stickers</span>
        <span className="flex-1" />
        <button onClick={onClose} className="p-1 rounded-lg text-black/35 hover:bg-black/5" title="Close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {!stickers.length ? (
        <p className="text-[11.5px] text-black/45 leading-relaxed px-1 pb-1">
          Select something you&apos;ve written, then tap <Stamp className="w-3 h-3 inline -mt-0.5" /> on
          the selection to keep it here. Stickers stay editable — stamp one down and you can
          still move, resize or recolour it.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {stickers.map((s) => (
            <div
              key={s.id}
              className={`group relative rounded-xl border transition-colors ${
                armed === s.id ? "border-[#8A6DE9] bg-[#8A6DE9]/[0.06]" : "border-black/10 hover:border-black/20 bg-white"
              }`}
            >
              <button
                onClick={() => onArm(armed === s.id ? null : s)}
                className="w-full p-1.5 pb-0 block"
                title={armed === s.id ? "Tap the page to place it" : `Place "${s.name}"`}
              >
                <span className="block h-16 rounded-lg bg-[#FBF7F1] p-1.5">
                  <StickerThumb sticker={s} className="w-full h-full" />
                </span>
              </button>
              {editing === s.id ? (
                <div className="flex items-center gap-1 p-1.5">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { onRename(s.id, draft); setEditing(null); }
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="flex-1 min-w-0 text-[11px] rounded-lg border border-black/10 px-1.5 py-1"
                    maxLength={40}
                  />
                  <button
                    onClick={() => { onRename(s.id, draft); setEditing(null); }}
                    className="p-1 rounded-lg text-[#3E7C17] hover:bg-black/5"
                    title="Rename"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 px-1.5 pb-1.5 pt-1">
                  <span className="flex-1 min-w-0 truncate text-[11px] font-semibold text-black/65" style={MARKER}>
                    {s.name}
                  </span>
                  <button
                    onClick={() => { setEditing(s.id); setDraft(s.name); }}
                    className="p-1 rounded-lg text-black/30 hover:bg-black/5 hover:text-black/60"
                    title="Rename"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDelete(s.id)}
                    className="p-1 rounded-lg text-black/30 hover:bg-red-50 hover:text-red-600"
                    title="Delete this sticker"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Naming a sticker on the way into the tray. */
export function StickerNameDialog({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-xs rounded-3xl bg-white shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Stamp className="w-4 h-4 text-black/50" />
          <span className="text-[13px] font-bold text-black/75" style={MARKER}>Save as a sticker</span>
        </div>
        <p className="text-[11.5px] text-black/45 mb-2.5 leading-relaxed">
          It&apos;s kept as ink, not a picture, so you can stamp it anywhere and still edit it.
        </p>
        <input
          autoFocus
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(name);
            if (e.key === "Escape") onCancel();
          }}
          className="w-full text-[13px] rounded-xl border border-black/10 px-2.5 py-2 mb-2.5"
          placeholder="Sticker name"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-2xl text-[12.5px] font-semibold bg-black/[0.05] text-black/55 hover:bg-black/[0.08]"
            style={MARKER}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(name)}
            className="flex-1 py-2 rounded-2xl text-[12.5px] font-bold bg-[#FFB400] text-black hover:brightness-105"
            style={MARKER}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
