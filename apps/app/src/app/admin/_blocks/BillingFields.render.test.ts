import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SubscriptionCancelState } from "@/lib/admin/console-types";
import type { SubscriptionRow } from "@/lib/admin/detail";
import { subscriptionCancelState } from "@/lib/admin/familyFlags";
import type { AdminLocale } from "@/lib/admin/format";
import { BillingFields, SubscriptionHistory } from "./BillingFields";
import { fmtDay } from "./helpers";

/**
 * The Billing tab is where the cancel_scheduled reason sends the operator, so
 * its two cancellation fields must say what the header and the list say:
 * «إلغاء مجدول» answers from the header's cancelState — with all three states
 * told apart — and the period end is the date the subscription is paid
 * through. Each header here carries the cancelState the loader would give it
 * (subscriptionCancelState at the snapshot's time).
 */

const NOW = Date.parse("2026-09-30T09:00:00Z");
const FUTURE = "2026-10-20T00:00:00Z";
const PAST = "2026-09-01T00:00:00Z";

const sub = (p: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  tier: "family",
  status: "active",
  cadence: "monthly",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-09-26T00:00:00Z",
  trialStartedAt: null,
  trialEndsAt: null,
  currentPeriodEnd: FUTURE,
  endsAt: null,
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  lemonsqueezySubscriptionId: "sub_1",
  lemonsqueezyCustomerId: "cus_1",
  lemonsqueezyVariantId: "var_1",
  ...p,
});

function render(
  subscription: SubscriptionRow,
  locale: AdminLocale = "ar",
  cancelState: SubscriptionCancelState = subscriptionCancelState(subscription, NOW),
): string {
  return renderToString(createElement(BillingFields, { header: { subscription, cancelState }, locale }));
}

/** The value of the field labelled `label`. */
function field(html: string, label: string): string | undefined {
  return html.match(new RegExp(`<dt>${label}</dt><dd>(.*?)</dd>`))?.[1];
}

const CANCEL = "إلغاء مجدول";
const PERIOD_END = "نهاية الفترة";
const ENDED_AR = `انتهى الاشتراك في ${fmtDay(PAST, "ar")}`;

describe("BillingFields (render)", () => {
  it("says a lapsed portal cancellation has ended, and when", () => {
    // Cancelled in the LemonSqueezy portal, flag set, paid through a date that has passed.
    const html = render(
      sub({ status: "cancelled", cancelAtPeriodEnd: true, currentPeriodEnd: PAST, cancelledAt: PAST }),
    );
    // The status pill already reads «ملغى»: the answer is plain text.
    expect(field(html, CANCEL)).toBe(ENDED_AR);
    expect(field(html, PERIOD_END)).toContain(PAST);
  });

  it("dates a paid-up portal cancellation that arrived with only ends_at", () => {
    const html = render(
      sub({ status: "cancelled", cancelAtPeriodEnd: true, currentPeriodEnd: null, endsAt: FUTURE }),
    );
    expect(field(html, CANCEL)).toBe("نعم");
    // The date the attention reason names — never «—».
    expect(field(html, PERIOD_END)).toContain(FUTURE);
  });

  it("never hides that an «active» row has run out (a missed expiry webhook)", () => {
    // Set to cancel, but the expiry webhook was missed: the period end has
    // passed and the row still says active. This was «لا» — the one fact that
    // explains the lost access, hidden.
    const html = render(sub({ cancelAtPeriodEnd: true, currentPeriodEnd: PAST }));
    expect(field(html, CANCEL)).toBe(`<span class="ad-bad">${ENDED_AR}</span>`);
    expect(render(sub({ cancelAtPeriodEnd: true, currentPeriodEnd: PAST }), "en")).toContain(
      `Ended on ${fmtDay(PAST, "en")}`,
    );
  });

  it("follows the header's verdict, never the raw flag", () => {
    // Set to cancel and still running.
    expect(field(render(sub({ cancelAtPeriodEnd: true })), CANCEL)).toBe("نعم");
    // Whatever the raw fields say, the field follows the cancelState it is given.
    expect(field(render(sub({ cancelAtPeriodEnd: true }), "ar", "none"), CANCEL)).toBe("لا");
    expect(field(render(sub(), "en", "scheduled"), "Cancel scheduled")).toBe("Yes");
  });

  it("says a trial that ran out with no date has ended, without inventing one", () => {
    const html = render(sub({ status: "trialing", cancelAtPeriodEnd: true, currentPeriodEnd: null }));
    expect(field(html, CANCEL)).toBe('<span class="ad-bad">انتهى الاشتراك</span>');
  });

  it("keeps the period end of a renewing subscription", () => {
    const html = render(sub(), "en");
    expect(field(html, "Cancel scheduled")).toBe("No");
    expect(field(html, "Period ends")).toContain(FUTURE);
  });

  it("never shows a renewing subscription's left-over ends_at as its period end", () => {
    // Cancelled once, then renewed without a period end: the renewal never
    // clears ends_at, and the app ignores it on an active row — as do the
    // renewal cells, so this field agrees with them.
    const html = render(sub({ currentPeriodEnd: null, endsAt: PAST }), "en");
    expect(field(html, "Period ends")).toBe("—");
    expect(html).not.toContain(PAST);
  });
});

describe("SubscriptionHistory (render)", () => {
  it("is a named, keyboard-reachable scrolling region", () => {
    const html = renderToString(
      createElement(SubscriptionHistory, {
        rows: [sub(), sub({ status: "cancelled", createdAt: "2026-07-01T00:00:00Z" })],
        locale: "ar",
      }),
    );
    const region = html.match(/<div class="ad-tbl-wrap" role="region" aria-labelledby="([^"]+)" tabindex="0">/);
    expect(region).not.toBeNull();
    expect(html).toContain(`<caption id="${region?.[1]}" class="ad-sr">`);
  });
});
