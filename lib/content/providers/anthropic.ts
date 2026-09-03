import type { ConnectorResult } from "@/lib/connectors/types";
import type { Concept, ContentFormat, PostSnapshot } from "@/lib/content/types";

// Anthropic adapter: research analysis, concepts, scripts, captions and
// performance summaries. Behind an adapter so a model or API change does not
// reach into campaign logic.
//
// Sonnet 5 rather than Opus: this is high-volume, well-specified generation
// where the cheaper model is sufficient, and text is a small fraction of the
// engine's cost either way. Callers may override per request.

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";

// Pricing per million tokens, used to record spend against a campaign budget.
const INPUT_PER_MTOK_CENTS = 200;
const OUTPUT_PER_MTOK_CENTS = 1000;

export interface AnthropicUsage {
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}

export function estimateCostCents(inputTokens: number, outputTokens: number): number {
  const cents =
    (inputTokens / 1_000_000) * INPUT_PER_MTOK_CENTS +
    (outputTokens / 1_000_000) * OUTPUT_PER_MTOK_CENTS;
  // Round up so recorded spend never understates the bill.
  return Math.ceil(cents);
}

export function hasCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

interface MessageResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string;
}

interface CallOptions {
  system?: string;
  maxTokens?: number;
  model?: string;
}

/** Low-level call. Returns the concatenated text blocks plus usage. */
async function callAnthropic(
  prompt: string,
  options: CallOptions = {},
): Promise<{ text: string; usage: AnthropicUsage }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      max_tokens: options.maxTokens ?? 4000,
      system: options.system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const json = (await res.json()) as MessageResponse;
  // Guard before reading content: a policy decline returns HTTP 200 with
  // stop_reason "refusal" and no usable text.
  if (json.stop_reason === "refusal") {
    throw new Error("anthropic declined this request");
  }

  const text = json.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");

  const inputTokens = json.usage?.input_tokens ?? 0;
  const outputTokens = json.usage?.output_tokens ?? 0;

  return {
    text,
    usage: {
      inputTokens,
      outputTokens,
      costCents: estimateCostCents(inputTokens, outputTokens),
    },
  };
}

/** Extracts the first JSON object or array from a model response, tolerating
 *  surrounding prose or a fenced code block. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in model response");
  const slice = candidate.slice(start);
  return JSON.parse(slice) as T;
}

export interface ConceptIdea {
  hook: string;
  angle: string;
  structure: string;
  format: ContentFormat;
}

/**
 * Proposes concepts from observed outliers. The posts are supplied as research
 * input, not as material to copy: the prompt asks for the transferable pattern
 * rather than a rewrite, since duplicating someone else's creative is both a
 * rights problem and, once several of our accounts do it, a detection problem.
 */
export async function proposeConcepts(
  posts: PostSnapshot[],
  brief: { objective: string; audience: string; product: string },
  count = 5,
): Promise<ConnectorResult<{ concepts: ConceptIdea[]; usage: AnthropicUsage }>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }

  const examples = posts
    .slice(0, 20)
    .map((p, i) => {
      const stats = [
        p.views != null ? `${p.views} views` : null,
        p.likes != null ? `${p.likes} likes` : null,
        p.comments != null ? `${p.comments} comments` : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `${i + 1}. [${p.mediaType ?? "unknown"}] ${p.caption ?? "(no caption)"}${stats ? ` (${stats})` : ""}`;
    })
    .join("\n");

  const prompt = `These posts outperformed their own accounts' baselines:

${examples}

Product: ${brief.product}
Objective: ${brief.objective}
Audience: ${brief.audience}

Identify what makes these work (the hook mechanism, the angle, the structure),
then propose ${count} original concepts applying those patterns to the product.
Do not rewrite or closely imitate any specific example: extract the transferable
pattern and build something new with it.

Return only JSON: an array of objects with keys "hook", "angle", "structure",
"format". format is one of "reel", "carousel", "image".`;

  try {
    const { text, usage } = await callAnthropic(prompt, {
      system:
        "You are a direct response creative strategist for short-form social video. " +
        "You write specific, concrete hooks, never generic marketing language.",
    });
    const concepts = extractJson<ConceptIdea[]>(text);
    return {
      data: { concepts, usage },
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

export interface GeneratedScript {
  /** One entry per scene or slide. */
  scenes: Array<{ imagePrompt: string; overlayText: string; voiceover?: string }>;
  caption: string;
  hashtags: string[];
}

/**
 * Turns a concept into a per-account script. accountAngle is included so two
 * accounts running the same concept produce visibly different scripts, images
 * and captions: shared concepts are cheap, shared media is what gets a cluster
 * of accounts suppressed.
 */
export async function generateScript(
  concept: Pick<Concept, "hook" | "angle" | "structure" | "format">,
  context: { product: string; cta: string; accountAngle: string | null },
): Promise<ConnectorResult<{ script: GeneratedScript; usage: AnthropicUsage }>> {
  if (!hasCredentials()) {
    return { data: null, asOf: null, status: "awaiting_credentials" };
  }

  const sceneCount = concept.format === "carousel" ? "5 to 8 slides" : "5 to 7 scenes";

  const prompt = `Concept
Hook: ${concept.hook}
Angle: ${concept.angle ?? "not specified"}
Structure: ${concept.structure ?? "not specified"}
Format: ${concept.format}

Product: ${context.product}
Call to action: ${context.cta}
This account's angle: ${context.accountAngle ?? "general"}

Write ${sceneCount} for a faceless vertical ${concept.format}.

For each scene give:
- "imagePrompt": a photographic description for an image generator. No text, no
  words, no letterforms in the image itself. Describe the shot only.
- "overlayText": the on-screen text, at most 12 words. Our renderer draws this
  after generation, so it must be plain text.
${concept.format === "reel" ? '- "voiceover": one spoken sentence for this scene.\n' : ""}
Then give "caption" (with the call to action) and "hashtags" (5 to 8, no # prefix).

Write for this account's specific angle so it does not read like a template.
Make no claims about the product that are not plainly true of a document
scanning app.

Return only JSON with keys "scenes", "caption", "hashtags".`;

  try {
    const { text, usage } = await callAnthropic(prompt, {
      system:
        "You write short-form social scripts. Concrete, specific, no marketing " +
        "cliches, no unsupported claims.",
    });
    const script = extractJson<GeneratedScript>(text);
    return { data: { script, usage }, asOf: new Date().toISOString(), status: "ok" };
  } catch (err) {
    return {
      data: null,
      asOf: null,
      status: "error",
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}
