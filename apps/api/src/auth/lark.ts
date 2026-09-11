import axios from "axios";

const LARK_HOST = "https://open.feishu.cn";

let cachedTenantToken: { token: string; expiresAt: number } | null = null;

/**
 * Fetches (and caches, with a small safety margin before expiry) the app's
 * tenant_access_token, used to call APIs that act on behalf of the app
 * itself (e.g. exchanging a user's authorization code).
 */
export async function getTenantAccessToken(): Promise<string> {
  if (cachedTenantToken && cachedTenantToken.expiresAt > Date.now() + 30_000) {
    return cachedTenantToken.token;
  }
  const { data } = await axios.post(
    `${LARK_HOST}/open-apis/auth/v3/tenant_access_token/internal`,
    {
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET,
    }
  );
  if (data.code !== 0) {
    throw new Error(`Lark tenant_access_token error: ${data.code} ${data.msg}`);
  }
  cachedTenantToken = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + data.expire * 1000,
  };
  return cachedTenantToken.token;
}

/** Builds the URL the user's browser is redirected to in order to consent (Lark "authen" flow). */
export function getLarkAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    app_id: process.env.LARK_APP_ID ?? "",
    redirect_uri: process.env.LARK_REDIRECT_URI ?? "",
  });
  if (state) params.set("state", state);
  return `${LARK_HOST}/open-apis/authen/v1/index?${params.toString()}`;
}

export interface LarkAuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope: string[];
  profile: {
    providerAccountId: string; // open_id
    email?: string;
    displayName: string;
    avatarUrl?: string;
  };
}

/** Exchanges an authorization `code` for a user_access_token + user profile. */
export async function handleLarkCallback(code: string): Promise<LarkAuthResult> {
  const tenantToken = await getTenantAccessToken();
  const { data } = await axios.post(
    `${LARK_HOST}/open-apis/authen/v1/access_token`,
    { grant_type: "authorization_code", code },
    { headers: { Authorization: `Bearer ${tenantToken}` } }
  );
  if (data.code !== 0) {
    throw new Error(`Lark access_token error: ${data.code} ${data.msg}`);
  }
  const d = data.data;
  return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    expiresAt: d.expires_in ? new Date(Date.now() + d.expires_in * 1000) : undefined,
    scope: typeof d.scope === "string" ? d.scope.split(" ").filter(Boolean) : [],
    profile: {
      providerAccountId: d.open_id ?? d.union_id ?? "unknown",
      email: d.email ?? undefined,
      displayName: d.name ?? d.en_name ?? "Lark user",
      avatarUrl: d.avatar_url ?? undefined,
    },
  };
}
