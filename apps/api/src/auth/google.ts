import { google } from "googleapis";

// "contacts.readonly" lets us list the user's Google Contacts as candidate
// event attendees / "friends" in the app; "calendar" is full read/write
// access needed to create, update and delete synced events.
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/contacts.readonly",
];

export function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/** Builds the URL the user's browser is redirected to in order to consent. */
export function getGoogleAuthUrl(state?: string): string {
  const client = getGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures a refresh_token is returned even on repeat consent
    scope: GOOGLE_SCOPES,
    state,
  });
}

export interface GoogleAuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope: string[];
  profile: {
    providerAccountId: string; // Google's stable user id
    email?: string;
    displayName: string;
    avatarUrl?: string;
  };
}

/** Exchanges an OAuth `code` for tokens and the authenticated user's profile. */
export async function handleGoogleCallback(code: string): Promise<GoogleAuthResult> {
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: profile } = await oauth2.userinfo.get();

  return {
    accessToken: tokens.access_token ?? "",
    refreshToken: tokens.refresh_token ?? undefined,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    scope: (tokens.scope ?? GOOGLE_SCOPES.join(" ")).split(" ").filter(Boolean),
    profile: {
      providerAccountId: profile.id ?? profile.email ?? "unknown",
      email: profile.email ?? undefined,
      displayName: profile.name ?? profile.email ?? "Google user",
      avatarUrl: profile.picture ?? undefined,
    },
  };
}

/** Builds an authenticated OAuth2 client for an already-connected account, refreshing as needed. */
export function getAuthedGoogleClient(account: {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}) {
  const client = getGoogleOAuthClient();
  client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken ?? undefined,
    expiry_date: account.expiresAt ? account.expiresAt.getTime() : undefined,
  });
  return client;
}
