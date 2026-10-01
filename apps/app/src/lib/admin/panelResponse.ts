/**
 * The families side panel route's error answers (GET /api/admin/families/:id),
 * shared by the route and the console's PanelLoader so the two cannot drift.
 * Plain constants, client-safe.
 *
 * A 404 means two different things, and only one of them may be remembered:
 *  - To anyone but an admin it is the bare PANEL_NOT_FOUND, which says
 *    nothing — not even that the route exists. Reaching the console, it
 *    means the operator's own access has lapsed (a session that ended or was
 *    signed out in another tab, an admin removed): the family may well exist.
 *  - Once the requester IS an admin, a family that does not exist is
 *    PANEL_FAMILY_GONE, marked with `reason: "family"`. Only that answer may
 *    tell the operator the family is gone, and only it is cached.
 * A lookup that failed (Auth or the admin table unreachable) is a 503
 * (PANEL_UNAVAILABLE): try again.
 */

export const PANEL_NOT_FOUND = { error: "Not found" } as const;

export const PANEL_FAMILY_GONE = { error: "Not found", reason: "family" } as const;

export const PANEL_UNAVAILABLE = { error: "Unavailable" } as const;

/** A 404 body that says the family itself does not exist (PANEL_FAMILY_GONE). */
export function isFamilyGone(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { reason?: unknown }).reason === PANEL_FAMILY_GONE.reason
  );
}
