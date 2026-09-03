import { NextResponse } from "next/server";
import { addAccount, listAccounts, removeAccount } from "@/lib/db/content/accounts";
import type { AccountKind, Platform } from "@/lib/content/types";

// Watchlist and owned-account management. proxy.ts already requires a valid
// session for /api/content/*, so these handlers do not re-check auth.

const PLATFORMS: Platform[] = ["instagram", "tiktok"];
const KINDS: AccountKind[] = ["owned", "watched"];

export async function GET(request: Request): Promise<NextResponse> {
  const kindParam = new URL(request.url).searchParams.get("kind");
  const kind = KINDS.includes(kindParam as AccountKind)
    ? (kindParam as AccountKind)
    : undefined;
  try {
    const accounts = await listAccounts(kind);
    return NextResponse.json({ status: "ok", data: { accounts } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const input = body as {
    platform?: string;
    kind?: string;
    handle?: string;
    displayName?: string;
    angle?: string;
  };

  if (!PLATFORMS.includes(input.platform as Platform)) {
    return NextResponse.json(
      { status: "error", error: "platform must be instagram or tiktok" },
      { status: 400 },
    );
  }
  if (!KINDS.includes(input.kind as AccountKind)) {
    return NextResponse.json(
      { status: "error", error: "kind must be owned or watched" },
      { status: 400 },
    );
  }
  if (!input.handle || input.handle.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "handle is required" },
      { status: 400 },
    );
  }

  try {
    const account = await addAccount({
      platform: input.platform as Platform,
      kind: input.kind as AccountKind,
      handle: input.handle,
      displayName: input.displayName ?? null,
      angle: input.angle ?? null,
    });
    return NextResponse.json({ status: "ok", data: { account } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { status: "error", error: "id is required" },
      { status: 400 },
    );
  }
  try {
    await removeAccount(id);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
