import { useEffect, useEffectEvent, type RefObject } from "react";

/**
 * Keyboard containment for the console's dialogs (the command palette, the
 * phone drawer, the health confirm). Client-only: import it by path from a
 * client component. It is deliberately NOT re-exported from ./index, which
 * server components import, because the hook uses client-only React APIs.
 *
 * The bug this exists for: a dialog's own onKeyDown only hears keys whose
 * target is inside it. A pointer press on something that cannot take focus
 * (a result row's text, a group label, padding) moves focus to <body>, and
 * from then on Esc, the arrows, Enter and Tab no longer reach the dialog.
 * Each dialog keeps focus inside itself (a container with tabIndex={-1}, or
 * mousedown handling that keeps focus in its field); `useEscapedKeys` is the
 * net under that: a window listener that still routes keys to the dialog
 * when focus got out anyway.
 */

/** What Tab can land on, in DOM order: visible, enabled, in the tab order. */
export function tabbablesIn(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, summary, [tabindex]',
    ),
  ).filter((el) => el.tabIndex >= 0 && !el.matches(":disabled") && el.getClientRects().length > 0);
}

interface TabKey {
  key: string;
  shiftKey: boolean;
  preventDefault(): void;
}

/**
 * Keeps Tab inside `container`: the last tabbable wraps to the first (Shift:
 * the first to the last), and focus that is on none of them — the container
 * itself after a click on plain text, or anything outside — goes to the first
 * (Shift: the last). With nothing tabbable, focus stays on the container.
 * Returns true when it moved focus; false for any other key, or when the
 * browser's own Tab order is already right.
 */
export function trapTab(event: TabKey, container: HTMLElement): boolean {
  if (event.key !== "Tab") return false;
  const nodes = tabbablesIn(container);
  const active = document.activeElement;
  const at = active instanceof HTMLElement ? nodes.indexOf(active) : -1;
  let next: HTMLElement | undefined;
  if (nodes.length === 0) next = container;
  else if (event.shiftKey) next = at <= 0 ? nodes[nodes.length - 1] : undefined;
  else next = at === -1 || at === nodes.length - 1 ? nodes[0] : undefined;
  if (!next) return false;
  event.preventDefault();
  next.focus();
  return true;
}

/**
 * While `open`, keys pressed with focus OUTSIDE the dialog still act on it:
 * Esc calls `onEscape`, Tab moves focus back in (trapTab), and anything else
 * goes to `onOtherKey`. Keys whose target is inside the dialog are left to
 * its own onKeyDown, and keys inside ANOTHER open dialog (one stacked above
 * it) are left to that one. Listens on window, after React's delegated
 * handlers, so an event a dialog already stopped never arrives here.
 */
export function useEscapedKeys({
  open,
  containerRef,
  onEscape,
  onOtherKey,
}: {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onEscape: () => void;
  onOtherKey?: (event: KeyboardEvent) => void;
}): void {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const container = containerRef.current;
    if (!container || event.defaultPrevented || event.isComposing) return;
    const target = event.target;
    if (target instanceof Node && container.contains(target)) return;
    if (target instanceof Element && target.closest('[aria-modal="true"]')) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
    } else if (!trapTab(event, container)) {
      onOtherKey?.(event);
    }
  });

  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [open]);
}
