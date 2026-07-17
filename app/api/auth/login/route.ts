import { NextResponse } from "next/server";
import { verifyCredentials, signSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }
  const session = await verifyCredentials(body.email, body.password);
  if (!session) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const token = await signSession(session);
  const res = NextResponse.json({ role: session.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
