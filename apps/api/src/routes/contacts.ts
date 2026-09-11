import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { getProviderClient } from "../providers";

export const contactsRouter = Router();
contactsRouter.use(requireAuth);

// GET /contacts — pulls fresh contacts from every connected provider,
// upserts them into the local Contact table, and returns the merged list.
contactsRouter.get("/", async (req, res) => {
  const accounts = await prisma.calendarAccount.findMany({ where: { userId: req.userId! } });

  for (const account of accounts) {
    const client = getProviderClient(account.provider);
    if (!client) continue;
    try {
      const contacts = await client.listContacts(account);
      for (const c of contacts) {
        await prisma.contact.upsert({
          where: {
            ownerId_provider_providerContactId: {
              ownerId: req.userId!,
              provider: c.provider,
              providerContactId: c.providerContactId,
            },
          },
          create: {
            ownerId: req.userId!,
            provider: c.provider,
            providerContactId: c.providerContactId,
            displayName: c.displayName,
            email: c.email,
            avatarUrl: c.avatarUrl,
          },
          update: {
            displayName: c.displayName,
            email: c.email,
            avatarUrl: c.avatarUrl,
            lastSyncedAt: new Date(),
          },
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[contacts] failed to pull contacts from ${account.provider}:`, err);
    }
  }

  const rows = await prisma.contact.findMany({ where: { ownerId: req.userId! } });
  res.json({
    contacts: rows.map((row) => ({
      id: row.id,
      ownerId: row.ownerId,
      provider: row.provider,
      providerContactId: row.providerContactId,
      displayName: row.displayName,
      email: row.email ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      lastSyncedAt: row.lastSyncedAt.toISOString(),
    })),
  });
});
