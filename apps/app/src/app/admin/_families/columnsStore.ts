/**
 * The operator's hidden table columns, kept in this browser's localStorage
 * ("admin.families.columns") and read through useSyncExternalStore: the
 * server and the hydrating client both render every column (the server
 * snapshot), then the stored choice applies — no hydration mismatch.
 *
 * Storage can be unavailable or throw (private windows, blocked site data).
 * Every access is guarded; a choice that could not be saved still holds for
 * this tab (`memory`). Browser-only: call these from effects and handlers.
 */

import type { FamilyColumn } from "@/lib/admin/console-types";
import { COLUMNS_STORAGE_KEY, parseHiddenColumns, serializeHiddenColumns } from "./listModel";

const NONE: readonly FamilyColumn[] = [];
const listeners = new Set<() => void>();

/** What this tab chose last; null = follow storage. */
let memory: readonly FamilyColumn[] | null = null;
/** The last raw value read, and what it parsed to (a stable snapshot). */
let lastRaw: string | null = null;
let lastParsed: readonly FamilyColumn[] = NONE;

function readStorage(): readonly FamilyColumn[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastParsed = raw ? parseHiddenColumns(raw) : NONE;
  }
  return lastParsed;
}

export function getHiddenColumns(): readonly FamilyColumn[] {
  return memory ?? readStorage();
}

/** Server render and hydration: every column shows. */
export function getServerHiddenColumns(): readonly FamilyColumn[] {
  return NONE;
}

export function subscribeHiddenColumns(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changed the choice: follow it.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== COLUMNS_STORAGE_KEY) return;
    memory = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setHiddenColumns(hidden: readonly FamilyColumn[]): void {
  memory = hidden;
  try {
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, serializeHiddenColumns(hidden));
  } catch {
    // Not saved: the choice still holds in this tab.
  }
  for (const listener of listeners) listener();
}
