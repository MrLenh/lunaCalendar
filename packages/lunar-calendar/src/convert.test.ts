import { test } from "node:test";
import assert from "node:assert/strict";
import { solarToLunar, lunarToSolar, lunarMonthLength } from "./convert";
import { expandLunarRecurrence, LunarRecurrenceRule } from "./recurrence";

test("known Vietnamese Tet (lunar new year) solar dates", () => {
  const cases: [string, [number, number, number]][] = [
    ["2023-01-22", [22, 1, 2023]],
    ["2024-02-10", [10, 2, 2024]],
    ["2025-01-29", [29, 1, 2025]],
    ["2026-02-17", [17, 2, 2026]],
  ];
  for (const [, [d, m, y]] of cases) {
    const lunar = solarToLunar(d, m, y);
    assert.equal(lunar.day, 1, `${y}-${m}-${d} should be lunar day 1`);
    assert.equal(lunar.month, 1, `${y}-${m}-${d} should be lunar month 1`);
    assert.equal(lunar.isLeapMonth, false);
  }
});

test("round-trip solar -> lunar -> solar", () => {
  const samples: [number, number, number][] = [
    [1, 1, 2024],
    [15, 8, 2024],
    [31, 12, 2025],
    [1, 3, 2023],
  ];
  for (const [d, m, y] of samples) {
    const lunar = solarToLunar(d, m, y);
    const back = lunarToSolar(lunar.day, lunar.month, lunar.year, lunar.isLeapMonth);
    assert.deepEqual(back, { day: d, month: m, year: y }, `round trip failed for ${y}-${m}-${d}`);
  }
});

test("2023 has a leap 2nd lunar month", () => {
  // Ho Ngoc Duc reference data: Quy Mao 2023 has leap month 2.
  const normalMonth2 = lunarToSolar(1, 2, 2023, false);
  const leapMonth2 = lunarToSolar(1, 2, 2023, true);
  assert.notDeepEqual(normalMonth2, leapMonth2);
});

test("leap month boundary matches historical record for 2023", () => {
  // Regular thang 2: 2023-02-20; Nhuan thang 2: 2023-03-21; thang 3: 2023-04-20.
  assert.deepEqual(lunarToSolar(1, 2, 2023, false), { day: 20, month: 2, year: 2023 });
  assert.deepEqual(lunarToSolar(1, 2, 2023, true), { day: 21, month: 3, year: 2023 });
  assert.deepEqual(lunarToSolar(1, 3, 2023, false), { day: 20, month: 4, year: 2023 });

  assert.deepEqual(solarToLunar(20, 2, 2023), { day: 1, month: 2, year: 2023, isLeapMonth: false });
  assert.deepEqual(solarToLunar(21, 3, 2023), { day: 1, month: 2, year: 2023, isLeapMonth: true });
  assert.deepEqual(solarToLunar(20, 4, 2023), { day: 1, month: 3, year: 2023, isLeapMonth: false });
});

test("yearly lunar recurrence expands one occurrence per lunar year", () => {
  const rule: LunarRecurrenceRule = {
    type: "lunar",
    freq: "yearly",
    anchor: { day: 22, month: 1, year: 2023 }, // Tet 2023 (lunar 1/1)
  };
  const occurrences = expandLunarRecurrence(
    rule,
    { day: 1, month: 1, year: 2023 },
    { day: 31, month: 12, year: 2026 }
  );
  assert.deepEqual(occurrences, [
    { day: 22, month: 1, year: 2023 },
    { day: 10, month: 2, year: 2024 },
    { day: 29, month: 1, year: 2025 },
    { day: 17, month: 2, year: 2026 },
  ]);
});

test("lunarMonthLength never returns 0 (regression: floating-point rounding bug)", () => {
  // month 1 (thang Gieng) across several years, including 2027 where a plain
  // Math.floor() of the new-moon index used to underflow by one and yield 0.
  for (const y of [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]) {
    const len = lunarMonthLength(1, y, false);
    assert.ok(len === 29 || len === 30, `lunarMonthLength(1, ${y}) should be 29 or 30, got ${len}`);
  }
});

test("yearly lunar recurrence anchored on Tet lands on Tet every year, 2024-2030", () => {
  const rule: LunarRecurrenceRule = {
    type: "lunar",
    freq: "yearly",
    anchor: { day: 10, month: 2, year: 2024 }, // Tet 2024
  };
  const occurrences = expandLunarRecurrence(
    rule,
    { day: 1, month: 1, year: 2024 },
    { day: 31, month: 12, year: 2030 }
  );
  for (const o of occurrences) {
    const lunar = solarToLunar(o.day, o.month, o.year);
    assert.equal(lunar.day, 1, `${JSON.stringify(o)} should be lunar day 1`);
    assert.equal(lunar.month, 1, `${JSON.stringify(o)} should be lunar month 1`);
  }
  assert.equal(occurrences.length, 7);
});

test("monthly lunar recurrence (ngay ram - 15th of every lunar month)", () => {
  const rule: LunarRecurrenceRule = {
    type: "lunar",
    freq: "monthly",
    anchor: { day: 24, month: 2, year: 2024 }, // Tet 2024 (lunar 1/1) was 2024-02-10, so +14 days = lunar 15/1
  };
  const occurrences = expandLunarRecurrence(
    rule,
    { day: 1, month: 2, year: 2024 },
    { day: 30, month: 4, year: 2024 }
  );
  assert.ok(occurrences.length >= 2, "expected at least 2 monthly occurrences in a 3 month window");
  for (const o of occurrences) {
    const lunar = solarToLunar(o.day, o.month, o.year);
    assert.equal(lunar.day, 15);
  }
});
