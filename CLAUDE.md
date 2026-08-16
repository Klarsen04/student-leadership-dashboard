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
Beyond the shipped planners, users can **import a PDF** or **duplicate** any
notebook — both stored per-device in IndexedDB, listed under "My Notebooks".
- An **import** keeps the original PDF in IndexedDB and renders pages on demand
  with pdf.js (`PdfRenderer`); its links become tappable hotspots. `pdfKey` marks
  a PDF-backed planner.
- A **copy** stores no file — it points at its source via `sourceId` (reusing the
  source's page images) and only claims a fresh id, giving it a blank ink layer.
Ink still syncs to the account (keyed by planner id), so it isn't lost with the
device.

pdf.js is loaded at runtime as a native module from `/public` (`pdf.min.mjs` +
`pdf.worker.min.mjs`, copied by `scripts/copy-pdf-worker.mjs` from
predev/prebuild) with a `webpackIgnore` import — webpack's ESM interop mangles
pdf.js. The public copies are gitignored and regenerated on each build.

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
