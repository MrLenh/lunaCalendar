// Month-grid math for the calendar tab. Kept separate from the screen
// component so the date/lunar arithmetic can be reasoned about independently
// of rendering.
import dayjs, { type Dayjs } from "dayjs";
import {
  VN_TIMEZONE,
  getLunarHolidayName,
  getSolarHolidayName,
  solarToLunar,
} from "@luna/lunar-calendar";
import type { LunarDate } from "@luna/lunar-calendar";

export interface DayCell {
  date: Dayjs;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  lunar: LunarDate;
  isLunarMonthStart: boolean;
  holidayName?: string;
}

/** Vietnamese short weekday labels, indexed by dayjs' day() (0=Sunday..6=Saturday). */
export const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Builds a full grid (padded to whole weeks) of days covering the given month. */
export function buildMonthGrid(monthAnchor: Dayjs): DayCell[][] {
  const startOfMonth = monthAnchor.startOf("month");
  const endOfMonth = monthAnchor.endOf("month");
  const gridStart = startOfMonth.startOf("week");
  const gridEnd = endOfMonth.endOf("week");
  const today = dayjs();

  const cells: DayCell[] = [];
  let cursor = gridStart;
  while (cursor.isBefore(gridEnd) || cursor.isSame(gridEnd, "day")) {
    const lunar = solarToLunar(cursor.date(), cursor.month() + 1, cursor.year(), VN_TIMEZONE);
    const solarHoliday = getSolarHolidayName(cursor.month() + 1, cursor.date());
    const lunarHoliday = getLunarHolidayName(lunar.month, lunar.day);
    cells.push({
      date: cursor,
      isCurrentMonth: cursor.month() === monthAnchor.month(),
      isToday: cursor.isSame(today, "day"),
      isWeekend: cursor.day() === 0 || cursor.day() === 6,
      lunar,
      isLunarMonthStart: lunar.day === 1,
      holidayName: solarHoliday ?? lunarHoliday,
    });
    cursor = cursor.add(1, "day");
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/** Lunar month/year span covered by the given solar month, formatted for the header. */
export function lunarMonthSpanLabel(monthAnchor: Dayjs): string {
  const first = solarToLunar(1, monthAnchor.month() + 1, monthAnchor.year(), VN_TIMEZONE);
  const lastDay = monthAnchor.endOf("month").date();
  const last = solarToLunar(lastDay, monthAnchor.month() + 1, monthAnchor.year(), VN_TIMEZONE);

  const fmt = (l: LunarDate) => `${l.isLeapMonth ? "nhuận " : ""}${l.month}/${l.year}`;
  if (
    first.month === last.month &&
    first.year === last.year &&
    first.isLeapMonth === last.isLeapMonth
  ) {
    return `Âm lịch: tháng ${fmt(first)}`;
  }
  return `Âm lịch: tháng ${fmt(first)} – ${fmt(last)}`;
}
