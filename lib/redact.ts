import type { Role } from "@/lib/types";

const ADMIN_ONLY_FIELDS = ["mrr", "arr"] as const;

export function redactForRole<T extends Record<string, unknown>>(data: T, role: Role): T {
  if (role === "admin") return { ...data };
  const copy = { ...data };
  for (const field of ADMIN_ONLY_FIELDS) {
    delete copy[field];
  }
  return copy;
}
