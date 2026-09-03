import type { PublishInput, PublishResult, Publisher } from "./types";
import { ReconnectRequired } from "./types";

// Instagram publishing via the Content Publishing API.
//
// Three steps, not one: create a media container, poll it until the platform
// has finished processing the video, then publish the container. The poll is
// mandatory. Publishing a container still IN_PROGRESS fails, and the processing
// time depends on the file, so a fixed sleep is not a substitute.
//
// Requires an Instagram Professional account linked to a Facebook Page, the
// instagram_content_publish permission, and App Review. Rate limit is 100
// API-published posts per rolling 24 hours per account.

const GRAPH = "https://graph.facebook.com/v21.0";
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 60;

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number };
}

// Codes meaning the credential is bad rather than the request: the caller
// should prompt a reconnect instead of burning retries.
const AUTH_ERROR_CODES = new Set([190, 102, 463, 467]);

async function graphPost(
  path: string,
  token: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}${path}`, { method: "POST", body });
  const json = (await res.json()) as Record<string, unknown> & GraphError;

  if (!res.ok || json.error) {
    const code = json.error?.code;
    const message = json.error?.message ?? `instagram ${res.status}`;
    if (code != null && AUTH_ERROR_CODES.has(code)) {
      throw new ReconnectRequired(message);
    }
    throw new Error(message);
  }
  return json;
}

async function waitForContainer(containerId: string, token: string): Promise<void> {
  for (let i = 0; i < MAX_POLLS; i += 1) {
    const res = await fetch(
      `${GRAPH}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
    );
    const json = (await res.json()) as { status_code?: string; status?: string };

    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") {
      throw new Error(`instagram container failed: ${json.status ?? "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("instagram container did not finish in time");
}

export const instagramPublisher: Publisher = {
  platform: "instagram",

  isConfigured(): boolean {
    return Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
  },

  async publishVideo(input: PublishInput): Promise<PublishResult> {
    const container = await graphPost(`/${input.platformAccountId}/media`, input.accessToken, {
      media_type: "REELS",
      video_url: input.mediaUrl,
      caption: input.caption,
    });
    const containerId = String(container.id);

    await waitForContainer(containerId, input.accessToken);

    const published = await graphPost(
      `/${input.platformAccountId}/media_publish`,
      input.accessToken,
      { creation_id: containerId },
    );
    const id = String(published.id);
    return { platformPostId: id, postUrl: `https://www.instagram.com/p/${id}/` };
  },

  async publishCarousel(input: PublishInput): Promise<PublishResult> {
    const slides = input.slideUrls ?? [];
    if (slides.length < 2) throw new Error("a carousel needs at least 2 slides");

    // Each slide is its own container, marked is_carousel_item so it is not
    // published on its own, then all are attached to one parent container.
    const childIds: string[] = [];
    for (const url of slides) {
      const child = await graphPost(`/${input.platformAccountId}/media`, input.accessToken, {
        image_url: url,
        is_carousel_item: "true",
      });
      childIds.push(String(child.id));
    }

    const parent = await graphPost(`/${input.platformAccountId}/media`, input.accessToken, {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption: input.caption,
    });
    const parentId = String(parent.id);

    await waitForContainer(parentId, input.accessToken);

    const published = await graphPost(
      `/${input.platformAccountId}/media_publish`,
      input.accessToken,
      { creation_id: parentId },
    );
    const id = String(published.id);
    return { platformPostId: id, postUrl: `https://www.instagram.com/p/${id}/` };
  },
};
