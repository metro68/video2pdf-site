// Sends a test conversion to TikTok's Events API using the same payload shape
// the Stripe webhook builds, so the server-side path can be verified without
// taking a real payment.
//
//   TIKTOK_PIXEL_ID=... TIKTOK_EVENTS_ACCESS_TOKEN=... \
//     node scripts/tiktok-test-event.mjs StartTrial [test_event_code]
//
// Pass the Test Events code from TikTok Events Manager as the second argument
// to route the event to the Test Events tab instead of live reporting.

import { createHash } from "node:crypto";

const EVENT = process.argv[2] ?? "StartTrial";
const TEST_CODE = process.argv[3];
const VALID = ["StartTrial", "Purchase", "ViewContent", "Contact", "InitiateCheckout"];

const split = (v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const ids = split(process.env.TIKTOK_PIXEL_ID);
const tokens = split(process.env.TIKTOK_EVENTS_ACCESS_TOKEN);

if (!ids.length || !tokens.length) {
  console.error("Set TIKTOK_PIXEL_ID and TIKTOK_EVENTS_ACCESS_TOKEN in the environment.");
  console.error("Both accept comma-separated lists; tokens pair with ids by position.");
  process.exit(1);
}
if (!VALID.includes(EVENT)) {
  console.error(`Unknown event "${EVENT}". Expected one of: ${VALID.join(", ")}`);
  process.exit(1);
}

const email = "tiktok-server-test@video2pdf.ai";
const eventId = `test_${EVENT}_${Math.floor(Date.now() / 1000)}`;

console.log(`Sending ${EVENT} (event_id ${eventId})${TEST_CODE ? ` with test code ${TEST_CODE}` : ""}`);
console.log(`Pixels: ${ids.join(", ")}\n`);

let failed = 0;

for (const [i, pixelId] of ids.entries()) {
  const token = tokens.length === 1 ? tokens[0] : tokens[i];
  if (!token) {
    console.log(`${pixelId}: SKIPPED, no token at position ${i + 1}`);
    failed++;
    continue;
  }

  const body = {
    event_source: "web",
    event_source_id: pixelId,
    ...(TEST_CODE ? { test_event_code: TEST_CODE } : {}),
    data: [
      {
        event: EVENT,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        user: { email: createHash("sha256").update(email).digest("hex") },
        page: { url: "https://video2pdf.ai/go/success" },
        properties: { value: EVENT === "Purchase" ? 4.99 : 29.99, currency: "USD" },
      },
    ],
  };

  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
    method: "POST",
    headers: { "content-type": "application/json", "Access-Token": token },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  // TikTok returns HTTP 200 even for rejected payloads; code 0 is the real
  // success signal, and anything else carries the reason in the message field.
  if (json?.code === 0) {
    console.log(`${pixelId}: ACCEPTED`);
  } else {
    console.log(`${pixelId}: REJECTED (HTTP ${res.status}) ${json?.message ?? "unknown error"}`);
    failed++;
  }
}

console.log(
  failed
    ? `\n${failed} of ${ids.length} pixel(s) failed.`
    : `\nAll ${ids.length} pixel(s) accepted. Check Events Manager${TEST_CODE ? " > Test Events" : ""}.`
);
process.exit(failed ? 1 : 0);
