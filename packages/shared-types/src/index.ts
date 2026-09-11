import type { LunarRecurrenceRule } from "@luna/lunar-calendar";

export type { LunarRecurrenceRule } from "@luna/lunar-calendar";

/** Calendar/contacts providers the app can connect to. */
export type CalendarProvider = "google" | "lark" | "local";

export interface CalendarAccount {
  id: string;
  userId: string;
  provider: CalendarProvider;
  /** The account id/email on the provider's side (e.g. Google email, Lark union_id). */
  providerAccountId: string;
  displayName: string;
  avatarUrl?: string;
  scope: string[];
  connectedAt: string; // ISO 8601
  /** Provider calendar id to sync into (e.g. Google "primary", a Lark calendar_id). */
  targetCalendarId?: string;
}

export type SolarRecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

/** A conventional Gregorian recurrence, modeled after a practical subset of RFC 5545 RRULE. */
export interface SolarRecurrenceRule {
  type: "solar";
  freq: SolarRecurrenceFreq;
  interval?: number;
  /** 0=Sunday..6=Saturday, used when freq="weekly". */
  byWeekday?: number[];
  count?: number;
  until?: string; // ISO date
}

export type RecurrenceRule = SolarRecurrenceRule | LunarRecurrenceRule;

export interface Reminder {
  /** Minutes before the event start. */
  minutesBefore: number;
  method: "notification" | "email";
}

export interface EventAttendee {
  email?: string;
  /** Lark open_id/union_id for attendees added via Lark contacts. */
  providerUserId?: string;
  displayName?: string;
  responseStatus?: "needsAction" | "accepted" | "declined" | "tentative";
}

export interface CalendarEvent {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  location?: string;
  /** ISO 8601 timestamp (or date-only "YYYY-MM-DD" when allDay is true). */
  startAt: string;
  endAt: string;
  allDay: boolean;
  timeZone: string;
  color?: string;
  attendees?: EventAttendee[];
  reminders?: Reminder[];
  recurrence?: RecurrenceRule;
  /** Set on generated occurrences of a recurring event. */
  recurrenceParentId?: string;
  /** Where this event lives / is synced to. "local" = app-only, not pushed out. */
  provider: CalendarProvider;
  providerEventId?: string;
  providerCalendarId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  ownerId: string;
  provider: CalendarProvider;
  providerContactId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  lastSyncedAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  timeZone: string;
  calendarDisplay: "lunar" | "solar" | "both";
}

export interface SyncResult {
  provider: CalendarProvider;
  pulled: number;
  pushed: number;
  errors: string[];
  syncedAt: string;
}
