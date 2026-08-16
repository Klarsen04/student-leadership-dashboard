# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

The dev server runs at http://localhost:3000. Auth is required for all app routes — use the credentials provider with email/password.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Build (prisma generate + next build)
npm run lint         # ESLint
npx prisma db push  # Apply schema changes to SQLite
npx prisma studio   # Browse database GUI
npx tsc --noEmit --skipLibCheck  # Type-check without building
```

No test framework is configured.

## Stack

- **Framework:** Next.js 15 (App Router, `output: "standalone"`)
- **Language:** TypeScript 5.3
- **Styling:** Tailwind CSS 3.4 + shadcn/ui components
- **Animation:** framer-motion (BlurFade, NumberTicker, ShineBorder in `src/components/ui/`)
- **Database:** SQLite via Prisma (libsql adapter, `prisma/dev.db`)
- **Auth:** NextAuth 4.24 (Credentials, Google, Azure AD)
- **Deployment:** Vercel

## Architecture

```
src/
  app/
    (app)/          # Authenticated routes — protected by middleware
    (auth)/         # Login/register — public
    api/            # REST API routes (CRUD for tasks, events, goals, reflections)
  components/
    ui/             # shadcn/ui base + magic-ui animated components
    tasks/          # TapeShelf (cassette-themed task board)
  lib/              # Auth config, Prisma client, hooks, validations
  middleware.ts     # CSP headers + auth redirect for protected paths
prisma/
  schema.prisma     # Models: User, Event, Task, Goal, Reflection, Person, Interaction
  dev.db            # SQLite database file
```

### Auth Flow
Middleware (`src/middleware.ts`) checks for `next-auth.session-token` cookie on protected paths (`/dashboard`, `/calendar`, `/analytics`, `/reflections`). Missing token → redirect to `/login`. CSP nonce is generated per-request and injected via `x-nonce` header.

### Client-Side Storage (account-synced)
Some features keep their state as a JSON document rather than rows — classes
(`leadership-os-classes`), sub-calendars (`leadership-os-calendars`), roles, goal
categories, semester dates and the time budget. They are written to
`localStorage` first and mirrored to the **account** in the `UserData` table via
`/api/sync`, so signing in on a second device shows the same data.

`src/lib/synced-setting.ts` is the primitive: `useSyncedSetting(spec)` reads
localStorage synchronously (so there's no flash of defaults and SSR is safe),
pulls the account copy once on mount, and pushes local edits after a 600 ms
debounce. Rules that matter when adding one:
- **Local first.** A failed push means "not on the other devices yet", never lost
  data — the local copy stands and syncs on the next load.
- **Last write wins** by `updatedAt`; the server never merges a document.
- A local edit made *before* the pull returns outranks the pull (`dirty`), so
  typing during a slow network isn't overwritten.
- If the account has no copy, the local one is pushed up — that's how state
  created before sync existed migrates itself.

Hooks in `src/lib/use*.ts` wrap this; their public API is unchanged.

### Calendar Architecture
The calendar page (`src/app/(app)/calendar/page.tsx`) is a large client component (~1300 lines) containing:
- 5 views: Day, 3-Day, 5-Day (Class Schedule), Week, Month
- Collision detection algorithm for side-by-side overlapping class/event layout
- Time grid from 6 AM to 11 PM
- "Next Up" banner with countdown, conflict detection, gap indicators
- Seasonal SVG icons and monthly color themes

### TaskTape System
The tasks page uses a cassette tape metaphor:
1. **Shelf** — 7 tape spines (one per day)
2. **Tape Open** — 3D cassette animation
3. **Board** — Kanban columns + notes

URL: `/tasks` = shelf, `/tasks?day=0-6` = board. Assets in `/public/tasktape/`.

### Planner Library
`/planner` is a multi-planner digital notebook. Each planner is a PDF rendered to
WebP pages under `public/planner/<id>/`, listed in `public/planner/index.json`:

```bash
node scripts/add-planner.mjs <pdf> <id> "Name" "Description" "Category" "Credit"
```

The script needs `poppler` + `webp` (`brew install poppler webp`), renders every
page, extracts the PDF's internal link annotations into `manifest.json`, and
registers the planner. `category` becomes a section heading in the library.

Tap navigation comes from one of two sources:
- **manifest links** — hotspots read from the PDF's own hyperlinks
- **`template`** — a key in `src/lib/planner-templates.ts`, for PDFs exported
  without link annotations (iOS PDF export strips them). A template supplies
  `hotspots(page)`, `label(page)`, `today(now)` and a `writeArea`.

Hotspots are normalised rects (0..1 fractions of the page). `kind: "chrome"`
marks printed tabs and buttons: ink is refused there and a stylus tap navigates.
`kind: "content"` (day cells) sits on writable paper and only navigates from a
finger tap or the hand tool. Ink is clipped to `writeArea`, so strokes never
land on the tabs or outer margins. Add `?debug=1` to the URL to see the write
area (blue) and hotspots (amber = chrome, red = content).

Stepping one page (a planner runs to hundreds, and the weekly/daily spreads sit
right behind the page a month tab lands on) doesn't need the toolbar arrows:
- **edge tap** — a tap inside `EDGE_FLIP` of either side turns the page, but only
  for a pointer that's navigating rather than writing (`tapStart.flip`: fingers,
  the hand tool, any read-only planner). Hotspots are checked *first*, so a tab
  strip down the edge still wins.
- **swipe** — a sideways drag past `SWIPE_FLIP_PX` on the same pointers.
- **scroll** — wheel/trackpad travel banked in `wheelAccum` until it passes
  `WHEEL_FLIP_PX`; ignored mid-stroke and over a text box being edited.
Hover shows a chevron chip on whichever edges have a page to go to.

### Pointer input (`src/lib/planner-input.ts`)
One mode per pointer, latched for the whole gesture. `routePointer({tool,
pointerType, readOnly})` returns the `InputMode` at pointerdown — `draw`, `erase`,
`select`, `text` or `navigate` — and `gestureRef` (`{id, mode, rect}`) holds it
until that pointer lifts. Every later event checks the id, so a second pointer
can't steer a gesture it doesn't own. Rules that follow from it:
- **a finger always navigates**, whatever the tool. That's what keeps a planner
  tappable with a pen armed, and what makes a resting palm harmless.
- **the hand and select tools never draw**, from any pointer type.
- a `touch` landing while a stroke is in progress (`drawingRef`) is swallowed with
  `preventDefault()`, killing the synthesised tap that used to press whatever was
  under the hand. A capture-phase listener does the same for touches on the
  toolbar and rail *only while a stroke is in flight* — the UI is otherwise normal.
- `rect` is measured once at pointerdown (nothing moves mid-gesture), keeping a
  layout read out of the per-move path.

**Latency.** While the pen is down, no React state is touched. Points go into the
mutable `liveRef` stroke and are painted onto a dedicated live canvas above the ink
canvas, drawing *only the newest segments* (`drawStroke(..., from)`), so per-move
cost is flat in stroke length instead of growing with it (measured: 0.12 ms → 0.13 ms
first-to-last 50 moves, against 0.19 → 0.42 ms before). `getCoalescedEvents()` keeps
every digitiser sample and its pressure. On pointerup the stroke is committed to
state once, which repaints the committed-ink cache; the live layer is then wiped.
The cache is invalidated by **identity** (`inkCachePainted !== elementsRef.current`),
plus an explicit reset on a page turn — a flag was how undo used to leave a stroke on
screen until the next edit.

### Writing tools (pen, pencil, marker, highlighter)
All four are the same `Stroke` on the same pipeline above — the tool is a field, not
a separate renderer, so none of them can be the slow one. What differs is how
`planner-render.ts` paints it:
- `TOOL_WIDTH` / `TOOL_ALPHA` give each tool its nib and its default opacity;
  `strokeAlpha(s) = s.opacity ?? TOOL_ALPHA[s.tool]` (a stroke stores `opacity`
  only when the user overrode it, so the defaults stay tunable).
- marker and highlighter are **flat** — width ignores pressure, because a felt tip
  and a chisel highlighter don't taper. Pen and pencil scale with it.
- pencil adds a second, lighter, laterally-offset pass per segment with grain from
  a deterministic `sin`-hash of index+position, so the same stroke grains
  identically in the viewer, a thumbnail and an export.

A see-through stroke is **flattened** (`isFlattened`): painted at full strength into
a scratch canvas and composited once at its own alpha (`paintStrokes`). Compositing
per *stroke* rather than per segment is what stops overlapping segment joins beading
into dark blobs. The highlighter composites with `globalCompositeOperation =
"multiply"`, so it darkens the paper but can never cover handwriting — and repeated
passes deepen without turning into a solid block (measured: 681 → 682 dark ink px
after four passes over the same words). Mid-stroke the live canvas reproduces this
with CSS `opacity` + `mixBlendMode`, so nothing changes appearance when the pen lifts.

Each tool remembers **its own colour, thickness and opacity** (`inkPrefs`, keyed by
`InkPrefKey` = the ink tools plus `shape` and `text`) — reaching for the highlighter
shouldn't hand you a black one, so it has its own bright `HIGHLIGHTER_COLORS`.

**Erasing** (`src/lib/planner-erase.ts`) has two modes. `stroke` takes the whole
stroke the tip touched; `precise` **splits** its polyline and keeps the surviving runs
as ordinary strokes with their original pressures — nothing is rasterised. Hit-testing
is against segments, not samples, so a fast pen's long gaps still get cut, and
distances put y in width units so the tip stays round on a non-square page. Untouched
strokes are returned **by identity**, which is what keeps a missed erase from
invalidating element ids, the selection or the render cache. One drag is one undo step
(`beginBurst`/`endBurst`). The tip ring follows the pointer through a ref, never state.

Pages hold **strokes and text boxes** (`PageElement` in `src/lib/planner-ink.ts`).
The Text tool drops an editable, draggable, resizable text box; fonts come from
`PLANNER_FONTS` (Inter/Instrument Serif/Fredoka/Caveat/Patrick Hand/mono, wired
up as CSS variables in `src/app/layout.tsx`).

### Colour (`src/lib/planner-color.ts`, `components/planner/ColorPicker.tsx`)
Presets are a shortcut, never the whole set: every colour in the planner also opens a
`ColorPickerButton` — saturation/brightness pad, hue slider, optional opacity, hex box,
that thing's presets, and one **shared recents list** (`leadership-os-recent-colours`),
because a colour mixed for the pen is the one you'll want for a heading a moment later.
It's wired to the pen/pencil/marker/highlighter/shape nib, text boxes, the lasso's
recolour, a page's paper and ruling, and a new notebook's tint.

Three things it gets right and shouldn't be undone:
- **hex is the only stored form.** Opacity lives beside it as its own field, never folded
  into `#rrggbbaa` — the renderer already multiplies by `strokeAlpha`, so a packed alpha
  would be applied twice.
- **the panel keeps its own HSV.** Hex can't carry the hue of black or of a grey, so
  deriving HSV from the prop each render would snap a hue back to red the moment value
  hit the bottom. It re-reads the prop only when the value isn't the one it just emitted.
- **it renders in a portal on `document.body`.** The toolbars use `backdrop-filter`, and
  a filtered ancestor becomes the containing block for `position: fixed` — inside the
  toolbar the panel was clipped off the right of the viewport.

Recolouring a selection from the picker is **one** undo step: `onChange` edits inside a
burst, and the picker's `onCommit` (drag end, preset tap, hex entered) closes it.

### Toolbar geometry
The toolbar is two rows: identity + tools + global actions, then a **tool options row of
constant height** that never wraps (it scrolls sideways). This isn't cosmetic. When the
options shared one wrapping row, switching pen → eraser dropped the toolbar from two
lines to one and the paper jumped 36px up the screen, so a stylus resting on a word was
suddenly over a different one — and a precise erase aimed at a stroke missed it entirely.
The footer hint is height-reserved for the same reason (its text changes per tool, and a
one-line hint left the paper more room than a two-line one). **Anything added to the
toolbar or footer must not change size with the armed tool.** The options row also ranks
`z-20` under the top row's `z-30`, or it covers the menus hanging down from it.

Toolbar controls carry stable hooks for tests — `data-tool` on each tool button,
`data-swatch` on each colour, `data-picker`/`data-picker-panel` on a colour picker,
`data-recolor` on the selection swatches, `data-zoom` on the zoom readout, `aria-pressed`
for what's armed. The page rail adds `data-page-row`, `data-page-open` (the jump button —
*not* the first button in the row, which is the insert-a-page hairline) and `data-page-ink`.
Tooltips describe the tool and get reworded; select on these instead.

### Page-rail thumbnails (`src/lib/planner-thumbs.ts`)
The rail already draws each page's real paper, so a thumbnail is just that page's
handwriting as a transparent PNG laid over it — composited by `paintElements` from the same
vectors as the page and the export (at 2×), never a screenshot, so it can't drift from what
the page holds.

Repainting is governed by a **content version per slot**: `inkVersions` in the planner page,
bumped by `putSlot()` — the single choke point through which a page's elements are ever
replaced (writing, erasing, undo, redo, paste, duplicate, clear). The rail asks for one key
(`plannerId:slot:version`) at most once, so writing on page 4 leaves pages 1-3's images
byte-identical, and undo — which bumps the version *back* to a key already in the cache —
updates the rail instantly instead of showing a stale bitmap. The tick that wakes the rail
is debounced 180ms, because one eraser drag replaces a page's elements many times over.

Two traps, both of which cost an afternoon:
- The rail stores ink **by row position**, with the key kept beside it only as the staleness
  test. Keying the store by content key deadlocks: painting a page reads its ink, the viewer
  caches it, and caching bumps the version — so the key moved on between asking and storing
  and the row looked up a key nothing was filed under. Nothing rendered after a reload.
- Its in-flight guard is `mounted`, **not** an effect-run flag. The effect re-runs on every
  scroll and page change, and since a key is only asked for once, cancelling with the run
  loses that page's thumbnail permanently. Set the flag on mount too — React remounts every
  component once in development.

Two guards, doing different jobs: `inkByPos.get(position)?.key === key` is what stops
repainting, and `inkAsked` only stops the same request being started twice — so it's cleared
when the request *finishes*. Left in place, it freezes rows: after a reorder or an undo, the
row inheriting an already-painted key is skipped and keeps the wrong page's writing.

### Reordering and duplicating pages
A page's handwriting is keyed by slot and a page carries its slot, so reordering the index
moves the content with it — there's nothing to copy. Reordering starts from the **grip**
only, so a flick still scrolls the rail and can't draw; the drop gap is derived from pointer
Y over `ROW_H`, and `onMove` treats a page dropped back where it was as a no-op.

The live drag lives in `dragRef`, not just state: one pointerup reaches `endDrag` **twice**
(the grip, then the list it bubbles to), both closures see the same pre-render `drag`, and
the page gets moved twice — the second move dragging whatever page had shifted into the
vacated position. That read exactly like "reordering leaves the handwriting behind".

The rail offers two separate duplicate actions, because they're different intentions:
**Duplicate** copies the handwriting too, and **Blank copy** gives a new page of the same
paper — same template, colour, size, orientation — with nothing on it, for a page you've
laid out as a form and fill in again. Both go through `duplicatePages(index, positions,
{content})` and one `duplicatePagesAt(positions, withContent)`; a blank copy blanks every
target slot (not just recycled ones) so "blank" is true on the server as well, and doesn't
inherit the source's label.

Content is stored per planner/page in the `PlannerInk` table via `/api/planner`
(the `strokes` column holds the serialized `PageElement[]`, text boxes included).
Saving is **durable**: every edit is mirrored to `localStorage` before the POST
and the mirror is cleared only on a 200, so a failed save degrades to "Offline"
(and syncs on reconnect / next load) instead of losing ink. The API route
self-heals a drifted `PlannerInk` table on a "no such table/column" error.

### User notebooks (`src/lib/planner-library.ts`)
The shipped planners are **read-only** — everyone shares them, so the viewer
refuses ink and offers "Make a copy to write" instead (`isOwned()` is the test;
existing ink still renders, frozen). Everything a user makes lives in IndexedDB
under "My Notebooks", and only those can be renamed, edited or deleted:
- An **import** keeps the original PDF in IndexedDB and renders pages on demand
  with pdf.js (`PdfRenderer`); its own hyperlinks are extracted at import time
  into tappable hotspots, so a PDF planner's month tabs work. `pdfKey` marks a
  PDF-backed planner.
- A **copy** stores no file — it points at its source via `sourceId` (reusing the
  source's page images) and only claims a fresh id, giving it its own ink layer.
  Duplicating asks for a name and whether to carry the handwriting across;
  `POST /api/planner/duplicate` clones the source's `PlannerInk` rows server-side.
- A **blank notebook** has no source at all: `paper` names a template in
  `src/lib/planner-paper.ts` (blank/lined/narrow/grid/dotted/Cornell/checklist),
  drawn as one SVG data URL shared by every page, plus a page shape and tint.
  Paper-backed notebooks are the only ones that can **add pages**, append-only —
  inserting mid-notebook would shuffle ink onto the wrong page numbers.

Ink syncs to the account (keyed by planner id), so it isn't lost with the device.
Deleting an import keeps its ink — re-importing the same PDF picks it back up —
while deleting a copy or blank notebook clears it (`DELETE /api/planner`), since
its id goes with it.

**Notebooks follow the account too.** A notebook's *record* (name, kind, paper,
`sourceId`, page count), its page index, its stickers and its custom templates
sync through `/api/sync` (`syncUserPlanners`, `syncRecords`, `syncSavedElements`,
`syncUserTemplates`) — so a copy made on a laptop is on the iPad, with its
handwriting. Same rules as settings above: newest `updatedAt` wins, and a delete
leaves a **tombstone** so an offline device doesn't push the notebook back up.

What can't travel is the **file**. An import's PDF (up to 100 MB) stays on the
device that imported it, and `pdfKey` names a blob in *this* device's IndexedDB —
so a merge keeps the local `pdfKey` rather than the remote one. Elsewhere the
notebook still appears, its card says "Add the PDF · Your handwriting is safe",
and `attachPdf()` re-links the same file to the same id (refusing a PDF with a
different page count, which would land ink on the wrong pages). Opening such a
notebook by URL bounces to the library instead of showing blank pages. A custom
template's picture *does* travel, inlined as a base64 data URL when ≤ 1.2 MB.

pdf.js is loaded at runtime as a native module from `/public` (`pdf.min.mjs` +
`pdf.worker.min.mjs`, copied by `scripts/copy-pdf-worker.mjs` from
predev/prebuild) with a `webpackIgnore` import — webpack's ESM interop mangles
pdf.js. The public copies are gitignored and regenerated on each build. Note that
pdf.js 6 removed `PDFDocumentProxy.destroy()`: only the loading task can end the
worker, which is why `openPdf()` returns `{ doc, close }`.

### Editing tools (shapes, selection, stickers)
A **selection** (`src/lib/planner-select.ts`) acts on object *identity*, never
pixels — ids live in a module `WeakMap` so they cost nothing in the payload.
Every action (move/resize/rotate/recolour/reorder/duplicate) rewrites the picked
elements; nothing is ever flattened to an image. Anything that must be round on
screen is computed in **"square space"** (x·aspect), since normalised coords
squash one axis. A whole gesture is one undo step (`beginBurst`/`endBurst` +
`setElements(next, {history:false})`).

The **Shapes tool** (`src/lib/planner-shapes.ts`) snaps a rough drawing to a
circle/ellipse/rectangle/square/triangle/polygon/line/arrow — but a recognised
shape stays an ordinary `Stroke` with ideal points and constant pressure, so
selection/undo/save/export all treat it like handwriting. Recognition is
propose-and-score: reduce the path to corners, propose candidates in preference
order, take the first that fits the gate, otherwise **decline** and keep the
drawing. Corners are found by the turn the *drawn* path makes over a short window
(the only way to tell a sharp elbow from a sweeping bend), fitted through the
window's samples so a shaky hand doesn't invent corners.

**Stickers** (`src/lib/planner-elements.ts`, `StickerTray.tsx`) save a selection
for reuse. A sticker is kept as its own vector strokes/text in its own square
space (x 0..aspect, y 0..1); stamping scales it by a target height, so it keeps
its shape on any page size. Stamped ink is ordinary page content. Stickers persist
in IndexedDB `ELEMENT_STORE` and sync to the account (a sticker is pure vectors, so
it travels in full); thumbnails are SVG drawn from the vectors.

### Rendering and export
`src/lib/planner-render.ts` is the one place strokes/text become pixels
(`drawStroke`, `drawTextBox`, `paintElements`) — shared by the live viewer and
export so they can't drift. The viewer lays text out as DOM (editable) and paints
only strokes to canvas; `paintElements` paints strokes then text to match the
on-screen z-order. Committed strokes are cached to an **offscreen canvas** and
blitted each frame (`inkCacheRef`/`inkCacheDirty` in the planner page); only the
live stroke repaints, so a page with thousands of strokes stays smooth. The cache
is invalidated on a committed-set / size / zoom change, not on selection changes.

`src/lib/planner-export.ts` exports a page/selection/notebook as PNG or PDF, and
an **annotated PDF** for imports (ink drawn onto the original PDF's real pages via
`pdf-lib`, so its own text stays selectable underneath). Every export is
composited fresh from the background image + vector ink at print resolution —
never a screenshot. `pdf-lib` is `import()`ed on demand, kept out of the initial
bundle. Notebook PDF export is capped (`EXPORT_PAGE_CAP`) and says when it exported
fewer pages than the notebook holds.

## Key Patterns

### Light-themed pages (Tasks, Calendar)
These pages force light backgrounds regardless of the app's dark theme:
- Use `text-black/XX` not `text-foreground/XX`
- Use fully opaque backgrounds (no `rgba()` transparency)
- Add `relative z-20` to sit above `AnimatedBackground`

### API Routes
All CRUD APIs follow the same pattern: GET (list/filter), POST (create), PATCH (update), DELETE (by id query param). Validation via Zod schemas in `src/lib/validations.ts`.

### Fonts
Instrument Serif loaded as CSS variable `--font-instrument-serif`. Used for decorative headings on tasks and calendar pages via inline `fontFamily` style.

### UI Components
The project uses shadcn/ui as the base component library (`src/components/ui/`). Animation components from magic-ui patterns are also available: `BlurFade`, `NumberTicker`, `ShineBorder`. framer-motion is installed for `motion` elements.

## Environment Variables

Required in `.env.local`:
- `NEXTAUTH_URL` — Base URL (http://localhost:3000 for dev)
- `NEXTAUTH_SECRET` — Session encryption key
- `DATABASE_URL` — SQLite path (default: `file:./dev.db`)

Optional (for OAuth):
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`
