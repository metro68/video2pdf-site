import { NextResponse } from "next/server";
import {
  addReferenceKey,
  createAvatar,
  deleteAvatar,
  listAvatars,
} from "@/lib/db/content/avatars";
import { putObject, referenceKey, isConfigured } from "@/lib/content/storage";

// Avatar profiles: reference photos an operator uploads, reused to keep a
// recurring character recognisable across generated scenes. v1 produces stills
// only, no talking-head and no lip sync.

const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function GET(): Promise<NextResponse> {
  try {
    const avatars = await listAvatars();
    return NextResponse.json({ status: "ok", data: { avatars } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";

  // Multipart means a reference upload against an existing avatar; JSON means
  // creating the avatar itself.
  if (contentType.includes("multipart/form-data")) {
    if (!isConfigured()) {
      return NextResponse.json(
        { status: "error", error: "object storage is not configured" },
        { status: 503 },
      );
    }
    try {
      const form = await request.formData();
      const avatarId = Number(form.get("avatarId"));
      const file = form.get("file");
      const index = Number(form.get("index") ?? 0);

      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return NextResponse.json(
          { status: "error", error: "avatarId is required" },
          { status: 400 },
        );
      }
      if (!(file instanceof File)) {
        return NextResponse.json({ status: "error", error: "file is required" }, { status: 400 });
      }
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { status: "error", error: "file must be png, jpeg or webp" },
          { status: 400 },
        );
      }
      if (file.size > MAX_REFERENCE_BYTES) {
        return NextResponse.json(
          { status: "error", error: "file must be 10MB or smaller" },
          { status: 400 },
        );
      }

      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const key = referenceKey(avatarId, index, ext);
      await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
      await addReferenceKey(avatarId, key);

      return NextResponse.json({ status: "ok", data: { key } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      return NextResponse.json({ status: "error", error: message }, { status: 500 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }
  const input = body as { name?: string; description?: string };
  if (!input.name || input.name.trim() === "") {
    return NextResponse.json({ status: "error", error: "name is required" }, { status: 400 });
  }
  try {
    const avatar = await createAvatar(input.name.trim(), input.description ?? null);
    return NextResponse.json({ status: "ok", data: { avatar } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }
  try {
    await deleteAvatar(id);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
