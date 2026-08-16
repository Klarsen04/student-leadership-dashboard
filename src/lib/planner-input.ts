// What a pointer touching the page is *for*.
//
// This is the one place that decides it. Before, the viewer worked it out inline in
// a chain of ifs, and the modes leaked into each other: the hand tool still drew
// with a stylus, and a palm landing on the page put the viewer into a pan that then
// swallowed the pen's own moves, so a stroke silently went nowhere.
//
// The rule now: pointerdown resolves exactly one mode for that pointer, latches it
// for the life of the gesture, and every later event for that pointer is handled by
// that mode and no other. A pointer that isn't the one holding the gesture does
// nothing (bar the second finger of a pinch, which is its own case).

export type Tool =
  | "hand"
  | "pen"
  | "pencil"
  | "marker"
  | "highlighter"
  | "eraser"
  | "text"
  | "select"
  | "shape";

/** Tools that put ink on the paper. Ordinary strokes, all through one pipeline. */
export const INK_TOOLS = ["pen", "pencil", "marker", "highlighter"] as const;
export type InkTool = (typeof INK_TOOLS)[number];

export const isInkTool = (t: Tool): t is InkTool => (INK_TOOLS as readonly string[]).includes(t);

export type InputMode =
  /** Lay down a stroke. */
  | "draw"
  /** Rub ink out — whole strokes, or part of one. */
  | "erase"
  /** Sweep a region, or move/resize/rotate what's picked. */
  | "select"
  /** Drop or edit a text box. */
  | "text"
  /** Tap tabs and day cells, turn pages, pan a zoomed page. Never marks the paper. */
  | "navigate";

export interface RouteOpts {
  tool: Tool;
  pointerType: string;
  /** A shipped planner: shared by everyone, so nothing here may be marked. */
  readOnly: boolean;
}

/**
 * The mode for a pointer that has just gone down.
 *
 * Fingers navigate whatever the tool is — that's what keeps the page usable while a
 * pen tool is armed, and it's the same rule that makes a resting palm harmless.
 * Everything else follows the selected tool, with no special case for the stylus:
 * if the hand tool is chosen, a stylus navigates too.
 */
export function routePointer({ tool, pointerType, readOnly }: RouteOpts): InputMode {
  if (readOnly) return "navigate";
  if (pointerType === "touch") return "navigate";
  if (tool === "hand") return "navigate";
  if (tool === "select") return "select";
  if (tool === "text") return "text";
  if (tool === "eraser") return "erase";
  return "draw"; // pen, pencil, marker, highlighter, shape
}

/** True when this mode marks the paper, so a palm has to be kept out of the way. */
export const marksPaper = (m: InputMode) => m === "draw" || m === "erase";
