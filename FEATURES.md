# Leadora — features, APIs and storage

A reference for the whole app: what each feature does, which endpoints it calls,
and where its data actually lives. Written against `main` at `6463e26`
(2026-08-21). `CLAUDE.md` is the working-rules document; this one is the map.

Where something is deliberately odd, the reason is given. Where something is
genuinely a loose end, it's listed under [Known wrinkles](#14-known-wrinkles-and-dead-code)
rather than being smoothed over.

---

## 1. The app at a glance

A personal planning app for a student leader: a calendar with a class timetable,
a task board, guided reflections, a handwriting planner, and analytics over all
of it. Warm, light-only, phone-first, installable as a PWA.

- **Framework** Next.js 15 (App Router, `output: "standalone"`), React 19, TypeScript 5.3
- **Styling** Tailwind + shadcn/ui, `Fredoka` for headings, `Instrument Serif`/`Caveat`/`Patrick Hand` for decorative and planner text
- **Motion** framer-motion / `motion`, GSAP (+ `@gsap/react`) for one-time entrances, Lenis for smooth scroll on the marketing page
- **Database** SQLite through Prisma 5 with the **libSQL adapter** — local `prisma/dev.db` in dev, Turso in production when `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` are set (`src/lib/prisma.ts`)
- **Auth** NextAuth 4, **JWT sessions** (no server-side session rows are consulted), Credentials + Google
- **Hosting** Vercel, live at `leadora.dpdns.org`
- **Charts** recharts. **PDF** pdf.js (viewer) + pdf-lib (annotated export)

### Routes

| Route | Group | Auth | What it is |
|---|---|---|---|
| `/` | public | — | Marketing homepage, cinematic scroll scenes |
| `/download` | public | — | PWA install instructions per platform |
| `/terms`, `/privacy` | public | — | Static legal pages |
| `/login` | `(auth)` | — | Sign in / create account, Google button |
| `/forgot-password`, `/reset-password` | `(auth)` | — | Password recovery (**not yet in `main`** — see §5.2) |
| `/dashboard` | `(app)` | yes | Today's overview, streaks, quick actions |
| `/tasks` | `(app)` | yes | Cassette-tape task board (`?day=0-6`) |
| `/calendar` | `(app)` | yes | Day / 5-day / week / month, classes, sub-calendars |
| `/reflections` | `(app)` | yes | Guided reflection pods + "Get inspired" |
| `/reflections/history` | `(app)` | yes | Everything saved, grouped, editable |
| `/reflections/saved` | `(app)` | yes | Post-save confirmation |
| `/planner` | `(app)` | yes | Handwriting planner library and viewer |
| `/analytics` | `(app)` | yes | Streaks, hours per calendar, time budgets |
| `/settings` | `(app)` | yes | Profile, semester dates, data export |

Two independent guards, doing different jobs:

- **`src/middleware.ts`** redirects to `/login?callbackUrl=…` when the
  `next-auth.session-token` (or `__Secure-` variant) cookie is missing on
  `/dashboard`, `/calendar`, `/analytics`, `/reflections`, `/planner`. It also
  sets the CSP and the other security headers on every matched response.
- **`src/app/(app)/layout.tsx`** is a client guard: `useSession()` →
  `router.replace("/login")` on `unauthenticated`. This is what covers `/tasks`
  and `/settings`, which are *not* in the middleware list.

Neither is the real access control. **Every API route independently calls
`getServerSession` and scopes every query by `userId`** — no data is reachable
without a session, whichever page renders.

---

## 2. Where data lives

Four tiers, chosen per feature on purpose.

| Tier | Used for | Survives | Notes |
|---|---|---|---|
| **Server DB** (Prisma) | events, tasks, reflections, planner ink | account, all devices | one row per thing, scoped by `userId` |
| **`UserData`** (JSON documents, via `/api/sync`) | sub-calendars, classes, roles, semester, time budget, user notebooks, page indexes, stickers, templates | account, all devices | last-write-wins per document; tombstoned deletes |
| **`localStorage`** | the same documents as above (as the fast local copy), plus per-day notes and recent colours | this browser | written first, always; the network is second |
| **IndexedDB** `leadora-planner-library` | notebook metadata, imported PDF blobs, page indexes, stickers, custom templates | this browser | the PDF *file* never leaves the device |

### The synced-setting contract (`src/lib/synced-setting.ts`)

`useSyncedSetting(spec)` is the primitive behind every "setting" that follows
the account. Its rules are the ones to keep:

1. **Local first.** `localStorage` is read *synchronously* on first render, so
   there's no flash of defaults and SSR is safe. An edit is stored locally
   before the network is touched — a failed push means "not on the other devices
   yet", never lost data.
2. **The server is pulled once per key per page load.** If it holds a document,
   it wins. That's what makes the iPad show what the laptop created.
3. **…unless the user edited first.** A local edit sets `dirty` and outranks the
   pull it raced, then gets pushed up instead of being overwritten.
4. **Pushes are debounced 600 ms**, so a burst of keystrokes in a rename box is
   one request.
5. **One value per key process-wide, with subscribers** — a calendar added in a
   dialog appears in the already-mounted sidebar.
6. `revive(raw)` per setting is where migration of older stored shapes lives
   (tags that used to be plain strings, a dropped `engine` field, classes with
   no `calendar`).

Settings on this primitive, with their keys:

| Key | Hook | Contents |
|---|---|---|
| `leadership-os-calendars` | `useCalendars` | sub-calendars (`id`, `name`, `color`, `visible`, `tags[]`) |
| `leadership-os-classes` | inline in the calendar page | class timetable blocks |
| `leadership-os-semester` | `useSemester` | term name, start/end, exam start |
| `leadership-os-time-budget` | `useTimeBudget` | hours/week target per calendar |
| `leadership-os-roles` | `useRoles` | role names (**no consumers** — see §14) |
| `leadership-os-goal-categories` | `useGoalCategories` | goal categories (**no consumers**) |

Not synced, browser-only by design: `leadership-os-note-<yyyy-MM-dd>` (the
daily note on the task board) and `leadership-os-recent-colours` (the colour
picker's shared recents).

---

## 3. Data model (`prisma/schema.prisma`)

| Model | Purpose | Notable fields / constraints |
|---|---|---|
| `User` | account | `password` nullable — a Google-only account has none |
| `Account`, `Session`, `VerificationToken` | NextAuth tables | `Session` rows exist but sessions are JWTs; `VerificationToken` is what password reset uses |
| `Event` | calendar events | `outlookId` **globally unique** — the key imported events upsert on (`google_<id>`); `category` = sub-calendar name, `role` = filter tag, `isLed`, `attended`, `actualMinutes` |
| `Task` | tasks and subtasks | `status` `todo`/`in_progress`/`done`; `priority` `low`→`urgent`; `recurrence` + `recurrenceEnd`; `parentTaskId` self-link |
| `Reflection` | one saved reflection | `type` `daily`/`weekly`/`monthly`; `mood`/`energy` 1–10; `podId`; `questions` = JSON `{question, answer}[]` |
| `PlannerInk` | one page of handwriting | unique `(userId, plannerId, page)`; `strokes` = serialized `PageElement[]` |
| `UserData` | one JSON document | unique `(userId, scope, key)`; `deletedAt` tombstone |
| `Person`, `Interaction`, `DailyCheckIn` | **not used by any current page** | left in place; `Event.interactions` still joins `Interaction` |

`Habit` / `HabitEntry` exist only as tables created by `/api/migrate` — there is
no Prisma model and no feature reading them.

### Migrations are not `prisma migrate`

The deployed database is brought forward by **`POST /api/migrate`**, an
idempotent, additive DDL endpoint (`CREATE TABLE IF NOT EXISTS`, `PRAGMA
table_info` + `ALTER TABLE ADD COLUMN`). Two consequences that shape the code:

- The live schema can lag behind `schema.prisma`, so the routes that write the
  newest tables **self-heal**: `withRepair()` in `/api/sync` and `/api/planner`
  catches `no such table|no such column|has no column named`, creates or patches
  the table in place, and retries the write once. `/api/tasks` does the same
  narrower thing with `ensureColumns()` (once per process), and
  `/api/reflections` retries a failed insert without `podId`/`questions`.
- **`/api/migrate` has no auth check.** It is additive-only and leaks nothing,
  but it is callable by anyone. Flagged in §14.

---

## 4. HTTP API

All routes are App Router handlers under `src/app/api/`. Unless stated: JSON in,
JSON out, `401 {error:"Unauthorized"}` without a session, and every query
filtered by `userId`. Bodies are validated by Zod schemas in
`src/lib/validations.ts`.

### `/api/auth/[...nextauth]`
NextAuth handler. Providers: **Credentials** (email + bcrypt compare; refuses an
account with `password: null`) and **Google**. Session strategy `jwt`; sign-in
page `/login`.

The `signIn` callback upserts OAuth users itself, using
**`account.providerAccountId` as the `User.id`** (so a Google user's row id is
their Google subject), and upserts the `Account` row with the tokens — which is
what makes Google Calendar sync possible later. The `jwt` callback carries
`accessToken`/`refreshToken`/`expiresAt`/`provider`, and `session` copies
`token.id` onto `session.user.id`.

### `/api/register` — POST
`{name?, email, password}`. Requires email + password, password ≥ 8 chars,
`409` if the email exists, bcrypt cost 12, returns `201 {success:true}`. Hand-
rolled validation (no Zod), and the email is stored **as typed**.

### `/api/tasks`
| Method | Shape | Notes |
|---|---|---|
| GET | `?status=&role=&priority=&page=1&limit=50` | `limit` capped at 100. Ordered `dueDate asc` in SQL, then **re-sorted by priority within the page** in JS. Returns `{tasks, total, page, limit}` |
| POST | `createTaskSchema` | Runs `ensureColumns()` once per process first. `201` with the task |
| PATCH | `updateTaskSchema` (`id` + any field) | Only supplied fields are written |
| DELETE | `?id=` | Deletes the task's subtasks first so none are orphaned |

### `/api/tasks/generate` — POST
Materialises recurring tasks **7 days ahead**. For every task with a
`recurrence` and no parent, computes the due dates (`daily`, `weekdays`,
`weekly`, `biweekly` — phase from the parent's `createdAt` — `monthly` by
day-of-month), skips dates past `recurrenceEnd`, and creates a child row with
`parentTaskId` set if one doesn't already exist for that day. Returns
`{created}`. Called once on every visit to `/tasks`.

### `/api/calendar`
| Method | Shape | Notes |
|---|---|---|
| GET | `?start=&end=&role=` | Overlap query (`startTime <= end AND endTime >= start`), includes `interactions`, ordered by start |
| POST | `createEventSchema` **or** `{action:"sync", start?, end?}` | The sync branch pulls Google Calendar (default window: now → +7 days) and returns `{synced, events}` |
| PATCH | `{id, …fields}` | Hand-rolled field allowlist, no Zod |
| DELETE | `?id=` | |

**Google sync** (`src/lib/google-calendar.ts`): reads the stored `google`
account, refreshes the access token against `oauth2.googleapis.com/token` when
`expires_at` has passed (persisting the new token), then
`GET https://www.googleapis.com/calendar/v3/calendars/primary/events` with
`singleEvents=true&orderBy=startTime&maxResults=250`. Each event upserts on
`outlookId = "google_<id>"`, updating title/times/location only, so local
`category`/`role` edits survive a re-sync. Every failure path returns `[]` — a
broken sync is quiet.

### `/api/reflections`
| Method | Shape | Notes |
|---|---|---|
| GET | `?type=` | **Latest 30**, newest first |
| POST | `createReflectionSchema` | One-per-period guard, then create. `409 {code:"DUPLICATE"}` if the period already has an entry |
| PATCH | `{id, content?, mood?, energy?, gratitude?, type?, questions?}` | |
| DELETE | `?id=` | Uses `deleteMany` deliberately (see §14) |

The guard: period bounds come from `userPeriod(now, tzOffset, daily|weekly|monthly)`,
i.e. **the user's timezone**, because the server runs UTC and an evening entry
would otherwise land on the wrong day. It is **per pod** when `podId` is sent
(so several pods can be done the same day) and per `type` otherwise.

### `/api/analytics` — GET `?period=week|month&tz=<getTimezoneOffset()>`
Returns `{eventsByCalendar, hoursByCalendar, totalEvents, tasksCompleted,
tasksPending, taskStreak, reflectionStreak, reflectionCount, wellness, daily}`.

- Window is `userPeriod(now, tz, weekly|monthly)`.
- Hours per calendar use `actualMinutes` when set, else the event's duration,
  and are **ignored above 720 minutes** so one mis-entered all-day event can't
  swamp the chart. Task `hours` in the window are added as a `"Tasks"` bucket.
- **Streaks** (`dayStreak`) count consecutive user-local day keys over the last
  60 days from the 60 most recent done-tasks / reflections. An empty *today*
  doesn't break the streak — it just doesn't count yet.
- `daily[]` (last 30 days of tasks/reflections/events per day) is only computed
  for `period=month`.
- Any query failure returns a **zeroed payload rather than a 500**, so the
  dashboard and analytics render instead of erroring.

### `/api/sync`
The account-scoped home for JSON documents. Scope is an **allowlist**:
`setting | notebook | pageIndex | sticker | template`. Keys must match
`/^[A-Za-z0-9][A-Za-z0-9._:-]{0,80}$/`. A document is ≤ **2 MB** and must parse
as JSON; a batch is ≤ **200** documents.

| Method | Shape | Notes |
|---|---|---|
| GET | `?scope=` / `?scope=&key=` | Returns `{scope, items:[{key, value, deleted, updatedAt}]}`. **Deleted documents come back too** — a device that missed the delete needs to hear about it |
| PUT | `{scope, key, value}` or `{scope, items:[…]}` | Upsert; **clears any tombstone**, so re-importing the same PDF brings the notebook back. The batch form is how a never-synced device uploads what it already had |
| DELETE | `?scope=&key=` | **Tombstone**: `value = "null"`, `deletedAt = now` |

The server never merges two versions of a document — newest `updatedAt` wins,
exactly as `/api/planner` treats a page of ink. A `FOREIGN KEY` failure (a JWT
outliving its user row, e.g. a re-seeded database) is translated to
`409 "Your account wasn't found — sign out and sign in again."`

### `/api/planner`
Ink for one page, keyed `(userId, plannerId, page)`. Planner ids match
`/^[a-z0-9][a-z0-9-]{0,39}$/` (default `collanote-2026`), page ≤ 2000, strokes
payload ≤ 2 MB.

- `GET ?planner=&page=N` → that page's elements
- `GET ?planner=&pages=all` → `{pages:[…]}`, the page numbers that have ink
- `POST` → save a page; `DELETE` → drop a notebook's ink (used when a copy or
  blank notebook is deleted)

### `/api/planner/duplicate` — POST `{from, to}`
Clones every `PlannerInk` row from one notebook id to another (upsert, so a
retry is safe, capped at 2000 pages). Server-side because the client has no
reason to hold 500 pages in memory to write them back. Refuses `from === to`.

### `/api/export` — GET `?type=all|events|tasks|reflections|checkins&format=json|csv`
Streams a download (`Content-Disposition: attachment`). JSON is a single object
keyed by collection; CSV is sections separated by `--- NAME ---` with quoting of
values containing commas, quotes or newlines.

### `/api/notifications` — GET
**Derived, not stored.** Upcoming events in the next 24 h (≤ 10) plus
not-done tasks due within 24 h (≤ 10), merged and sorted by time. There is no
notification table and nothing is ever marked read server-side.

### `/api/migrate` — POST
Idempotent additive DDL: creates `Habit`, `HabitEntry`, `PlannerInk`,
`UserData` (+ their indexes) if absent, and adds `Task.recurrence`,
`Task.recurrenceEnd`, `Task.parentTaskId`, `Reflection.podId`,
`Reflection.questions`, `UserData.deletedAt`, `PlannerInk.plannerId` if missing.
**No auth check.**

---

## 5. Accounts and authentication

### 5.1 Sign in and register (`/login`)

One card, two modes toggled by a link — sign in, or create an account (which
adds a Name field, POSTs `/api/register`, then immediately signs in with the
same credentials). Password field has a show/hide eye. `callbackUrl` is honoured
from the query string, default `/dashboard`. A Google button sits under an "or
continue with" divider.

Storage: `User` row (bcrypt cost 12) and, for Google, an `Account` row with the
OAuth tokens.

### 5.2 Password recovery (on `feat/slds-batch`, **not yet merged to `main`**)

Commit `c393e46`. Documented here because it's the current shape of the feature;
the files below don't exist on `main` yet.

**Flow.** `/login` → "Forgot password?" → `/forgot-password` (enter email) →
email → `/reset-password?token=…` → new password → signed straight in.

**`POST /api/auth/forgot-password`** `{email}`
- Returns an **identical** `{ok:true, message:"If that email has an account, a
  reset link is on its way."}` for every address — including on internal failure
  — so the endpoint can't be used to enumerate accounts.
- Throttled per address (3 / 15 min) and per IP (10 / 15 min), with
  `Retry-After` on the 429.
- The link's base URL comes from **`NEXTAUTH_URL` only**; the request origin is a
  dev-only fallback, so a poisoned `Host` header can't rewrite where the email
  points.

**`GET /api/auth/reset-password?token=`** — a **non-consuming** peek that answers
`valid | expired | invalid`, so opening last week's email says so immediately
instead of after a password has been typed twice. Throttled 60 / 15 min per IP;
on internal error it answers `{valid:true, unchecked:true}` rather than turning
someone away from a link that might be fine.

**`POST /api/auth/reset-password`** `{token, password}` — spends the token, writes
`bcrypt.hash(password, 12)`, clears the user's `Session` rows (belt and braces:
sessions are JWTs, so an already-signed-in device stays signed in until its token
expires), and returns `{ok:true, email}` so the page can sign the user in
without making them retype what they just chose.

**Token design** (`src/lib/password-reset.ts`)
- 32 random bytes, `base64url`, in the link; **only its SHA-256 is stored**, in
  the existing `VerificationToken` table under `identifier =
  "password-reset:<email>"`. A leaked database therefore hands over no working
  link. SHA-256 rather than bcrypt because the secret already has 256 bits of
  entropy — there's nothing for a slow hash to protect.
- **Single use** (the row is deleted whether or not the password change
  succeeds), **1 hour** TTL, **one live token per address** (issuing replaces the
  outstanding one, which also lets a user invalidate a request they didn't make).
  Expired rows are deleted on sight — nothing else reads them.
- An account with `password: null` (Google-only) is allowed to set one: proving
  control of the mailbox Google verified *is* legitimate recovery, and the
  Google button keeps working afterwards.

**Email** (`src/lib/mailer.ts`) goes out through the **Resend HTTP API** with
`fetch` — no SDK dependency. It's optional infrastructure: with no
`RESEND_API_KEY`, dev logs the link to the console and production simply can't
deliver. Nothing user-facing branches on delivery, or the reply would leak which
addresses exist. `EMAIL_REPLY_TO` sets a `reply_to` so an answer to the
`noreply@` sender reaches a real inbox instead of bouncing; unset, the field is
**omitted** rather than sent empty, which Resend would reject.

Throttling (`src/lib/throttle.ts`) is **in-process**: per instance, reset by a
cold start. It's a speed bump, not a quota, and the seam for Redis/Upstash later.

---

## 6. Dashboard (`/dashboard`)

Today's state in one screen.

- **Greeting** by time of day, first name from the session, and a one-line
  motivation chosen from pending/overdue counts.
- **Semester chip** from `useSemester`: "Week 4/13", "Starts in 9 days",
  "Term complete", plus an `EXAMS` pill during the exam period.
- **Three stat cards** (pending / overdue / due this week) with counting
  `NumberTicker`s.
- **Priority tasks**: overdue first (max 3), then up to 5 due on or before the
  end of this week. Each row links to that task's day on the board
  (`/tasks?day=<0-6>`, computed from the due date in local time).
- **Streaks & actions**: task and reflection streaks (green/orange once ≥ 7
  days) and four quick links.

APIs: `GET /api/tasks?status=todo`, `GET /api/analytics?period=week&tz=…`
(streaks only). Storage: none of its own — semester dates come from the synced
setting.

**Entrance.** On the first load of a browser session (`useFirstVisit`, and never
under `prefers-reduced-motion`) a ~2 s GSAP timeline builds the page: mascot
pops, greeting words stagger, stat cards fly in, then the two large cards rise.
`intro` gates both the markup and the timeline so **no element is ever animated
by GSAP and framer-motion at once** — otherwise the normal `Stagger` reveal
plays.

---

## 7. Tasks (`/tasks`)

A cassette-tape metaphor in three states, driven by the URL: `/tasks` is the
**shelf** (seven tape spines, one per weekday), and `/tasks?day=0-6` is the
**board** for that day, with a 3D tape-open animation between them.

**Board.** Three columns — To Do / In Progress / Done — with drag-and-drop
between them (`handleDrop` → `PATCH /api/tasks`), a per-column quick-add, a
fuller add dialog, a priority dot that cycles priority in place, and a
completion percentage for the day.

**Day filtering** is deliberately forgiving: a task with **no due date shows on
every day**, an overdue-and-unfinished task is pulled out into its own
"Overdue" group, and an overdue-and-done task stays on its original day.

**Subtasks** are rows with a `parentTaskId`. They render nested under their
parent with a progress count, never as standalone column cards — so every
top-level filter skips them. Deleting a parent deletes its subtasks server-side.

**Recurrence** is materialised, not computed at read time: every visit POSTs
`/api/tasks/generate`, which creates the next 7 days of instances as children of
the recurring task. (See §14 for how that interacts with subtask nesting.)

**Focus timer.** A 25-minute count-up per task with play/pause/reset and a toast
at the end. Purely client state — nothing is persisted, so a reload loses it.

**Daily note.** A free-text note per calendar day, `localStorage` only under
`leadership-os-note-<yyyy-MM-dd>`. It does **not** follow the account.

APIs: `GET /api/tasks?limit=100`, `POST/PATCH/DELETE /api/tasks`,
`POST /api/tasks/generate`. Assets in `/public/tasktape/`.

---

## 8. Calendar (`/calendar`)

The densest page in the app (~1,370 lines). Four views — **Day**, **5-Day**
(class schedule), **Week**, **Month** — on a 6 AM → 11 PM grid with
side-by-side layout for overlapping items.

**Two kinds of thing live on it.**

- **Events** are database rows (`Event`). Created/edited/deleted through
  `/api/calendar`; `category` names the sub-calendar and `role` is a free-text
  filter tag (defaulting to empty on purpose — a non-empty default would make
  untagged events phantom-match a chip of the same name).
- **Classes** are a **synced setting** (`leadership-os-classes`), not rows: a
  timetable repeats, so storing 40 instances of one lecture would be wrong.
  A `ClassBlock` has title, professor, location, credit hours, `days`
  (`MWF`/`TuTh`/`Mon`…), start/end time, colour, an owning sub-calendar, and an
  optional `startDate`/`endDate` term window (empty = repeats indefinitely).
  Legacy blocks are backfilled to the `"Personal"` calendar by `revive`.

**Sub-calendars and tags** (`useCalendars`, synced): each calendar has a name, a
Tailwind colour class, a `visible` flag and its own tags. `calHex()` maps the
class to hex for painting, passing `#rrggbb` through unchanged. Filter chips
across the top switch the active calendar and tag.

**Around the grid.** A "Next Up" banner with countdown and conflict detection, a
`findGaps` pass that surfaces free windows of ≥ 30 minutes between classes as
focus suggestions, week stats, an activity ring, a schedule heatmap, an
unscheduled-tasks panel, a mini calendar, a command palette, keyboard shortcuts,
export, focus mode, and a **seasonal SVG per month** (snowflake in January
through Christmas tree in December).

**Google import.** `POST /api/calendar {action:"sync"}` pulls the primary Google
calendar into `Event` rows (see §4). Imported events keep any local
category/role edits on re-sync.

APIs: `GET /api/calendar?start=&end=`, `POST/PATCH/DELETE /api/calendar`,
`GET /api/tasks?limit=100` (for the unscheduled panel and day agenda).

---

## 9. Reflections (`/reflections`)

### Pods and the guided flow

Six curated question packs (`src/lib/pods.ts`), each mapping to a reflection
`type`:

| Pod | Type | Theme |
|---|---|---|
| The Essentials | daily | three gentle questions to start the day |
| Friends | daily | how you connect with people |
| Self-esteem & School | daily | confidence and study |
| Getting Unstuck | daily | when something's stalled |
| Weekly Review | weekly | the week behind |
| Reflecting on the Month | monthly | the month behind |

A pod card shows its emoji, tagline and gradient; pods already done for their
current period are marked used (`usedPodIds` compares stored dates against the
current day/week/month client-side).

The flow is one question per screen with a directional slide, then a wellness
step (mood + energy sliders, 1–10) and an optional gratitude line. Every question
must have a real answer — enforced at the Next button *and* again at save.
Questions rotate: `pickQuestions(pod, priorCount)` walks the pod's wider
`questionBank` based on how many times that pod has been completed, so a repeat
reflection gets a fresh trio (reused once cycled).

On save, `POST /api/reflections` gets the joined `content`, `mood`, `energy`,
`gratitude`, `podId`, `questions` (the JSON Q&A pairs) **and
`tzOffset`** — the server computes the one-per-period window in the user's
timezone. A `409` is treated as information, not an error: a toast explains the
pod is already done for this period and the user goes back rather than being
stranded. Success routes to `/reflections/saved`, a confirmation page with a
confetti burst (skipped under reduced motion).

### Get inspired

A second tab with five long-form stories (`src/lib/inspireStories.ts`) — a hard
year, quiet confidence, recognising depression, songs that helped, breaking
free — opened in a reader overlay. Static content, no storage.

### History (`/reflections/history`)

Fetches saved reflections, groups them by month (or another `groupMode`), and
renders cards that can be edited (`EditReflectionDialog` → `PATCH`) or deleted
(`DELETE /api/reflections?id=`). Note `GET /api/reflections` returns **the latest
30**, so this page is a recent history rather than a complete archive.

---

## 10. Planner (`/planner`)

A digital handwriting notebook — the largest feature in the app (~4,400 lines in
the page, plus ~25 `src/lib/planner-*.ts` modules). `CLAUDE.md` holds the full
invariants; this is what it does and where the bytes go.

### The library

**Shipped planners** are PDFs pre-rendered to WebP pages under
`public/planner/<id>/` and listed in `public/planner/index.json`
(`scripts/add-planner.mjs` does the rendering, link extraction and registration;
needs `poppler` + `webp`):

| Id | Pages | Category | Navigation | Credit |
|---|---|---|---|---|
| `collanote-2026` | 513 | 365-Day Planners | template | CollaNote |
| `making-the-year-mine-2026` | 450 | 365-Day Planners | template | CollaNote |
| `back-to-school-2026` | 371 | Study Planners | template | CollaNote |
| `remarkably-2026` | 488 | Minimal Planners | manifest links | Remarkably Organized (MIT) |
| `focus-daily-2026` | 731 | Minimal Planners | manifest links | remarkable-daily-planner-generator (MIT) |
| `bujo-2026` | 92 | Journals & Notebooks | manifest links | bujo-pdf (MIT) |

These are **read-only** — everyone shares them, so the viewer refuses ink and
offers "Make a copy to write" instead (`isOwned()` is the test; ink written
before is still rendered, frozen).

**User notebooks** ("My Notebooks", `src/lib/planner-library.ts`) come in three
kinds, all in IndexedDB `leadora-planner-library` (v2; stores `meta`, `files`,
`pages`, `elements`, `templates`):

- **Import** — keeps the original PDF (≤ **100 MB**, ≤ **2000 pages**) in the
  `files` store and renders pages on demand with pdf.js. The PDF's own
  hyperlinks are extracted at import into tappable hotspots, so a PDF planner's
  month tabs work.
- **Copy** — stores no file. It points at its source via `sourceId` (reusing the
  source's page images) and claims a fresh id, giving it its own ink layer.
  `POST /api/planner/duplicate` clones the source's ink server-side when asked.
- **Blank notebook** — no source at all: `paper` names a template in
  `src/lib/planner-paper.ts` — 20 of them: four plain (blank/cream/grey/dark),
  five ruled (four line weights plus one with a margin rule), three dot grids,
  three grids, three graphs, Cornell and a checklist — drawn as one
  SVG data URL shared by every page, plus a page shape and tint. Paper-backed
  notebooks are the only ones that can **add pages**, and only by appending —
  inserting mid-notebook would shuffle ink onto the wrong page numbers.

### What follows the account, and what can't

- **Ink** → `PlannerInk` via `/api/planner`, keyed by planner id and page.
  Saving is durable: every edit is mirrored to `localStorage` *before* the POST
  and the mirror is cleared only on a 200, so a failed save degrades to
  "Offline" and syncs later instead of losing handwriting.
- **Notebook records, page indexes, stickers and custom templates** → `/api/sync`
  scopes `notebook`, `pageIndex`, `sticker`, `template`. A copy made on a laptop
  is on the iPad, with its handwriting. Deletes leave tombstones.
- **The file can't travel.** An import's PDF stays on the device that imported
  it; `pdfKey` names a blob in *this* device's IndexedDB, so a merge keeps the
  local `pdfKey` rather than the remote one. Elsewhere the notebook still
  appears, its card says "Add the PDF · Your handwriting is safe", and
  `attachPdf()` re-links the same file to the same id — refusing a PDF with a
  different page count, which would land ink on the wrong pages. Opening such a
  notebook by URL bounces back to the library.
- Deleting an **import** keeps its ink (re-importing the same PDF picks it back
  up); deleting a **copy** or **blank** notebook clears it, since its id goes
  with it.

### Writing

Four writing tools — pen, pencil, marker, highlighter — are the same `Stroke` on
the same pipeline; the tool is a field, not a separate renderer. Marker and
highlighter are pressure-flat (a felt tip doesn't taper); pen and pencil scale
with pressure; pencil adds a lighter offset pass with deterministic grain so it
looks identical in the viewer, a thumbnail and an export. A see-through stroke is
flattened and composited once per *stroke*, which is what stops overlapping
joins beading into dark blobs, and the highlighter multiplies — it darkens paper
but can never cover handwriting. Each tool keeps its own colour, thickness and
opacity.

**Erasing** has two modes: `stroke` takes the whole stroke the tip touched;
`precise` splits the polyline and keeps the surviving runs as ordinary strokes
with their original pressures — nothing is rasterised. One drag is one undo step.

**Editing**: a selection acts on object identity, never pixels — move, resize,
rotate, recolour, reorder, duplicate all rewrite the picked elements. Shapes can
be **dragged out** (line/arrow/rectangle/ellipse/triangle, Shift to constrain) or
sketched and recognised, and a recognised shape is still an ordinary stroke.
**Stickers** save a selection as reusable vectors; stamping scales by target
height. Anything placed — a sticker, a paste — is *armed* first: the next contact
inside the write area drops it centred on that point, with a 45 %-opacity ghost
showing exactly where it will land.

**Text boxes** are DOM while editing (fonts from `PLANNER_FONTS`) and painted to
canvas everywhere else, so the screen and an export agree.

**Navigation** without the toolbar: edge tap, sideways swipe, banked wheel/
trackpad travel, and hotspots from the PDF's own links or a template
(`src/lib/planner-templates.ts`). Hotspots marked `chrome` (printed tabs)
refuse ink and navigate from any tap; `content` hotspots (day cells) sit on
writable paper and only navigate from a finger or the hand tool. Ink is clipped
to the page's `writeArea`. `?debug=1` draws the write area and hotspots.

**Export** (`src/lib/planner-export.ts`) writes a page, a selection or a whole
notebook as PNG or PDF, always composited fresh from background + vector ink at
print resolution (long edge 2400 px) — never a screenshot. For imports it can
produce an **annotated PDF**: ink drawn onto the original pages with `pdf-lib`,
so the PDF's own text stays selectable underneath. Whole-notebook PDF export is
capped at **120 pages** and says so when it exported fewer than the notebook
holds. `pdf-lib` is dynamically imported to stay out of the initial bundle.

**pdf.js** is loaded at runtime as a native module from `/public`
(`pdf.min.mjs` + `pdf.worker.min.mjs`, copied by `scripts/copy-pdf-worker.mjs`
from `predev`/`prebuild`) with a `webpackIgnore` import, because webpack's ESM
interop mangles it. The public copies are gitignored and regenerated on every
build. pdf.js 6 removed `PDFDocumentProxy.destroy()`, which is why `openPdf()`
returns `{doc, close}`.

Also worth knowing: **the page must be exactly the shape of its paper** (the fit
invariant — the max-width cap comes from the frame's measured height via a
`ResizeObserver`, not a guess), **rail thumbnails** are that page's vectors
repainted over its real paper and governed by a per-slot content version, and
**reordering** moves content with the page because ink is keyed by slot.

---

## 11. Analytics (`/analytics`)

Two requests on mount — `period=week` for the numbers and `period=month` for the
30-day series — merged into one payload.

- **Metric cards**: task streak, reflection streak, tasks completed, total
  events, all counting up.
- **Productivity chart** (recharts area): completion rate over the last 30 days
  with a week-over-week arrow.
- **Hours per calendar** from `hoursByCalendar`, drawn against the **time
  budget** (`useTimeBudget`, synced setting): hours/week per calendar, editable
  inline, with the total refused above 168 h/week.
- **Wellness bars** from the mood/energy values on reflections in the window.

Storage: nothing of its own except the budgets. Everything else is derived
server-side from `Event`, `Task` and `Reflection`.

---

## 12. Settings, export and notifications

### `/settings`
- **Profile** — read-only: name, email and initial from the session. There is no
  profile editing.
- **Get the app** — link to `/download`.
- **Academic semester** — name, start, end and exam start, saved to the synced
  `leadership-os-semester` setting; drives the dashboard chip.
- **Export data** — a type dropdown plus JSON and CSV buttons that hit
  `/api/export` and download the blob client-side.

### Notification bell (in the sidebar)
`GET /api/notifications` on mount, on open, and every 5 minutes. Shows upcoming
events (next 24 h) and tasks due within 24 h, badge-counted. A task row can be
marked done in place (`PATCH /api/tasks`). "Enable push" only requests browser
`Notification` permission — there is no push subscription and nothing is ever
sent. See §14 for what the dismiss button actually does.

---

## 13. Cross-cutting mechanics

**Security headers** (`src/middleware.ts`) — a per-request CSP nonce is injected
via the `x-nonce` header and read in the root layout. `script-src` is
nonce-only (plus `'unsafe-eval'` outside production for webpack HMR, and
`va.vercel-scripts.com`); `style-src` keeps `'unsafe-inline'` because React SSR
and GSAP/framer write dynamic inline styles that can't carry a nonce — and a
nonce there would silently disable `'unsafe-inline'` per spec. Inline *style*
can't execute JS, so the real injection boundary stays strict. Also set:
`Strict-Transport-Security` (2 years, preload), `X-Frame-Options: DENY`,
`nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` denying camera/microphone/geolocation,
`worker-src 'self' blob:` for pdf.js, `frame-ancestors 'none'`.

**Timezones** (`src/lib/userTime.ts`) — `toUserClock`, `userDayKey`,
`userDayKeyAgo`, `userPeriod` take the client's `getTimezoneOffset()` so day,
week and month boundaries are the user's, not the server's. Vercel runs UTC;
without this, an evening reflection lands on tomorrow and blocks the next one.

**PWA** — `public/manifest.json` (standalone, `start_url: /dashboard`, cream
theme, maskable icons), `public/sw.js` (cache `slo-v2`, precaches
`/dashboard`, `/calendar`, `/tasks`, `/reflections` **individually** with
`allSettled`, because one 404 in `cache.addAll()` used to fail the whole
install; same-origin GETs only, to avoid becoming an SSRF proxy), registered by
`/register-sw.js` with the CSP nonce. `/download` detects platform and
standalone mode (`usePwaInstall`) and shows the right install steps, using the
native install prompt where the browser offers one.

**Motion and one-time entrances** — each app page has a "signature entrance"
that plays **once per browser session** (`useFirstVisit`, `useIntroReflect`,
`useShelfIntro`, `useIntroCalEntrance`), never under `prefers-reduced-motion`,
and always gated so a node is animated by GSAP *or* framer-motion, never both.

**Light-themed pages** — Tasks and Calendar force light surfaces regardless of
theme: `text-black/XX` rather than `text-foreground/XX`, fully opaque
backgrounds, and `relative z-20` to sit above `AnimatedBackground`. The app is
locked to light (`forcedTheme="light"`).

**Environment variables**

| Variable | Required | Purpose |
|---|---|---|
| `NEXTAUTH_URL` | yes | base URL; also the only trusted source for reset links |
| `NEXTAUTH_SECRET` | yes | JWT signing |
| `DATABASE_URL` | yes | SQLite path (`file:./dev.db`) |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | prod | switches Prisma to the libSQL/Turso adapter |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional | Google sign-in **and** calendar sync |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional | password-reset email (dev logs the link without it) |
| `EMAIL_REPLY_TO` | optional | an address a reply reaches; the header is omitted when unset |

**CI** (`.github/workflows/`) — `ci.yml` runs Lint, Typecheck (`tsc --noEmit`),
Build, Format (advisory) and `npm audit` (advisory) as separate jobs so each can
be a required check. Alongside it: CodeQL, dependency review, gitleaks secret
scan, Lighthouse (advisory), bundle-size comment, Conventional-Commit PR titles,
auto-labelling, a required `deploy-preview` label and a workflow that asks the
Vercel API to redeploy when that label lands. **There is no test framework** —
verification is `tsc`, `next build`, and ad-hoc Playwright scripts driven with an
injected session cookie.

---

## 14. Known wrinkles and dead code

Not bugs being hidden — things a reader will otherwise trip over.

1. **`POST /api/migrate` has no auth check.** It's idempotent and additive-only,
   so the blast radius is small, but anyone can call it.
2. **Generated recurring tasks are children.** `/api/tasks/generate` creates each
   instance with `parentTaskId` pointing at the recurring task, while the board
   treats any row with a `parentTaskId` as a *subtask* and hides it from the day
   columns. So instances appear nested under the parent rather than as cards on
   their own day.
3. **The Settings export dropdown offers "Goals"**, but `/api/export` handles
   `events`, `tasks`, `reflections`, `checkins` and `all` — and there is no
   `Goal` model. Choosing it downloads `{}`.
4. **Dismissing (×) a task notification deletes the task**, with the toast "Task
   deleted". The affordance reads like "hide this".
5. **`categorizeEvent()` in `src/lib/microsoft-graph.ts` is a stub** returning
   `{category:"Personal", role:"Personal"}` unconditionally. Every imported
   Google event therefore lands on the Personal calendar. Microsoft sign-in
   itself has been removed; the file survives for this one function.
6. **Google sync upserts on `outlookId` alone** (`Event.outlookId` is globally
   unique, not per user), so two users importing an event with the same Google id
   would contend for one row. Google ids are per-calendar, so this is
   theoretical.
7. **`useRoles` and `useGoalCategories` have no consumers.** Leftovers from the
   removed Goals/People features, still syncing their documents.
8. **`Person`, `Interaction`, `DailyCheckIn` (and the `Habit`/`HabitEntry`
   tables) are unused** by any current page. `/api/export?type=checkins` will
   still dump `DailyCheckIn`.
9. **`GET /api/reflections` returns only the latest 30**, which quietly caps the
   history page.
10. **`/api/tasks` sorts by priority in JS after paginating in SQL**, so priority
    ordering holds within a page, not across the whole list.
11. **`/api/register` doesn't normalise the email** (no lowercasing, no Zod),
    while password reset normalises to lowercase — so `A@b.com` registered and
    `a@b.com` recovered are different rows to one and the same to the other.
12. **`/api/calendar` PATCH has no Zod schema** (hand-rolled field allowlist),
    unlike POST.
13. **`Reflection` DELETE uses `deleteMany`** on purpose: `delete()` with a
    compound `id`-plus-`userId` filter behaved inconsistently on the libSQL/Turso
    adapter and left the row in place, which then reported a false duplicate on
    the next reflection in that pod.
14. **A known pre-existing hydration warning** on every page: the nonce on the
    `/register-sw.js` script tag differs between server and client render.
15. **`.env.example` still lists `AZURE_AD_*`** even though the Microsoft
    provider has been removed from `src/lib/auth.ts`, and it doesn't list the
    Turso variables production actually needs.
16. **`@aikidosec/firewall` is a dependency and is declared in
    `serverExternalPackages`, but nothing imports it** — there is no
    `instrumentation.ts`, so it isn't running.
17. **`ios/` and `android/` are untracked leftovers** from an abandoned Capacitor
    experiment (`feat/mobile-capacitor`); they carry no build config on `main`.
    The install story is the PWA.
