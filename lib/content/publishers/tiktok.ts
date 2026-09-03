import type { PublishInput, PublishResult, Publisher } from "./types";
import { ReconnectRequired } from "./types";

// TikTok publishing via the Content Posting API.
//
// IMPORTANT: an unaudited client can only post SELF_ONLY, meaning the post is
// visible to the account owner and nobody else. Public posting requires passing
// TikTok's separate audit on top of developer signup. TIKTOK_AUDITED must be
// explicitly set once that audit passes; until then this adapter posts
// SELF_ONLY rather than silently producing invisible "published" posts that
// look successful in our dashboard.

const API = "https://open.tiktokapis.com/v2";
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 60;

interface TikTokResponse {
  data?: { publish_id?: string; status?: string; publicaly_available_post_id?: string[] };
  error?: { code?: string; message?: string };
}

const AUTH_ERROR_CODES = new Set([
  "access_token_invalid",
  "scope_not_authorized",
  "token_expired",
]);

async function call(
  path: string,
  token: string,
  body: Record<string, unknown>,
): Promise<TikTokResponse> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as TikTokResponse;

  const code = json.error?.code;
  if (code && code !== "ok") {
    const message = json.error?.message ?? code;
    if (AUTH_ERROR_CODES.has(code)) throw new ReconnectRequired(message);
    throw new Error(`tiktok: ${message}`);
  }
  if (!res.ok) throw new Error(`tiktok ${res.status}`);
  return json;
}

/** Public posting needs TikTok's audit. Without it every post is SELF_ONLY. */
function privacyLevel(): string {
  return process.env.TIKTOK_AUDITED === "1" ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY";
}

async function waitForPublish(publishId: string, token: string): Promise<string | null> {
  for (let i = 0; i < MAX_POLLS; i += 1) {
    const status = await call("/post/publish/status/fetch/", token, {
      publish_id: publishId,
    });
    const state = status.data?.status;
    if (state === "PUBLISH_COMPLETE") {
      return status.data?.publicaly_available_post_id?.[0] ?? null;
    }
    if (state === "FAILED") throw new Error("tiktok publish failed");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("tiktok publish did not complete in time");
}

export const tiktokPublisher: Publisher = {
  platform: "tiktok",

  isConfigured(): boolean {
    return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
  },

  async publishVideo(input: PublishInput): Promise<PublishResult> {
    const init = await call("/post/publish/video/init/", input.accessToken, {
      post_info: {
        title: input.caption.slice(0, 2200),
        privacy_level: privacyLevel(),
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: input.mediaUrl,
      },
    });

    const publishId = init.data?.publish_id;
    if (!publishId) throw new Error("tiktok returned no publish_id");

    const postId = await waitForPublish(publishId, input.accessToken);
    return {
      // Fall back to the publish id so the duplicate guard still has a value
      // even when TikTok does not return a public post id (SELF_ONLY posts).
      platformPostId: postId ?? publishId,
      postUrl: postId ? `https://www.tiktok.com/@${input.platformAccountId}/video/${postId}` : null,
    };
  },

  async publishCarousel(input: PublishInput): Promise<PublishResult> {
    const slides = input.slideUrls ?? [];
    if (slides.length === 0) throw new Error("a photo post needs at least 1 image");

    const init = await call("/post/publish/content/init/", input.accessToken, {
      post_info: {
        title: input.caption.slice(0, 90),
        description: input.caption.slice(0, 4000),
        privacy_level: privacyLevel(),
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_cover_index: 0,
        photo_images: slides,
      },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
    });

    const publishId = init.data?.publish_id;
    if (!publishId) throw new Error("tiktok returned no publish_id");

    const postId = await waitForPublish(publishId, input.accessToken);
    return { platformPostId: postId ?? publishId, postUrl: null };
  },
};
