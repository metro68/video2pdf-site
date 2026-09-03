import { sql } from "@/lib/db/client";

export interface Avatar {
  id: number;
  name: string;
  description: string | null;
  referenceKeys: string[];
  active: boolean;
  createdAt: number;
}

function map(r: Record<string, unknown>): Avatar {
  const keys = r.reference_keys;
  return {
    id: Number(r.id),
    name: String(r.name),
    description: r.description == null ? null : String(r.description),
    referenceKeys: Array.isArray(keys) ? (keys as string[]) : [],
    active: Boolean(r.active),
    createdAt: r.created_at instanceof Date ? r.created_at.getTime() : 0,
  };
}

export async function listAvatars(): Promise<Avatar[]> {
  const result = await sql`SELECT * FROM avatars ORDER BY created_at DESC`;
  return result.rows.map(map);
}

export async function createAvatar(
  name: string,
  description: string | null,
): Promise<Avatar> {
  const result = await sql`
    INSERT INTO avatars (name, description) VALUES (${name}, ${description})
    RETURNING *
  `;
  return map(result.rows[0]);
}

export async function addReferenceKey(id: number, key: string): Promise<void> {
  await sql`
    UPDATE avatars
    SET reference_keys = reference_keys || ${JSON.stringify([key])}::jsonb
    WHERE id = ${id}
  `;
}

export async function deleteAvatar(id: number): Promise<void> {
  await sql`DELETE FROM avatars WHERE id = ${id}`;
}
