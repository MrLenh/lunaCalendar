// Typed REST client for the Luna Calendar backend (apps/api).
//
// Base URL resolution:
// - Set EXPO_PUBLIC_API_URL to point at your backend, e.g.
//     EXPO_PUBLIC_API_URL=http://localhost:4000/api pnpm --filter luna-mobile start
// - Defaults to http://localhost:4000/api, which works for the iOS simulator and web.
// - The Android emulator cannot reach the host machine via "localhost" - use
//   http://10.0.2.2:4000/api instead (10.0.2.2 is the emulator's alias for the host
//   machine's loopback address).
// - A physical device on the same Wi-Fi needs your machine's LAN IP instead, e.g.
//   http://192.168.1.20:4000/api.
//
// The backend (apps/api) is being built in parallel, so the exact route bodies may
// still shift. This file models "the obvious REST shape" described in the mobile
// app spec and is intentionally kept as a single file so it's easy to patch once
// the real routes land.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  CalendarAccount,
  CalendarEvent,
  CalendarProvider,
  Contact,
  SyncResult,
  User,
} from "@luna/shared-types";

const DEFAULT_API_URL = "http://localhost:4000/api";

export const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;

const TOKEN_KEY = "luna.auth.token";

export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage failures (e.g. private browsing mode on web).
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Set false for endpoints that must be called without a bearer token. */
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (auth) {
    const token = await getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, `Network error contacting ${API_BASE_URL}: ${String(err)}`);
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      const raw = data?.message ?? data?.error ?? message;
      // Some error responses (e.g. zod validation failures) send a structured
      // object rather than a string - stringify defensively so callers never
      // end up rendering "[object Object]" in the UI.
      message = typeof raw === "string" ? raw : JSON.stringify(raw);
    } catch {
      // response body wasn't JSON - keep statusText
    }
    throw new ApiError(res.status, message || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---- Auth ----

export interface LoginResponse {
  token: string;
  user: User;
}

/** POST /auth/dev-login - the app's stand-in for real OAuth sign-in. */
export async function login(email: string, displayName: string): Promise<LoginResponse> {
  const result = await request<LoginResponse>("/auth/dev-login", {
    method: "POST",
    body: { email, displayName },
    auth: false,
  });
  await setStoredToken(result.token);
  return result;
}

export async function me(): Promise<User> {
  return request<User>("/auth/me");
}

export async function logout(): Promise<void> {
  await setStoredToken(null);
}

/** Backend URL to open in a browser to start linking a provider account. */
export function oauthStartUrl(provider: "google" | "lark"): string {
  return `${API_BASE_URL}/auth/${provider}/start`;
}

// ---- Events ----

export async function listEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const { events } = await request<{ events: CalendarEvent[] }>(`/events?${query}`);
  return events;
}

export type NewEventInput = Omit<CalendarEvent, "id" | "ownerId" | "createdAt" | "updatedAt">;

export async function createEvent(event: NewEventInput): Promise<CalendarEvent> {
  return request<CalendarEvent>("/events", { method: "POST", body: event });
}

export async function updateEvent(
  id: string,
  event: Partial<NewEventInput>
): Promise<CalendarEvent> {
  return request<CalendarEvent>(`/events/${id}`, { method: "PUT", body: event });
}

export async function deleteEvent(id: string): Promise<void> {
  await request<void>(`/events/${id}`, { method: "DELETE" });
}

// ---- Accounts ----

export async function listAccounts(): Promise<CalendarAccount[]> {
  const { accounts } = await request<{ accounts: CalendarAccount[] }>("/accounts");
  return accounts;
}

export async function disconnectAccount(id: string): Promise<void> {
  await request<void>(`/accounts/${id}`, { method: "DELETE" });
}

// ---- Contacts ----

export async function listContacts(): Promise<Contact[]> {
  const { contacts } = await request<{ contacts: Contact[] }>("/contacts");
  return contacts;
}

// ---- Sync ----

export async function triggerSync(provider: CalendarProvider): Promise<SyncResult> {
  return request<SyncResult>(`/sync/${provider}`, { method: "POST" });
}
