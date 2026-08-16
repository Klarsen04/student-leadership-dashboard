// Planner layouts — the printed furniture of a daily/weekly/monthly page, drawn
// as vectors from the page box rather than shipped as pictures.
//
// Each layout is a function of the content box (in page points) and a small style
// bundle, so the same layout works on A6 and Legal, portrait or landscape, and
// stays sharp at any zoom. Adding a planner page type means adding one entry to
// LAYOUT_TEMPLATES and one case here.
//
// Nothing drawn here is content: the layout is the page background, and the
// handwriting, text and shapes on top of it live in the page's element list. A
// page can be switched from Weekly to Dotted without touching a stroke.

import type { TemplateDefinition } from "@/lib/planner-paper";

export interface LayoutBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutStyle {
  /** Ruling period in points. */
  gap: number;
  /** Ruling thickness in points. */
  lw: number;
  /** Primary ruling colour. */
  stroke: string;
  /** Secondary, lighter ruling colour. */
  faint: string;
  /** Accent used for headings and dividers. */
  accent: string;
}

/** The planner pages offered in the template gallery. */
export const LAYOUT_TEMPLATES: TemplateDefinition[] = [
  {
    id: "planner-daily",
    name: "Daily planner",
    category: "Planner",
    pattern: "layout",
    layout: "daily",
    hint: "Hour schedule, priorities, to-dos, notes",
  },
  {
    id: "planner-weekly",
    name: "Weekly planner",
    category: "Planner",
    pattern: "layout",
    layout: "weekly",
    hint: "Seven day boxes and a notes column",
  },
  {
    id: "planner-monthly",
    name: "Monthly planner",
    category: "Planner",
    pattern: "layout",
    layout: "monthly",
    hint: "Six-week month grid",
    orientation: "landscape",
  },
  {
    id: "planner-goals",
    name: "Goal setting",
    category: "Productivity",
    pattern: "layout",
    layout: "goals",
    hint: "One goal, why it matters, milestones",
  },
  {
    id: "planner-todo",
    name: "To-do list",
    category: "Productivity",
    pattern: "layout",
    layout: "todo",
    hint: "Checklist with priority and due date",
  },
  {
    id: "planner-meeting",
    name: "Meeting notes",
    category: "Meetings",
    pattern: "layout",
    layout: "meeting",
    hint: "Attendees, agenda, notes, action items",
  },
  {
    id: "planner-project",
    name: "Project planning",
    category: "Productivity",
    pattern: "layout",
    layout: "project",
    hint: "Objective, milestones, tasks, risks",
  },
  {
    id: "planner-semester",
    name: "Semester overview",
    category: "School",
    pattern: "layout",
    layout: "semester",
    hint: "Subjects down, weeks across",
    orientation: "landscape",
  },
  {
    id: "planner-study",
    name: "Study session",
    category: "School",
    pattern: "layout",
    layout: "study",
    hint: "Topic, key ideas, questions, recall check",
  },
];

// ---- drawing helpers ---------------------------------------------------------------

const r2 = (n: number) => Math.round(n * 100) / 100;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const line = (x1: number, y1: number, x2: number, y2: number, color: string, w: number) =>
  `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${color}" stroke-width="${r2(w)}"/>`;

const box = (b: LayoutBox, color: string, w: number, radius = 4) =>
  `<rect x="${r2(b.x)}" y="${r2(b.y)}" width="${r2(b.w)}" height="${r2(b.h)}" rx="${radius}" fill="none" stroke="${color}" stroke-width="${r2(w)}"/>`;

/** Uppercase caption, the only text a layout draws. */
const cap = (text: string, x: number, y: number, color: string, size = 8, weight = 600) =>
  `<text x="${r2(x)}" y="${r2(y)}" fill="${color}" font-size="${r2(size)}" font-weight="${weight}" ` +
  `letter-spacing="0.09em" font-family="${FONT}">${esc(text.toUpperCase())}</text>`;

/** Sentence-case text at normal weight, for weekday names and hour labels. */
const txt = (text: string, x: number, y: number, color: string, size = 8, anchor = "start") =>
  `<text x="${r2(x)}" y="${r2(y)}" fill="${color}" font-size="${r2(size)}" text-anchor="${anchor}" ` +
  `font-family="${FONT}">${esc(text)}</text>`;

/** Horizontal rules filling a box, every `gap` points. Skips the last partial row. */
function rules(b: LayoutBox, gap: number, color: string, w: number, indent = 0): string {
  let out = "";
  for (let y = b.y + gap; y <= b.y + b.h - 1; y += gap) {
    out += line(b.x + indent, y, b.x + b.w, y, color, w);
  }
  return out;
}

/** A titled area: caption above, ruled paper below. */
function ruledSection(title: string, b: LayoutBox, s: LayoutStyle): string {
  const head = 13;
  return (
    cap(title, b.x, b.y + 8, s.stroke) +
    line(b.x, b.y + head, b.x + b.w, b.y + head, s.accent, s.lw + 0.4) +
    rules({ ...b, y: b.y + head, h: b.h - head }, s.gap, s.faint, s.lw)
  );
}

/** A titled area of tick boxes. */
function checkSection(title: string, b: LayoutBox, s: LayoutStyle, gap = s.gap): string {
  const head = 13;
  const side = Math.min(11, gap * 0.5);
  let out =
    cap(title, b.x, b.y + 8, s.stroke) + line(b.x, b.y + head, b.x + b.w, b.y + head, s.accent, s.lw + 0.4);
  for (let y = b.y + head + gap; y <= b.y + b.h - 1; y += gap) {
    out +=
      `<rect x="${r2(b.x)}" y="${r2(y - side - 3)}" width="${r2(side)}" height="${r2(side)}" rx="2" fill="none" stroke="${s.stroke}" stroke-width="${r2(s.lw + 0.3)}"/>` +
      line(b.x + side + 6, y, b.x + b.w, y, s.faint, s.lw);
  }
  return out;
}

/** A single labelled write-on line, e.g. "Date ______". */
const field = (title: string, b: LayoutBox, s: LayoutStyle) =>
  cap(title, b.x, b.y, s.stroke) +
  line(b.x + Math.max(30, title.length * 6.2), b.y + 2, b.x + b.w, b.y + 2, s.faint, s.lw + 0.2);

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---- the layouts -------------------------------------------------------------------

/**
 * Furniture for one planner layout, in page points.
 *
 * `b` is the content box (the page inset by its margin); every layout must draw
 * inside it so nothing collides with the page edge.
 */
export function drawLayout(def: TemplateDefinition, b: LayoutBox, s: LayoutStyle): string {
  switch (def.layout) {
    case "daily":
      return daily(b, s);
    case "weekly":
      return weekly(b, s);
    case "monthly":
      return monthly(b, s);
    case "goals":
      return goals(b, s);
    case "todo":
      return todo(b, s);
    case "meeting":
      return meeting(b, s);
    case "project":
      return project(b, s);
    case "semester":
      return semester(b, s);
    case "study":
      return study(b, s);
    default:
      return rules(b, s.gap, s.faint, s.lw);
  }
}

/** Title, date field and a rule across the top. Returns the y of the rule. */
function titleBar(title: string, b: LayoutBox, s: LayoutStyle): { svg: string; y: number } {
  const baseline = b.y + 15;
  const dateW = Math.min(180, b.w * 0.38);
  const svg =
    cap(title, b.x, baseline, s.stroke, 11, 700) +
    cap("Date", b.x + b.w - dateW, baseline, s.faint) +
    line(b.x + b.w - dateW + 26, baseline + 2, b.x + b.w, baseline + 2, s.faint, s.lw + 0.2) +
    line(b.x, baseline + 10, b.x + b.w, baseline + 10, s.accent, s.lw + 0.8);
  return { svg, y: baseline + 10 };
}

function daily(b: LayoutBox, s: LayoutStyle): string {
  const { svg, y } = titleBar("Daily plan", b, s);
  const top = y + 14;
  const colGap = 16;
  const leftW = b.w * 0.46;
  const rightX = b.x + leftW + colGap;
  const rightW = b.x + b.w - rightX;
  const bodyH = b.y + b.h - top;

  // Left: an hour-by-hour schedule. Hours are labelled and each gets one row.
  const startHour = 7;
  const endHour = 21;
  const rowsN = endHour - startHour + 1;
  const rowH = Math.max(14, (bodyH - 13) / rowsN);
  let schedule = cap("Schedule", b.x, top + 8, s.stroke) + line(b.x, top + 13, b.x + leftW, top + 13, s.accent, s.lw + 0.4);
  for (let i = 0; i < rowsN; i++) {
    const ry = top + 13 + rowH * (i + 1);
    const h24 = startHour + i;
    const hour = h24 % 12 === 0 ? 12 : h24 % 12;
    schedule +=
      txt(`${hour}${h24 < 12 ? "am" : "pm"}`, b.x + 22, ry - 3, s.stroke, 7.5, "end") +
      line(b.x + 26, ry, b.x + leftW, ry, s.faint, s.lw);
  }

  // Right: priorities, to-dos, notes.
  const prioH = Math.min(96, bodyH * 0.3);
  const todoH = (bodyH - prioH - 24) * 0.5;
  const priorities = checkSection("Top three", { x: rightX, y: top, w: rightW, h: prioH }, s, Math.max(20, prioH / 3.4));
  const tasks = checkSection("To do", { x: rightX, y: top + prioH + 12, w: rightW, h: todoH }, s);
  const notes = ruledSection("Notes", { x: rightX, y: top + prioH + todoH + 24, w: rightW, h: todoH }, s);

  return (
    svg + schedule + line(rightX - colGap / 2, top, rightX - colGap / 2, b.y + b.h, s.faint, s.lw) + priorities + tasks + notes
  );
}

function weekly(b: LayoutBox, s: LayoutStyle): string {
  const { svg, y } = titleBar("Week of", b, s);
  const top = y + 12;
  const bodyH = b.y + b.h - top;
  // Two columns: four cells on the left, three plus a notes cell on the right, so
  // the week fits either orientation without any cell getting squeezed.
  const colGap = 14;
  const colW = (b.w - colGap) / 2;
  const rowsPerCol = 4;
  const cellH = (bodyH - (rowsPerCol - 1) * 8) / rowsPerCol;
  let out = svg;
  for (let i = 0; i < 8; i++) {
    const col = Math.floor(i / rowsPerCol);
    const row = i % rowsPerCol;
    const cell = {
      x: b.x + col * (colW + colGap),
      y: top + row * (cellH + 8),
      w: colW,
      h: cellH,
    };
    const name = i < 7 ? DAYS[i] : "Notes";
    out +=
      box(cell, s.faint, s.lw) +
      cap(name, cell.x + 7, cell.y + 12, i < 7 ? s.stroke : s.accent) +
      line(cell.x + 7, cell.y + 16, cell.x + cell.w - 7, cell.y + 16, s.faint, s.lw) +
      rules({ x: cell.x + 7, y: cell.y + 16, w: cell.w - 14, h: cell.h - 20 }, s.gap * 0.85, s.faint, s.lw);
  }
  return out;
}

function monthly(b: LayoutBox, s: LayoutStyle): string {
  const { svg, y } = titleBar("Month", b, s);
  const top = y + 12;
  const headH = 15;
  const cols = 7;
  const rows = 6;
  const cellW = b.w / cols;
  const cellH = (b.y + b.h - top - headH) / rows;
  let out = svg;
  for (let c = 0; c < cols; c++) {
    out += txt(DAYS_SHORT[c], b.x + cellW * (c + 0.5), top + 10, s.stroke, 8, "middle");
  }
  out += line(b.x, top + headH, b.x + b.w, top + headH, s.accent, s.lw + 0.5);
  for (let rIdx = 0; rIdx <= rows; rIdx++) {
    const yy = top + headH + cellH * rIdx;
    out += line(b.x, yy, b.x + b.w, yy, s.faint, s.lw);
  }
  for (let c = 0; c <= cols; c++) {
    const xx = b.x + cellW * c;
    out += line(xx, top + headH, xx, top + headH + cellH * rows, s.faint, s.lw);
  }
  return out;
}

function goals(b: LayoutBox, s: LayoutStyle): string {
  const { svg, y } = titleBar("Goal", b, s);
  const top = y + 14;
  const bodyH = b.y + b.h - top;
  const goalH = Math.min(64, bodyH * 0.16);
  const whyH = Math.min(90, bodyH * 0.2);
  const trackH = 40;
  const restH = bodyH - goalH - whyH - trackH - 36;

  const goalBox = { x: b.x, y: top, w: b.w, h: goalH };
  let out =
    svg +
    box(goalBox, s.accent, s.lw + 0.5, 6) +
    cap("My goal", goalBox.x + 8, goalBox.y + 13, s.accent) +
    rules({ x: goalBox.x + 8, y: goalBox.y + 16, w: goalBox.w - 16, h: goalBox.h - 18 }, s.gap * 0.9, s.faint, s.lw);

  out += ruledSection("Why it matters", { x: b.x, y: top + goalH + 12, w: b.w, h: whyH }, s);

  // Progress: ten circles to fill in, a cheap but legible tracker.
  const trackY = top + goalH + whyH + 24;
  out += cap("Progress", b.x, trackY + 8, s.stroke);
  const dots = 10;
  const dotGap = Math.min(30, b.w / (dots + 1));
  for (let i = 0; i < dots; i++) {
    out += `<circle cx="${r2(b.x + 6 + dotGap * (i + 0.5))}" cy="${r2(trackY + 26)}" r="7" fill="none" stroke="${s.stroke}" stroke-width="${r2(s.lw + 0.3)}"/>`;
  }

  const milestonesY = trackY + trackH + 12;
  out += checkSection("Milestones", { x: b.x, y: milestonesY, w: b.w * 0.55 - 8, h: restH }, s);
  out += ruledSection("Notes", { x: b.x + b.w * 0.55 + 8, y: milestonesY, w: b.w * 0.45 - 8, h: restH }, s);
  return out;
}

function todo(b: LayoutBox, s: LayoutStyle): string {
  const { svg, y } = titleBar("To do", b, s);
  const top = y + 12;
  const gap = Math.max(22, s.gap);
  const dueX = b.x + b.w - 84;
  const priX = dueX - 46;
  let out =
    svg +
    cap("Task", b.x + 22, top + 9, s.faint, 7.5) +
    cap("Pri", priX, top + 9, s.faint, 7.5) +
    cap("Due", dueX, top + 9, s.faint, 7.5) +
    line(b.x, top + 13, b.x + b.w, top + 13, s.accent, s.lw + 0.4);
  const side = Math.min(12, gap * 0.5);
  for (let yy = top + 13 + gap; yy <= b.y + b.h - 1; yy += gap) {
    out +=
      `<rect x="${r2(b.x)}" y="${r2(yy - side - 4)}" width="${r2(side)}" height="${r2(side)}" rx="2.5" fill="none" stroke="${s.stroke}" stroke-width="${r2(s.lw + 0.3)}"/>` +
      line(b.x + side + 6, yy, b.x + b.w, yy, s.faint, s.lw);
  }
  out += line(priX - 8, top + 13, priX - 8, b.y + b.h, s.faint, s.lw);
  out += line(dueX - 8, top + 13, dueX - 8, b.y + b.h, s.faint, s.lw);
  return out;
}

function meeting(b: LayoutBox, s: LayoutStyle): string {
  const { svg, y } = titleBar("Meeting notes", b, s);
  let out = svg;
  const top = y + 18;
  out += field("Subject", { x: b.x, y: top, w: b.w * 0.62 - 8, h: 0 }, s);
  out += field("Time", { x: b.x + b.w * 0.62 + 8, y: top, w: b.w * 0.38 - 8, h: 0 }, s);
  out += field("Attendees", { x: b.x, y: top + 22, w: b.w, h: 0 }, s);

  const bodyTop = top + 36;
  const bodyH = b.y + b.h - bodyTop;
  const agendaH = Math.min(120, bodyH * 0.26);
  const actionH = Math.min(150, bodyH * 0.3);
  const notesH = bodyH - agendaH - actionH - 24;

  out += checkSection("Agenda", { x: b.x, y: bodyTop, w: b.w, h: agendaH }, s);
  out += ruledSection("Notes", { x: b.x, y: bodyTop + agendaH + 12, w: b.w, h: notesH }, s);

  // Action items get an owner column, since that is the bit that gets lost.
  const actY = bodyTop + agendaH + notesH + 24;
  const ownerX = b.x + b.w - 110;
  out +=
    cap("Action items", b.x, actY + 8, s.accent) +
    cap("Owner", ownerX, actY + 8, s.faint, 7.5) +
    line(b.x, actY + 13, b.x + b.w, actY + 13, s.accent, s.lw + 0.4) +
    line(ownerX - 8, actY + 13, ownerX - 8, actY + actionH, s.faint, s.lw);
  const side = Math.min(11, s.gap * 0.5);
  for (let yy = actY + 13 + s.gap; yy <= actY + actionH; yy += s.gap) {
    out +=
      `<rect x="${r2(b.x)}" y="${r2(yy - side - 3)}" width="${r2(side)}" height="${r2(side)}" rx="2" fill="none" stroke="${s.stroke}" stroke-width="${r2(s.lw + 0.3)}"/>` +
      line(b.x + side + 6, yy, b.x + b.w, yy, s.faint, s.lw);
  }
  return out;
}

function project(b: LayoutBox, s: LayoutStyle): string {
  const { svg, y } = titleBar("Project", b, s);
  const top = y + 18;
  let out = svg + field("Project", { x: b.x, y: top, w: b.w * 0.66 - 8, h: 0 }, s);
  out += field("Owner", { x: b.x + b.w * 0.66 + 8, y: top, w: b.w * 0.34 - 8, h: 0 }, s);

  const bodyTop = top + 18;
  const bodyH = b.y + b.h - bodyTop;
  const objH = Math.min(80, bodyH * 0.17);
  out += ruledSection("Objective", { x: b.x, y: bodyTop, w: b.w, h: objH }, s);

  // Milestones with a date column.
  const msY = bodyTop + objH + 14;
  const msH = Math.min(160, bodyH * 0.32);
  const dateX = b.x + b.w - 90;
  out +=
    cap("Milestones", b.x, msY + 8, s.stroke) +
    cap("Date", dateX, msY + 8, s.faint, 7.5) +
    line(b.x, msY + 13, b.x + b.w, msY + 13, s.accent, s.lw + 0.4) +
    line(dateX - 8, msY + 13, dateX - 8, msY + msH, s.faint, s.lw) +
    rules({ x: b.x, y: msY + 13, w: b.w, h: msH - 13 }, s.gap, s.faint, s.lw);

  const restY = msY + msH + 14;
  const restH = b.y + b.h - restY;
  const colW = b.w / 2 - 8;
  out += checkSection("Next actions", { x: b.x, y: restY, w: colW, h: restH }, s);
  out += ruledSection("Risks and blockers", { x: b.x + colW + 16, y: restY, w: colW, h: restH }, s);
  return out;
}

function semester(b: LayoutBox, s: LayoutStyle): string {
  const { svg, y } = titleBar("Semester overview", b, s);
  const top = y + 14;
  const labelW = Math.min(120, b.w * 0.18);
  const weeks = 14;
  const rows = 8;
  const cellW = (b.w - labelW) / weeks;
  const headH = 14;
  const cellH = (b.y + b.h - top - headH) / rows;
  let out = svg + cap("Subject", b.x, top + 9, s.faint, 7.5);
  for (let w = 0; w < weeks; w++) {
    out += txt(String(w + 1), b.x + labelW + cellW * (w + 0.5), top + 10, s.stroke, 7.5, "middle");
  }
  out += line(b.x, top + headH, b.x + b.w, top + headH, s.accent, s.lw + 0.5);
  for (let rIdx = 0; rIdx <= rows; rIdx++) {
    const yy = top + headH + cellH * rIdx;
    out += line(b.x, yy, b.x + b.w, yy, s.faint, s.lw);
  }
  out += line(b.x + labelW, top, b.x + labelW, top + headH + cellH * rows, s.accent, s.lw + 0.3);
  for (let w = 1; w <= weeks; w++) {
    const xx = b.x + labelW + cellW * w;
    out += line(xx, top + headH, xx, top + headH + cellH * rows, s.faint, s.lw);
  }
  return out;
}

function study(b: LayoutBox, s: LayoutStyle): string {
  const { svg, y } = titleBar("Study session", b, s);
  const top = y + 18;
  let out = svg + field("Topic", { x: b.x, y: top, w: b.w * 0.7 - 8, h: 0 }, s);
  out += field("Source", { x: b.x + b.w * 0.7 + 8, y: top, w: b.w * 0.3 - 8, h: 0 }, s);

  const bodyTop = top + 18;
  const bodyH = b.y + b.h - bodyTop;
  const summaryH = Math.min(110, bodyH * 0.22);
  const mainH = bodyH - summaryH - 14;
  const qW = b.w * 0.36;

  // Questions on the left, key ideas on the right — retrieval practice by layout.
  out += ruledSection("Questions", { x: b.x, y: bodyTop, w: qW - 8, h: mainH }, s);
  out += ruledSection("Key ideas", { x: b.x + qW + 8, y: bodyTop, w: b.w - qW - 8, h: mainH }, s);
  out += line(b.x + qW, bodyTop, b.x + qW, bodyTop + mainH, s.faint, s.lw);

  const sumY = bodyTop + mainH + 14;
  out +=
    box({ x: b.x, y: sumY, w: b.w, h: summaryH }, s.accent, s.lw + 0.4, 6) +
    cap("Recall check — what can I say without looking?", b.x + 8, sumY + 13, s.accent) +
    rules({ x: b.x + 8, y: sumY + 16, w: b.w - 16, h: summaryH - 18 }, s.gap * 0.9, s.faint, s.lw);
  return out;
}
