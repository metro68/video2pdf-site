// Object storage for reference images, generated stills, renders and export
// packages. Supabase Storage rather than a second vendor: the project already
// exists, and the service-role key that reaches it is already in the worker's
// environment for Postgres.
//
// The bucket is private. Dashboard previews use short-lived signed URLs, so a
// generated asset is never publicly addressable.

const BUCKET = process.env.CONTENT_BUCKET ?? "content";

function config(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export function isConfigured(): boolean {
  return config() !== null;
}

/** Deterministic key layout so an asset's owner is readable from its path. */
export function assetKey(
  variantId: number,
  kind: "still" | "render" | "audio" | "export",
  index: number,
  ext: string,
): string {
  return `variants/${variantId}/${kind}-${index}.${ext}`;
}

export function referenceKey(avatarId: number, index: number, ext: string): string {
  return `avatars/${avatarId}/reference-${index}.${ext}`;
}

export async function putObject(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const cfg = config();
  if (!cfg) throw new Error("Supabase storage is not configured");

  const res = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": contentType,
      // Generation retries re-write the same key rather than accumulating
      // orphaned objects, so upsert rather than insert.
      "x-upsert": "true",
    },
    body: new Uint8Array(bytes),
  });

  if (!res.ok) {
    throw new Error(`storage put ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

export async function getObject(key: string): Promise<Buffer> {
  const cfg = config();
  if (!cfg) throw new Error("Supabase storage is not configured");

  const res = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${key}`, {
    headers: { Authorization: `Bearer ${cfg.key}` },
  });
  if (!res.ok) {
    throw new Error(`storage get ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Short-lived signed URL for dashboard previews. */
export async function signedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const cfg = config();
  if (!cfg) throw new Error("Supabase storage is not configured");

  const res = await fetch(`${cfg.url}/storage/v1/object/sign/${BUCKET}/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) {
    throw new Error(`storage sign ${res.status}`);
  }
  const json = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const path = json.signedURL ?? json.signedUrl;
  if (!path) throw new Error("no signed url returned");
  return `${cfg.url}/storage/v1${path}`;
}

export async function deleteObject(key: string): Promise<void> {
  const cfg = config();
  if (!cfg) throw new Error("Supabase storage is not configured");
  await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${key}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${cfg.key}` },
  });
}
