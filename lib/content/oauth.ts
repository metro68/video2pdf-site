import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Platform } from "@/lib/content/types";

// OAuth helpers for connecting owned accounts.
//
// The state parameter is signed rather than stored: it carries the platform and
// account id plus a nonce, HMAC'd with JWT_SECRET. That makes CSRF on the
// callback detectable without a session store, and means a callback for an
// account the operator never started cannot be forged.

const STATE_TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

export interface OAuthState {
  platform: Platform;
  accountId: number;
  issuedAt: number;
}

export function signState(state: OAuthState): string {
  const payload = Buffer.from(
    JSON.stringify({ ...state, nonce: randomBytes(8).toString("hex") }),
  ).toString("base64url");
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyState(raw: string): OAuthState | null {
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;

  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as OAuthState;
    if (Date.now() - parsed.issuedAt > STATE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function redirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.video2pdf.ai").replace(
    /\/$/,
    "",
  );
  return `${base}/api/content/oauth/callback`;
}

/**
 * Instagram uses Facebook Login. instagram_basic and pages_show_list identify
 * the account; instagram_content_publish permits posting; the insights scope
 * is what makes owned-account metrics available. All require App Review.
 */
export function instagramAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID ?? "",
    redirect_uri: redirectUri(),
    state,
    response_type: "code",
    scope: [
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_insights",
      "pages_show_list",
      "pages_read_engagement",
    ].join(","),
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export function tiktokAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
    redirect_uri: redirectUri(),
    state,
    response_type: "code",
    scope: "user.info.basic,video.publish,video.list",
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

export interface TokenExchange {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  platformAccountId: string | null;
}

export async function exchangeInstagramCode(code: string): Promise<TokenExchange> {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID ?? "",
    client_secret: process.env.INSTAGRAM_APP_SECRET ?? "",
    redirect_uri: redirectUri(),
    code,
  });
  const res = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`,
  );
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error?.message ?? `instagram token exchange failed (${res.status})`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: null,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    // The Instagram user id is resolved separately from the linked Page, since
    // the token alone does not identify which IG account it grants access to.
    platformAccountId: null,
  };
}

export async function exchangeTikTokCode(code: string): Promise<TokenExchange> {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
      client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? `tiktok token exchange failed (${res.status})`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    platformAccountId: json.open_id ?? null,
  };
}
