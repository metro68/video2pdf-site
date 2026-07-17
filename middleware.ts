import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const isApi = request.nextUrl.pathname.startsWith("/api/");

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const res = NextResponse.next();
  res.headers.set("x-user-role", session.role);
  return res;
}

export const config = {
  runtime: "nodejs",
  matcher: ["/dashboard/:path*", "/api/metrics/:path*"],
};
