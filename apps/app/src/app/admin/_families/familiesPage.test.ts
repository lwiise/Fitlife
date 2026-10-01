import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FamilyRow } from "@/lib/admin/console-types";
import { unpackFamilyRows, type PackedFamilyRow } from "./rowCodec";

/**
 * The /admin/families server page's PDPL audit row (spec §2.4):
 * `view_subscriber_list {section: "families", view, filters: {q, tier, status},
 * total}`. Every family goes to the browser (the filters run there), so
 * `total` is the number of family records the load discloses — the figure a
 * PDPL review needs — and the page renders only once the row is in.
 */

const requireAdmin = vi.fn();
const logAdminAccess = vi.fn();
const loadFamilyList = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/families",
}));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: () => requireAdmin() }));
vi.mock("@/lib/admin/audit", () => ({
  logAdminAccess: (params: unknown) => logAdminAccess(params),
}));
vi.mock("@/lib/admin/queries", () => ({ loadFamilyList: () => loadFamilyList() }));
vi.mock("@/lib/admin/locale", () => ({
  getAdminLocale: async () => "ar",
  getAdminCurrency: async () => "sar",
}));

const { default: FamiliesPage } = await import("../(console)/families/page");

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

const ROWS = [fam(), fam({ status: "trialing" }), fam({ tier: "starter" })];

const page = (params: Record<string, string> = {}) =>
  FamiliesPage({ searchParams: Promise.resolve(params) });

/** Lets every queued promise callback run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({ userId: "admin-1", email: "ops@example.com" });
  logAdminAccess.mockReset().mockResolvedValue(undefined);
  loadFamilyList.mockReset().mockResolvedValue({
    rows: ROWS,
    loadedAt: "2026-09-30T09:00:00.000Z",
    truncated: [],
  });
});

describe("/admin/families — the list-view audit row", () => {
  it("records the URL's view and filters and every family the load discloses", async () => {
    await page({ view: "attention", q: "  هند ", tier: "family", sort: "status" });
    expect(logAdminAccess).toHaveBeenCalledTimes(1);
    expect(logAdminAccess).toHaveBeenCalledWith({
      adminUserId: "admin-1",
      action: "view_subscriber_list",
      detail: {
        section: "families",
        view: "attention",
        filters: { q: "هند", tier: "family", status: null },
        // The whole list goes to the browser, whatever the filters narrow it to.
        total: ROWS.length,
      },
    });
  });

  it("records an unfiltered load with null filters", async () => {
    await page();
    expect(logAdminAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          section: "families",
          view: "all",
          filters: { q: null, tier: null, status: null },
          total: ROWS.length,
        },
      }),
    );
  });

  it("renders only once the audit row is in", async () => {
    let release: () => void = () => {};
    logAdminAccess.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    let rendered = false;
    const pending = page().then((element) => {
      rendered = true;
      return element;
    });
    await settle();
    expect(logAdminAccess).toHaveBeenCalledTimes(1);
    expect(rendered).toBe(false);
    release();
    await pending;
    expect(rendered).toBe(true);
  });

  it("writes no audit row when the list could not be read (nothing was disclosed)", async () => {
    loadFamilyList.mockRejectedValue(new Error("admin load profiles: boom"));
    await expect(page()).rejects.toThrow("boom");
    expect(logAdminAccess).not.toHaveBeenCalled();
  });
});

describe("/admin/families — what the page sends the console", () => {
  // Sixty families, newest activity first: the default order pages them as listed.
  const many = Array.from({ length: 60 }, (_, i) =>
    fam({
      displayName: i === 59 ? "زينب" : `عائلة ${i}`,
      lastActivityAt: new Date(Date.UTC(2026, 8, 29) - i * 3_600_000).toISOString(),
    }),
  );
  const props = async (params: Record<string, string> = {}) =>
    ((await page(params)) as { props: ConsoleProps }).props;
  type ConsoleProps = {
    rows: PackedFamilyRow[];
    texts: Record<string, unknown>;
    nowIso: string;
  };

  beforeEach(() => {
    loadFamilyList.mockResolvedValue({ rows: many, loadedAt: "2026-09-30T09:00:00.000Z", truncated: [] });
  });

  it("sends every family, packed — and display strings only for the rows its render shows", async () => {
    const { rows, texts, nowIso } = await props();
    expect(unpackFamilyRows(rows)).toEqual(many);
    expect(Object.keys(texts).sort()).toEqual(many.slice(0, 50).map((row) => row.userId).sort());
    expect(Date.parse(nowIso)).not.toBeNaN();
  });

  it("formats the page the URL names, on the open family's page", async () => {
    const last = many[59]!;
    // Opening a family on page 2 starts the list there.
    expect(Object.keys((await props({ open: last.userId })).texts).sort()).toEqual(
      many.slice(50).map((row) => row.userId).sort(),
    );
    expect(Object.keys((await props({ page: "2" })).texts)).toHaveLength(10);
  });

  it("adds the open family when the filters leave it out (the panel's head shows its strings)", async () => {
    const open = many[3]!;
    const { texts } = await props({ q: "زينب", open: open.userId });
    expect(Object.keys(texts).sort()).toEqual([many[59]!.userId, open.userId].sort());
  });
});
