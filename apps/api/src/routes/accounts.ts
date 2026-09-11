import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { fromJson } from "../lib/json";

export const accountsRouter = Router();
accountsRouter.use(requireAuth);

accountsRouter.get("/", async (req, res) => {
  const rows = await prisma.calendarAccount.findMany({ where: { userId: req.userId! } });
  res.json({
    accounts: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      provider: row.provider,
      providerAccountId: row.providerAccountId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? undefined,
      scope: fromJson<string[]>(row.scopeJson, []),
      connectedAt: row.connectedAt.toISOString(),
      targetCalendarId: row.targetCalendarId ?? undefined,
    })),
  });
});

accountsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.calendarAccount.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  // Cascade delete removes this account's EventInstance rows too; provider-side
  // events are intentionally left in place (disconnecting shouldn't delete a
  // user's Google/Lark calendar history).
  await prisma.calendarAccount.delete({ where: { id: existing.id } });
  res.status(204).send();
});
