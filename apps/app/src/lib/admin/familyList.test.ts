import { describe, expect, it } from "vitest";

import type { FamilyRow } from "./console-types";
import { subscriptionCancelState } from "./familyFlags";
import {
  DEFAULT_FAMILY_LIST_QUERY,
  FAMILY_PAGE_SIZE,
  familyInView,
  familyListQueryToParams,
  filterFamilies,
  isFamilyId,
  matchesSearch,
  normalizeSearch,
  paginateFamilies,
  parseFamilyListQuery,
  parseFamilyPanelState,
  sortFamilies,
  toAsciiDigits,
  viewCounts,
} from "./familyList";

/** When the fixtures' dataset was "read" — the cancellation state is judged at it. */
const NOW = Date.parse("2026-09-30T09:00:00Z");
const FUTURE = "2026-10-14T00:00:00Z";
const PAST = "2026-09-01T00:00:00Z";

let seq = 0;
/** A row as buildFamilyRows makes it: cancelState follows the subscription unless given. */
function fam(p: Partial<FamilyRow> = {}): FamilyRow {
  seq += 1;
  const { cancelState, ...fields } = p;
  const row: Omit<FamilyRow, "cancelState"> = {
    userId: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    displayName: `عائلة ${seq}`,
    email: `f${seq}@example.com`,
    tier: "family",
    status: "active",
    cadence: "monthly",
    signupAt: "2026-06-01T00:00:00Z",
    trialEndsAt: null,
    currentPeriodEnd: null,
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
    ...fields,
  };
  return { ...row, cancelState: cancelState ?? subscriptionCancelState(row, NOW) };
}

// ── search ──────────────────────────────────────────────────────────────────

describe("normalizeSearch", () => {
  it("folds Arabic spelling variants and diacritics", () => {
    expect(normalizeSearch("هِنْدُ")).toBe("هند");
    expect(normalizeSearch("أمل")).toBe("امل");
    expect(normalizeSearch("إيمان")).toBe("ايمان");
    expect(normalizeSearch("آمنة")).toBe("امنه");
    expect(normalizeSearch("منى")).toBe("مني");
    expect(normalizeSearch("فاطمـــة")).toBe("فاطمه");
  });

  it("folds case, Latin accents, whitespace and Arabic-Indic digits", () => {
    expect(normalizeSearch("  Zoë   ALI  ")).toBe("zoe ali");
    expect(normalizeSearch("٠٥٥١٢٣")).toBe("055123");
    expect(toAsciiDigits("۱۲۳")).toBe("123");
  });
});

describe("matchesSearch", () => {
  const row = fam({ displayName: "هِنْد العتيبي", email: "Hind.O@Example.com" });
  it("matches name or email, every word, any spelling", () => {
    expect(matchesSearch(row, normalizeSearch(""))).toBe(true);
    expect(matchesSearch(row, normalizeSearch("هند"))).toBe(true);
    expect(matchesSearch(row, normalizeSearch("هند عتيبي"))).toBe(true);
    expect(matchesSearch(row, normalizeSearch("hind.o@"))).toBe(true);
    expect(matchesSearch(row, normalizeSearch("هند hind"))).toBe(true);
    expect(matchesSearch(row, normalizeSearch("نورة"))).toBe(false);
  });

  it("copes with a family that has no name or email", () => {
    expect(matchesSearch(fam({ displayName: null, email: null }), "x")).toBe(false);
  });
});

// ── views & filters ─────────────────────────────────────────────────────────

describe("views", () => {
  const rows = [
    fam({ status: "trialing", trialEndsAt: FUTURE }),
    fam({ status: "active", flags: ["failed_meal_run"] }),
    fam({ status: "active", cancelAtPeriodEnd: true, flags: ["cancel_scheduled"] }),
    fam({ status: "past_due", flags: ["past_due"] }),
    // Cancelled and past its paid-through date.
    fam({ status: "cancelled", cancelAtPeriodEnd: true, currentPeriodEnd: PAST }),
    fam({ status: "expired" }),
    fam({ status: null }),
  ];

  it("puts each row in the right saved views", () => {
    expect(viewCounts(rows)).toEqual({
      all: 7,
      attention: 3,
      trialing: 1,
      active: 2,
      past_due: 1,
      cancelling: 1,
      ended: 2,
    });
    expect(familyInView(rows[4]!, "cancelling")).toBe(false);
    expect(familyInView(rows[4]!, "ended")).toBe(true);
  });

  it("keeps a portal cancellation «cancelling» until the day it is paid through", () => {
    // LemonSqueezy's portal lands a cancellation as status 'cancelled', often
    // with no new period end and ends_at set. She keeps what she paid for.
    const paidUp = fam({
      status: "cancelled",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: null,
      endsAt: FUTURE,
      flags: ["cancel_scheduled"],
    });
    expect(paidUp.cancelState).toBe("scheduled");
    expect(familyInView(paidUp, "cancelling")).toBe(true);
    expect(familyInView(paidUp, "ended")).toBe(false);
    expect(familyInView(paidUp, "attention")).toBe(true);
    // The same cancellation once that date has passed.
    const lapsed = fam({
      status: "cancelled",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: null,
      endsAt: PAST,
    });
    expect(lapsed.cancelState).toBe("ended");
    expect(familyInView(lapsed, "cancelling")).toBe(false);
    expect(familyInView(lapsed, "ended")).toBe(true);
    // No paid-through date at all: nothing justifies access, so it has ended.
    const undated = fam({ status: "cancelled", currentPeriodEnd: null, endsAt: null });
    expect(familyInView(undated, "ended")).toBe(true);
    // An expired subscription has ended whatever its dates say.
    const expired = fam({ status: "expired", currentPeriodEnd: FUTURE, cancelAtPeriodEnd: true });
    expect(familyInView(expired, "ended")).toBe(true);
    expect(familyInView(expired, "cancelling")).toBe(false);
  });

  it("moves a subscription set to cancel from «cancelling» to «ended» at its date", () => {
    // Our own cancel route keeps the row 'active'; a missed expiry webhook
    // leaves it 'active' past its period end, when it has in fact run out.
    const running = fam({ status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: FUTURE });
    expect(familyInView(running, "cancelling")).toBe(true);
    expect(familyInView(running, "ended")).toBe(false);
    const runOut = fam({ status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: PAST });
    expect(familyInView(runOut, "cancelling")).toBe(false);
    expect(familyInView(runOut, "ended")).toBe(true);
    // A trial set to cancel runs until the trial's end.
    const trial = fam({ status: "trialing", cancelAtPeriodEnd: true, trialEndsAt: FUTURE });
    expect(familyInView(trial, "cancelling")).toBe(true);
    const trialOver = fam({ status: "trialing", cancelAtPeriodEnd: true, trialEndsAt: PAST });
    expect(familyInView(trialOver, "ended")).toBe(true);
    expect(familyInView(trialOver, "cancelling")).toBe(false);
  });

  it("moves a trial that ran out from «trialing» to «ended», set to cancel or not", () => {
    // Nothing moves an internal trial's status on: only the LemonSqueezy
    // webhook writes 'expired', so a trial that never converted stays
    // 'trialing' for good — and the app stopped granting access at its end.
    const running = fam({ status: "trialing", trialEndsAt: FUTURE });
    expect(familyInView(running, "trialing")).toBe(true);
    expect(familyInView(running, "ended")).toBe(false);
    for (const lapsed of [
      fam({ status: "trialing", trialEndsAt: PAST }),
      fam({ status: "trialing", trialEndsAt: PAST, cancelAtPeriodEnd: true }),
      // No end date at all: the app counts it as over (isTrialExpired).
      fam({ status: "trialing", trialEndsAt: null }),
    ]) {
      expect(lapsed.cancelState).toBe("ended");
      expect(familyInView(lapsed, "trialing")).toBe(false);
      expect(familyInView(lapsed, "ended")).toBe(true);
      expect(familyInView(lapsed, "cancelling")).toBe(false);
    }
  });

  it("reads the view from the row's cancelState, never the clock", () => {
    // Judged «scheduled» when the dataset was read: the browser's later clock
    // does not move the row, so the rail, the list and the flag agree.
    const judged = fam({ status: "cancelled", currentPeriodEnd: PAST, cancelState: "scheduled" });
    expect(familyInView(judged, "cancelling")).toBe(true);
    expect(familyInView(judged, "ended")).toBe(false);
  });

  it("filters by view, tier, status and search together", () => {
    const list = [
      fam({ displayName: "نورة", tier: "pro", status: "trialing", trialEndsAt: FUTURE }),
      fam({ displayName: "نورة الثانية", tier: "family", status: "trialing", trialEndsAt: FUTURE }),
      fam({ displayName: "ريم", tier: "pro", status: "active" }),
    ];
    const base = { view: "all" as const, q: "", tier: "", status: "" };
    expect(filterFamilies(list, { ...base, q: "نوره" })).toHaveLength(2);
    expect(filterFamilies(list, { ...base, q: "نوره", tier: "pro" })).toHaveLength(1);
    expect(filterFamilies(list, { ...base, view: "trialing", tier: "pro" })).toHaveLength(1);
    expect(filterFamilies(list, { ...base, status: "active" })[0]!.displayName).toBe("ريم");
  });
});

// ── sort & paginate ─────────────────────────────────────────────────────────

describe("sortFamilies", () => {
  it("puts families with no activity last in both directions", () => {
    const a = fam({ lastActivityAt: "2026-09-01T00:00:00Z" });
    const b = fam({ lastActivityAt: null });
    const c = fam({ lastActivityAt: "2026-09-10T00:00:00Z" });
    expect(sortFamilies([a, b, c], "lastActivityAt", "desc").map((r) => r.userId)).toEqual([
      c.userId,
      a.userId,
      b.userId,
    ]);
    expect(sortFamilies([a, b, c], "lastActivityAt", "asc").map((r) => r.userId)).toEqual([
      a.userId,
      c.userId,
      b.userId,
    ]);
  });

  it("sorts names with the Arabic collation and numbers numerically", () => {
    const rows = [
      fam({ displayName: "ريم" }),
      fam({ displayName: "أمل" }),
      fam({ displayName: "هند" }),
    ];
    expect(sortFamilies(rows, "displayName", "asc").map((r) => r.displayName)).toEqual([
      "أمل",
      "ريم",
      "هند",
    ]);
    const costs = [
      fam({ lifetimeAiCostUsd: 2 }),
      fam({ lifetimeAiCostUsd: 10 }),
      fam({ lifetimeAiCostUsd: 0.5 }),
    ];
    expect(
      sortFamilies(costs, "lifetimeAiCostUsd", "desc").map((r) => r.lifetimeAiCostUsd),
    ).toEqual([10, 2, 0.5]);
  });

  it("breaks ties by id so the order never flickers, and does not mutate", () => {
    const rows = [fam({ beneficiaries: 3 }), fam({ beneficiaries: 3 }), fam({ beneficiaries: 1 })];
    const before = rows.map((r) => r.userId);
    const out = sortFamilies(rows, "beneficiaries", "desc");
    expect(out.map((r) => r.userId)).toEqual([before[0], before[1], before[2]]);
    expect(rows.map((r) => r.userId)).toEqual(before);
  });
});

describe("paginateFamilies", () => {
  const rows = Array.from({ length: 120 }, () => fam());

  it("pages by 50 and clamps the page", () => {
    expect(FAMILY_PAGE_SIZE).toBe(50);
    const p3 = paginateFamilies(rows, 3);
    expect(p3).toMatchObject({ total: 120, page: 3, pageSize: 50, pageCount: 3 });
    expect(p3.rows).toHaveLength(20);
    expect(paginateFamilies(rows, 99).page).toBe(3);
    expect(paginateFamilies(rows, 0).page).toBe(1);
    expect(paginateFamilies([], 4)).toMatchObject({ total: 0, page: 1, pageCount: 1, rows: [] });
  });
});

// ── URL <-> query ───────────────────────────────────────────────────────────

describe("parseFamilyListQuery", () => {
  it("defaults an empty URL", () => {
    expect(parseFamilyListQuery({})).toEqual(DEFAULT_FAMILY_LIST_QUERY);
    expect(DEFAULT_FAMILY_LIST_QUERY).toMatchObject({ sort: "lastActivityAt", dir: "desc" });
  });

  it("rejects every invalid param back to its default", () => {
    expect(
      parseFamilyListQuery({
        view: "everyone",
        sort: "email; drop table",
        dir: "sideways",
        tier: "gold",
        status: "frozen",
        page: "-3",
      }),
    ).toEqual(DEFAULT_FAMILY_LIST_QUERY);
    // Object-prototype keys are not tiers or statuses.
    expect(parseFamilyListQuery({ tier: "toString", status: "constructor" })).toMatchObject({
      tier: "",
      status: "",
    });
    expect(parseFamilyListQuery({ page: "abc" }).page).toBe(1);
    expect(parseFamilyListQuery({ page: "0" }).page).toBe(1);
    expect(parseFamilyListQuery({ page: "2.5" }).page).toBe(1);
  });

  it("accepts valid values, arrays, Arabic digits and URLSearchParams", () => {
    expect(
      parseFamilyListQuery({
        view: ["attention", "all"],
        q: "  هند  ",
        tier: "pro",
        status: "paused",
        sort: "signupAt",
        dir: "asc",
        page: "٣",
      }),
    ).toEqual({
      view: "attention",
      q: "هند",
      tier: "pro",
      status: "paused",
      sort: "signupAt",
      dir: "asc",
      page: 3,
    });
    expect(parseFamilyListQuery(new URLSearchParams("view=ended&page=2"))).toMatchObject({
      view: "ended",
      page: 2,
    });
    expect(parseFamilyListQuery({ q: "x".repeat(500) }).q).toHaveLength(200);
  });
});

describe("familyListQueryToParams", () => {
  it("omits defaults", () => {
    expect(familyListQueryToParams(DEFAULT_FAMILY_LIST_QUERY).toString()).toBe("");
  });

  it("round-trips through the parser, with the panel state", () => {
    const q = {
      view: "past_due" as const,
      q: "نورة",
      tier: "family",
      status: "past_due",
      sort: "displayName" as const,
      dir: "asc" as const,
      page: 4,
    };
    const id = "00000000-0000-4000-8000-000000000abc";
    const params = familyListQueryToParams(q, { open: id, tab: "meal" });
    expect(parseFamilyListQuery(params)).toEqual(q);
    expect(parseFamilyPanelState(params)).toEqual({ open: id, tab: "meal" });
    expect(familyListQueryToParams(q, { open: id, tab: "summary" }).has("tab")).toBe(false);
  });
});

describe("parseFamilyPanelState", () => {
  it("only opens a real family id and a panel tab", () => {
    expect(parseFamilyPanelState({ open: "../../etc", tab: "runs" })).toEqual({
      open: null,
      tab: "summary",
    });
    expect(
      parseFamilyPanelState({ open: "00000000-0000-4000-8000-00000000ABCD", tab: "exercise" }),
    ).toEqual({ open: "00000000-0000-4000-8000-00000000abcd", tab: "exercise" });
  });

  it("isFamilyId accepts UUIDs only", () => {
    expect(isFamilyId("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isFamilyId("not-a-uuid")).toBe(false);
    expect(isFamilyId("")).toBe(false);
    expect(isFamilyId(null)).toBe(false);
  });
});
