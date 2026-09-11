import { astro } from "./astro";

/** Vietnam standard time offset used for all conversions (UTC+7). */
export const VN_TIMEZONE = 7;

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  /** true if `month` is a leap month in this lunar year */
  isLeapMonth: boolean;
}

export interface SolarDate {
  day: number;
  month: number;
  year: number;
}

/**
 * Convert a solar (Gregorian) date to its lunar equivalent.
 */
export function solarToLunar(
  day: number,
  month: number,
  year: number,
  timeZone: number = VN_TIMEZONE
): LunarDate {
  const dayNumber = astro.jdFromDate(day, month, year);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = astro.getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = astro.getNewMoonDay(k, timeZone);
  }
  let a11 = astro.getLunarMonth11(year, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = year;
    a11 = astro.getLunarMonth11(year - 1, timeZone);
  } else {
    lunarYear = year + 1;
    b11 = astro.getLunarMonth11(year + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = astro.getLeapMonthOffset(a11, timeZone);
    // `diff === leapMonthDiff` is the *regular* month right before the
    // inserted leap month, so it keeps the unadjusted month number; only
    // the leap month itself (diff === leapMonthDiff + 1) and months after
    // it shift down by one.
    if (diff > leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff + 1) {
        lunarLeap = true;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth -= 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return { day: lunarDay, month: lunarMonth, year: lunarYear, isLeapMonth: lunarLeap };
}

/**
 * Convert a lunar date to its solar (Gregorian) equivalent.
 * @param isLeapMonth must be set when the desired month is the intercalary
 * (leap) month of that lunar year; ignored if that year has no leap month
 * matching `month`.
 */
export function lunarToSolar(
  day: number,
  month: number,
  year: number,
  isLeapMonth: boolean = false,
  timeZone: number = VN_TIMEZONE
): SolarDate {
  let a11: number, b11: number;
  if (month < 11) {
    a11 = astro.getLunarMonth11(year - 1, timeZone);
    b11 = astro.getLunarMonth11(year, timeZone);
  } else {
    a11 = astro.getLunarMonth11(year, timeZone);
    b11 = astro.getLunarMonth11(year + 1, timeZone);
  }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = month - 11;
  if (off < 0) {
    off += 12;
  }
  if (b11 - a11 > 365) {
    const leapOff = astro.getLeapMonthOffset(a11, timeZone);
    // `off === leapOff` is the *regular* month that precedes the inserted
    // leap month, so it must NOT be bumped; only the leap month itself
    // (explicitly requested) or months strictly after it shift by one.
    if (isLeapMonth || off > leapOff) {
      off += 1;
    }
  }
  const monthStart = astro.getNewMoonDay(k + off, timeZone);
  const [d, m, y] = astro.jdToDate(monthStart + day - 1);
  return { day: d, month: m, year: y };
}

/** Returns the number of days in the given lunar month/year. */
export function lunarMonthLength(
  month: number,
  year: number,
  isLeapMonth: boolean = false,
  timeZone: number = VN_TIMEZONE
): number {
  const start = lunarToSolar(1, month, year, isLeapMonth, timeZone);
  const startJd = astro.jdFromDate(start.day, start.month, start.year);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  // If current month is a leap month, the following month (same number,
  // non-leap) comes right after it; otherwise check whether the following
  // month itself is a leap month by comparing new moon days directly.
  let nextStartJd: number;
  if (isLeapMonth) {
    const next = lunarToSolar(1, month, year, false, timeZone);
    nextStartJd = astro.jdFromDate(next.day, next.month, next.year);
  } else {
    const k = Math.floor((startJd - 2415021.076998695) / 29.530588853);
    nextStartJd = astro.getNewMoonDay(k + 1, timeZone);
    void nextMonth;
    void nextYear;
  }
  return nextStartJd - startJd;
}

export function isValidLeapMonth(
  month: number,
  year: number,
  timeZone: number = VN_TIMEZONE
): boolean {
  const a11 =
    month < 11
      ? astro.getLunarMonth11(year - 1, timeZone)
      : astro.getLunarMonth11(year, timeZone);
  const b11 =
    month < 11
      ? astro.getLunarMonth11(year, timeZone)
      : astro.getLunarMonth11(year + 1, timeZone);
  if (b11 - a11 <= 365) return false;
  const leapOff = astro.getLeapMonthOffset(a11, timeZone);
  let leapMonth = leapOff - 2;
  if (leapMonth < 0) leapMonth += 12;
  leapMonth += 1;
  return leapMonth === month;
}
