import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FamilyRow } from "@/lib/admin/console-types";
import { subscriptionCancelState } from "@/lib/admin/familyFlags";
import { parseFamilyListQuery, parseFamilyPanelState } from "@/lib/admin/familyList";

/**
 * Server-render smoke test: the families console is a client component that
 * Next renders on the server first, so it must render from props alone — no
 * window, no clock, no storage — and produce the table, the phone cards and,
 * for an `open` URL, the panel's head and skeleton. (Behaviour is tested on
 * the pure modules; this only proves the tree renders.)
 */

const search = { current: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => search.current,
  usePathname: () => "/admin/families",
}));

const { FamiliesConsole } = await import("./FamiliesConsole");
const { familyRowTexts } = await import("./rowText");

let seq = 0;
function fam(p: Partial<FamilyRow> = {}): FamilyRow {
  seq += 1;
  return {
    userId: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    displayName: `عائلة ${seq}`,
    email: `f${seq}@example.com`,
    tier: "family",
    status: "active",
    cadence: "monthly",
    signupAt: "2026-06-01T00:00:00Z",
    trialEndsAt: null,
    currentPeriodEnd: "2026-10-01T00:00:00Z",
    endsAt: null,
    cancelAtPeriodEnd: false,
    beneficiaries: 2,
    hasHousekeeper: false,
    overLimit: false,
    plansGenerated: 1,
    failedPlans: 0,
    lastActivityAt: "2026-09-20T00:00:00Z",
    lifetimeAiCostUsd: 1,
    onboardingComplete: true,
    meal: { state: "ready", daysReady: 7, daysTotal: 7, masked: false },
    workout: { state: "none", masked: false },
    flags: [],
    cancelState: "none",
    ...p,
  };
}

function render(rows: FamilyRow[], url = "") {
  search.current = new URLSearchParams(url);
  const texts = familyRowTexts(rows, {
    locale: "ar",
    currency: "sar",
    nowIso: "2026-09-30T09:00:00Z",
  });
  return renderToString(
    createElement(FamiliesConsole, {
      rows,
      texts,
      initialQuery: parseFamilyListQuery(search.current),
      initialPanel: parseFamilyPanelState(search.current),
      locale: "ar",
      currency: "sar",
      tierOptions: [{ value: "family", label: "العائلة" }],
      statusOptions: [{ value: "active", label: "نشط" }],
      truncated: [],
    }),
  );
}

const count = (html: string, needle: RegExp) => (html.match(needle) ?? []).length;

describe("FamiliesConsole (server render)", () => {
  const rows = [
    fam({ displayName: "هند العتيبي", status: "trialing", trialEndsAt: "2026-10-04T00:00:00Z" }),
    fam({ displayName: "أمل السبيعي", onboardingComplete: false, flags: ["onboarding_incomplete"] }),
    fam({ displayName: "ريم الحربي", status: "past_due", flags: ["past_due"], failedPlans: 2 }),
  ];

  it("renders the head, the table rows, the phone cards and the footer", () => {
    const html = render(rows);
    expect(html).toContain("كل العائلات");
    // The head's figures with a drawn separator between them; the live region
    // reads them as one text, joined with the Arabic comma.
    expect(html).toMatch(
      /٣ عائلات(<!-- -->)? <span class="ad-sep" aria-hidden="true"><\/span> (<!-- -->)?١ مدفوعة/,
    );
    expect(html).toContain("٣ عائلات، ١ مدفوعة، ١ تجريبية");
    // A count keeps its label company as its own element, never behind «·»:
    // beside an Arabic-Indic digit a middle dot reads as the digit zero.
    expect(html).toMatch(/كل العائلات(<!-- -->)? <span class="ad-count">٣<\/span>/);
    expect(html).not.toContain("·");
    expect(count(html, /<tr data-id=/g)).toBe(3);
    expect(count(html, /class="ad-pcard"/g)).toBe(3);
    expect(html).toContain("١–٣ من ٣");
    // One row in the tab order; the sheet is closed.
    expect(count(html, /tabindex="0"/g)).toBeGreaterThanOrEqual(1);
    expect(html).not.toContain("ad-a-sheet");
    // At rest nothing is on its way: no busy list, row or card, no pending hint.
    expect(html).not.toContain('aria-busy="true"');
    expect(html).not.toContain("ad-lp");
    // Each card carries its family's id (the delegated tap marks it pending).
    expect(count(html, /class="ad-pcard" href="[^"]+" data-id="/g)).toBe(3);
  });

  it("opens the panel from the URL with the row's head and a loading body", () => {
    const open = rows[0]!.userId;
    const html = render(rows, `open=${open}&tab=meal`);
    expect(html).toContain("ad-a-sheet");
    expect(html).toContain("هند العتيبي");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="tablist"');
    expect(count(html, /role="tab"/g)).toBe(5);
    expect(html).toMatch(/data-selected=""[^>]*aria-current="true"|aria-current="true"[^>]*data-selected=""/);
  });

  it("filters from the URL and says when nothing matches", () => {
    const html = render(rows, "q=غير%20موجود");
    expect(count(html, /<tr data-id=/g)).toBe(0);
    expect(html).toContain("لا توجد عائلات مطابقة");
    expect(html).toContain("مسح عوامل التصفية");
  });

  it("says when there are no families at all", () => {
    const html = render([]);
    expect(html).toContain("لا توجد عائلات بعد");
  });

  it("renewal column: the date the rule judges by, «إلغاء مجدول» only while the cancellation is scheduled", () => {
    // Each row judged as the loader judges it, at the render's "now".
    const judged = (p: Partial<FamilyRow>): FamilyRow => {
      const row = fam(p);
      return { ...row, cancelState: subscriptionCancelState(row, Date.parse("2026-09-30T09:00:00Z")) };
    };
    // Cancelled in the LemonSqueezy portal with no period end: paid through ends_at.
    const portal = judged({
      status: "cancelled",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: null,
      endsAt: "2026-10-20T00:00:00Z",
    });
    const lapsed = judged({
      status: "cancelled",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: null,
      endsAt: "2026-09-01T00:00:00Z",
    });
    const trial = judged({
      status: "trialing",
      cancelAtPeriodEnd: true,
      trialEndsAt: "2026-10-04T00:00:00Z",
      currentPeriodEnd: null,
    });
    expect([portal, lapsed, trial].map((row) => row.cancelState)).toEqual([
      "scheduled",
      "ended",
      "scheduled",
    ]);

    const html = render([portal, lapsed, trial]).replace(/<!-- -->/g, "");
    // The renewal <td> of each row, found by the header's column order.
    const columns = [...html.matchAll(/<th [^>]*data-col="(\w+)"/g)].map((m) => m[1]);
    const at = columns.indexOf("renewal");
    expect(at).toBeGreaterThan(0);
    const cell = (id: string) => {
      const tr = html.match(new RegExp(`<tr data-id="${id}"[^>]*>([\\s\\S]*?)</tr>`))?.[1] ?? "";
      return tr.split(/<td[\s>]/)[at + 1]?.replace(/<\/td>$/, "") ?? "";
    };
    const SEP = '<span class="ad-sep" aria-hidden="true"></span>';
    const CANCEL = '<span class="ad-bad">إلغاء مجدول</span>';
    expect(cell(portal.userId)).toMatch(
      new RegExp(`^<time dateTime="2026-10-20T00:00:00Z">[^<]+</time> ${SEP} ${CANCEL}$`),
    );
    expect(cell(lapsed.userId)).toMatch(/^<time dateTime="2026-09-01T00:00:00Z">[^<]+<\/time>$/);
    expect(cell(trial.userId)).toMatch(
      new RegExp(
        `^<span class="ad-muted">تنتهي التجربة</span> <time dateTime="2026-10-04T00:00:00Z">[^<]+</time> ${SEP} ${CANCEL}$`,
      ),
    );
  });
});
