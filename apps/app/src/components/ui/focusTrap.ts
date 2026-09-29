// Tab containment for the app's two modals (Sheet, ConfirmDialog) — one
// implementation, because a ConfirmDialog opened from a sheet takes the trap
// over from it, and two copies of the wrap rule would drift apart.

/** Everything Tab can land on inside a modal panel. */
export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keep Tab inside `panel`: wrap at both ends, and pull focus back in when it
 * sits outside the panel or on the panel itself (a dialog focuses its own
 * container when it has a form, so the first Tab lands on the first control).
 * Call from a document keydown listener; ignores every key but Tab.
 */
export function trapTab(e: KeyboardEvent, panel: HTMLElement | null): void {
  if (e.key !== "Tab" || !panel) return;
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    e.preventDefault();
    return;
  }
  const active = document.activeElement;
  if (!panel.contains(active) || active === panel) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}
