import { NextResponse } from "next/server";
import { upsertLead } from "@/lib/db/leads";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public funnel endpoint, no auth. Lead capture must never break the funnel:
// any DB failure still returns 200 ok:false rather than surfacing an error to
// the client. The email is intentionally never echoed back in the response.
export async function POST(request: Request): Promise<NextResponse> {
  const { email, scanType, frequency, src } = await request.json().catch(() => ({}));
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    await upsertLead({
      email: email.trim().toLowerCase(),
      scanType: typeof scanType === "string" ? scanType : null,
      frequency: typeof frequency === "string" ? frequency : null,
      src: typeof src === "string" ? src : null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
