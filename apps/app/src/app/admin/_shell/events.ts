import type { FamilyView } from "@/lib/admin/console-types";

/**
 * Window events the console frame uses to talk to pages without a server
 * round-trip. The families page (U4) listens for the two cancelable ones and
 * calls `preventDefault()` when it handled the request client-side (state +
 * history.replaceState); the frame then skips its own router navigation.
 */

/** Opens the command palette (the top-bar search buttons dispatch it). */
export const PALETTE_OPEN_EVENT = "ad:palette-open";

/** Cancelable. detail: { id } — open this family in the side panel. */
export const FAMILY_OPEN_EVENT = "ad:open-family";

/** Cancelable. detail: { view } — switch the families list to this view. */
export const FAMILIES_VIEW_EVENT = "ad:families-view";

export interface FamilyOpenDetail {
  id: string;
}

export interface FamiliesViewDetail {
  view: FamilyView;
}

export function openCommandPalette(): void {
  window.dispatchEvent(new Event(PALETTE_OPEN_EVENT));
}

/** True when a listener handled it (called preventDefault). */
export function requestFamilyOpen(id: string): boolean {
  return !window.dispatchEvent(
    new CustomEvent<FamilyOpenDetail>(FAMILY_OPEN_EVENT, { detail: { id }, cancelable: true }),
  );
}

/** True when a listener handled it (called preventDefault). */
export function requestFamiliesView(view: FamilyView): boolean {
  return !window.dispatchEvent(
    new CustomEvent<FamiliesViewDetail>(FAMILIES_VIEW_EVENT, {
      detail: { view },
      cancelable: true,
    }),
  );
}
