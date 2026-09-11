import type { CalendarAccount as PrismaCalendarAccount } from "@prisma/client";
import type { Contact } from "@luna/shared-types";

/** A single concrete occurrence of a (possibly recurring) local event, ready to push to a provider. */
export interface ProviderEventInput {
  /** Local Event.id this occurrence was expanded from — stashed for round-trip recognition. */
  localEventId: string;
  /** Calendar date (YYYY-MM-DD) of this occurrence, used for the EventInstance mapping key. */
  occurrenceDate: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string; // ISO timestamp (or YYYY-MM-DD when allDay)
  endAt: string;
  allDay: boolean;
  timeZone: string;
}

export interface ProviderEvent {
  providerEventId: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  timeZone: string;
  /** Recovered from the provider's extended-properties/description marker, if present. */
  localEventId?: string;
  occurrenceDate?: string;
}

/** Common shape every calendar provider client (Google, Lark) implements. */
export interface CalendarProviderClient {
  listEvents(
    account: PrismaCalendarAccount,
    timeMin: Date,
    timeMax: Date
  ): Promise<ProviderEvent[]>;
  createEvent(account: PrismaCalendarAccount, event: ProviderEventInput): Promise<string>; // returns providerEventId
  updateEvent(
    account: PrismaCalendarAccount,
    providerEventId: string,
    event: ProviderEventInput
  ): Promise<void>;
  deleteEvent(account: PrismaCalendarAccount, providerEventId: string): Promise<void>;
  listContacts(account: PrismaCalendarAccount): Promise<Omit<Contact, "id" | "ownerId" | "lastSyncedAt">[]>;
}
