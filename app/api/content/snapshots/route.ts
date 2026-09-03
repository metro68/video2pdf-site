import { NextResponse } from "next/server";
import {
  recordAccountSnapshot,
  recordPostSnapshot,
} from "@/lib/db/content/snapshots";
import { activeCollector } from "@/lib/content/collectors";
import type { MediaType } from "@/lib/content/types";

// Records an operator-entered reading of a public profile or post.
//
// The active collector supplies the source label, so a reading recorded while
// the manual collector is active is stored as "manual" and can never later be
// mistaken for Insights data.

const MEDIA_TYPES: MediaType[] = ["reel", "video", "image", "carousel", "unknown"];

function optionalInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const input = body as {
    type?: string;
    accountId?: number;
    followers?: unknown;
    following?: unknown;
    postCount?: unknown;
    platformPostId?: string;
    postUrl?: string;
    caption?: string;
    mediaType?: string;
    publishedAt?: string;
    views?: unknown;
    likes?: unknown;
    comments?: unknown;
    shares?: unknown;
  };

  const accountId = Number(input.accountId);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json(
      { status: "error", error: "accountId is required" },
      { status: 400 },
    );
  }

  const source = activeCollector().source;

  try {
    if (input.type === "profile") {
      const snapshot = await recordAccountSnapshot({
        accountId,
        followers: optionalInt(input.followers),
        following: optionalInt(input.following),
        postCount: optionalInt(input.postCount),
        source,
      });
      return NextResponse.json({ status: "ok", data: { snapshot } });
    }

    if (input.type === "post") {
      // Identify the post by its platform id where known, else by URL, so a
      // repeat reading of the same post updates the same series rather than
      // creating a second one.
      const platformPostId = (input.platformPostId ?? input.postUrl ?? "").trim();
      if (platformPostId === "") {
        return NextResponse.json(
          { status: "error", error: "platformPostId or postUrl is required" },
          { status: 400 },
        );
      }
      const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
      const snapshot = await recordPostSnapshot({
        accountId,
        platformPostId,
        postUrl: input.postUrl ?? null,
        caption: input.caption ?? null,
        mediaType: MEDIA_TYPES.includes(input.mediaType as MediaType)
          ? (input.mediaType as MediaType)
          : "unknown",
        publishedAt:
          publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
        views: optionalInt(input.views),
        likes: optionalInt(input.likes),
        comments: optionalInt(input.comments),
        shares: optionalInt(input.shares),
        source,
      });
      return NextResponse.json({ status: "ok", data: { snapshot } });
    }

    return NextResponse.json(
      { status: "error", error: "type must be profile or post" },
      { status: 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
