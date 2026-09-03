import { NextResponse } from "next/server";
import {
  exchangeInstagramCode,
  exchangeTikTokCode,
  verifyState,
} from "@/lib/content/oauth";
import { saveTokens } from "@/lib/db/content/tokens";
import { sql } from "@/lib/db/client";

// OAuth callback. The state is signed, so a callback for an account whose flow
// the operator never started is rejected rather than silently storing tokens.
//
// Note: this route sits under /api/content/*, which proxy.ts guards with the
// dashboard session. That is deliberate: the operator is logged in throughout
// the flow, and an unauthenticated callback should not be able to write tokens.
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const back = new URL("/dashboard/content", url.origin);

  if (oauthError) {
    back.searchParams.set("connect_error", oauthError.slice(0, 200));
    return NextResponse.redirect(back);
  }
  if (!code || !rawState) {
    back.searchParams.set("connect_error", "missing code or state");
    return NextResponse.redirect(back);
  }

  const state = verifyState(rawState);
  if (!state) {
    back.searchParams.set("connect_error", "invalid or expired state");
    return NextResponse.redirect(back);
  }

  try {
    const exchanged =
      state.platform === "instagram"
        ? await exchangeInstagramCode(code)
        : await exchangeTikTokCode(code);

    await saveTokens(state.accountId, {
      accessToken: exchanged.accessToken,
      refreshToken: exchanged.refreshToken,
      expiresAt: exchanged.expiresAt,
    });

    if (exchanged.platformAccountId) {
      await sql`
        UPDATE social_accounts
        SET platform_account_id = ${exchanged.platformAccountId}, updated_at = now()
        WHERE id = ${state.accountId}
      `;
    }

    back.searchParams.set("connected", String(state.accountId));
    return NextResponse.redirect(back);
  } catch (err) {
    back.searchParams.set(
      "connect_error",
      (err instanceof Error ? err.message : "connection failed").slice(0, 200),
    );
    return NextResponse.redirect(back);
  }
}
