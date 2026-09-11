import { google, calendar_v3 } from "googleapis";
import type { CalendarAccount as PrismaCalendarAccount } from "@prisma/client";
import { getAuthedGoogleClient } from "../auth/google";
import type { CalendarProviderClient, ProviderEvent, ProviderEventInput } from "./types";

// Namespace used for Google's `extendedProperties.private` bag, which round-trips
// invisibly through the Calendar API (not shown to the user) — this is how we
// recognize an already-synced lunar/solar occurrence on re-sync.
const LOCAL_EVENT_ID_KEY = "lunaLocalEventId";
const OCCURRENCE_DATE_KEY = "lunaOccurrenceDate";

function getClient(account: PrismaCalendarAccount) {
  const auth = getAuthedGoogleClient(account);
  return google.calendar({ version: "v3", auth });
}

function toGoogleEventBody(event: ProviderEventInput): calendar_v3.Schema$Event {
  return {
    summary: event.title,
    description: event.description,
    location: event.location,
    start: event.allDay
      ? { date: event.startAt.slice(0, 10) }
      : { dateTime: event.startAt, timeZone: event.timeZone },
    end: event.allDay
      ? { date: event.endAt.slice(0, 10) }
      : { dateTime: event.endAt, timeZone: event.timeZone },
    extendedProperties: {
      private: {
        [LOCAL_EVENT_ID_KEY]: event.localEventId,
        [OCCURRENCE_DATE_KEY]: event.occurrenceDate,
      },
    },
  };
}

function fromGoogleEvent(ev: calendar_v3.Schema$Event): ProviderEvent {
  const priv = ev.extendedProperties?.private ?? {};
  const allDay = Boolean(ev.start?.date && !ev.start?.dateTime);
  return {
    providerEventId: ev.id ?? "",
    title: ev.summary ?? "",
    description: ev.description ?? undefined,
    location: ev.location ?? undefined,
    startAt: (allDay ? ev.start?.date : ev.start?.dateTime) ?? "",
    endAt: (allDay ? ev.end?.date : ev.end?.dateTime) ?? "",
    allDay,
    timeZone: ev.start?.timeZone ?? "UTC",
    localEventId: priv[LOCAL_EVENT_ID_KEY],
    occurrenceDate: priv[OCCURRENCE_DATE_KEY],
  };
}

export const googleCalendarClient: CalendarProviderClient = {
  async listEvents(account, timeMin, timeMax) {
    const client = getClient(account);
    const calendarId = account.targetCalendarId ?? "primary";
    const events: ProviderEvent[] = [];
    let pageToken: string | undefined;
    do {
      const { data } = await client.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        pageToken,
        maxResults: 250,
      });
      for (const item of data.items ?? []) {
        events.push(fromGoogleEvent(item));
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);
    return events;
  },

  async createEvent(account, event) {
    const client = getClient(account);
    const calendarId = account.targetCalendarId ?? "primary";
    const { data } = await client.events.insert({
      calendarId,
      requestBody: toGoogleEventBody(event),
    });
    return data.id ?? "";
  },

  async updateEvent(account, providerEventId, event) {
    const client = getClient(account);
    const calendarId = account.targetCalendarId ?? "primary";
    await client.events.patch({
      calendarId,
      eventId: providerEventId,
      requestBody: toGoogleEventBody(event),
    });
  },

  async deleteEvent(account, providerEventId) {
    const client = getClient(account);
    const calendarId = account.targetCalendarId ?? "primary";
    try {
      await client.events.delete({ calendarId, eventId: providerEventId });
    } catch (err: any) {
      // 410/404 means it's already gone on the provider side — treat as success.
      if (err?.code !== 410 && err?.code !== 404) throw err;
    }
  },

  async listContacts(account) {
    const auth = getAuthedGoogleClient(account);
    const people = google.people({ version: "v1", auth });
    const contacts: Omit<
      import("@luna/shared-types").Contact,
      "id" | "ownerId" | "lastSyncedAt"
    >[] = [];
    let pageToken: string | undefined;
    do {
      const { data } = await people.people.connections.list({
        resourceName: "people/me",
        personFields: "names,emailAddresses,photos",
        pageSize: 200,
        pageToken,
      });
      for (const person of data.connections ?? []) {
        const resourceName = person.resourceName ?? "";
        if (!resourceName) continue;
        contacts.push({
          provider: "google",
          providerContactId: resourceName,
          displayName: person.names?.[0]?.displayName ?? "Unknown",
          email: person.emailAddresses?.[0]?.value ?? undefined,
          avatarUrl: person.photos?.[0]?.url ?? undefined,
        });
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);
    return contacts;
  },
};
