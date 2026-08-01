import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { markUnsubscribed } from "@/lib/db/leads";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const email = url.searchParams.get("e");
  const token = url.searchParams.get("t");

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return new Response("Invalid or expired unsubscribe link.", {
      status: 400,
      headers: { "content-type": "text/plain" },
    });
  }

  await markUnsubscribed(email);

  return new Response(
    "<!doctype html><html><body><p>You are unsubscribed. You will not receive any more reminder emails from us.</p></body></html>",
    { status: 200, headers: { "content-type": "text/html" } },
  );
}
