# Luna Calendar - Mobile (Expo)

Cross-platform client (iOS, Android, and desktop web from one codebase) for Luna
Calendar, built with Expo + `expo-router`. Talks to the `apps/api` backend over
plain REST.

## Running

From the monorepo root, after the central `pnpm install` has been run once:

```bash
pnpm --filter luna-mobile start
```

Then press `i` (iOS simulator), `a` (Android emulator), or `w` (web) in the
Expo CLI, or scan the QR code with Expo Go on a physical device.

Package-local equivalents (`pnpm start`, `pnpm ios`, `pnpm android`, `pnpm web`)
also work if you `cd apps/mobile` first.

## Pointing at a backend

The API client (`lib/api.ts`) reads its base URL from `EXPO_PUBLIC_API_URL`:

```bash
EXPO_PUBLIC_API_URL=http://localhost:4000/api pnpm --filter luna-mobile start
```

If unset, it defaults to `http://localhost:4000/api`, which works for the iOS
simulator and for web. Two platform-specific gotchas:

- **Android emulator**: it cannot reach the host machine via `localhost` -
  use `http://10.0.2.2:4000/api` instead (`10.0.2.2` is the emulator's alias
  for the host's loopback address).
- **Physical device**: use your machine's LAN IP, e.g.
  `http://192.168.1.20:4000/api`, and make sure the phone is on the same
  network as the backend.

Auth uses `POST /auth/dev-login` (a stand-in for real sign-in - no Google/Apple
developer account needed to try the app) plus OAuth "connect" buttons that open
the backend's `/auth/google/start` and `/auth/lark/start` URLs in a browser
session and redirect back to the `lunacalendar://` deep-link scheme.

## App-store builds

This sandboxed session only produces a runnable Expo dev-client / Expo Go
experience. Real iOS App Store / Google Play builds require `eas build` with a
paid Expo account plus Apple Developer / Google Play Console accounts, which
is out of scope here. `app.json` is set up with placeholder icon/splash image
paths (`./assets/icon.png`, `./assets/splash.png`, `./assets/adaptive-icon.png`,
`./assets/favicon.png`) - **no actual image files were created**, so a real
build will need real assets dropped into `assets/` first.

## The lunar-recurrence feature (the headline feature)

This is the thing that makes Luna Calendar different from a generic calendar
app: events that repeat by the *lunar* calendar (anniversaries, death
anniversaries/giỗ, lunar-new-year-adjacent traditions), not just the Gregorian
one.

Walkthrough:

1. Sign in with dev sign-in on the login screen (any email/name).
2. On the **Lịch** (Calendar) tab, tap any day - this opens the **Sự kiện**
   (Events) tab for that day.
3. Tap **"+ Thêm sự kiện"** to open the new-event modal.
4. Fill in a title, pick a start date (e.g. a birthday you want tracked by the
   lunar calendar), then under **"Lặp lại"** (Recurrence) select **"Lặp theo
   Âm lịch"** (Repeat by lunar calendar).
5. Choose frequency (hàng năm/hàng tháng - yearly/monthly), an interval, and
   how the leap-month edge case should be handled for yearly rules whose
   anchor date falls in a leap lunar month.
6. As soon as a lunar rule is configured, a **"Xem trước các lần lặp lại tiếp
   theo"** (preview of the next occurrences) section appears below, showing
   the next 3-5 concrete solar dates this rule will produce - computed
   entirely client-side via `expandLunarRecurrence` from
   `@luna/lunar-calendar`, so you see exactly what you're creating before
   saving.
7. Save, and the event appears in the day's agenda tagged "Lặp lại theo Âm
   lịch".

The calendar grid itself (Lịch tab) also shows small lunar day numbers under
each solar day (toggle via Cài đặt/Settings -> "Hiển thị lịch"), with the
lunar month number surfaced on the first day of each lunar month and holiday
names for both calendars.

## Structure

- `app/` - `expo-router` file-based routes (`(auth)` group for sign-in,
  `(tabs)` group for the four main tabs, `event/new` and `event/[id]` as modal
  routes for the event form).
- `lib/api.ts` - the single-file typed REST client (patch here first if the
  backend's route shapes shift).
- `lib/calendarGrid.ts` - month-grid + lunar-span math backing the Calendar tab.
- `context/AuthContext.tsx`, `context/CalendarDisplayContext.tsx` - app-wide
  auth/session state and the lunar/solar/both display preference, both
  persisted via `AsyncStorage`.
- `components/EventForm.tsx` - the shared create/edit form (title, all-day,
  start/end date+time, and the three-way recurrence section described above).
- `components/SegmentedControl.tsx`, `components/DateTimeField.tsx` - small
  shared form controls (the latter falls back to a plain HTML date/time input
  on web, since `@react-native-community/datetimepicker` has no web
  implementation).
