import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { pullFromProvider } from "../services/syncEngine";

export const syncRouter = Router();
syncRouter.use(requireAuth);

// POST /sync/:provider — manually trigger a pull-sync for the caller's
// connected account(s) on that provider; returns a SyncResult per account
// (or the single result if there's exactly one, for convenience).
syncRouter.post("/:provider", async (req, res) => {
  const provider = req.params.provider;
  if (provider !== "google" && provider !== "lark") {
    res.status(400).json({ error: 'provider must be "google" or "lark"' });
    return;
  }
  const accounts = await prisma.calendarAccount.findMany({
    where: { userId: req.userId!, provider },
  });
  if (accounts.length === 0) {
    res.status(404).json({ error: `No connected ${provider} account` });
    return;
  }
  const results = await Promise.all(accounts.map((account) => pullFromProvider(account)));
  res.json(results.length === 1 ? results[0] : { results });
});
