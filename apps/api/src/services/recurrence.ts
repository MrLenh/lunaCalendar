import { expandLunarRecurrence, VN_TIMEZONE, type SolarDate } from "@luna/lunar-calendar";
import type { CalendarEvent, RecurrenceRule, SolarRecurrenceRule } from "@luna/shared-types";

/** One concrete occurrence of a (possibly recurring) event, ready to sync/display. */
export interface Occurrence {
  /** Calendar date of the occurrence's start, "YYYY-MM-DD" — used as the EventInstance dedup key. */
  occurrenceDate: string;
  startAt: Date;
  endAt: Date;
}

const MS_PER_DAY = 86_400_000;
// Safety bound on loop iterations for the solar expansion below — keeps a
// pathological rule (e.g. a daily recurrence anchored decades in the past)
// from running unbounded. Fine for this app's 2-year sync window.
const MAX_STEPS = 100_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function solarDateKey(s: SolarDate): string {
  return `${s.year}-${pad2(s.month)}-${pad2(s.day)}`;
}

function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Parses a CalendarEvent's startAt/endAt (ISO timestamp, or "YYYY-MM-DD" if allDay). */
function parseEventBoundary(value: string): Date {
  return new Date(value);
}

/** Builds a Date for a given calendar day, preserving the wall-clock time-of-day taken from `timeSource`. */
function applyTimeOfDay(base: SolarDate, timeSource: Date, allDay: boolean): Date {
  if (allDay) {
    return new Date(Date.UTC(base.year, base.month - 1, base.day));
  }
  return new Date(
    Date.UTC(
      base.year,
      base.month - 1,
      base.day,
      timeSource.getUTCHours(),
      timeSource.getUTCMinutes(),
      timeSource.getUTCSeconds(),
      timeSource.getUTCMilliseconds()
    )
  );
}

function expandLunar(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const rule = event.recurrence as Extract<RecurrenceRule, { type: "lunar" }>;
  const startAt = parseEventBoundary(event.startAt);
  const endAt = parseEventBoundary(event.endAt);
  const durationMs = endAt.getTime() - startAt.getTime();

  const toSolarDate = (d: Date): SolarDate => ({
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  });

  const solarDates = expandLunarRecurrence(
    rule,
    toSolarDate(rangeStart),
    toSolarDate(rangeEnd),
    VN_TIMEZONE
  );

  return solarDates.map((s) => {
    const occStart = applyTimeOfDay(s, startAt, event.allDay);
    return {
      occurrenceDate: solarDateKey(s),
      startAt: occStart,
      endAt: new Date(occStart.getTime() + durationMs),
    };
  });
}

function addPeriod(date: Date, freq: SolarRecurrenceRule["freq"], amount: number): Date {
  const d = new Date(date);
  switch (freq) {
    case "daily":
      d.setUTCDate(d.getUTCDate() + amount);
      break;
    case "weekly":
      d.setUTCDate(d.getUTCDate() + amount * 7);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + amount);
      break;
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + amount);
      break;
  }
  return d;
}

/**
 * Expands a basic subset of RFC 5545 RRULE semantics: daily/weekly/monthly/
 * yearly frequency, `interval`, `byWeekday` (weekly only), `count` and
 * `until`. Not a full RFC 5545 implementation (no BYMONTHDAY, BYSETPOS,
 * exceptions, etc) — intentionally simple, per spec.
 */
function expandSolar(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const rule = event.recurrence as SolarRecurrenceRule;
  const interval = Math.max(1, rule.interval ?? 1);
  const startAt = parseEventBoundary(event.startAt);
  const endAt = parseEventBoundary(event.endAt);
  const durationMs = endAt.getTime() - startAt.getTime();
  const until = rule.until ? new Date(rule.until) : undefined;

  const results: Occurrence[] = [];
  const pushIfInRange = (occStart: Date) => {
    if (occStart.getTime() >= rangeStart.getTime() && occStart.getTime() <= rangeEnd.getTime()) {
      results.push({
        occurrenceDate: dateKey(occStart),
        startAt: occStart,
        endAt: new Date(occStart.getTime() + durationMs),
      });
    }
  };

  if (rule.freq === "weekly" && rule.byWeekday && rule.byWeekday.length > 0) {
    const weekdays = [...new Set(rule.byWeekday)].sort((a, b) => a - b);
    // Sunday-based week start containing the anchor, so weekday offsets (0=Sun..6=Sat) are additive.
    const anchorWeekStart = new Date(startAt);
    anchorWeekStart.setUTCDate(anchorWeekStart.getUTCDate() - anchorWeekStart.getUTCDay());

    let occurrenceIndex = 0;
    for (let week = 0; week < MAX_STEPS; week++) {
      const weekStart = addPeriod(anchorWeekStart, "weekly", week * interval);
      if (weekStart.getTime() > rangeEnd.getTime() + 7 * MS_PER_DAY) break;
      for (const wd of weekdays) {
        const occDay = new Date(weekStart);
        occDay.setUTCDate(occDay.getUTCDate() + wd);
        if (occDay.getTime() < startAt.getTime()) continue; // before the recurrence's own start
        if (until && occDay.getTime() > until.getTime()) return results;
        occurrenceIndex++;
        if (rule.count && occurrenceIndex > rule.count) return results;
        const occStart = applyTimeOfDay(
          { day: occDay.getUTCDate(), month: occDay.getUTCMonth() + 1, year: occDay.getUTCFullYear() },
          startAt,
          event.allDay
        );
        pushIfInRange(occStart);
      }
    }
    return results;
  }

  let current = new Date(startAt);
  let occurrenceIndex = 0;
  for (let steps = 0; steps < MAX_STEPS; steps++) {
    if (current.getTime() > rangeEnd.getTime()) break;
    if (until && current.getTime() > until.getTime()) break;
    occurrenceIndex++;
    if (rule.count && occurrenceIndex > rule.count) break;
    pushIfInRange(current);
    current = addPeriod(current, rule.freq, interval);
  }
  return results;
}

/**
 * Expands a local event into its concrete occurrences within
 * [rangeStart, rangeEnd] (inclusive), delegating lunar rules to
 * `@luna/lunar-calendar` and handling a practical subset of solar RRULE
 * semantics directly. A non-recurring event yields at most one occurrence.
 */
export function expandLocalEvent(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  if (!event.recurrence) {
    const startAt = parseEventBoundary(event.startAt);
    const endAt = parseEventBoundary(event.endAt);
    if (startAt.getTime() >= rangeStart.getTime() && startAt.getTime() <= rangeEnd.getTime()) {
      return [{ occurrenceDate: dateKey(startAt), startAt, endAt }];
    }
    return [];
  }
  if (event.recurrence.type === "lunar") {
    return expandLunar(event, rangeStart, rangeEnd);
  }
  return expandSolar(event, rangeStart, rangeEnd);
}
