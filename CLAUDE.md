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
