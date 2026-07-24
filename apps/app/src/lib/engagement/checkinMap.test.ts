import { describe, expect, it } from "vitest";

import {
  checkinClearKeys,
  checkinMapKey,
  resolveCheckin,
  type CheckinMark,
} from "./checkinMap";

const cooked: CheckinMark = { status: "cooked", reason: null };
const skipped: CheckinMark = { status: "skipped", reason: null };

function mapOf(entries: Array<[string, CheckinMark]>) {
  return new Map(entries);
}

describe("resolveCheckin", () => {
  it("prefers the member's own row over the whole-house fallback", () => {
    const map = mapOf([
      [checkinMapKey(1, "lunch", "mom"), cooked],
      [checkinMapKey(1, "lunch", "household"), skipped],
    ]);
    expect(resolveCheckin(map, 1, "lunch", ["mom"])).toEqual(cooked);
  });

  it("falls back to the whole-house row when the member has none", () => {
    const map = mapOf([[checkinMapKey(1, "lunch", "household"), skipped]]);
    expect(resolveCheckin(map, 1, "lunch", ["mom"])).toEqual(skipped);
  });

  it("takes the first sharer that answers, in the order given", () => {
    const map = mapOf([[checkinMapKey(2, "dinner", "m2"), cooked]]);
    expect(resolveCheckin(map, 2, "dinner", ["m1", "m2"])).toEqual(cooked);
  });

  it("is null when nothing answers — unanswered is unknown", () => {
    expect(resolveCheckin(mapOf([]), 0, "breakfast", ["mom"])).toBeNull();
  });
});

describe("checkinClearKeys", () => {
  // The bug this guards (owner report 07/2026): clearing only the member rows
  // left the whole-house row behind, and the meal re-read as «تجاوزتها» — the
  // un-tap looked like it had marked the meal skipped.
  it("sweeps the whole-house fallback along with the members' own rows", () => {
    const keys = checkinClearKeys(1, "lunch", ["mom", "m1"]);
    expect(keys).toEqual([
      checkinMapKey(1, "lunch", "mom"),
      checkinMapKey(1, "lunch", "m1"),
      checkinMapKey(1, "lunch", "household"),
    ]);
  });

  it("leaves a shared meal unmarked even when a legacy whole-house row exists", () => {
    const map = mapOf([
      [checkinMapKey(1, "lunch", "mom"), cooked],
      [checkinMapKey(1, "lunch", "m1"), cooked],
      [checkinMapKey(1, "lunch", "household"), skipped],
    ]);
    for (const k of checkinClearKeys(1, "lunch", ["mom", "m1"])) map.delete(k);
    expect(resolveCheckin(map, 1, "lunch", ["mom", "m1"])).toBeNull();
  });

  it("never touches another slot or another day", () => {
    const map = mapOf([
      [checkinMapKey(1, "lunch", "household"), skipped],
      [checkinMapKey(1, "dinner", "household"), cooked],
      [checkinMapKey(2, "lunch", "mom"), cooked],
    ]);
    for (const k of checkinClearKeys(1, "lunch", ["mom"])) map.delete(k);
    expect(resolveCheckin(map, 1, "dinner", ["mom"])).toEqual(cooked);
    expect(resolveCheckin(map, 2, "lunch", ["mom"])).toEqual(cooked);
  });

  it("does not duplicate the household key when it is already a target", () => {
    expect(checkinClearKeys(0, "snack", ["household"])).toEqual([
      checkinMapKey(0, "snack", "household"),
    ]);
  });
});
