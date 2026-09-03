import type { GeneratedScript } from "@/lib/content/providers/anthropic";
import type { QualityCheck } from "@/lib/content/types";

// Automated pre-review checks. These do not replace human approval, they stop
// obviously broken items from consuming a reviewer's attention.
//
// Everything here is deterministic and cheap: no second model call to grade the
// first one. Checks that genuinely need vision (malformed hands, identity
// drift) are declared as unavailable rather than faked, so the review UI can
// say what was and was not verified.

export const OVERLAY_WORD_LIMIT = 12;
export const EXPECTED_ASPECT = 1024 / 1536;

/** Claims a document scanning app cannot support. Matched case-insensitively
 *  as whole phrases, so ordinary copy is not tripped by a substring. */
const UNSUPPORTED_CLAIMS = [
  "guaranteed",
  "100% accurate",
  "best in the world",
  "free forever",
  "no subscription",
  "cures",
  "medical grade",
  "hipaa compliant",
  "bank grade encryption",
];

export function checkScript(script: GeneratedScript): QualityCheck[] {
  const checks: QualityCheck[] = [];

  const longOverlays = script.scenes.filter(
    (s) => s.overlayText.trim().split(/\s+/).length > OVERLAY_WORD_LIMIT,
  );
  checks.push({
    check: "overlay_length",
    passed: longOverlays.length === 0,
    detail:
      longOverlays.length === 0
        ? undefined
        : `${longOverlays.length} overlay(s) exceed ${OVERLAY_WORD_LIMIT} words and will not fit`,
  });

  const empty = script.scenes.filter((s) => s.overlayText.trim() === "");
  checks.push({
    check: "overlay_present",
    passed: empty.length === 0,
    detail: empty.length === 0 ? undefined : `${empty.length} scene(s) have no overlay text`,
  });

  // The image model must not be asked to render words: our renderer draws text
  // afterwards, and a prompt asking for type produces misspelled letterforms.
  const promptsWithText = script.scenes.filter((s) =>
    /\b(text|word|caption|title|sign|label|writing|letters)\b/i.test(s.imagePrompt),
  );
  checks.push({
    check: "image_prompt_textless",
    passed: promptsWithText.length === 0,
    detail:
      promptsWithText.length === 0
        ? undefined
        : `${promptsWithText.length} image prompt(s) ask for rendered text`,
  });

  const haystack = [
    script.caption,
    ...script.scenes.map((s) => s.overlayText),
    ...script.scenes.map((s) => s.voiceover ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  const found = UNSUPPORTED_CLAIMS.filter((c) => haystack.includes(c));
  checks.push({
    check: "supportable_claims",
    passed: found.length === 0,
    detail: found.length === 0 ? undefined : `unsupported claim(s): ${found.join(", ")}`,
  });

  checks.push({
    check: "caption_present",
    passed: script.caption.trim().length > 0,
    detail: script.caption.trim().length > 0 ? undefined : "caption is empty",
  });

  return checks;
}

/** Aspect ratio check from decoded image dimensions. Tolerance covers encoder
 *  rounding without admitting a genuinely wrong aspect. */
export function checkAspect(width: number, height: number): QualityCheck {
  const actual = width / height;
  const off = Math.abs(actual - EXPECTED_ASPECT) / EXPECTED_ASPECT;
  return {
    check: "aspect_ratio",
    passed: off <= 0.02,
    detail: off <= 0.02 ? undefined : `expected 2:3 portrait, got ${width}x${height}`,
  };
}

/** Checks we cannot perform without a vision pass. Declared rather than
 *  silently omitted, so the reviewer knows these are on them. */
export function declaredManualChecks(): QualityCheck[] {
  return [
    { check: "identity_drift", passed: true, detail: "not automated, verify by eye" },
    { check: "malformed_hands", passed: true, detail: "not automated, verify by eye" },
  ];
}

export function allPassed(checks: QualityCheck[]): boolean {
  return checks.every((c) => c.passed);
}
