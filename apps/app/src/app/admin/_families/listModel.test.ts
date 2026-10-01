import { describe, expect, it } from "vitest";
import {
  FAMILY_COLUMNS,
  type FamilyListQuery,
  type FamilyRow,
  type MealPlanCell,
} from "@/lib/admin/console-types";
import { subscriptionCancelState } from "@/lib/admin/familyFlags";
import {
  DEFAULT_FAMILY_LIST_QUERY,
  filterFamilies,
  parseFamilyListQuery,
  parseFamilyPanelState,
} from "@/lib/admin/familyList";
import {
  COLUMN_LABEL,
  COLUMN_SORT,
  SORT_ORDERS,
  STATUS_FILTERS,
  TYPING_WRITE_DELAY_MS,
  adoptUrl,
  buildSearchIndex,
  cardCorner,
  countFamilies,
  countsLine,
  countsParts,
  defaultSortDir,
  familyPageHref,
  filterRows,
  hasFilters,
  isAppPath,
  isPanelTab,
  listCounts,
  listSearch,
  mealCardParts,
  nextSort,
  pageOf,
  pageRange,
  pageRows,
  panelTabLabel,
  parseHiddenColumns,
  parseSortOrder,
  rangeText,
  revealOpenFamily,
  rowKeyCommand,
  serializeHiddenColumns,
  sortOrderLabel,
  sortOrderValue,
  startingQuery,
  startsNavigationAway,
  statusFilterValues,
  statusOptionLabel,
  stepRow,
  toggleHidden,
  urlWriteDelay,
  visibleColumns,
  workoutCardText,
  type LinkClick,
} from "./listModel";
import { familyTabLabel } from "../_family/model";

/** When the fixtures' dataset was "read" — the cancellation state is judged at it. */
const NOW = Date.parse("2026-09-30T09:00:00Z");

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

  describe("the narrow screens' sort select", () => {
    it("offers every order a header click can give: each sortable column, both directions", () => {
      expect(SORT_ORDERS).toHaveLength(Object.keys(COLUMN_SORT).length * 2);
      for (const [column, sort] of Object.entries(COLUMN_SORT)) {
        const orders = SORT_ORDERS.filter((o) => o.sort === sort);
        // The header's first direction comes first, then the flip.
        expect(orders.map((o) => o.dir)).toEqual([
          defaultSortDir(sort),
          nextSort({ sort, dir: defaultSortDir(sort) }, sort).dir,
        ]);
        expect(orders.every((o) => o.column === column)).toBe(true);
      }
      // Every query the URL can hold has its option, and the value reads back.
      for (const order of SORT_ORDERS) {
        expect(parseSortOrder(sortOrderValue(order))).toEqual({ sort: order.sort, dir: order.dir });
      }
      expect(sortOrderValue(DEFAULT_FAMILY_LIST_QUERY)).toBe("lastActivityAt:desc");
      for (const bad of ["", "lastActivityAt", "lastActivityAt:up", "bogus:asc", "status:desc:x"]) {
        expect(parseSortOrder(bad)).toBeNull();
      }
    });

    it("names an order by its column header and its direction", () => {
      const named = (sort: string, dir: string, locale: "ar" | "en") => {
        const order = SORT_ORDERS.find((o) => o.sort === sort && o.dir === dir)!;
        return sortOrderLabel(order, locale);
      };
      expect(named("lastActivityAt", "desc", "ar")).toBe("آخر نشاط: الأحدث أولاً");
      expect(named("lifetimeAiCostUsd", "asc", "ar")).toBe("تكلفة الذكاء: الأقل أولاً");
      expect(named("displayName", "asc", "ar")).toBe("العائلة: أ–ي");
      expect(named("beneficiaries", "desc", "en")).toBe("Household: largest first");
      expect(named("signupAt", "asc", "en")).toBe("Signup: oldest first");
      expect(named("plansGenerated", "desc", "en")).toBe("Plans: most first");
      expect(named("status", "desc", "en")).toBe("Status: descending");
      // All fourteen differ.
      const labels = SORT_ORDERS.map((o) => sortOrderLabel(o, "ar"));
      expect(new Set(labels).size).toBe(labels.length);
    });

    it("shows on each card the value the list is sorted by, when the card does not already", () => {
      const text = { signup: "٣٠ مايو ٢٠٢٦", cost: "‏٣٥٫٩٩ ر.س.‏", last: "قبل ٣ ساعات" };
      const row = { plansGenerated: 3 };
      expect(cardCorner("signupAt", row, text, "ar")).toBe("التسجيل ٣٠ مايو ٢٠٢٦");
      expect(cardCorner("lifetimeAiCostUsd", row, text, "ar")).toBe("تكلفة الذكاء ‏٣٥٫٩٩ ر.س.‏");
      expect(cardCorner("lifetimeAiCostUsd", row, { ...text, cost: null }, "ar")).toBe("تكلفة الذكاء —");
      expect(cardCorner("plansGenerated", row, text, "en")).toBe("Plans 3");
      // Otherwise the prototype's last activity («—» when never active).
      for (const sort of ["lastActivityAt", "displayName", "status", "beneficiaries"] as const) {
        expect(cardCorner(sort, row, text, "ar")).toBe("قبل ٣ ساعات");
      }
      expect(cardCorner("lastActivityAt", row, { ...text, last: null }, "ar")).toBe("—");
      expect(cardCorner("signupAt", row, undefined, "ar")).toBe("التسجيل —");
    });
  });
});

// ── Search ──────────────────────────────────────────────────────────────────

describe("filterRows", () => {
  const rows = [
    fam({ displayName: "هِنْد العتيبي", email: "hind.o@example.com", status: "active" }),
    fam({
      displayName: "أمل السبيعي",
      email: "amal@example.com",
      tier: "pro",
      status: "trialing",
      trialEndsAt: "2026-10-04T00:00:00Z",
    }),
    fam({ displayName: null, email: "ZOË@Example.com", status: "past_due" }),
    // Cancelled with no paid-through date: ended.
    fam({ displayName: "منى", email: null, status: "cancelled", cancelAtPeriodEnd: true }),
    // Cancelled in the LemonSqueezy portal, still paid up: cancelling.
    fam({
      displayName: "نوف",
      status: "cancelled",
      cancelAtPeriodEnd: true,
      endsAt: "2026-10-20T00:00:00Z",
      flags: ["cancel_scheduled"],
    }),
    fam({ displayName: "ريم", flags: ["failed_meal_run"], status: "expired" }),
    // Set to cancel through our own route: cancelling.
    fam({
      displayName: "سارة",
      status: "active",
      cancelAtPeriodEnd: true,
      tier: "starter",
      flags: ["cancel_scheduled"],
    }),
  ];
  const index = buildSearchIndex(rows);

  it("puts each cancellation in its view, so the equivalence below covers both", () => {
    const names = (view: "cancelling" | "ended") =>
      filterRows(rows, index, { view, q: "", tier: "", status: "" }).map((r) => r.displayName);
    expect(names("cancelling")).toEqual(["نوف", "سارة"]);
    expect(names("ended")).toEqual(["منى", "ريم"]);
  });

  it("matches exactly what filterFamilies matches, for any view, search and filter", () => {
    const searches = ["", "هند عتيبي", "امل", "zoe", "EXAMPLE", "مني", "  ", "غير موجود", "hind amal"];
    const views = ["all", "attention", "trialing", "active", "past_due", "cancelling", "ended"] as const;
    for (const q of searches) {
      for (const view of views) {
        for (const tier of ["", "pro", "family"]) {
          for (const status of ["", "active", "trialing", "cancelled"]) {
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

  it("starts where the console's first render does: the open family's page, and its rows", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      fam({ lastActivityAt: new Date(Date.UTC(2026, 8, 1) + i * 60_000).toISOString() }),
    );
    const oldest = many[0]!;
    // No open family: the URL's own page, as the list sorts and filters it.
    expect(startingQuery(many, query(), null)).toEqual(query());
    const first = pageRows(many, query());
    expect(first).toHaveLength(50);
    expect(first[0]).toBe(many[59]);
    expect(pageRows(many, query({ page: 2 }))).toEqual(many.slice(0, 10).reverse());
    // A family opened on page 2 starts the list there.
    const start = startingQuery(many, query(), oldest.userId);
    expect(start.page).toBe(2);
    expect(pageRows(many, start)).toContain(oldest);
    // A page past the end is the last page, as the console clamps it.
    expect(pageRows(many, query({ page: 9 }))).toEqual(pageRows(many, query({ page: 2 })));
    expect(pageRows(many, query({ status: "trialing" }))).toEqual([]);
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
      fam({ status: "trialing", trialEndsAt: "2026-10-04T00:00:00Z" }),
      // A trial that ran out is still 'trialing' in the table — not in trial.
      fam({ status: "trialing", trialEndsAt: "2026-09-20T00:00:00Z" }),
      fam({ status: "past_due" }),
      fam({ status: null }),
    ];
    expect(listCounts(rows)).toEqual({ families: 6, paying: 2, trialing: 1 });
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

  describe("a link's navigation, as the window sees the finished click", () => {
    const here = { origin: "https://admin.test", pathname: "/admin/families" };
    const click = (p: Partial<LinkClick> = {}): LinkClick => ({
      defaultPrevented: true,
      button: 0,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      link: { href: "https://admin.test/admin", target: "", download: false },
      ...p,
    });
    const link = (href: string, p: Partial<NonNullable<LinkClick["link"]>> = {}) => ({
      link: { href, target: "", download: false, ...p },
    });

    it("counts a <Link> that took a plain click to another page", () => {
      expect(startsNavigationAway(click(), here)).toBe(true);
      const id = "00000000-0000-4000-8000-00000000000a";
      for (const href of [
        `https://admin.test/admin/subscribers/${id}?tab=meal`,
        `https://admin.test/admin/subscribers/${id}/plan/${id}`,
        `https://admin.test/admin/subscribers/${id}/health`,
      ]) {
        expect(startsNavigationAway(click(link(href)), here)).toBe(true);
      }
      // `_self` is still this tab.
      expect(startsNavigationAway(click(link("https://admin.test/admin", { target: "_self" })), here)).toBe(true);
    });

    it("leaves out what is not a navigation away", () => {
      // Nobody took the click: the browser's own (a new tab, a download…).
      expect(startsNavigationAway(click({ defaultPrevented: false }), here)).toBe(false);
      // No link at all (a button, a row).
      expect(startsNavigationAway(click({ link: null }), here)).toBe(false);
      // Modified or not the primary button: the browser's (new tab, new window).
      for (const p of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
        expect(startsNavigationAway(click(p), here)).toBe(false);
      }
      // Another tab or a download.
      expect(startsNavigationAway(click(link("https://admin.test/admin", { target: "_blank" })), here)).toBe(false);
      expect(startsNavigationAway(click(link("https://admin.test/admin", { download: true })), here)).toBe(false);
      // The list's own path: a view the page handles itself.
      expect(startsNavigationAway(click(link("https://admin.test/admin/families?view=ended")), here)).toBe(false);
      // Another origin.
      expect(startsNavigationAway(click(link("https://elsewhere.test/admin")), here)).toBe(false);
    });

    it("hands over only in-app paths", () => {
      expect(isAppPath("/admin")).toBe(true);
      expect(isAppPath("/admin/families?view=attention")).toBe(true);
      for (const href of ["//evil.test/x", "/\\evil.test", "https://evil.test", "javascript:alert(1)", ""]) {
        expect(isAppPath(href)).toBe(false);
      }
    });
  });

  describe("adopting a URL from outside", () => {
    const A = "00000000-0000-4000-8000-00000000000a";
    const B = "00000000-0000-4000-8000-00000000000b";
    const shown = (search: string) => ({
      search,
      open: parseFamilyPanelState(new URLSearchParams(search)).open,
    });

    it("adopts nothing when the screen already shows what the URL says", () => {
      expect(adoptUrl(`open=${A}&view=attention`, shown(`view=attention&open=${A}`))).toBeNull();
      // Invalid or default params read as what the screen shows.
      expect(adoptUrl("view=bogus&page=0", shown(""))).toBeNull();
    });

    it("adopts the list's state and keeps the panel when the same family stays open", () => {
      const adopted = adoptUrl(`view=attention&open=${A}`, shown(`open=${A}`));
      expect(adopted?.query).toEqual(query({ view: "attention" }));
      expect(adopted?.panel).toEqual({ open: A, tab: "summary" });
      expect(adopted?.resetSheet).toBe(false);
      // Another tab of the same family keeps what the panel holds.
      expect(adoptUrl(`open=${A}&tab=meal`, shown(`open=${A}`))?.resetSheet).toBe(false);
    });

    it("resets the panel when the URL names another family or none (back/forward)", () => {
      // Back to a family whose load was dropped: the panel must ask again.
      expect(adoptUrl(`open=${A}`, shown("view=attention"))?.resetSheet).toBe(true);
      expect(adoptUrl("view=attention", shown(`open=${A}`))?.resetSheet).toBe(true);
      expect(adoptUrl(`open=${B}`, shown(`open=${A}`))).toMatchObject({
        panel: { open: B },
        resetSheet: true,
      });
    });
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
    // Billing carries the full page's own tab name, in both languages.
    expect(panelTabLabel("billing", "ar")).toBe("الاشتراك");
    expect(panelTabLabel("billing", "en")).toBe("Billing");
    expect(panelTabLabel("billing", "en")).toBe(familyTabLabel("billing", "en"));
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
    expect(countsParts({ families: 10, paying: 6, trialing: 3 }, "ar")).toEqual([
      "١٠ عائلات",
      "٦ مدفوعة",
      "٣ تجريبية",
    ]);
    // The live region's text: Arabic joins with its comma — beside an
    // Arabic-Indic digit «·» reads as «٠» («٦ مدفوعة ·٣» → «٣٠»).
    expect(countsLine({ families: 10, paying: 6, trialing: 3 }, "ar")).toBe(
      "١٠ عائلات، ٦ مدفوعة، ٣ تجريبية",
    );
    expect(countsLine({ families: 10, paying: 6, trialing: 3 }, "en")).toBe(
      "10 families · 6 paying · 3 in trial",
    );
    expect(rangeText({ from: 1, to: 50 }, 120, "ar")).toBe("١–٥٠ من ١٢٠");
    expect(rangeText({ from: 101, to: 120 }, 120, "en")).toBe("101–120 of 120");
  });

  it("writes a card's meal line from what is known, never a guessed day count", () => {
    const cell = (state: MealPlanCell["state"], daysReady: number | null, masked = false) => ({
      state,
      daysReady,
      daysTotal: 7,
      masked,
    });
    expect(mealCardParts(cell("none", null), "ar")).toEqual({ state: "لا يوجد", days: null });
    expect(mealCardParts(cell("ready", 6), "ar")).toEqual({ state: null, days: "٦/٧" });
    expect(mealCardParts(cell("ready", null), "ar")).toEqual({ state: "جاهزة", days: null });
    // The state and the days stay two parts: the card sets the days apart as a count.
    expect(mealCardParts(cell("generating", 4), "ar")).toEqual({ state: "قيد الإنشاء", days: "٤/٧" });
    expect(mealCardParts(cell("generating", null), "en")).toEqual({ state: "Generating", days: null });
    expect(mealCardParts(cell("failed", 0, true), "ar")).toEqual({ state: "فشلت", days: null });
    expect(workoutCardText({ state: "none", masked: false }, "ar")).toBe("لا يوجد");
    expect(workoutCardText({ state: "ready", masked: false }, "ar")).toBe("جاهزة");
    expect(workoutCardText({ state: "failed", masked: true }, "en")).toBe("Failed");
  });
});
