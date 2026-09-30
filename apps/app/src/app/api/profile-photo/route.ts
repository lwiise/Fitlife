import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  PROFILE_PHOTOS_BUCKET,
  parseProfilePhotoPath,
  sniffImageType,
} from "@/lib/profilePhoto/shared";

export const runtime = "nodejs";

/**
 * GET /api/profile-photo?p=<user_id>/<member_id>-<uuid>.<ext>
 *
 * Serves one profile photo from the PRIVATE profile-photos bucket (00028) to
 * the account that owns it. The path must be one this app wrote and must sit
 * in the caller's own folder; the read then runs through the caller's own
 * client, so storage RLS checks the same thing again.
 *
 * Why a route and not signed URLs: a signed URL carries a fresh token on
 * every render, so the browser re-downloads every avatar on every page. Here
 * the URL is stable per object and objects are never overwritten (each save
 * is a new uuid), so the response is cached by the browser as immutable —
 * `private`, so no shared cache (the CDN) keeps a copy.
 *
 * Anything that is not the caller's photo answers 404 with no body; the
 * avatar under it then shows the person's initial.
 */
export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("p");
  const parsed = parseProfilePhotoPath(path);
  if (!parsed) return notFound();

  const user = await getAuthUser();
  if (!user || user.id !== parsed.userId) return notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .download(path as string);
  if (error || !data) return notFound();

  const bytes = new Uint8Array(await data.arrayBuffer());
  // Served as what the bytes are; anything else is not ours to serve.
  const type = sniffImageType(bytes);
  if (!type) return notFound();

  return new Response(bytes, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

function notFound() {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}
