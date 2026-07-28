# Student Leadership OS

## Quick Start

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Stack

- Next.js 15 (App Router, standalone output)
- TypeScript 5.3
- Tailwind CSS 3.4 with shadcn/ui components
- Prisma + SQLite (libsql adapter)
- NextAuth 4.24 (Credentials, Google, Azure AD)
- Vercel deployment

## Architecture

```
src/
  app/
    (app)/          # Authenticated routes (dashboard, tasks, goals, calendar, etc.)
    (auth)/         # Login/register
    api/            # REST API routes
  components/
    ui/             # shadcn/ui base components
    tasks/          # TapeShelf, CassetteDisplay, DayTabs
  lib/              # Utilities, hooks, auth config
```

## Key Patterns

### Light-themed pages (Tasks, Calendar)

These pages force a light background even though the app uses dark mode:
- Use `text-black/XX` NOT `text-foreground/XX`
- Use fully opaque backgrounds (no `rgba()` transparency)
- Add `relative z-20` to the page container to sit above AnimatedBackground
- Use `getGradientBg(accentRgb)` from TapeShelf.tsx for pre-blended gradients

### TaskTape Integration

Three-view state machine at `/tasks`:
1. **Shelf** — Gray background, 7 tape spines, "PLAY. PLAN. DONE."
2. **Tape Open** — 3D cassette centered with glow + "Open X's Tasks" button
3. **Board** — Two-panel: cassette+focus (left), Kanban+notes (right)

URL: `/tasks` = shelf, `/tasks?day=0-6` = board

Assets in `/public/tasktape/` (spine, cover, cassette PNGs per day + SVG logo)

### Calendar

5 views (Day, 3-Day, 5-Day, Week, Month) with:
- Class management (localStorage key: `leadership-os-classes`)
- Sub-calendars (localStorage key: `leadership-os-calendars`)
- Task sidebar with streak counter
- Seasonal SVG illustrations per month

### Fonts

Instrument Serif loaded via `next/font/google` as CSS variable `--font-instrument-serif`. Used for decorative headings on tasks and calendar pages.

## API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| /api/tasks | GET, POST, PATCH, DELETE | Task CRUD |
| /api/tasks/generate | POST | Generate recurring tasks |
| /api/calendar | GET, POST, PATCH, DELETE | Event CRUD + sync |
| /api/goals | GET, POST, PATCH, DELETE | Goal CRUD |
| /api/reflections | GET, POST, PATCH, DELETE | Reflection CRUD |
| /api/analytics | GET | Aggregated analytics |
| /api/notifications | GET | Upcoming events + due tasks |
| /api/export | GET | Data export (JSON/CSV) |

## Build & Deploy

```bash
npx next build          # Build (standalone output)
npx prisma db push      # Apply schema changes
```

Deployed on Vercel with `output: "standalone"` in next.config.js.

## Reference Resources

- AI Agent System Prompt: `/AI_AGENT_SYSTEM_PROMPT.md` (engineering standards)
- Reference repos: `~/repos/` (shadcn-ui, magic-ui, motion, tremor, etc.)
- Site cloner: `~/ditto.site` (capture any URL as Next.js app)
- TaskTape original: captured via ditto at `~/ditto.site/runs/tasktape.replit.app-tasks/`
