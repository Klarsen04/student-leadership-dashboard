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

### Client-Side Storage
Some features use localStorage instead of the database:
- **Classes** (`leadership-os-classes`): Recurring class schedule blocks
- **Sub-calendars** (`leadership-os-calendars`): Calendar groupings and tags
- Hooks in `src/lib/use*.ts` manage these

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

Pages hold **strokes and text boxes** (`PageElement` in `src/lib/planner-ink.ts`).
The Text tool drops an editable, draggable, resizable text box; fonts come from
`PLANNER_FONTS` (Inter/Instrument Serif/Fredoka/Caveat/Patrick Hand/mono, wired
up as CSS variables in `src/app/layout.tsx`).

Content is stored per planner/page in the `PlannerInk` table via `/api/planner`
(the `strokes` column holds the serialized `PageElement[]`, text boxes included).
Saving is **durable**: every edit is mirrored to `localStorage` before the POST
and the mirror is cleared only on a 200, so a failed save degrades to "Offline"
(and syncs on reconnect / next load) instead of losing ink. The API route
self-heals a drifted `PlannerInk` table on a "no such table/column" error.

### User notebooks (`src/lib/planner-library.ts`)
The shipped planners are **read-only** — everyone shares them, so the viewer
refuses ink and offers "Make a copy to write" instead (`isOwned()` is the test;
existing ink still renders, frozen). Everything a user makes lives per-device in
IndexedDB under "My Notebooks", and only those can be renamed, edited or deleted:
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

Ink still syncs to the account (keyed by planner id), so it isn't lost with the
device. Deleting an import keeps its ink — re-importing the same PDF picks it back
up — while deleting a copy or blank notebook clears it (`DELETE /api/planner`),
since its id goes with it.

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
per-device in IndexedDB `ELEMENT_STORE`; thumbnails are SVG drawn from the vectors.

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
