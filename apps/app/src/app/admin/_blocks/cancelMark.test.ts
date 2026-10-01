import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SubscriptionCancelState } from "@/lib/admin/console-types";
import { cancelFieldText, cancelMark, cancelMarkText, fmtDay } from "./helpers";
import { RenewalCell } from "./SummaryFacts";

/**
 * One cancellation rule for every renewal cell and the billing tab: the
 * three cancelStates stay distinct, and a subscription that has run out while
 * its row still reads active or trialing — a missed expiry webhook, the case
 * where the status pill says «نشط» — is marked, never shown as clean.
 */

const PAST = "2026-09-01T00:00:00Z";

describe("cancelMark", () => {
  it("marks a scheduled cancellation whatever the status", () => {
    for (const status of ["active", "trialing", "past_due", "cancelled"]) {
      expect(cancelMark(status, "scheduled")).toBe("scheduled");
    }
  });

  it("marks a run-out subscription only where the status pill says otherwise", () => {
    expect(cancelMark("active", "ended")).toBe("ended");
    expect(cancelMark("trialing", "ended")).toBe("ended");
    // «ملغى» / «منتهي» already say it.
    expect(cancelMark("cancelled", "ended")).toBeNull();
    expect(cancelMark("expired", "ended")).toBeNull();
  });

  it("marks nothing otherwise", () => {
    for (const status of ["active", "trialing", "past_due", "cancelled", null]) {
      expect(cancelMark(status, "none")).toBeNull();
    }
  });

  it("reads in both languages", () => {
    expect(cancelMarkText("scheduled", "ar")).toBe("إلغاء مجدول");
    expect(cancelMarkText("ended", "ar")).toBe("انتهى الاشتراك");
    expect(cancelMarkText("ended", "en")).toBe("Ended");
  });
});

describe("cancelFieldText", () => {
  const states: SubscriptionCancelState[] = ["none", "scheduled", "ended"];

  it("tells the three states apart", () => {
    const ar = states.map((s) => cancelFieldText(s, PAST, "ar"));
    expect(ar).toEqual(["لا", "نعم", `انتهى الاشتراك في ${fmtDay(PAST, "ar")}`]);
    expect(new Set(ar).size).toBe(3);
    expect(cancelFieldText("ended", PAST, "en")).toBe(`Ended on ${fmtDay(PAST, "en")}`);
  });

  it("drops the date it does not have, never the state", () => {
    expect(cancelFieldText("ended", null, "ar")).toBe("انتهى الاشتراك");
    expect(cancelFieldText("ended", "not a date", "en")).toBe("Ended");
  });
});

describe("RenewalCell", () => {
  const cell = (status: string, cancelState: SubscriptionCancelState, trialEndsAt: string | null = null) =>
    renderToString(
      createElement(RenewalCell, {
        status,
        trialEndsAt,
        currentPeriodEnd: PAST,
        endsAt: null,
        cancelState,
        locale: "ar",
      }),
    );

  it("adds «انتهى الاشتراك» to an «active» row that has run out", () => {
    const html = cell("active", "ended");
    expect(html).toContain(fmtDay(PAST, "ar"));
    expect(html).toContain('<span class="ad-bad">انتهى الاشتراك</span>');
  });

  it("keeps «إلغاء مجدول» while scheduled, and adds nothing to a row that renews", () => {
    expect(cell("active", "scheduled")).toContain('<span class="ad-bad">إلغاء مجدول</span>');
    expect(cell("active", "none")).not.toContain("ad-bad");
    // A cancelled row's own status pill says it; the cell stays a date.
    expect(cell("cancelled", "ended")).not.toContain("ad-bad");
  });

  it("marks a trial that has run out", () => {
    expect(cell("trialing", "ended", PAST)).toContain("انتهى الاشتراك");
  });
});
