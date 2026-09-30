/**
 * Profile photos (09/2026, migration 00028) — the pure half, safe on the
 * server, in the browser and in tests.
 *
 * One photo per person: the account owner ("mom", the same sentinel plan_data
 * and the engagement tables use) and every family member who is a plan
 * beneficiary — adults AND children. The housekeeper has none: the privacy
 * policy keeps her data to a name and a reading language.
 *
 * The public.profile_photos table maps (user_id, member_id) → object path —
 * a separate table rather than a column on profiles / family_members because
 * a member row newer than the plan reads as an unapplied edit (staleMemberIds)
 * and would buy a paid regeneration for a new photo. Objects live in the
 * PRIVATE profile-photos bucket at
 *   <user_id>/<subject>-<uuid>.<ext>
 * and are served only through /api/profile-photo, which checks the session
 * and reads with the caller's own client. A new photo is always a NEW object
 * (fresh uuid, never an overwrite), so the served URL for a path can be cached
 * as immutable and a replacement changes the URL by construction.
 */

export const PROFILE_PHOTOS_BUCKET = "profile-photos";

/** Mirrors the bucket's file_size_limit (00028). The client re-encodes every
 * photo to a small square, so a real save is tens of KB. */
export const PROFILE_PHOTO_MAX_BYTES = 1024 * 1024;

/** Edge of the saved square, in px — 3× the largest avatar in a list (44 px)
 * with room for the photo sheet's larger preview. */
export const PROFILE_PHOTO_EDGE = 384;

/** The account owner's subject id, as everywhere else in the app. */
export const OWNER_PHOTO_SUBJECT = "mom";

export type ProfilePhotoType = "image/webp" | "image/jpeg" | "image/png";

export const PROFILE_PHOTO_EXT: Record<ProfilePhotoType, "webp" | "jpg" | "png"> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const TYPE_BY_EXT: Record<string, ProfilePhotoType> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_RE = new RegExp(`^${UUID}$`);
const PATH_RE = new RegExp(`^(${UUID})/(mom|${UUID})-${UUID}\\.(webp|jpg|png)$`);

/** "mom" or a family_members id — the only things that can own a photo. */
export function isPhotoSubject(id: unknown): id is string {
  return typeof id === "string" && (id === OWNER_PHOTO_SUBJECT || UUID_RE.test(id));
}

/**
 * The parts of a stored path, or null when it is not one this app wrote.
 * Every consumer goes through this, so a hand-edited or legacy value can never
 * steer a read outside the convention.
 */
export function parseProfilePhotoPath(
  path: unknown,
): { userId: string; subject: string; type: ProfilePhotoType } | null {
  if (typeof path !== "string") return null;
  const m = PATH_RE.exec(path);
  if (!m) return null;
  return { userId: m[1]!, subject: m[2]!, type: TYPE_BY_EXT[m[3]!]! };
}

export function profilePhotoPathFor(
  userId: string,
  subject: string,
  type: ProfilePhotoType,
  id: string = crypto.randomUUID(),
): string {
  return `${userId}/${subject}-${id}.${PROFILE_PHOTO_EXT[type]}`;
}

/**
 * The URL an <img> uses for a stored path, or null (→ the initial).
 * A query parameter rather than a path segment on purpose: proxy.ts skips the
 * session refresh for any pathname ending in an image extension, and this
 * route needs the session.
 */
export function profilePhotoSrc(path: unknown): string | null {
  if (!parseProfilePhotoPath(path)) return null;
  return `/api/profile-photo?p=${encodeURIComponent(path as string)}`;
}

/**
 * Photo URL per person ("mom" + each beneficiary's id) for the components that
 * draw avatars, from the account's profile_photos rows (member_id → path).
 * People without a photo are absent, so a lookup miss means "draw the
 * initial". Only the owner and CURRENT beneficiaries are kept — never the
 * housekeeper, never a row left behind by a removed member.
 */
export function householdPhotoSrcs(
  paths: Readonly<Record<string, string>>,
  members: ReadonlyArray<{ id: string; role?: string | null }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const own = profilePhotoSrc(paths[OWNER_PHOTO_SUBJECT]);
  if (own) out[OWNER_PHOTO_SUBJECT] = own;
  for (const m of members) {
    if (m.role === "housekeeper") continue;
    const src = profilePhotoSrc(paths[m.id]);
    if (src) out[m.id] = src;
  }
  return out;
}

/**
 * What the bytes actually are, from their signature — never the name or the
 * type the browser claimed. The server stores only these three.
 */
export function sniffImageType(bytes: Uint8Array): ProfilePhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * The square taken from a photo of any shape. Landscape: centred. Portrait:
 * a little above centre, because a face sits in the upper part of a portrait
 * frame and a dead-centre square cuts off the top of the head in full-length
 * shots.
 */
export function squareCrop(
  width: number,
  height: number,
): { sx: number; sy: number; size: number } {
  const size = Math.max(1, Math.min(width, height));
  const sx = Math.max(0, Math.round((width - size) / 2));
  const sy = Math.max(
    0,
    Math.round(height > width ? (height - size) * 0.3 : (height - size) / 2),
  );
  return { sx, sy, size };
}
