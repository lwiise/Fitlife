"use server";

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  OWNER_PHOTO_SUBJECT,
  PROFILE_PHOTOS_BUCKET,
  PROFILE_PHOTO_MAX_BYTES,
  isPhotoSubject,
  parseProfilePhotoPath,
  profilePhotoPathFor,
  sniffImageType,
} from "./shared";

export type ProfilePhotoResult = { ok: true } | { ok: false; error: string };

const AUTH_ERROR_AR = "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى";
const NOT_FOUND_AR = "هذا الفرد غير موجود في عائلتك";
const SAVE_ERROR_AR = "تعذّر حفظ الصورة، يرجى المحاولة مرة أخرى";
const REMOVE_ERROR_AR = "تعذّر إزالة الصورة، يرجى المحاولة مرة أخرى";
const FORMAT_ERROR_AR = "تعذّرت قراءة هذه الصورة، يرجى اختيار صورة أخرى";
const SIZE_ERROR_AR = "الصورة أكبر من المسموح، يرجى اختيار صورة أخرى";

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Who may have a photo: the owner, or a beneficiary of THIS account. The
 * RLS-scoped read doubles as the ownership check (another account's member id
 * returns no row). Never the housekeeper — the privacy policy keeps her data
 * to a name and a reading language.
 */
async function subjectAllowed(supabase: Db, userId: string, memberId: string) {
  if (memberId === OWNER_PHOTO_SUBJECT) return true;
  const { data, error } = await supabase
    .from("family_members")
    .select("role")
    .eq("id", memberId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return (data as { role: string }).role !== "housekeeper";
}

/** The person's current object path, if they have a photo. */
async function currentPath(supabase: Db, userId: string, memberId: string) {
  // profile_photos (00028) is newer than the generated types → untyped.
  const { data } = await (supabase as unknown as SupabaseClient)
    .from("profile_photos")
    .select("path")
    .eq("user_id", userId)
    .eq("member_id", memberId)
    .maybeSingle();
  const path = (data as { path?: unknown } | null)?.path;
  return typeof path === "string" ? path : null;
}

/**
 * Remove objects best-effort. A leftover object is unreadable to anyone but
 * this account and is swept by member removal / account erasure, so a failure
 * here is reported, never surfaced as a failed save. Only paths inside the
 * caller's own folder are touched (the bucket policy would refuse the rest).
 */
async function removeObjects(supabase: Db, userId: string, paths: string[], step: string) {
  const own = paths.filter((p) => parseProfilePhotoPath(p)?.userId === userId);
  if (own.length === 0) return;
  const { error } = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove(own);
  if (error) {
    Sentry.captureException(error, { tags: { area: "profile-photo", step, userId } });
  }
}

/**
 * Save a person's profile photo. FormData: `member_id` ("mom" or a
 * family_members id) and `photo` (the square the browser prepared with
 * prepareProfilePhoto).
 *
 * The bytes are sniffed here and stored under the type they actually are —
 * the bucket's mime allowlist only checks the Content-Type the uploader
 * claims. Each save is a NEW object (fresh uuid), so the served URL can be
 * cached as immutable; the previous object is removed after the row points at
 * the new one. If the row write fails, the fresh object is removed again.
 */
export async function saveProfilePhoto(form: FormData): Promise<ProfilePhotoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: AUTH_ERROR_AR };

  const memberId = form.get("member_id");
  const photo = form.get("photo");
  if (!isPhotoSubject(memberId)) return { ok: false, error: NOT_FOUND_AR };
  if (!(photo instanceof Blob) || photo.size === 0) {
    return { ok: false, error: FORMAT_ERROR_AR };
  }
  if (photo.size > PROFILE_PHOTO_MAX_BYTES) return { ok: false, error: SIZE_ERROR_AR };
  if (!(await subjectAllowed(supabase, user.id, memberId))) {
    return { ok: false, error: NOT_FOUND_AR };
  }

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, error: FORMAT_ERROR_AR };

  const path = profilePhotoPathFor(user.id, memberId, type);
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .upload(path, bytes, { contentType: type, upsert: false });
  if (uploadError) {
    // Also the pre-00028 state: the bucket does not exist yet.
    Sentry.captureException(uploadError, {
      tags: { area: "profile-photo", step: "upload", userId: user.id },
    });
    return { ok: false, error: SAVE_ERROR_AR };
  }

  const previous = await currentPath(supabase, user.id, memberId);
  const { error: rowError } = await (supabase as unknown as SupabaseClient)
    .from("profile_photos")
    .upsert(
      { user_id: user.id, member_id: memberId, path },
      { onConflict: "user_id,member_id" },
    );
  if (rowError) {
    Sentry.captureException(rowError, {
      tags: { area: "profile-photo", step: "row", userId: user.id },
    });
    await removeObjects(supabase, user.id, [path], "rollback");
    return { ok: false, error: SAVE_ERROR_AR };
  }

  if (previous && previous !== path) {
    await removeObjects(supabase, user.id, [previous], "replace");
  }

  // The photo shows in the header on every signed-in page, not only here.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Remove a person's photo: back to their initial. */
export async function removeProfilePhoto(memberId: string): Promise<ProfilePhotoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: AUTH_ERROR_AR };
  if (!isPhotoSubject(memberId)) return { ok: false, error: NOT_FOUND_AR };

  const previous = await currentPath(supabase, user.id, memberId);
  const { error } = await (supabase as unknown as SupabaseClient)
    .from("profile_photos")
    .delete()
    .eq("user_id", user.id)
    .eq("member_id", memberId);
  if (error) {
    Sentry.captureException(error, {
      tags: { area: "profile-photo", step: "remove", userId: user.id },
    });
    return { ok: false, error: REMOVE_ERROR_AR };
  }
  if (previous) await removeObjects(supabase, user.id, [previous], "remove");

  revalidatePath("/", "layout");
  return { ok: true };
}
