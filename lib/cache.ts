interface Entry {
  value: unknown;
  asOf: string;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const store = new Map<string, Entry>();

export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): string {
  const now = Date.now();
  const asOf = new Date(now).toISOString();
  store.set(key, { value, asOf, expiresAt: now + ttlMs });
  return asOf;
}

export function getCached<T>(key: string): { value: T; asOf: string } | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return { value: entry.value as T, asOf: entry.asOf };
}

export function clearCache(): void {
  store.clear();
}
