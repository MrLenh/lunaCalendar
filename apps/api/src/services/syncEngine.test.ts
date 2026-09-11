import { test } from "node:test";
import assert from "node:assert/strict";
import { getSyncWindow } from "./syncEngine";

// syncEventToProviders / pullFromProvider need a real Prisma-backed database
// and network-calling provider clients, so they're exercised via manual/
// integration testing rather than node:test unit tests here. getSyncWindow
// is pure and covered directly.

test("getSyncWindow spans exactly two years from the given instant", () => {
  const now = new Date("2026-05-01T00:00:00.000Z");
  const { start, end } = getSyncWindow(now);
  assert.equal(start.getTime(), now.getTime());
  assert.equal(end.getUTCFullYear() - start.getUTCFullYear() >= 1, true);
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
  assert.equal(end.getTime() - start.getTime(), twoYearsMs);
});

test("getSyncWindow defaults to now when no instant is given", () => {
  const before = Date.now();
  const { start } = getSyncWindow();
  const after = Date.now();
  assert.ok(start.getTime() >= before && start.getTime() <= after);
});
