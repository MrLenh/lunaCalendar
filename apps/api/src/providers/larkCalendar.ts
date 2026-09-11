import axios from "axios";
import type { CalendarAccount as PrismaCalendarAccount } from "@prisma/client";
import type { CalendarProviderClient, ProviderEvent, ProviderEventInput } from "./types";

const LARK_HOST = "https://open.feishu.cn";

// Lark calendar events have no generic "extended properties" bag like Google's.
// As a workaround we stash a hidden marker at the end of the event's own
// `description` field and strip/parse it back out on read. This is a
// simplification: it costs a little of the description field's length and
// would be visible to anyone reading the raw API response directly (though
// Lark's own calendar UI truncates/does not surface this line prominently).
const MARKER_RE = /\n\n\[luna:eventId=([^;]+);date=([^\]]+)\]$/;

function withMarker(description: string | undefined, localEventId: string, occurrenceDate: string): string {
  const base = description ?? "";
  return `${base}\n\n[luna:eventId=${localEventId};date=${occurrenceDate}]`;
}

function stripMarker(description: string | undefined): {
  description?: string;
  localEventId?: string;
  occurrenceDate?: string;
} {
  if (!description) return {};
  const match = description.match(MARKER_RE);
  if (!match) return { description };
  return {
    description: description.slice(0, match.index).trimEnd() || undefined,
    localEventId: match[1],
    occurrenceDate: match[2],
  };
}

function authHeaders(account: PrismaCalendarAccount) {
  return { Authorization: `Bearer ${account.accessToken}` };
}

function calendarId(account: PrismaCalendarAccount) {
  return account.targetCalendarId ?? "primary";
}

function toLarkTimestamp(iso: string, allDay: boolean) {
  if (allDay) {
    return { date: iso.slice(0, 10) };
  }
  // Lark expects a unix timestamp (seconds, as a string) plus an IANA timezone.
  return { timestamp: String(Math.floor(new Date(iso).getTime() / 1000)) };
}

function toLarkEventBody(event: ProviderEventInput) {
  return {
    summary: event.title,
    description: withMarker(event.description, event.localEventId, event.occurrenceDate),
    location: event.location ? { name: event.location } : undefined,
    start_time: { ...toLarkTimestamp(event.startAt, event.allDay), timezone: event.timeZone },
    end_time: { ...toLarkTimestamp(event.endAt, event.allDay), timezone: event.timeZone },
  };
}

function fromLarkEvent(ev: any): ProviderEvent {
  const { description, localEventId, occurrenceDate } = stripMarker(ev.description);
  const allDay = Boolean(ev.start_time?.date);
  const startAt = allDay
    ? ev.start_time?.date
    : new Date(Number(ev.start_time?.timestamp) * 1000).toISOString();
  const endAt = allDay
    ? ev.end_time?.date
    : new Date(Number(ev.end_time?.timestamp) * 1000).toISOString();
  return {
    providerEventId: ev.event_id,
    title: ev.summary ?? "",
    description,
    location: ev.location?.name ?? undefined,
    startAt,
    endAt,
    allDay,
    timeZone: ev.start_time?.timezone ?? "UTC",
    localEventId,
    occurrenceDate,
  };
}

export const larkCalendarClient: CalendarProviderClient = {
  async listEvents(account, timeMin, timeMax) {
    const events: ProviderEvent[] = [];
    let pageToken: string | undefined;
    do {
      const { data } = await axios.get(
        `${LARK_HOST}/open-apis/calendar/v4/calendars/${calendarId(account)}/events`,
        {
          headers: authHeaders(account),
          params: {
            start_time: String(Math.floor(timeMin.getTime() / 1000)),
            end_time: String(Math.floor(timeMax.getTime() / 1000)),
            page_token: pageToken,
            page_size: 200,
          },
        }
      );
      for (const item of data.data?.items ?? []) {
        events.push(fromLarkEvent(item));
      }
      pageToken = data.data?.page_token || undefined;
      if (!data.data?.has_more) pageToken = undefined;
    } while (pageToken);
    return events;
  },

  async createEvent(account, event) {
    const { data } = await axios.post(
      `${LARK_HOST}/open-apis/calendar/v4/calendars/${calendarId(account)}/events`,
      toLarkEventBody(event),
      { headers: authHeaders(account) }
    );
    return data.data?.event?.event_id ?? "";
  },

  async updateEvent(account, providerEventId, event) {
    await axios.patch(
      `${LARK_HOST}/open-apis/calendar/v4/calendars/${calendarId(account)}/events/${providerEventId}`,
      toLarkEventBody(event),
      { headers: authHeaders(account) }
    );
  },

  async deleteEvent(account, providerEventId) {
    try {
      await axios.delete(
        `${LARK_HOST}/open-apis/calendar/v4/calendars/${calendarId(account)}/events/${providerEventId}`,
        { headers: authHeaders(account) }
      );
    } catch (err: any) {
      if (err?.response?.status !== 404) throw err;
    }
  },

  async listContacts(account) {
    // Simplification: Lark's full contact directory is department-tree shaped
    // (find_by_department) rather than a flat "my contacts" list; we pull the
    // root department (department_id "0") as a reasonable stand-in for
    // "coworkers this user can see", which is normally what Lark installs are
    // scoped to. A production app would page through the whole org tree.
    const { data } = await axios.get(
      `${LARK_HOST}/open-apis/contact/v3/users/find_by_department`,
      {
        headers: authHeaders(account),
        params: { department_id: "0", page_size: 50 },
      }
    );
    return (data.data?.items ?? []).map((u: any) => ({
      provider: "lark" as const,
      providerContactId: u.open_id ?? u.user_id,
      displayName: u.name ?? "Unknown",
      email: u.email ?? undefined,
      avatarUrl: u.avatar?.avatar_240 ?? undefined,
    }));
  },
};
