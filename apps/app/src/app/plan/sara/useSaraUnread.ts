import { useCallback, useSyncExternalStore } from "react";
import type { WeekChange } from "@fitlife/plan-engine";
import { hashChanges, saraSeenStore, unreadDot, withOpened } from "@/lib/plans/saraSeen";

/**
 * The ••• dot and the «جديد» tag on «ما عدّلته سارة هذا الأسبوع», plus the
 * write that clears them. The server render and hydration read false —
 * storage is browser-only, and a dot baked into the server HTML would flash
 * away for every reader who had already opened it; the real value lands in
 * the render right after hydration. Shares the toast's store, so opening the
 * sheet from either entry point updates both. Always false with no changes,
 * so it is safe to call unconditionally.
 */
export function useSaraUnread(
  weekStart: string,
  /** plan.week_changes as stored — absent on older plans and quiet weeks. */
  changes: ReadonlyArray<WeekChange> | null | undefined,
): { unread: boolean; markOpened: () => void } {
  const list = changes ?? [];
  const hash = hashChanges(list);
  const has = list.length > 0;

  const unread = useSyncExternalStore(
    saraSeenStore.subscribe,
    () => has && unreadDot(saraSeenStore.load(), weekStart, hash),
    () => false,
  );

  const markOpened = useCallback(() => {
    if (!has) return;
    saraSeenStore.update((seen) => withOpened(seen, weekStart, hash));
  }, [has, weekStart, hash]);

  return { unread, markOpened };
}
