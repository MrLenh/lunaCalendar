import { test } from "node:test";
import assert from "node:assert/strict";
import { solarToLunar } from "@luna/lunar-calendar";
import type { CalendarEvent } from "@luna/shared-types";
import { expandLocalEvent } from "./recurrence";

function baseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt1",
    ownerId: "user1",
    title: "Test event",
    startAt: "2026-01-10T09:00:00.000Z",
    endAt: "2026-01-10T10:30:00.000Z",
    allDay: false,
    timeZone: "Asia/Ho_Chi_Minh",
    provider: "local",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("non-recurring event: single occurrence when inside range", () => {
  const event = baseEvent();
  const occs = expandLocalEvent(event, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T23:59:59Z"));
  assert.equal(occs.length, 1);
  assert.equal(occs[0].occurrenceDate, "2026-01-10");
  assert.equal(occs[0].startAt.toISOString(), "2026-01-10T09:00:00.000Z");
  assert.equal(occs[0].endAt.toISOString(), "2026-01-10T10:30:00.000Z");
});

test("non-recurring event: no occurrence when outside range", () => {
  const event = baseEvent();
  const occs = expandLocalEvent(event, new Date("2026-02-01T00:00:00Z"), new Date("2026-02-28T23:59:59Z"));
  assert.equal(occs.length, 0);
});

test("solar daily recurrence respects interval and count", () => {
  const event = baseEvent({
    recurrence: { type: "solar", freq: "daily", interval: 2, count: 4 },
  });
  const occs = expandLocalEvent(event, new Date("2026-01-01T00:00:00Z"), new Date("2026-03-01T00:00:00Z"));
  assert.deepEqual(
    occs.map((o) => o.occurrenceDate),
    ["2026-01-10", "2026-01-12", "2026-01-14", "2026-01-16"]
  );
  // duration preserved
  for (const o of occs) {
    assert.equal(o.endAt.getTime() - o.startAt.getTime(), 90 * 60 * 1000);
  }
});

test("solar weekly recurrence with byWeekday expands to matching weekdays", () => {
  // 2026-01-10 is a Saturday (day 6). Ask for Mon(1)/Wed(3)/Fri(5) weekly.
  const event = baseEvent({
    recurrence: { type: "solar", freq: "weekly", interval: 1, byWeekday: [1, 3, 5], count: 6 },
  });
  const occs = expandLocalEvent(event, new Date("2026-01-01T00:00:00Z"), new Date("2026-02-28T00:00:00Z"));
  const dates = occs.map((o) => o.occurrenceDate);
  // All results should be Monday, Wednesday, or Friday.
  for (const d of dates) {
    const day = new Date(`${d}T00:00:00Z`).getUTCDay();
    assert.ok([1, 3, 5].includes(day), `${d} should be Mon/Wed/Fri, got weekday ${day}`);
  }
  assert.equal(dates.length, 6);
  // Chronologically sorted.
  const sorted = [...dates].sort();
  assert.deepEqual(dates, sorted);
});

test("solar yearly recurrence with until stops correctly", () => {
  const event = baseEvent({
    recurrence: { type: "solar", freq: "yearly", interval: 1, until: "2028-06-01" },
  });
  const occs = expandLocalEvent(event, new Date("2026-01-01T00:00:00Z"), new Date("2030-01-01T00:00:00Z"));
  assert.deepEqual(
    occs.map((o) => o.occurrenceDate),
    ["2026-01-10", "2027-01-10", "2028-01-10"]
  );
});

test("allDay event occurrences fall at UTC midnight with zero-shifted time", () => {
  const event = baseEvent({
    allDay: true,
    startAt: "2026-01-10",
    endAt: "2026-01-11",
    recurrence: { type: "solar", freq: "monthly", interval: 1, count: 2 },
  });
  const occs = expandLocalEvent(event, new Date("2026-01-01T00:00:00Z"), new Date("2026-04-01T00:00:00Z"));
  assert.deepEqual(
    occs.map((o) => o.occurrenceDate),
    ["2026-01-10", "2026-02-10"]
  );
  for (const o of occs) {
    assert.equal(o.startAt.getUTCHours(), 0);
    assert.equal(o.endAt.getTime() - o.startAt.getTime(), 24 * 60 * 60 * 1000);
  }
});

test("lunar recurrence delegates to @luna/lunar-calendar and preserves the anchor's lunar month/day", () => {
  // Anchor on a solar date; whatever lunar (month, isLeapMonth) that maps to,
  // every yearly occurrence should map back to the same lunar month/day
  // (mirroring the underlying package's own semantics) since this rule has
  // no leap-month edge case forced by leapMonthPolicy.
  const anchorSolar = { day: 10, month: 2, year: 2024 };
  const anchorLunar = solarToLunar(anchorSolar.day, anchorSolar.month, anchorSolar.year);

  const event = baseEvent({
    startAt: "2024-02-10T08:00:00.000Z",
    endAt: "2024-02-10T09:00:00.000Z",
    recurrence: { type: "lunar", freq: "yearly", interval: 1, anchor: anchorSolar },
  });

  const occs = expandLocalEvent(event, new Date("2024-01-01T00:00:00Z"), new Date("2027-12-31T00:00:00Z"));
  assert.ok(occs.length >= 3, "expected at least 3 yearly occurrences across the range");

  for (const occ of occs) {
    const [y, m, d] = occ.occurrenceDate.split("-").map(Number);
    const lunar = solarToLunar(d, m, y);
    if (lunar.isLeapMonth === anchorLunar.isLeapMonth) {
      assert.equal(lunar.month, anchorLunar.month);
    }
    // Day-of-month may clamp down on shorter lunar months; never past the anchor day.
    assert.ok(lunar.day <= anchorLunar.day);
  }

  // Sanity check against the well-known Lunar New Year's Day (mùng 1 Tết) 2024.
  assert.equal(anchorLunar.month, 1);
});

test("duration is preserved across timed occurrences", () => {
  const event = baseEvent({
    startAt: "2026-01-10T22:00:00.000Z",
    endAt: "2026-01-11T00:30:00.000Z", // spans midnight UTC
    recurrence: { type: "solar", freq: "daily", interval: 1, count: 3 },
  });
  const occs = expandLocalEvent(event, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z"));
  assert.equal(occs.length, 3);
  const durationMs = 2.5 * 60 * 60 * 1000;
  for (const o of occs) {
    assert.equal(o.endAt.getTime() - o.startAt.getTime(), durationMs);
  }
});
