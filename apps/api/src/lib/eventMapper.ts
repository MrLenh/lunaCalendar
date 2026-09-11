import type { Event as PrismaEvent } from "@prisma/client";
import type {
  CalendarEvent,
  CalendarProvider,
  EventAttendee,
  Reminder,
  RecurrenceRule,
} from "@luna/shared-types";
import { fromJson, toJson } from "./json";

/** Maps a Prisma `Event` row (JSON-string columns) to the shared `CalendarEvent` shape. */
export function toCalendarEvent(row: PrismaEvent): CalendarEvent {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    startAt: row.startAt,
    endAt: row.endAt,
    allDay: row.allDay,
    timeZone: row.timeZone,
    color: row.color ?? undefined,
    attendees: fromJson<EventAttendee[] | undefined>(row.attendeesJson, undefined),
    reminders: fromJson<Reminder[] | undefined>(row.remindersJson, undefined),
    recurrence: fromJson<RecurrenceRule | undefined>(row.recurrenceJson, undefined),
    recurrenceParentId: row.recurrenceParentId ?? undefined,
    provider: row.provider as CalendarProvider,
    providerEventId: row.providerEventId ?? undefined,
    providerCalendarId: row.providerCalendarId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Shape accepted for creating/updating an Event row from a CalendarEvent-like payload. */
export interface EventWriteInput {
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  timeZone: string;
  color?: string;
  attendees?: EventAttendee[];
  reminders?: Reminder[];
  recurrence?: RecurrenceRule;
}

export function toEventRowData(ownerId: string, input: EventWriteInput) {
  return {
    ownerId,
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    startAt: input.startAt,
    endAt: input.endAt,
    allDay: input.allDay,
    timeZone: input.timeZone,
    color: input.color ?? null,
    attendeesJson: input.attendees ? toJson(input.attendees) : null,
    remindersJson: input.reminders ? toJson(input.reminders) : null,
    recurrenceJson: input.recurrence ? toJson(input.recurrence) : null,
    provider: "local" as const,
  };
}
