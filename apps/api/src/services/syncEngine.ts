import type { CalendarAccount as PrismaCalendarAccount } from "@prisma/client";
import type { CalendarEvent, SyncResult } from "@luna/shared-types";
import { prisma } from "../lib/prisma";
import { getProviderClient } from "../providers";
import type { ProviderEventInput } from "../providers/types";
import { expandLocalEvent } from "./recurrence";

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/** Rolling window the sync engine keeps provider calendars populated over. */
export function getSyncWindow(now: Date = new Date()): { start: Date; end: Date } {
  return { start: now, end: new Date(now.getTime() + TWO_YEARS_MS) };
}

function toProviderEventInput(event: CalendarEvent, occ: { occurrenceDate: string; startAt: Date; endAt: Date }): ProviderEventInput {
  return {
    localEventId: event.id,
    occurrenceDate: occ.occurrenceDate,
    title: event.title,
    description: event.description,
    location: event.location,
    startAt: event.allDay ? occ.occurrenceDate : occ.startAt.toISOString(),
    endAt: event.allDay ? occ.occurrenceDate : occ.endAt.toISOString(),
    allDay: event.allDay,
    timeZone: event.timeZone,
  };
}

/**
 * Pushes a local event (and, if recurring, each of its occurrences in the
 * rolling sync window) to every connected provider account, creating or
 * updating the provider-side event as needed. Uses the `EventInstance`
 * mapping table so re-syncing an already-expanded occurrence updates the
 * existing provider event instead of duplicating it.
 */
export async function syncEventToProviders(
  event: CalendarEvent,
  accounts: PrismaCalendarAccount[]
): Promise<void> {
  if (accounts.length === 0) return;
  const { start, end } = getSyncWindow();
  const occurrences = expandLocalEvent(event, start, end);
  if (occurrences.length === 0) return;

  for (const account of accounts) {
    const client = getProviderClient(account.provider);
    if (!client) continue; // "local" or unrecognized provider: nothing to push

    for (const occ of occurrences) {
      const occurrenceDate = new Date(`${occ.occurrenceDate}T00:00:00.000Z`);
      const input = toProviderEventInput(event, occ);

      const existing = await prisma.eventInstance.findUnique({
        where: {
          parentEventId_occurrenceDate_provider: {
            parentEventId: event.id,
            occurrenceDate,
            provider: account.provider,
          },
        },
      });

      try {
        if (existing) {
          await client.updateEvent(account, existing.providerEventId, input);
        } else {
          const providerEventId = await client.createEvent(account, input);
          await prisma.eventInstance.create({
            data: {
              parentEventId: event.id,
              occurrenceDate,
              provider: account.provider,
              providerEventId,
              accountId: account.id,
            },
          });
        }
      } catch (err) {
        // One occurrence/account failing shouldn't abort the whole sync pass;
        // callers relying on completeness should check provider state directly.
        // eslint-disable-next-line no-console
        console.error(
          `[syncEngine] failed to push event ${event.id} occurrence ${occ.occurrenceDate} to ${account.provider}:`,
          err
        );
      }
    }
  }
}

/**
 * Removes a local event's pushed occurrences from every connected provider
 * account (used when a local event is deleted) and clears their EventInstance rows.
 */
export async function unsyncEventFromProviders(
  eventId: string,
  accounts: PrismaCalendarAccount[]
): Promise<void> {
  const instances = await prisma.eventInstance.findMany({ where: { parentEventId: eventId } });
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  for (const instance of instances) {
    const account = accountById.get(instance.accountId);
    const client = account && getProviderClient(account.provider);
    if (account && client) {
      try {
        await client.deleteEvent(account, instance.providerEventId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[syncEngine] failed to delete provider event for instance ${instance.id}:`, err);
      }
    }
  }
  await prisma.eventInstance.deleteMany({ where: { parentEventId: eventId } });
}

/**
 * Pulls events from a connected provider account since its last sync (or the
 * start of the rolling sync window on first sync) and upserts them into the
 * local `Event` table, tagged with that provider. Returns a SyncResult
 * summarizing what happened.
 */
export async function pullFromProvider(account: PrismaCalendarAccount): Promise<SyncResult> {
  const errors: string[] = [];
  let pulled = 0;
  const client = getProviderClient(account.provider);
  const { start, end } = getSyncWindow();
  const rangeStart = account.lastSyncedAt ?? start;

  if (!client) {
    errors.push(`Unknown provider "${account.provider}"`);
    return { provider: account.provider as SyncResult["provider"], pulled, pushed: 0, errors, syncedAt: new Date().toISOString() };
  }

  try {
    const providerEvents = await client.listEvents(account, rangeStart, end);
    for (const pe of providerEvents) {
      // Events we ourselves pushed (recognizable via the round-tripped local
      // event id) are our own local events reflected back — skip them so we
      // don't create a duplicate local copy of an event that already exists locally.
      if (pe.localEventId) continue;
      try {
        await prisma.event.upsert({
          where: {
            // No native composite unique on (provider, providerEventId, ownerId) in the
            // schema, so emulate find-or-create explicitly.
            id: (await findLocalIdForProviderEvent(account, pe.providerEventId)) ?? "__none__",
          },
          create: {
            ownerId: account.userId,
            title: pe.title,
            description: pe.description,
            location: pe.location,
            startAt: pe.startAt,
            endAt: pe.endAt,
            allDay: pe.allDay,
            timeZone: pe.timeZone,
            provider: account.provider,
            providerEventId: pe.providerEventId,
            providerCalendarId: account.targetCalendarId,
          },
          update: {
            title: pe.title,
            description: pe.description,
            location: pe.location,
            startAt: pe.startAt,
            endAt: pe.endAt,
            allDay: pe.allDay,
            timeZone: pe.timeZone,
          },
        });
        pulled++;
      } catch (err) {
        errors.push(`Failed to upsert provider event ${pe.providerEventId}: ${String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`Failed to list events from ${account.provider}: ${String(err)}`);
  }

  await prisma.calendarAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date() },
  });

  return {
    provider: account.provider as SyncResult["provider"],
    pulled,
    pushed: 0,
    errors,
    syncedAt: new Date().toISOString(),
  };
}

async function findLocalIdForProviderEvent(
  account: PrismaCalendarAccount,
  providerEventId: string
): Promise<string | undefined> {
  const existing = await prisma.event.findFirst({
    where: { ownerId: account.userId, provider: account.provider, providerEventId },
    select: { id: true },
  });
  return existing?.id;
}
