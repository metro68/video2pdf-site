import { NextResponse } from "next/server";
import { getAccount } from "@/lib/db/content/accounts";
import { instagramAuthUrl, signState, tiktokAuthUrl } from "@/lib/content/oauth";
import { isConfigured as tokenStorageReady } from "@/lib/content/crypto";

// Starts the OAuth flow for an owned account. proxy.ts already requires a
// session for /api/content/*, so only an authenticated operator reaches this.
export async function GET(request: Request): Promise<NextResponse> {
  const accountId = Number(new URL(request.url).searchParams.get("accountId"));
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json(
      { status: "error", error: "accountId is required" },
      { status: 400 },
    );
  }

  // Refuse to start a flow whose tokens could not be stored safely, rather than
  // collecting credentials and failing at the callback.
  if (!tokenStorageReady()) {
    return NextResponse.json(
      { status: "error", error: "CONTENT_TOKEN_KEY is not set; cannot store tokens" },
      { status: 503 },
    );
  }

  const account = await getAccount(accountId);
  if (!account) {
    return NextResponse.json({ status: "error", error: "account not found" }, { status: 404 });
  }
  if (account.kind !== "owned") {
    return NextResponse.json(
      { status: "error", error: "only owned accounts can be connected" },
      { status: 400 },
    );
  }

  const state = signState({
    platform: account.platform,
    accountId,
    issuedAt: Date.now(),
  });

  const url =
    account.platform === "instagram" ? instagramAuthUrl(state) : tiktokAuthUrl(state);

  return NextResponse.redirect(url);
}
