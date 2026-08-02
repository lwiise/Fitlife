import { describe, it, expect } from "vitest";
import { dailyCapMessage } from "./capMessage";

/**
 * Hit for real during the live test: a six-person household exhausted the
 * advisor's 30-message allowance and got «تم بلوغ الحد اليومي من الأسئلة. يرجى
 * المحاولة غداً.» — a dead end that was wrong twice over. The window is rolling,
 * so the first slot returned 80 minutes later, not "tomorrow"; and the pool is
 * shared across the whole household, which the message never said.
 */
const NOW = Date.parse("2026-08-02T14:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("dailyCapMessage", () => {
  it("says the allowance is shared by the household", () => {
    const msg = dailyCapMessage(iso(NOW - 23 * 3600_000), NOW);
    expect(msg).toContain("مشترك بين أفراد البيت");
  });

  it("gives minutes when the next slot is under an hour away", () => {
    // oldest message 23h 20m ago → frees in 40 minutes
    const msg = dailyCapMessage(iso(NOW - (23 * 3600_000 + 20 * 60_000)), NOW);
    expect(msg).toContain("40 دقيقة");
    expect(msg).not.toContain("ساعة و");
  });

  it("gives hours and minutes when it is further out", () => {
    // oldest 2h ago → frees in 22h
    const msg = dailyCapMessage(iso(NOW - 2 * 3600_000), NOW);
    expect(msg).toContain("22 ساعة");
  });

  it("never promises «غداً» — the window is rolling, not a calendar day", () => {
    for (const agoH of [1, 5, 12, 23]) {
      expect(dailyCapMessage(iso(NOW - agoH * 3600_000), NOW)).not.toContain("غداً");
    }
  });

  it("never says zero minutes", () => {
    // A slot 20 seconds out must not render as «بعد 0 دقيقة».
    const msg = dailyCapMessage(iso(NOW - (24 * 3600_000 - 20_000)), NOW);
    expect(msg).toContain("1 دقيقة");
  });

  it("tells her to just try again when the slot already freed", () => {
    expect(dailyCapMessage(iso(NOW - 25 * 3600_000), NOW)).toContain("الآن");
  });

  it("degrades honestly when the timestamp is unknown or unparseable", () => {
    expect(dailyCapMessage(null, NOW)).toContain("خلال الساعات القادمة");
    expect(dailyCapMessage("not-a-date", NOW)).toContain("خلال الساعات القادمة");
  });
});
