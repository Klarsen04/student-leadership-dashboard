"use client";

// The colour picker: a saturation/value square, a hue slider, opacity, a hex box, the
// presets for whatever you're colouring, and the colours you've used lately.
//
// Two things it's careful about:
//
//  - **hue survives.** The panel holds HSV of its own rather than deriving it from the hex
//    every render, because hex can't carry the hue of black or of a fully desaturated
//    grey: dragging value down to the bottom and back up would otherwise come back red.
//    The prop is only re-read when it changes to something the panel didn't produce.
//  - **it drags with a finger or a stylus.** Both tracks use pointer capture and
//    `touch-none`, so a drag doesn't turn into a page scroll on a tablet.
//
// Recent colours are recorded on *commit* — a preset tap, a hex entry, or the end of a
// drag — never per move, or one drag round the square would fill the whole list.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Pipette } from "lucide-react";
import {
  contrastInk,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  recentColors,
  rememberColor,
  sameColor,
  type HSV,
} from "@/lib/planner-color";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

export interface ColorPickerProps {
  color: string;
  /** Called continuously while dragging, so the page shows the colour as it's chosen. */
  onChange: (hex: string) => void;
  /**
   * The choice has settled — end of a drag, a preset tapped, a hex typed. A caller that
   * edits the document on every `onChange` uses this to close its undo step.
   */
  onCommit?: (hex: string) => void;
  presets?: string[];
  /** 0..1. Omit both alpha props to hide the opacity slider. */
  alpha?: number;
  onAlphaChange?: (a: number) => void;
  /** Heading on the panel, e.g. "Pen colour". */
  label?: string;
}

/** A 0..1 position from a pointer event within `el`, along one axis. */
function axisAt(el: HTMLElement, clientPos: number, vertical: boolean): number {
  const r = el.getBoundingClientRect();
  const span = vertical ? r.height : r.width;
  const from = vertical ? r.top : r.left;
  if (span <= 0) return 0;
  const t = (clientPos - from) / span;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function ColorPicker({ color, onChange, onCommit, presets = [], alpha, onAlphaChange, label }: ColorPickerProps) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(color) ?? { h: 0, s: 0, v: 0 });
  const [hexText, setHexText] = useState(() => normalizeHex(color) ?? "#000000");
  const [recent, setRecent] = useState<string[]>([]);
  // What we last handed upstream, so an echo of our own value doesn't reset the hue.
  const ours = useRef<string | null>(null);

  useEffect(() => setRecent(recentColors()), []);

  // Adopt a colour that came from somewhere else (a different tool armed, a preset
  // clicked elsewhere), but ignore our own value coming back.
  useEffect(() => {
    const hex = normalizeHex(color);
    if (!hex || (ours.current && sameColor(ours.current, hex))) return;
    setHsv(hexToHsv(hex) ?? { h: 0, s: 0, v: 0 });
    setHexText(hex);
  }, [color]);

  const emit = useCallback((next: HSV) => {
    const hex = hsvToHex(next);
    ours.current = hex;
    setHsv(next);
    setHexText(hex);
    onChange(hex);
  }, [onChange]);

  /** Settle on the current colour: this is the one worth keeping in the recents. */
  const commit = useCallback((hex?: string) => {
    const h = hex ?? hsvToHex(hsv);
    setRecent(rememberColor(h));
    onCommit?.(h);
  }, [hsv, onCommit]);

  const pick = useCallback((hex: string) => {
    const h = normalizeHex(hex);
    if (!h) return;
    ours.current = h;
    setHsv(hexToHsv(h) ?? { h: 0, s: 0, v: 0 });
    setHexText(h);
    onChange(h);
    setRecent(rememberColor(h));
    onCommit?.(h);
  }, [onChange, onCommit]);

  const hue = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const current = hsvToHex(hsv);

  const submitHex = () => {
    const h = normalizeHex(hexText);
    if (h) pick(h);
    else setHexText(current); // put the box back rather than leaving nonsense in it
  };

  return (
    <div className="w-[15.5rem]">
      {label && (
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-black/35 mb-1.5">{label}</p>
      )}

      {/* Saturation (across) and brightness (down), over the chosen hue. */}
      <Pad
        onPick={(x, y) => emit({ ...hsv, s: x, v: 1 - y })}
        onSettle={() => commit()}
        style={{
          background:
            `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0)), ${hue}`,
        }}
        knob={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        knobColor={current}
        aria-label="Saturation and brightness"
      />

      <div className="mt-2.5 space-y-2">
        <Track
          value={hsv.h / 360}
          onPick={(t) => emit({ ...hsv, h: t * 360 })}
          onSettle={() => commit()}
          knobColor={hue}
          aria-label="Hue"
          background="linear-gradient(to right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)"
        />
        {alpha != null && onAlphaChange && (
          <Track
            value={alpha}
            onPick={(t) => onAlphaChange(Math.max(0.05, t))}
            onSettle={() => commit()}
            knobColor={current}
            aria-label="Opacity"
            checkered
            background={`linear-gradient(to right, rgba(0,0,0,0), ${current})`}
          />
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <span
          className="w-7 h-7 rounded-xl ring-1 ring-black/10 shrink-0"
          style={{
            background: current,
            opacity: alpha != null ? Math.max(0.1, alpha) : 1,
          }}
        />
        <label className="flex-1 flex items-center rounded-xl border border-black/10 bg-white px-2 py-1.5">
          <span className="text-[12px] text-black/30">#</span>
          <input
            value={hexText.replace(/^#/, "")}
            onChange={(e) => setHexText(e.target.value)}
            onBlur={submitHex}
            // Escape belongs to the panel (it closes it, discarding whatever is half-typed
            // here); Enter is what commits a hex.
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitHex(); } }}
            spellCheck={false}
            maxLength={8}
            aria-label="Hex colour"
            className="w-full min-w-0 text-[12.5px] font-mono uppercase tracking-wide outline-none bg-transparent"
          />
        </label>
        {alpha != null && (
          <span className="text-[11px] text-black/40 tabular-nums w-8 text-right">{Math.round(alpha * 100)}%</span>
        )}
      </div>

      {presets.length > 0 && <Swatches label="Presets" colors={presets} current={current} onPick={pick} />}
      {recent.length > 0 && <Swatches label="Recent" colors={recent} current={current} onPick={pick} />}
    </div>
  );
}

// ---- parts ---------------------------------------------------------------------------

/** The 2-D field. */
// Deliberately not `role="slider"`: it's two axes at once, so it can't report one
// `aria-valuenow` honestly. The hex box beside it is the keyboard and screen-reader way
// in, and it can express every colour this pad can.
function Pad({ onPick, onSettle, style, knob, knobColor, ...rest }: {
  onPick: (x: number, y: number) => void;
  onSettle: () => void;
  style: React.CSSProperties;
  knob: { left: string; top: string };
  knobColor: string;
  "aria-label": string;
}) {
  const held = useRef(false);
  const apply = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    onPick(axisAt(el, e.clientX, false), axisAt(el, e.clientY, true));
  };
  return (
    <div
      {...rest}
      role="img"
      className="relative w-full h-32 rounded-xl ring-1 ring-black/10 cursor-crosshair touch-none select-none"
      style={style}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current = true;
        apply(e);
      }}
      onPointerMove={(e) => { if (held.current) apply(e); }}
      onPointerUp={() => { held.current = false; onSettle(); }}
      onPointerCancel={() => { held.current = false; }}
    >
      <span
        className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.4)] pointer-events-none"
        style={{ ...knob, background: knobColor }}
      />
    </div>
  );
}

/** A 1-D slider — hue or opacity. */
function Track({ value, onPick, onSettle, background, knobColor, checkered, ...rest }: {
  value: number;
  onPick: (t: number) => void;
  onSettle: () => void;
  background: string;
  knobColor: string;
  checkered?: boolean;
  "aria-label": string;
}) {
  const held = useRef(false);
  const apply = (e: React.PointerEvent<HTMLDivElement>) => onPick(axisAt(e.currentTarget, e.clientX, false));
  return (
    <div
      {...rest}
      role="slider"
      aria-valuenow={Math.round(value * 100)}
      tabIndex={0}
      className="relative h-3.5 rounded-full ring-1 ring-black/10 touch-none select-none cursor-pointer"
      style={{
        // The checks show through a part-transparent opacity track, the way they do in
        // every other editor, so "half see-through" looks half see-through.
        backgroundImage: checkered
          ? `${background}, repeating-conic-gradient(#e6e6e6 0% 25%, #fff 0% 50%)`
          : background,
        backgroundSize: checkered ? "auto, 8px 8px" : undefined,
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current = true;
        apply(e);
      }}
      onPointerMove={(e) => { if (held.current) apply(e); }}
      onPointerUp={() => { held.current = false; onSettle(); }}
      onPointerCancel={() => { held.current = false; }}
    >
      <span
        className="absolute top-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.35)] pointer-events-none"
        style={{ left: `${value * 100}%`, background: knobColor }}
      />
    </div>
  );
}

function Swatches({ label, colors, current, onPick }: {
  label: string;
  colors: string[];
  current: string;
  onPick: (hex: string) => void;
}) {
  return (
    <div className="mt-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/30 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => {
          const on = sameColor(c, current);
          return (
            <button
              key={`${label}-${c}`}
              onClick={() => onPick(c)}
              title={c}
              data-swatch={c}
              aria-pressed={on}
              className={`w-6 h-6 rounded-full ring-1 ring-black/10 flex items-center justify-center transition-transform ${
                on ? "ring-2 ring-black/40 scale-110" : "hover:scale-110"
              }`}
              style={{ background: c }}
            >
              {on && <Check className="w-3 h-3" style={{ color: contrastInk(c) }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- the trigger + popover ------------------------------------------------------------

export interface ColorPickerButtonProps extends ColorPickerProps {
  /** Tooltip on the trigger. */
  title?: string;
  className?: string;
  /** Marks the trigger for tests, e.g. `data-picker="pen"`. */
  name?: string;
}

/**
 * The swatch you tap to open the picker. The panel is positioned `fixed` from the
 * trigger's own rect so it can't be clipped by a scrolling panel it happens to sit in,
 * and it flips when there isn't room below or to the right.
 *
 * It's rendered through a portal on `document.body` because the planner's toolbars use
 * `backdrop-filter`, and a filtered ancestor becomes the containing block for anything
 * `fixed` inside it — which put the panel's right edge off the screen. React still routes
 * events through the tree, so the `stopPropagation` below keeps working from a portal.
 */
export function ColorPickerButton({ title = "Any colour", className, name, ...picker }: ColorPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      if (!b) return;
      const w = panelRef.current?.offsetWidth ?? 264;
      const h = panelRef.current?.offsetHeight ?? 380;
      const pad = 8;
      const below = b.bottom + pad;
      setPos({
        left: Math.max(pad, Math.min(window.innerWidth - w - pad, b.left - 8)),
        top: below + h > window.innerHeight - pad ? Math.max(pad, b.top - h - pad) : below,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Escape closes the picker and *stops there*: the dialog or the selection underneath
    // has its own Escape handler, and one key press shouldn't dismiss both.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
    };
    // Capture, so the planner's own pointer handlers don't get the closing tap first.
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title={title}
        data-picker={name}
        aria-expanded={open}
        className={
          className ??
          `relative w-5 h-5 rounded-full ring-1 ring-black/15 flex items-center justify-center transition-transform hover:scale-110 ${
            open ? "ring-2 ring-black/40 scale-110" : ""
          }`
        }
        style={{ background: "conic-gradient(#f87171,#fbbf24,#34d399,#60a5fa,#a78bfa,#f87171)" }}
      >
        <Pipette className="w-2.5 h-2.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          data-picker-panel={name}
          className="fixed z-[80] p-3 rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
          style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? "visible" : "hidden" }}
          // The panel sits over the paper in the viewer; nothing that happens inside it
          // is the page's business.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <ColorPicker {...picker} />
          <button
            onClick={() => setOpen(false)}
            className="mt-3 w-full py-1.5 rounded-xl text-[12px] font-bold bg-black/[0.05] text-black/60 hover:bg-black/[0.09]"
            style={MARKER}
          >
            Done
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
