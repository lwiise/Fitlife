import { describe, expect, it } from "vitest";
import { FAMILY_COLUMNS, type FamilyListQuery, type FamilyRow } from "@/lib/admin/console-types";
import {
  DEFAULT_FAMILY_LIST_QUERY,
  filterFamilies,
  parseFamilyListQuery,
  parseFamilyPanelState,
} from "@/lib/admin/familyList";
import {
  COLUMN_LABEL,
  COLUMN_SORT,
  STATUS_FILTERS,
  TYPING_WRITE_DELAY_MS,
  buildSearchIndex,
  countFamilies,
  countsLine,
  defaultSortDir,
  familyPageHref,
  filterRows,
  hasFilters,
  isPanelTab,
  listCounts,
  listSearch,
  mealCardText,
  nextSort,
  pageOf,
  pageRange,
  panelTabLabel,
  parseHiddenColumns,
  rangeText,
  revealOpenFamily,
  rowKeyCommand,
  serializeHiddenColumns,
  statusFilterValues,
  statusOptionLabel,
  stepRow,
  toggleHidden,
  urlWriteDelay,
  visibleColumns,
  workoutCardText,
} from "./listModel";

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
    currentPeriodEnd: null,
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
    ...p,
  };
}

const query = (p: Partial<FamilyListQuery> = {}): FamilyListQuery => ({
  ...DEFAULT_FAMILY_LIST_QUERY,
  ...p,
});

// ── Sorting ─────────────────────────────────────────────────────────────────

describe("sorting", () => {
  it("starts names and statuses A→Z, everything else largest / newest first", () => {
    expect(defaultSortDir("displayName")).toBe("asc");
    expect(defaultSortDir("status")).toBe("asc");
    for (const key of [
      "beneficiaries",
      "lastActivityAt",
      "lifetimeAiCostUsd",
      "signupAt",
      "plansGenerated",
    ] as const) {
      expect(defaultSortDir(key)).toBe("desc");
    }
  });

  it("flips the active column and starts another at its default", () => {
    expect(nextSort({ sort: "lastActivityAt", dir: "desc" }, "lastActivityAt")).toEqual({
      sort: "lastActivityAt",
      dir: "asc",
    });
    expect(nextSort({ sort: "displayName", dir: "asc" }, "displayName")).toEqual({
      sort: "displayName",
      dir: "desc",
    });
    expect(nextSort({ sort: "lastActivityAt", dir: "asc" }, "displayName")).toEqual({
      sort: "displayName",
      dir: "asc",
    });
    expect(nextSort({ sort: "displayName", dir: "asc" }, "lifetimeAiCostUsd")).toEqual({
      sort: "lifetimeAiCostUsd",
      dir: "desc",
    });
  });

  it("sorts the old list's sortable columns and names every column", () => {
    expect(Object.values(COLUMN_SORT).sort()).toEqual(
      [
        "beneficiaries",
        "displayName",
        "lastActivityAt",
        "lifetimeAiCostUsd",
        "plansGenerated",
        "signupAt",
        "status",
      ].sort(),
    );
    for (const column of ["family", ...FAMILY_COLUMNS] as const) {
      expect(COLUMN_LABEL[column]).toBeTruthy();
    }
    expect(COLUMN_SORT.tier).toBeUndefined();
    expect(COLUMN_SORT.meal).toBeUndefined();
    expect(COLUMN_SORT.workout).toBeUndefined();
    expect(COLUMN_SORT.renewal).toBeUndefined();
  });
});

// ── Search ──────────────────────────────────────────────────────────────────

describe("filterRows", () => {
  const rows = [
    fam({ displayName: "هِنْد العتيبي", email: "hind.o@example.com", status: "active" }),
    fam({ displayName: "أمل السبيعي", email: "amal@example.com", tier: "pro", status: "trialing" }),
    fam({ displayName: null, email: "ZOË@Example.com", status: "past_due" }),
    fam({ displayName: "منى", email: null, status: "cancelled", cancelAtPeriodEnd: true }),
    fam({ displayName: "ريم", flags: ["failed_meal_run"], status: "expired" }),
    fam({ displayName: "سارة", status: "active", cancelAtPeriodEnd: true, tier: "starter" }),
  ];
  const index = buildSearchIndex(rows);

  it("matches exactly what filterFamilies matches, for any view, search and filter", () => {
    const searches = ["", "هند عتيبي", "امل", "zoe", "EXAMPLE", "مني", "  ", "غير موجود", "hind amal"];
    const views = ["all", "attention", "trialing", "active", "past_due", "cancelling", "ended"] as const;
    for (const q of searches) {
      for (const view of views) {
        for (const tier of ["", "pro", "family"]) {
          for (const status of ["", "active", "trialing"]) {
            const narrow = { view, q, tier, status };
            expect(filterRows(rows, index, narrow)).toEqual(filterFamilies(rows, narrow));
          }
        }
      }
    }
  });

  it("finds a family by any word of its name or email, spelling folded", () => {
    const hits = filterRows(rows, index, { view: "all", q: "هند عتيبي", tier: "", status: "" });
    expect(hits.map((r) => r.displayName)).toEqual(["هِنْد العتيبي"]);
  });

  it("still matches a row the index does not know (a stale index never hides a family)", () => {
    const late = fam({ displayName: "لطيفة" });
    expect(filterRows([late], index, { view: "all", q: "لطيفه", tier: "", status: "" })).toEqual([late]);
  });

  it("knows when anything besides the view narrows the list", () => {
    expect(hasFilters(query())).toBe(false);
    expect(hasFilters(query({ q: "   " }))).toBe(false);
    expect(hasFilters(query({ q: "x" }))).toBe(true);
    expect(hasFilters(query({ tier: "pro" }))).toBe(true);
    expect(hasFilters(query({ status: "active" }))).toBe(true);
  });
});

// ── Paging and rows ─────────────────────────────────────────────────────────

describe("paging", () => {
  it("gives the page's 1-based positions", () => {
    expect(pageRange(1, 50, 0)).toEqual({ from: 0, to: 0 });
    expect(pageRange(1, 50, 10)).toEqual({ from: 1, to: 10 });
    expect(pageRange(1, 50, 120)).toEqual({ from: 1, to: 50 });
    expect(pageRange(3, 50, 120)).toEqual({ from: 101, to: 120 });
  });

  it("finds the page a family is on", () => {
    const ids = Array.from({ length: 120 }, (_, i) => `id-${i}`);
    expect(pageOf(ids, "id-0", 50)).toBe(1);
    expect(pageOf(ids, "id-49", 50)).toBe(1);
    expect(pageOf(ids, "id-50", 50)).toBe(2);
    expect(pageOf(ids, "id-119", 50)).toBe(3);
    expect(pageOf(ids, "missing", 50)).toBeNull();
  });

  it("turns the list to an open family's page, and leaves it when the family is not listed", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      fam({ lastActivityAt: new Date(Date.UTC(2026, 8, 1) + i * 60_000).toISOString() }),
    );
    // Newest activity first: the first family made is the last row, on page 2.
    const first = many[0];
    expect(first).toBeDefined();
    expect(revealOpenFamily(many, query(), first!.userId, 50).page).toBe(2);
    const newest = many[59]!;
    const q = query();
    expect(revealOpenFamily(many, q, newest.userId, 50)).toBe(q);
    const filtered = query({ status: "trialing" });
    expect(revealOpenFamily(many, filtered, first!.userId, 50)).toBe(filtered);
  });

  it("steps between the page's rows without wrapping", () => {
    const ids = ["a", "b", "c"];
    expect(stepRow(ids, "a", "next")).toBe("b");
    expect(stepRow(ids, "c", "next")).toBeNull();
    expect(stepRow(ids, "b", "prev")).toBe("a");
    expect(stepRow(ids, "a", "prev")).toBeNull();
    expect(stepRow(ids, "b", "first")).toBe("a");
    expect(stepRow(ids, "a", "last")).toBe("c");
    // From a family that is not on the page: into the page from its edge.
    expect(stepRow(ids, "zz", "next")).toBe("a");
    expect(stepRow(ids, null, "prev")).toBe("c");
    expect(stepRow([], "a", "next")).toBeNull();
  });

  it("maps the table's keys, the same on a row and on its name link", () => {
    const key = (k: string, mods: Partial<Record<"altKey" | "ctrlKey" | "metaKey" | "shiftKey", boolean>> = {}) =>
      rowKeyCommand({ key: k, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });
    expect(key("ArrowDown")).toEqual({ kind: "step", step: "next" });
    expect(key("ArrowUp")).toEqual({ kind: "step", step: "prev" });
    expect(key("Home")).toEqual({ kind: "step", step: "first" });
    expect(key("End")).toEqual({ kind: "step", step: "last" });
    // Enter is the full page — also on the name link, whose own Enter would
    // click it and open the panel instead.
    expect(key("Enter")).toEqual({ kind: "page" });
    expect(key(" ")).toEqual({ kind: "panel" });
    expect(key("Escape")).toEqual({ kind: "close" });
    expect(key("a")).toBeNull();
    // A modifier leaves the key to the browser (⌘/Ctrl+Enter: a new tab).
    expect(key("Enter", { metaKey: true })).toBeNull();
    expect(key("Enter", { ctrlKey: true })).toBeNull();
    expect(key("Enter", { shiftKey: true })).toBeNull();
    expect(key("ArrowDown", { altKey: true })).toBeNull();
  });

  it("counts paying (active) and trialing families", () => {
    const rows = [
      fam({ status: "active" }),
      fam({ status: "active" }),
      fam({ status: "trialing" }),
      fam({ status: "past_due" }),
      fam({ status: null }),
    ];
    expect(listCounts(rows)).toEqual({ families: 5, paying: 2, trialing: 1 });
    expect(listCounts([])).toEqual({ families: 0, paying: 0, trialing: 0 });
  });
});

// ── The URL ─────────────────────────────────────────────────────────────────

describe("the URL", () => {
  it("writes the canonical query, which reads back as the same state", () => {
    const q = query({ view: "attention", q: "هند", tier: "pro", sort: "displayName", dir: "asc", page: 2 });
    const panel = { open: "00000000-0000-4000-8000-000000000001", tab: "meal" as const };
    const search = listSearch(q, panel);
    const params = new URLSearchParams(search);
    expect(parseFamilyListQuery(params)).toEqual(q);
    expect(parseFamilyPanelState(params)).toEqual(panel);
    expect(listSearch(query(), { open: null, tab: "summary" })).toBe("");
  });

  it("waits while only the search text changes, writes anything else at once", () => {
    expect(urlWriteDelay("view=active", "view=active")).toBeNull();
    expect(urlWriteDelay(null, "")).toBe(0);
    expect(urlWriteDelay("", "q=%D9%87")).toBe(TYPING_WRITE_DELAY_MS);
    expect(urlWriteDelay("q=a&view=active", "q=ab&view=active")).toBe(TYPING_WRITE_DELAY_MS);
    expect(urlWriteDelay("q=ab", "")).toBe(TYPING_WRITE_DELAY_MS);
    expect(urlWriteDelay("q=a", "q=a&view=active")).toBe(0);
    expect(urlWriteDelay("", "open=x")).toBe(0);
    expect(urlWriteDelay("open=x", "open=x&tab=meal")).toBe(0);
    expect(urlWriteDelay("page=2", "")).toBe(0);
  });
});

// ── Column preference ───────────────────────────────────────────────────────

describe("column preference", () => {
  it("round-trips the hidden columns in table order", () => {
    const raw = serializeHiddenColumns(["plans", "tier", "signup"]);
    expect(parseHiddenColumns(raw)).toEqual(["tier", "signup", "plans"]);
  });

  it("shows everything when the stored value is missing or unreadable", () => {
    for (const raw of [null, undefined, "", "not json", "[]", "null", "42", '{"hidden":"tier"}', "[\"tier\"]"]) {
      expect(parseHiddenColumns(raw)).toEqual([]);
    }
    expect(parseHiddenColumns('{"hidden":["tier","family","nope",3,"tier"]}')).toEqual(["tier"]);
  });

  it("toggles one column at a time and lists what stays visible", () => {
    const hidden = toggleHidden([], "cost");
    expect(hidden).toEqual(["cost"]);
    expect(toggleHidden(hidden, "tier")).toEqual(["tier", "cost"]);
    expect(toggleHidden(["tier", "cost"], "cost")).toEqual(["tier"]);
    expect(visibleColumns(["tier", "cost"])).toEqual(
      FAMILY_COLUMNS.filter((c) => c !== "tier" && c !== "cost"),
    );
    expect(visibleColumns([])).toEqual(FAMILY_COLUMNS);
  });
});

// ── Links, tabs, statuses ───────────────────────────────────────────────────

describe("links and tabs", () => {
  it("opens the full page on a tab, the summary being its default", () => {
    const id = "00000000-0000-4000-8000-00000000000a";
    expect(familyPageHref(id)).toBe(`/admin/subscribers/${id}`);
    expect(familyPageHref(id, "summary")).toBe(`/admin/subscribers/${id}`);
    expect(familyPageHref(id, "exercise")).toBe(`/admin/subscribers/${id}?tab=exercise`);
    expect(familyPageHref(id, null)).toBe(`/admin/subscribers/${id}`);
  });

  it("names the five panel tabs", () => {
    expect(isPanelTab("billing")).toBe(true);
    expect(isPanelTab("runs")).toBe(false);
    expect(panelTabLabel("summary", "ar")).toBe("ملخص");
    expect(panelTabLabel("meal", "ar")).toBe("الخطة الغذائية");
    expect(panelTabLabel("exercise", "en")).toBe("Exercise plan");
    expect(panelTabLabel("household", "ar")).toBe("الأسرة");
    expect(panelTabLabel("billing", "ar")).toBe("الاشتراك");
  });

  it("offers the old list's statuses, then valid others that occur, then the current one", () => {
    expect(statusFilterValues([], "")).toEqual([...STATUS_FILTERS]);
    expect(statusFilterValues(["active", "paused", null, "bogus", "paused"], "")).toEqual([
      ...STATUS_FILTERS,
      "paused",
    ]);
    expect(statusFilterValues([], "paused")).toEqual([...STATUS_FILTERS, "paused"]);
    expect(statusFilterValues([], "bogus")).toEqual([...STATUS_FILTERS]);
    expect(statusOptionLabel("paused", "ar")).toBe("متوقف مؤقتاً");
    expect(statusOptionLabel("past_due", "ar")).toBe("متأخر الدفع");
  });
});

// ── Texts ───────────────────────────────────────────────────────────────────

describe("texts", () => {
  it("counts families with Arabic number agreement", () => {
    expect(countFamilies(0, "ar")).toBe("٠ عائلة");
    expect(countFamilies(1, "ar")).toBe("عائلة واحدة");
    expect(countFamilies(2, "ar")).toBe("عائلتان");
    expect(countFamilies(10, "ar")).toBe("١٠ عائلات");
    expect(countFamilies(11, "ar")).toBe("١١ عائلة");
    expect(countFamilies(100, "ar")).toBe("١٠٠ عائلة");
    expect(countFamilies(1, "en")).toBe("1 family");
    expect(countFamilies(3, "en")).toBe("3 families");
  });

  it("reads the head line and the footer range", () => {
    expect(countsLine({ families: 10, paying: 6, trialing: 3 }, "ar")).toBe(
      "١٠ عائلات · ٦ مدفوعة · ٣ تجريبية",
    );
    expect(countsLine({ families: 10, paying: 6, trialing: 3 }, "en")).toBe(
      "10 families · 6 paying · 3 in trial",
    );
    expect(rangeText({ from: 1, to: 50 }, 120, "ar")).toBe("١–٥٠ من ١٢٠");
    expect(rangeText({ from: 101, to: 120 }, 120, "en")).toBe("101–120 of 120");
  });

  it("writes a card's meal line from what is known, never a guessed day count", () => {
    expect(mealCardText({ state: "none", daysReady: null, daysTotal: 7, masked: false }, "ar")).toBe("لا يوجد");
    expect(mealCardText({ state: "ready", daysReady: 6, daysTotal: 7, masked: false }, "ar")).toBe("٦/٧");
    expect(mealCardText({ state: "ready", daysReady: null, daysTotal: 7, masked: false }, "ar")).toBe("جاهزة");
    expect(mealCardText({ state: "generating", daysReady: 4, daysTotal: 7, masked: false }, "ar")).toBe(
      "قيد الإنشاء · ٤/٧",
    );
    expect(mealCardText({ state: "generating", daysReady: null, daysTotal: 7, masked: false }, "en")).toBe(
      "Generating",
    );
    expect(mealCardText({ state: "failed", daysReady: 0, daysTotal: 7, masked: true }, "ar")).toBe("فشلت");
    expect(workoutCardText({ state: "none", masked: false }, "ar")).toBe("لا يوجد");
    expect(workoutCardText({ state: "ready", masked: false }, "ar")).toBe("جاهزة");
    expect(workoutCardText({ state: "failed", masked: true }, "en")).toBe("Failed");
  });
});
