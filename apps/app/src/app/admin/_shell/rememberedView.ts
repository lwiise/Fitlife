import type { FamilyView } from "@/lib/admin/console-types";
import { parseView } from "./views";

/**
 * The families view the operator last looked at, kept for the tab session so
 * the rail can keep that view lit on a family page (/admin/subscribers/*),
 * which has no ?view= of its own. sessionStorage can throw (private mode,
 * blocked storage); every access is guarded and falls back to "all".
 */
const KEY = "ad:last-families-view";
const listeners = new Set<() => void>();

export function subscribeRememberedView(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readRememberedView(): FamilyView {
  try {
    return parseView(window.sessionStorage.getItem(KEY));
  } catch {
    return "all";
  }
}

export function serverRememberedView(): FamilyView {
  return "all";
}

export function rememberView(view: FamilyView): void {
  try {
    if (window.sessionStorage.getItem(KEY) === view) return;
    window.sessionStorage.setItem(KEY, view);
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}
