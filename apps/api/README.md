# @luna/api

Backend for Luna Calendar: an Express + TypeScript API that stores events locally,
expands lunar and solar recurrence rules into concrete occurrences, and syncs
them to a user's connected Google Calendar and/or Lark (Feishu) Calendar,
pulling contacts from the same providers as candidate attendees.

## What's implemented

- **Auth**
  - Google OAuth2 (`googleapis`), scoped to `calendar` (read/write) and
    `contacts.readonly`.
  - Lark/Feishu OAuth via a thin `axios` REST client (there is no official
    Lark Node SDK): tenant access token fetch/caching, the "authen" web login
    flow, and user access token exchange.
  - App session JWTs (`jsonwebtoken`), sent as `Authorization: Bearer <token>`
    or an httpOnly `luna_token` cookie.
  - **`POST /api/auth/dev-login`** — a dev-only escape hatch (disabled when
    `NODE_ENV=production`) that upserts a local user by email/displayName and
    returns a session JWT with no OAuth round-trip at all. See "Testing
    without real OAuth apps" below for why this exists.
- **Providers** (`src/providers/`): a common `CalendarProviderClient`
  interface (`listEvents`, `createEvent`, `updateEvent`, `deleteEvent`,
  `listContacts`) implemented for Google (via `googleapis`) and Lark (via
  hand-rolled REST calls). Each stashes the local event id + occurrence date
  on the provider event so re-syncing recognizes it instead of duplicating it:
  Google uses `extendedProperties.private`; Lark has no such field on calendar
  events, so a hidden `[luna:eventId=...;date=...]` marker is appended to the
  event's `description` and stripped back out on read (see the comment in
  `larkCalendar.ts`).
- **Sync engine** (`src/services/syncEngine.ts` + `src/services/recurrence.ts`):
  expands a local event's recurrence (delegating lunar rules to
  `@luna/lunar-calendar`'s `expandLunarRecurrence`, and handling a practical
  subset of RFC 5545 for solar rules — daily/weekly/monthly/yearly,
  `interval`, `byWeekday`, `count`, `until`) over a rolling "now .. now+2
  years" window, then creates/updates the corresponding provider event per
  occurrence, tracked via the `EventInstance` table so re-syncs don't
  duplicate events. `pullFromProvider` lists a provider's events since the
  account's last sync and upserts them into the local `Event` table.
- **REST routes** (`src/routes/`), all under `/api`: `auth`, `events`
  (occurrence-expanded `GET`, validated `POST`/`PUT`/`DELETE`), `accounts`
  (list/disconnect), `contacts` (pull + merge), `sync/:provider` (manual pull
  trigger), and `lunar/convert` (direct `@luna/lunar-calendar` access for
  non-JS clients/debugging).
- **Storage**: Prisma + SQLite (`prisma/schema.prisma`). SQLite has no native
  JSON column type, so structured fields (recurrence rule, attendees,
  reminders, OAuth scopes) are stored as JSON-encoded `String` columns and
  (de)serialized at the app boundary (`src/lib/json.ts`, `src/lib/eventMapper.ts`).

## Getting real Google / Lark credentials

You only need these if you want to test the real OAuth flows instead of
`dev-login` (see below).

**Google** — https://console.cloud.google.com/apis/credentials
1. Create (or pick) a project, then enable the **Google Calendar API** and
   **People API** under "APIs & Services > Library".
2. Under "APIs & Services > Credentials", create an **OAuth client ID** of
   type "Web application".
3. Add `http://localhost:4000/api/auth/google/callback` as an authorized
   redirect URI (or your deployed `GOOGLE_REDIRECT_URI`).
4. Copy the generated client ID/secret into `.env` as `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`.

**Lark / Feishu** — https://open.feishu.cn/app
1. Create an app ("Create App" > custom app).
2. Under the app's "Credentials & Basic Info" page, copy the **App ID** and
   **App Secret** into `.env` as `LARK_APP_ID` / `LARK_APP_SECRET`.
3. Under "Security Settings", add `http://localhost:4000/api/auth/lark/callback`
   as a redirect URL.
4. Under "Permissions & Scopes", add the Calendar (`calendar:calendar`) and
   Contact (`contact:user.base:readonly` or similar) scopes and publish/enable
   the app for your tenant.

## Running

```bash
cp apps/api/.env.example apps/api/.env   # then fill in real values, or leave
                                          # OAuth fields blank and use dev-login
pnpm --filter @luna/api db:migrate       # creates prisma/dev.db and applies the schema
pnpm --filter @luna/api dev              # starts the API on http://localhost:4000
```

Run the unit tests with:

```bash
pnpm --filter @luna/api test
```

## Testing without real OAuth apps (`dev-login`)

This sandboxed environment cannot register real Google Cloud or Lark Open
Platform developer apps (both require an interactive signup + a real,
reachable redirect URL). So the API exposes:

```
POST /api/auth/dev-login
Content-Type: application/json

{ "email": "you@example.com", "displayName": "Your Name" }
```

which upserts a local `User` by email and returns `{ token, user }` — a
normal session JWT, usable exactly like one obtained via Google/Lark. This
lets the mobile app and reviewers exercise event CRUD, lunar/solar
conversion, and recurrence expansion end-to-end without any real OAuth
credentials. It is automatically disabled (`404`) whenever
`NODE_ENV=production`, and is not a substitute for actually connecting a
Google/Lark account — a user created this way simply has no `CalendarAccount`
rows, so `syncEventToProviders` has nothing to push to and events stay local
only, which is expected.

## Known simplifications

- Solar recurrence expansion covers the common RFC 5545 cases (see above) but
  not the full spec (no `BYMONTHDAY`, `BYSETPOS`, recurrence exceptions, etc).
- Lark's contact list endpoint (`listContacts`) reads the root department
  (`department_id=0`) rather than paging the full org tree — a reasonable
  stand-in for "coworkers this user can see" but not exhaustive.
- `EventInstance` dedup keys on `(parentEventId, occurrenceDate, provider)`;
  if an update changes a recurring event's schedule enough to shift an
  occurrence's date, the old provider event can be orphaned rather than moved
  (it will no longer be touched by future syncs of that parent event).
