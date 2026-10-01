import type { FamilySearchEntry } from "@/lib/admin/console-types";

/**
 * The command palette's family index, on the client. It is subscriber data,
 * so it is never part of a page: the palette asks for it the first time it
 * opens, and GET /api/admin/families records every answer in the audit log.
 */
export const FAMILY_INDEX_URL = "/api/admin/families";

/**
 * The route's JSON (FamilySearchIndex), checked rather than trusted: entries
 * without a string id are dropped, a missing name or email reads as null.
 * Anything that is not that shape at all is null — the palette then says the
 * list could not be loaded instead of searching nothing.
 */
export function parseFamilyIndex(body: unknown): FamilySearchEntry[] | null {
  if (body === null || typeof body !== "object") return null;
  const families: unknown = (body as { families?: unknown }).families;
  if (!Array.isArray(families)) return null;
  const out: FamilySearchEntry[] = [];
  for (const item of families) {
    if (item === null || typeof item !== "object") continue;
    const { id, name, email } = item as Record<string, unknown>;
    if (typeof id !== "string" || id === "") continue;
    out.push({
      id,
      name: typeof name === "string" ? name : null,
      email: typeof email === "string" ? email : null,
    });
  }
  return out;
}

/** Fetches the index; throws on anything but a well-formed 200. */
export async function fetchFamilyIndex(signal?: AbortSignal): Promise<FamilySearchEntry[]> {
  const response = await fetch(FAMILY_INDEX_URL, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`family index: HTTP ${response.status}`);
  const families = parseFamilyIndex(await response.json());
  if (!families) throw new Error("family index: malformed response");
  return families;
}
