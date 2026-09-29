import { countAr, type ArabicCountForms } from "@/lib/copy/plural";

/**
 * «سارة عدّلت خطتكِ» — what this browser has already been shown of Sara's
 * weekly changes (`plan_data.week_changes`), so the toast is a once-a-week
 * event and the ••• dot is a quiet "there is something new".
 *
 * Keyed on the plan WEEK (week_start_date), never on a meal_plans id: the
 * drain, the chain, the sweeper and every per-member regeneration mint a new
 * row inside the same week, and keying on the row would re-toast on each. The
 * dot is keyed on week + a hash of the text, so a mid-week regeneration that
 * rewords the changes earns a dot, never a second toast.
 *
 * Browser storage only, and deliberately so: this is a per-viewer courtesy,
 * not a record. When storage is unusable (private window, blocked site data)
 * everything degrades to "at most one toast per page session, no dot" — a dot
 * that could never be cleared would be noise, not information.
 */

export const SARA_SEEN_KEY = "fitlife.saraChanges.v1";

export type SaraSeen = { week: string; toasted: boolean; openedHash: string | null };

type WeekChangeText = { change_ar: string; because_ar: string };

/** Stable djb2 over the changes' text, as 8 hex chars. Field and item
 * separators are control characters the model never emits, so moving words
 * between fields or items changes the hash. */
export function hashChanges(changes: ReadonlyArray<WeekChangeText>): string {
  let h = 5381;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  };
  for (const c of changes) {
    mix(c.change_ar);
    mix("\u001f");
    mix(c.because_ar);
    mix("\u001e");
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function shouldToast(seen: SaraSeen | null, week: string): boolean {
  return !seen || seen.week !== week || !seen.toasted;
}

export function isUnread(seen: SaraSeen | null, week: string, hash: string): boolean {
  return !seen || seen.week !== week || seen.openedHash !== hash;
}

/** A new week starts clean: last week's opened hash says nothing about this one. */
export function withToasted(seen: SaraSeen | null, week: string): SaraSeen {
  if (seen && seen.week === week) return { ...seen, toasted: true };
  return { week, toasted: true, openedHash: null };
}

/** Opening the sheet also counts as toasted — she has seen more than the toast. */
export function withOpened(_seen: SaraSeen | null, week: string, hash: string): SaraSeen {
  return { week, toasted: true, openedHash: hash };
}

/** Anything that is not exactly the stored shape reads as "never seen". */
export function parseSaraSeen(raw: string | null): SaraSeen | null {
  if (raw == null) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.week !== "string" || o.week.length === 0) return null;
  if (typeof o.toasted !== "boolean") return null;
  if (o.openedHash !== null && typeof o.openedHash !== "string") return null;
  return { week: o.week, toasted: o.toasted, openedHash: o.openedHash };
}

type Read = { ok: true; seen: SaraSeen | null } | { ok: false };

function tryRead(storage?: Pick<Storage, "getItem">): Read {
  try {
    // Resolving window.localStorage can itself throw (SecurityError), and on
    // the server `window` does not exist — both land in the catch.
    const s = storage ?? window.localStorage;
    return { ok: true, seen: parseSaraSeen(s.getItem(SARA_SEEN_KEY)) };
  } catch {
    return { ok: false };
  }
}

export function readSaraSeen(storage?: Pick<Storage, "getItem">): SaraSeen | null {
  const r = tryRead(storage);
  return r.ok ? r.seen : null;
}

export function writeSaraSeen(v: SaraSeen, storage?: Pick<Storage, "setItem">): boolean {
  try {
    const s = storage ?? window.localStorage;
    s.setItem(SARA_SEEN_KEY, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

export interface SaraSeenSnapshot {
  /** false once storage has thrown: the record lives in memory for this page
   * session only, and the dot is suppressed. */
  persistent: boolean;
  seen: SaraSeen | null;
}

export interface SaraSeenStore {
  /** Referentially stable until the next change (useSyncExternalStore). */
  load(): SaraSeenSnapshot;
  /** Read-modify-write against a FRESH read, so the toast and the sheet (two
   * writers of one key) never clobber each other's field. */
  update(fn: (seen: SaraSeen | null) => SaraSeen): boolean;
  subscribe(listener: () => void): () => void;
}

/**
 * The toast and the ••• dot share one store, so opening the sheet from either
 * place updates both. Storage failure is sticky for the session: a store whose
 * getItem works but whose setItem throws (quota, some private modes) would
 * otherwise re-toast on every visit, since the "toasted" write never lands.
 */
export function createSaraSeenStore(
  getStorage: () => Pick<Storage, "getItem" | "setItem">,
): SaraSeenStore {
  let memory: SaraSeen | null = null;
  let broken = false;
  let cached: SaraSeenSnapshot | null = null;
  const listeners = new Set<() => void>();

  // Resolving the storage can throw on its own (SecurityError on access).
  function resolve(): Pick<Storage, "getItem" | "setItem"> | null {
    try {
      return getStorage();
    } catch {
      return null;
    }
  }

  function read(): SaraSeenSnapshot {
    if (!broken) {
      const s = resolve();
      const r: Read = s ? tryRead(s) : { ok: false };
      if (r.ok) return { persistent: true, seen: r.seen };
      broken = true;
    }
    return { persistent: false, seen: memory };
  }

  function notify() {
    for (const l of listeners) l();
  }

  // Another tab opened the sheet: re-read on the next snapshot.
  function onStorageEvent(e: StorageEvent) {
    if (e.key !== null && e.key !== SARA_SEEN_KEY) return;
    cached = null;
    notify();
  }

  return {
    load() {
      cached ??= read();
      return cached;
    },
    update(fn) {
      const next = fn(read().seen);
      memory = next;
      if (!broken) {
        const s = resolve();
        if (!s || !writeSaraSeen(next, s)) broken = true;
      }
      cached = { persistent: !broken, seen: next };
      notify();
      return !broken;
    },
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1 && typeof window !== "undefined") {
        window.addEventListener("storage", onStorageEvent);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && typeof window !== "undefined") {
          window.removeEventListener("storage", onStorageEvent);
        }
      };
    },
  };
}

/** The app's one instance. Nothing touches `window` until first use. */
export const saraSeenStore = createSaraSeenStore(() => window.localStorage);

/** Opened = she has seen THIS week's current wording in the sheet. Unlike
 * `isUnread` it holds in the in-memory fallback too, which the toast needs to
 * step aside once the sheet was opened from •••. */
export function isOpened(seen: SaraSeen | null, week: string, hash: string): boolean {
  return !isUnread(seen, week, hash);
}

/** The ••• dot: only when the record can outlive the page (see module note). */
export function unreadDot(snap: SaraSeenSnapshot, week: string, hash: string): boolean {
  return snap.persistent && isUnread(snap.seen, week, hash);
}

/** «تعديل» as the REST of a list («وتعديل آخر»), so آخر/أخرى agree with it. */
const MORE_CHANGE_FORMS: ArabicCountForms = {
  one: "تعديل آخر",
  two: "تعديلان آخران",
  few: "تعديلات أخرى",
  many: "تعديلاً آخر",
  other: "تعديل آخر",
};

/** The toast's tail after the first change: «وتعديل آخر» / «وتعديلان آخران» /
 * «و٣ تعديلات أخرى». Null when there is nothing after the first. `fmt` writes
 * the numeral (the app passes arNum). */
export function moreChangesAr(total: number, fmt: (n: number) => string = String): string | null {
  const rest = Math.floor(total) - 1;
  if (rest < 1) return null;
  return `و${countAr(rest, MORE_CHANGE_FORMS, fmt)}`;
}
