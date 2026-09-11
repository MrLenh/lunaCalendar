import type { CalendarProviderClient } from "./types";
import { googleCalendarClient } from "./googleCalendar";
import { larkCalendarClient } from "./larkCalendar";

export * from "./types";

/** Registry mapping a syncable provider name to its client. "local" has no client (nothing to push). */
export const providerClients: Record<"google" | "lark", CalendarProviderClient> = {
  google: googleCalendarClient,
  lark: larkCalendarClient,
};

export function getProviderClient(provider: string): CalendarProviderClient | undefined {
  return providerClients[provider as "google" | "lark"];
}
