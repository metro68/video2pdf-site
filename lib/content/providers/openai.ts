import type { ConnectorResult } from "@/lib/connectors/types";
import type { ImageQuality } from "@/lib/content/types";

// OpenAI adapter: reference-based stills, supporting images, and optional
// voice-over. Behind an adapter so the image model can be swapped (or replaced
// by a cheaper vendor) without touching campaign logic.

const IMAGE_URL = "https://api.openai.com/v1/images/generations";
const IMAGE_EDIT_URL = "https://api.openai.com/v1/images/edits";
const SPEECH_URL = "https://api.openai.com/v1/audio/speech";

const IMAGE_MODEL = "gpt-image-1.5";
const TTS_MODEL = "gpt-4o-mini-tts";

// Vertical 1024x1536, which is the aspect both Reels and carousels use.
export const PORTRAIT_SIZE = "1024x1536";

// Per-image cost in cents at 1024x1536, used to check a campaign's budget
// before generating and to record spend after. Update alongside the model.
const IMAGE_COST_CENTS: Record<ImageQuality, number> = {
  low: 2,
  medium: 5,
  high: 20,
};

export function imageCostCents(quality: ImageQuality, count: number): number {
  return IMAGE_COST_CENTS[quality] * count;
}

export function hasCredentials(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export interface GeneratedImage {
  /** Raw PNG bytes, ready to be written to object storage. */
  bytes: Buffer;
  costCents: number;
}

interface ImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

/**
 * Generates one still.
 *
 * Prompts must not ask the model to render text: our template renderer draws
 * overlays afterwards, which is what guarantees legible, correctly spelled
 * copy and lets us use the cheapest quality tier without the type suffering.
 */
export async function generateImage(
  prompt: string,
  quality: ImageQuality,
): Promise<ConnectorResult<GeneratedImage>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }

  try {
    const res = await fetch(IMAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        size: PORTRAIT_SIZE,
        quality,
        n: 1,
      }),
    });

    if (!res.ok) {
      throw new Error(`openai images ${res.status}: ${(await res.text()).slice(0, 500)}`);
    }

    const json = (await res.json()) as ImageResponse;
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error(json.error?.message ?? "no image returned");

    return {
      data: { bytes: Buffer.from(b64, "base64"), costCents: IMAGE_COST_CENTS[quality] },
      asOf: new Date().toISOString(),
      status: "ok",
    };
  } catch (err) {
    return {
      data: null,
      asOf: null,
      status: "error",
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

/**
 * Generates a still conditioned on avatar reference photos, so a recurring
 * character stays recognisable across scenes. v1 produces stills only: no
 * talking-head, no lip sync.
 */
export async function generateFromReference(
  prompt: string,
  references: Buffer[],
  quality: ImageQuality,
): Promise<ConnectorResult<GeneratedImage>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  if (references.length === 0) {
    return { data: null, asOf: null, status: "error", error: "no reference images" };
  }

  try {
    const form = new FormData();
    form.append("model", IMAGE_MODEL);
    form.append("prompt", prompt);
    form.append("size", PORTRAIT_SIZE);
    form.append("quality", quality);
    references.forEach((buf, i) => {
      form.append(
        "image[]",
        new Blob([new Uint8Array(buf)], { type: "image/png" }),
        `reference-${i}.png`,
      );
    });

    const res = await fetch(IMAGE_EDIT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });

    if (!res.ok) {
      throw new Error(`openai edits ${res.status}: ${(await res.text()).slice(0, 500)}`);
    }

    const json = (await res.json()) as ImageResponse;
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error(json.error?.message ?? "no image returned");

    return {
      data: { bytes: Buffer.from(b64, "base64"), costCents: IMAGE_COST_CENTS[quality] },
      asOf: new Date().toISOString(),
      status: "ok",
    };
  } catch (err) {
    return {
      data: null,
      asOf: null,
      status: "error",
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

/** Optional voice-over. Returns MP3 bytes. */
export async function generateSpeech(
  text: string,
  voice = "alloy",
): Promise<ConnectorResult<{ bytes: Buffer }>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }
  try {
    const res = await fetch(SPEECH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: TTS_MODEL, input: text, voice, response_format: "mp3" }),
    });
    if (!res.ok) {
      throw new Error(`openai speech ${res.status}: ${(await res.text()).slice(0, 500)}`);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    return { data: { bytes }, asOf: new Date().toISOString(), status: "ok" };
  } catch (err) {
    return {
      data: null,
      asOf: null,
      status: "error",
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}
