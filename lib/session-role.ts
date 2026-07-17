import type { Role } from "@/lib/types";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

export async function roleFromRequest(request: Request): Promise<Role | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await verifySession(token);
  return session?.role ?? null;
}
