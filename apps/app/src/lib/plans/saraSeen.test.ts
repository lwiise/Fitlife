import { describe, expect, it, vi } from "vitest";

import { arNum } from "@/lib/copy/numbers";
import {
  SARA_SEEN_KEY,
  createSaraSeenStore,
  hashChanges,
  isOpened,
  isUnread,
  moreChangesAr,
  parseSaraSeen,
  readSaraSeen,
  shouldToast,
  unreadDot,
  withOpened,
  withToasted,
  writeSaraSeen,
  type SaraSeen,
} from "./saraSeen";

const WEEK = "2026-09-27";
const NEXT_WEEK = "2026-10-04";

const CHANGES = [
  { change_ar: "خفّفتُ الأرز في العشاء", because_ar: "سجّلتِ تجاوز العشاء ثلاث مرات" },
  { change_ar: "أضفتُ وجبة خفيفة بعد العصر", because_ar: "أعطيتِ «نحبّها» للزبادي مرتين" },
];

/** An in-memory Storage double; each method can be made to throw. */
function memoryStorage(opts: { getThrows?: boolean; setThrows?: boolean } = {}) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: vi.fn((k: string) => {
      if (opts.getThrows) throw new DOMException("blocked", "SecurityError");
      return data.get(k) ?? null;
    }),
    setItem: vi.fn((k: string, v: string) => {
      if (opts.setThrows) throw new DOMException("full", "QuotaExceededError");
      data.set(k, v);
    }),
  };
}

describe("hashChanges", () => {
  it("is stable for the same text and shaped as 8 hex chars", () => {
    const a = hashChanges(CHANGES);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(hashChanges(CHANGES.map((c) => ({ ...c })))).toBe(a);
  });

  it("changes when a mid-week regeneration rewords, reorders or drops a change", () => {
    const base = hashChanges(CHANGES);
    expect(hashChanges([{ ...CHANGES[0]!, change_ar: "قلّلتُ الأرز في العشاء" }, CHANGES[1]!])).not.toBe(base);
    expect(hashChanges([CHANGES[1]!, CHANGES[0]!])).not.toBe(base);
    expect(hashChanges([CHANGES[0]!])).not.toBe(base);
  });

  it("does not collide when words move between fields or items", () => {
    expect(hashChanges([{ change_ar: "أب", because_ar: "ج" }])).not.toBe(
      hashChanges([{ change_ar: "أ", because_ar: "بج" }]),
    );
    expect(
      hashChanges([
        { change_ar: "أ", because_ar: "ب" },
        { change_ar: "ج", because_ar: "د" },
      ]),
    ).not.toBe(hashChanges([{ change_ar: "أ", because_ar: "بجد" }]));
  });

  it("hashes an empty list without throwing", () => {
    expect(hashChanges([])).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("shouldToast — once per plan WEEK", () => {
  it("toasts a browser that has never seen anything", () => {
    expect(shouldToast(null, WEEK)).toBe(true);
  });

  it("toasts again when the week changes", () => {
    expect(shouldToast({ week: WEEK, toasted: true, openedHash: "x" }, NEXT_WEEK)).toBe(true);
  });

  it("toasts a same-week record that was never actually shown", () => {
    expect(shouldToast({ week: WEEK, toasted: false, openedHash: null }, WEEK)).toBe(true);
  });

  it("does not toast twice in one week, whatever the hash", () => {
    expect(shouldToast({ week: WEEK, toasted: true, openedHash: null }, WEEK)).toBe(false);
    expect(shouldToast({ week: WEEK, toasted: true, openedHash: "old" }, WEEK)).toBe(false);
  });
});

describe("isUnread — keyed on week + hash", () => {
  const hash = hashChanges(CHANGES);

  it("is unread until the sheet was opened on this exact wording", () => {
    expect(isUnread(null, WEEK, hash)).toBe(true);
    expect(isUnread({ week: WEEK, toasted: true, openedHash: null }, WEEK, hash)).toBe(true);
    expect(isUnread({ week: WEEK, toasted: true, openedHash: hash }, WEEK, hash)).toBe(false);
  });

  it("goes unread again on a reworded regeneration in the same week", () => {
    expect(isUnread({ week: WEEK, toasted: true, openedHash: "00000000" }, WEEK, hash)).toBe(true);
  });

  it("goes unread again in a new week even with identical wording", () => {
    expect(isUnread({ week: WEEK, toasted: true, openedHash: hash }, NEXT_WEEK, hash)).toBe(true);
  });

  it("isOpened is its complement", () => {
    const seen: SaraSeen = { week: WEEK, toasted: true, openedHash: hash };
    expect(isOpened(seen, WEEK, hash)).toBe(true);
    expect(isOpened(null, WEEK, hash)).toBe(false);
  });
});

describe("withToasted / withOpened", () => {
  it("starts a clean record from nothing", () => {
    expect(withToasted(null, WEEK)).toEqual({ week: WEEK, toasted: true, openedHash: null });
  });

  it("keeps the opened hash within the same week", () => {
    const seen: SaraSeen = { week: WEEK, toasted: false, openedHash: "abc" };
    expect(withToasted(seen, WEEK)).toEqual({ week: WEEK, toasted: true, openedHash: "abc" });
  });

  it("drops last week's opened hash when the week changes", () => {
    const seen: SaraSeen = { week: WEEK, toasted: true, openedHash: "abc" };
    expect(withToasted(seen, NEXT_WEEK)).toEqual({
      week: NEXT_WEEK,
      toasted: true,
      openedHash: null,
    });
  });

  it("never mutates its input", () => {
    const seen: SaraSeen = { week: WEEK, toasted: false, openedHash: null };
    withToasted(seen, WEEK);
    withOpened(seen, WEEK, "abc");
    expect(seen).toEqual({ week: WEEK, toasted: false, openedHash: null });
  });

  it("opening marks the wording read AND counts as toasted", () => {
    const opened = withOpened(null, WEEK, "abc");
    expect(opened).toEqual({ week: WEEK, toasted: true, openedHash: "abc" });
    expect(shouldToast(opened, WEEK)).toBe(false);
    expect(isUnread(opened, WEEK, "abc")).toBe(false);
  });
});

describe("parseSaraSeen — shape validation", () => {
  it("accepts exactly the stored shape and drops unknown keys", () => {
    expect(parseSaraSeen(JSON.stringify({ week: WEEK, toasted: true, openedHash: "abc", x: 1 }))).toEqual({
      week: WEEK,
      toasted: true,
      openedHash: "abc",
    });
    expect(parseSaraSeen(JSON.stringify({ week: WEEK, toasted: false, openedHash: null }))).toEqual({
      week: WEEK,
      toasted: false,
      openedHash: null,
    });
  });

  it.each([
    ["missing", null],
    ["not JSON", "{week:"],
    ["a JSON string", JSON.stringify("hello")],
    ["null", "null"],
    ["a number", "42"],
    ["an array", JSON.stringify([WEEK, true, null])],
    ["no week", JSON.stringify({ toasted: true, openedHash: null })],
    ["an empty week", JSON.stringify({ week: "", toasted: true, openedHash: null })],
    ["a numeric week", JSON.stringify({ week: 20260927, toasted: true, openedHash: null })],
    ["toasted as a string", JSON.stringify({ week: WEEK, toasted: "true", openedHash: null })],
    ["no toasted", JSON.stringify({ week: WEEK, openedHash: null })],
    ["a numeric hash", JSON.stringify({ week: WEEK, toasted: true, openedHash: 5 })],
    ["an absent hash", JSON.stringify({ week: WEEK, toasted: true })],
  ])("reads %s as never seen", (_label, raw) => {
    expect(parseSaraSeen(raw)).toBeNull();
  });
});

describe("readSaraSeen / writeSaraSeen", () => {
  it("round-trips through storage under the versioned key", () => {
    const s = memoryStorage();
    const v: SaraSeen = { week: WEEK, toasted: true, openedHash: "abc" };
    expect(writeSaraSeen(v, s)).toBe(true);
    expect(s.setItem).toHaveBeenCalledWith(SARA_SEEN_KEY, JSON.stringify(v));
    expect(readSaraSeen(s)).toEqual(v);
  });

  it("reads a throwing storage as never seen", () => {
    expect(readSaraSeen(memoryStorage({ getThrows: true }))).toBeNull();
  });

  it("reports a throwing write instead of raising", () => {
    expect(writeSaraSeen(withToasted(null, WEEK), memoryStorage({ setThrows: true }))).toBe(false);
  });

  it("degrades without a window (server render, node)", () => {
    expect(typeof window).toBe("undefined");
    expect(readSaraSeen()).toBeNull();
    expect(writeSaraSeen(withToasted(null, WEEK))).toBe(false);
  });
});

describe("createSaraSeenStore", () => {
  const hash = hashChanges(CHANGES);

  it("persists, and a new store (the next visit) sees what the last one wrote", () => {
    const s = memoryStorage();
    const visit1 = createSaraSeenStore(() => s);
    expect(visit1.load()).toEqual({ persistent: true, seen: null });
    expect(shouldToast(visit1.load().seen, WEEK)).toBe(true);
    expect(visit1.update((seen) => withToasted(seen, WEEK))).toBe(true);

    const visit2 = createSaraSeenStore(() => s);
    expect(shouldToast(visit2.load().seen, WEEK)).toBe(false);
    expect(unreadDot(visit2.load(), WEEK, hash)).toBe(true);
  });

  it("returns the same snapshot object until something changes", () => {
    const store = createSaraSeenStore(() => memoryStorage());
    const a = store.load();
    expect(store.load()).toBe(a);
    store.update((seen) => withToasted(seen, WEEK));
    expect(store.load()).not.toBe(a);
  });

  it("notifies subscribers on every write, and stops after unsubscribe", () => {
    const store = createSaraSeenStore(() => memoryStorage());
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.update((seen) => withOpened(seen, WEEK, hash));
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    store.update((seen) => withToasted(seen, NEXT_WEEK));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("read-modify-writes against storage, so the toast and the sheet never clobber each other", () => {
    const s = memoryStorage();
    const toast = createSaraSeenStore(() => s);
    const dot = createSaraSeenStore(() => s);
    dot.update((seen) => withOpened(seen, WEEK, hash));
    // The toast's store had cached "nothing seen" before the sheet was opened.
    toast.load();
    toast.update((seen) => withToasted(seen, WEEK));
    expect(readSaraSeen(s)).toEqual({ week: WEEK, toasted: true, openedHash: hash });
  });

  it("a reworded regeneration in the same week earns a dot, never a second toast", () => {
    const store = createSaraSeenStore(() => memoryStorage());
    store.update((seen) => withOpened(seen, WEEK, hash));
    const reworded = hashChanges([{ ...CHANGES[0]!, change_ar: "صياغة جديدة" }]);
    expect(shouldToast(store.load().seen, WEEK)).toBe(false);
    expect(unreadDot(store.load(), WEEK, reworded)).toBe(true);
    // …and next week both come back.
    expect(shouldToast(store.load().seen, NEXT_WEEK)).toBe(true);
    expect(unreadDot(store.load(), NEXT_WEEK, hash)).toBe(true);
  });

  describe("when storage throws", () => {
    it.each([
      ["getItem throws", () => memoryStorage({ getThrows: true })],
      [
        "resolving the storage throws",
        (): ReturnType<typeof memoryStorage> => {
          throw new DOMException("denied", "SecurityError");
        },
      ],
    ])("%s: toast at most once per page session, never a dot", (_label, getStorage) => {
      const store = createSaraSeenStore(getStorage);
      expect(store.load().persistent).toBe(false);
      expect(unreadDot(store.load(), WEEK, hash)).toBe(false);
      expect(shouldToast(store.load().seen, WEEK)).toBe(true);

      expect(store.update((seen) => withToasted(seen, WEEK))).toBe(false);
      // Same page session: the in-memory record holds.
      expect(shouldToast(store.load().seen, WEEK)).toBe(false);
      expect(unreadDot(store.load(), WEEK, hash)).toBe(false);
      // Opening from ••• still reaches the toast, which steps aside on it.
      store.update((seen) => withOpened(seen, WEEK, hash));
      expect(isOpened(store.load().seen, WEEK, hash)).toBe(true);
    });

    it("setItem throwing while getItem works is sticky, so a failed 'toasted' write cannot re-toast", () => {
      const s = memoryStorage({ setThrows: true });
      const store = createSaraSeenStore(() => s);
      expect(store.load().persistent).toBe(true);
      expect(store.update((seen) => withToasted(seen, WEEK))).toBe(false);
      expect(store.load()).toEqual({ persistent: false, seen: withToasted(null, WEEK) });
      expect(shouldToast(store.load().seen, WEEK)).toBe(false);
      expect(unreadDot(store.load(), WEEK, hash)).toBe(false);
      // Storage is no longer consulted for the rest of the session.
      const reads = s.getItem.mock.calls.length;
      store.update((seen) => withOpened(seen, WEEK, hash));
      expect(s.getItem.mock.calls.length).toBe(reads);
    });

    it("a corrupt stored value is 'never seen', not a failure", () => {
      const s = memoryStorage();
      s.data.set(SARA_SEEN_KEY, "{not json");
      const store = createSaraSeenStore(() => s);
      expect(store.load()).toEqual({ persistent: true, seen: null });
      store.update((seen) => withToasted(seen, WEEK));
      expect(readSaraSeen(s)).toEqual({ week: WEEK, toasted: true, openedHash: null });
    });
  });
});

describe("moreChangesAr — the toast's tail", () => {
  it("says nothing when there is only one change", () => {
    expect(moreChangesAr(0)).toBeNull();
    expect(moreChangesAr(1)).toBeNull();
  });

  it("agrees آخر/أخرى with the count, dropping the numeral for one and two", () => {
    expect(moreChangesAr(2, arNum)).toBe("وتعديل آخر");
    expect(moreChangesAr(3, arNum)).toBe("وتعديلان آخران");
    expect(moreChangesAr(4, arNum)).toBe("و٣ تعديلات أخرى");
    expect(moreChangesAr(12, arNum)).toBe("و١١ تعديلاً آخر");
  });
});
