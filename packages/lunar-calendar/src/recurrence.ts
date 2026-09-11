import { astro } from "./astro";
import {
  SolarDate,
  VN_TIMEZONE,
  isValidLeapMonth,
  lunarMonthLength,
  lunarToSolar,
  solarToLunar,
} from "./convert";

export type LunarRecurrenceFreq = "yearly" | "monthly";

/**
 * How to resolve a yearly recurrence whose anchor date falls in a leap
 * lunar month, for a target lunar year that has no matching leap month.
 */
export type LeapMonthPolicy = "same-month" | "skip";

export interface LunarRecurrenceRule {
  type: "lunar";
  freq: LunarRecurrenceFreq;
  /** Repeat every N years (freq=yearly) or N lunar months (freq=monthly). Default 1. */
  interval?: number;
  /** The solar date of the first occurrence; its lunar month/day is the anchor. */
  anchor: SolarDate;
  /** Only relevant when freq=yearly and the anchor falls in a leap month. */
  leapMonthPolicy?: LeapMonthPolicy;
  /** Stop after this many occurrences (inclusive of the anchor). */
  count?: number;
  /** Stop once occurrences would fall after this solar date (inclusive). */
  until?: SolarDate;
}

function toDate(s: SolarDate): Date {
  return new Date(Date.UTC(s.year, s.month - 1, s.day));
}

function cmp(a: SolarDate, b: SolarDate): number {
  return toDate(a).getTime() - toDate(b).getTime();
}

/**
 * Expand a lunar recurrence rule into concrete solar dates, limited to the
 * inclusive [rangeStart, rangeEnd] window (and to `count`/`until` if set).
 */
export function expandLunarRecurrence(
  rule: LunarRecurrenceRule,
  rangeStart: SolarDate,
  rangeEnd: SolarDate,
  timeZone: number = VN_TIMEZONE
): SolarDate[] {
  const interval = Math.max(1, rule.interval ?? 1);
  const anchorLunar = solarToLunar(
    rule.anchor.day,
    rule.anchor.month,
    rule.anchor.year,
    timeZone
  );
  const results: SolarDate[] = [];

  if (rule.freq === "yearly") {
    // Search a generous range of lunar years so we don't miss occurrences
    // near the edges of [rangeStart, rangeEnd].
    const firstYear = Math.min(anchorLunar.year, rangeStart.year - 1);
    const lastYear = Math.max(anchorLunar.year, rangeEnd.year + 1);
    let occurrenceIndex = 0;
    for (let y = anchorLunar.year; y <= lastYear; y += interval) {
      if (y < firstYear) continue;
      let leap = anchorLunar.isLeapMonth;
      if (leap && !isValidLeapMonth(anchorLunar.month, y, timeZone)) {
        if (rule.leapMonthPolicy === "skip") {
          continue;
        }
        leap = false; // "same-month": fall back to the regular month
      }
      const maxDay = lunarMonthLength(anchorLunar.month, y, leap, timeZone);
      const day = Math.min(anchorLunar.day, maxDay);
      const solar = lunarToSolar(day, anchorLunar.month, y, leap, timeZone);
      if (rule.until && cmp(solar, rule.until) > 0) break;
      occurrenceIndex++;
      if (rule.count && occurrenceIndex > rule.count) break;
      if (cmp(solar, rangeStart) >= 0 && cmp(solar, rangeEnd) <= 0) {
        results.push(solar);
      }
    }
    return results;
  }

  // freq === "monthly": walk lunar months chronologically (including leap
  // months) starting from the anchor's month, stepping `interval` months.
  const anchorMonthStart = lunarToSolar(
    1,
    anchorLunar.month,
    anchorLunar.year,
    anchorLunar.isLeapMonth,
    timeZone
  );
  let k = Math.round(
    (astro.jdFromDate(anchorMonthStart.day, anchorMonthStart.month, anchorMonthStart.year) -
      2415021.076998695) /
      29.530588853
  );

  const rangeStartJd = astro.jdFromDate(rangeStart.day, rangeStart.month, rangeStart.year);
  const rangeEndJd = astro.jdFromDate(rangeEnd.day, rangeEnd.month, rangeEnd.year);
  // Step back a bit before the range in case interval/day math lands early.
  while (
    astro.getNewMoonDay(k, timeZone) >
    rangeStartJd - 40
  ) {
    k -= interval;
  }

  let occurrenceIndex = 0;
  const MAX_STEPS = 100000;
  for (let steps = 0; steps < MAX_STEPS; steps++, k += interval) {
    const monthStartJd = astro.getNewMoonDay(k, timeZone);
    if (monthStartJd > rangeEndJd + 40) break;
    const nextMonthStartJd = astro.getNewMoonDay(k + 1, timeZone);
    const monthLen = nextMonthStartJd - monthStartJd;
    const day = Math.min(anchorLunar.day, monthLen);
    const [d, m, y] = astro.jdToDate(monthStartJd + day - 1);
    const solar: SolarDate = { day: d, month: m, year: y };
    if (cmp(solar, { day: rule.anchor.day, month: rule.anchor.month, year: rule.anchor.year }) < 0) {
      continue;
    }
    if (rule.until && cmp(solar, rule.until) > 0) break;
    occurrenceIndex++;
    if (rule.count && occurrenceIndex > rule.count) break;
    if (cmp(solar, rangeStart) >= 0 && cmp(solar, rangeEnd) <= 0) {
      results.push(solar);
    }
  }
  return results;
}
