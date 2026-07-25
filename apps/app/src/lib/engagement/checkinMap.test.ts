import { describe, expect, it } from "vitest";

import {
  checkinClearKeys,
  checkinMapKey,
  ownCheckin,
  resolveCheckin,
  type CheckinMark,
} from "./checkinMap";
import { OUT_OF_MEAL_CHECKIN_STATUSES } from "./types";

const cooked: CheckinMark = { status: "cooked", reason: null };
const skipped: CheckinMark = { status: "skipped", reason: null };
const swapped: CheckinMark = { status: "swapped", reason: "ate_out" };

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

// A member excluded from a shared meal occurrence (00021) keeps a mark about
// what happened INSTEAD — «بدّلتها» or «تجاوزتها» only (owner directive
// 07/2026). It is theirs alone: the kitchen's whole-house attestation covers
// the dish they sat out, so it must not answer for them.
describe("ownCheckin — a member who is out of the meal", () => {
  it("returns their own mark", () => {
    const map = mapOf([[checkinMapKey(3, "dinner", "m1"), swapped]]);
    expect(ownCheckin(map, 3, "dinner", "m1")).toEqual(swapped);
  });

  it("never borrows the whole-house fallback", () => {
    const map = mapOf([[checkinMapKey(3, "dinner", "household"), cooked]]);
    expect(ownCheckin(map, 3, "dinner", "m1")).toBeNull();
    // …while a member who DID share the meal still inherits it.
    expect(resolveCheckin(map, 3, "dinner", ["m1"])).toEqual(cooked);
  });

  it("never borrows a present sharer's mark", () => {
    const map = mapOf([[checkinMapKey(3, "dinner", "mom"), cooked]]);
    expect(ownCheckin(map, 3, "dinner", "m1")).toBeNull();
  });

  it("offers «بدّلتها»/«تجاوزتها» and never «طبختها كما هي»", () => {
    expect([...OUT_OF_MEAL_CHECKIN_STATUSES]).toEqual(["swapped", "skipped"]);
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

  // The out-of-meal clear (sweepHousehold: false) mirrors ownCheckin: that
  // member's chip is read without the fallback, so un-tapping it needs no
  // sweep — and must not have one, or someone who sat the meal out would
  // retract the kitchen's attestation for the dish the others shared.
  it("leaves the whole-house row alone for an out-of-meal member", () => {
    expect(
      checkinClearKeys(1, "lunch", ["m1"], { sweepHousehold: false }),
    ).toEqual([checkinMapKey(1, "lunch", "m1")]);
  });

  it("clears their own mark while the dish stays marked for the sharers", () => {
    const map = mapOf([
      [checkinMapKey(1, "lunch", "mom"), cooked],
      [checkinMapKey(1, "lunch", "m1"), swapped],
      [checkinMapKey(1, "lunch", "household"), cooked],
    ]);
    for (const k of checkinClearKeys(1, "lunch", ["m1"], {
      sweepHousehold: false,
    })) {
      map.delete(k);
    }
    expect(ownCheckin(map, 1, "lunch", "m1")).toBeNull();
    expect(resolveCheckin(map, 1, "lunch", ["mom"])).toEqual(cooked);
    expect(resolveCheckin(map, 1, "lunch", ["household"])).toEqual(cooked);
  });
});
