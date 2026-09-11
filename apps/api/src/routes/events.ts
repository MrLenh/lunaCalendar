import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { toCalendarEvent, toEventRowData } from "../lib/eventMapper";
import { expandLocalEvent } from "../services/recurrence";
import { syncEventToProviders, unsyncEventFromProviders } from "../services/syncEngine";

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

const attendeeSchema = z.object({
  email: z.string().email().optional(),
  providerUserId: z.string().optional(),
  displayName: z.string().optional(),
  responseStatus: z.enum(["needsAction", "accepted", "declined", "tentative"]).optional(),
});

const reminderSchema = z.object({
  minutesBefore: z.number().int().nonnegative(),
  method: z.enum(["notification", "email"]),
});

const solarRecurrenceSchema = z.object({
  type: z.literal("solar"),
  freq: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().positive().optional(),
  byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
  count: z.number().int().positive().optional(),
  until: z.string().optional(),
});

const solarDateSchema = z.object({ day: z.number().int(), month: z.number().int(), year: z.number().int() });

const lunarRecurrenceSchema = z.object({
  type: z.literal("lunar"),
  freq: z.enum(["yearly", "monthly"]),
  interval: z.number().int().positive().optional(),
  anchor: solarDateSchema,
  leapMonthPolicy: z.enum(["same-month", "skip"]).optional(),
  count: z.number().int().positive().optional(),
  until: solarDateSchema.optional(),
});

const recurrenceSchema = z.union([solarRecurrenceSchema, lunarRecurrenceSchema]);

const eventInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  allDay: z.boolean().default(false),
  timeZone: z.string().min(1),
  color: z.string().optional(),
  attendees: z.array(attendeeSchema).optional(),
  reminders: z.array(reminderSchema).optional(),
  recurrence: recurrenceSchema.optional(),
});

const rangeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Fires the sync engine for an event without making the caller wait on every
 * connected provider's API round-trip. Chosen over `await` so event
 * create/update/delete responses stay fast even if Google/Lark are slow or
 * briefly unavailable; failures are logged inside syncEngine per-occurrence
 * rather than surfaced to the HTTP response. A production app might instead
 * queue this on a durable job queue for retries.
 */
function fireAndForgetSync(fn: () => Promise<void>) {
  fn().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[events] background sync failed:", err);
  });
}

// GET /events?from=YYYY-MM-DD&to=YYYY-MM-DD
eventsRouter.get("/", async (req, res) => {
  const parsed = rangeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { from, to } = parsed.data;
  const rangeStart = new Date(`${from}T00:00:00.000Z`);
  const rangeEnd = new Date(`${to}T23:59:59.999Z`);

  const rows = await prisma.event.findMany({ where: { ownerId: req.userId! } });
  const occurrences = rows.flatMap((row) => {
    const event = toCalendarEvent(row);
    return expandLocalEvent(event, rangeStart, rangeEnd).map((occ) => ({
      ...event,
      startAt: event.allDay ? occ.occurrenceDate : occ.startAt.toISOString(),
      endAt: event.allDay ? occ.occurrenceDate : occ.endAt.toISOString(),
      occurrenceDate: occ.occurrenceDate,
      isRecurringInstance: Boolean(event.recurrence),
    }));
  });
  occurrences.sort((a, b) => a.startAt.localeCompare(b.startAt));
  res.json({ events: occurrences });
});

eventsRouter.post("/", async (req, res) => {
  const parsed = eventInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const row = await prisma.event.create({
    data: toEventRowData(req.userId!, parsed.data) as any,
  });
  const event = toCalendarEvent(row);

  const accounts = await prisma.calendarAccount.findMany({ where: { userId: req.userId! } });
  fireAndForgetSync(() => syncEventToProviders(event, accounts));

  res.status(201).json(event);
});

eventsRouter.put("/:id", async (req, res) => {
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.ownerId !== req.userId) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const parsed = eventInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const merged = toEventRowData(req.userId!, {
    title: parsed.data.title ?? existing.title,
    description: parsed.data.description ?? existing.description ?? undefined,
    location: parsed.data.location ?? existing.location ?? undefined,
    startAt: parsed.data.startAt ?? existing.startAt,
    endAt: parsed.data.endAt ?? existing.endAt,
    allDay: parsed.data.allDay ?? existing.allDay,
    timeZone: parsed.data.timeZone ?? existing.timeZone,
    color: parsed.data.color ?? existing.color ?? undefined,
    attendees: parsed.data.attendees as any,
    reminders: parsed.data.reminders as any,
    recurrence: parsed.data.recurrence as any,
  });
  const row = await prisma.event.update({ where: { id: existing.id }, data: merged as any });
  const event = toCalendarEvent(row);

  const accounts = await prisma.calendarAccount.findMany({ where: { userId: req.userId! } });
  fireAndForgetSync(() => syncEventToProviders(event, accounts));

  res.json(event);
});

eventsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.ownerId !== req.userId) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const accounts = await prisma.calendarAccount.findMany({ where: { userId: req.userId! } });
  // Deletion is awaited (unlike create/update) so a 204 response reliably
  // means the event is gone everywhere, not just locally.
  await unsyncEventFromProviders(existing.id, accounts);
  await prisma.event.delete({ where: { id: existing.id } });
  res.status(204).send();
});
