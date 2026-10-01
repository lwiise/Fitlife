import { describe, expect, it } from "vitest";
import { FAMILY_VIEWS, type ConsoleNavData, type FamilyView } from "@/lib/admin/console-types";
import { toShellNav } from "./navData";

const counts = Object.fromEntries(FAMILY_VIEWS.map((view, i) => [view, i + 1])) as Record<
  FamilyView,
  number
>;

const data: ConsoleNavData = {
  counts,
  loadedAt: "2026-09-30T11:32:00Z",
  truncated: [],
};

describe("toShellNav", () => {
  /** The same Riyadh day as `data.loadedAt` (14:32 there), later in the evening. */
  const SAME_DAY = Date.parse("2026-09-30T18:00:00Z");

  it("formats the counts and the Riyadh time for the UI language", () => {
    const ar = toShellNav(data, "ar", SAME_DAY);
    expect(ar.counts.all).toBe(1);
    expect(ar.countText.all).toBe("١");
    expect(ar.countText.ended).toBe("٧");
    // 11:32 UTC is 14:32 in Riyadh.
    expect(ar.updatedText).toMatch(/٢:٣٢/);
    expect(toShellNav(data, "en", SAME_DAY).updatedText).toMatch(/2:32/);
    // The time alone: it is today's.
    expect(toShellNav(data, "en", SAME_DAY).updatedText).not.toMatch(/Sep/);
    expect(ar.partial).toBe(false);
    expect(toShellNav({ ...data, truncated: ["profiles"] }, "ar").partial).toBe(true);
  });

  it("carries what every console page may show — never a family", () => {
    // The frame's payload rides along with every console page, unaudited:
    // whatever else reaches it (an old cache entry, a widened loader) must
    // not reach the browser.
    const leaky = {
      ...data,
      searchIndex: [{ id: "x", name: "هند", email: "hind@example.com" }],
    } as ConsoleNavData;
    const nav = toShellNav(leaky, "ar");
    expect(Object.keys(nav).sort()).toEqual(["countText", "counts", "partial", "updatedText"]);
    expect(JSON.stringify(nav)).not.toContain("hind@example.com");
  });

  it("dates the time once it is no longer today's in Riyadh", () => {
    // 21:30 UTC on the 30th is already the 1st in Riyadh: yesterday's 2:32
    // must not read as a time from today.
    const nextDay = Date.parse("2026-09-30T21:30:00Z");
    const en = toShellNav(data, "en", nextDay).updatedText;
    expect(en).toMatch(/Sep 30/);
    expect(en).toMatch(/2:32/);
    const ar = toShellNav(data, "ar", nextDay).updatedText;
    expect(ar).toMatch(/٣٠/);
    expect(ar).toMatch(/سبتمبر/);
    expect(ar).toMatch(/٢:٣٢/);
  });

  it("survives a malformed summary", () => {
    const nav = toShellNav(
      { counts: { all: Number.NaN } as Record<FamilyView, number>, loadedAt: "nope", truncated: [] },
      "en",
    );
    expect(nav.counts.all).toBe(0);
    expect(nav.counts.attention).toBe(0);
    expect(nav.updatedText).toBe("—");
  });
});
