import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAMILY_TABS,
  type FamilyHeaderData,
  type FamilyTab,
  type WorkoutSection,
} from "@/lib/admin/console-types";

/**
 * What a tab switch costs. `?tab` re-renders the family page segment and not
 * the family layout above it, so:
 *  - the layout reads the header — once per visit — and hands it down;
 *  - the page reads it never: its own work is the auth check, the per-tab
 *    audit row, and the sections its tab shows (tabSections), started early
 *    (preload) and awaited by the body;
 *  - billing and the account actions render the layout's header and read
 *    nothing at all.
 */

const state = vi.hoisted(() => ({
  reads: [] as string[],
  audits: [] as unknown[],
  header: null as unknown,
}));

vi.mock("@/lib/admin/family", () => {
  const read =
    <T,>(name: string, value: () => T) =>
    async () => {
      state.reads.push(name);
      return value();
    };
  const noWorkout: WorkoutSection = {
    optedIn: false,
    served: null,
    latest: null,
    waitingForMeals: false,
    plans: [],
    ineligible: [],
    marksWindow: null,
  };
  return {
    loadFamilyHeader: read("header", () => state.header),
    loadMealSection: read("meal", () => ({ served: null, plans: [] })),
    loadWorkoutSection: read("workout", () => noWorkout),
    loadHousehold: read("household", () => []),
    loadRuns: read("runs", () => []),
  };
});
vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: async () => ({ userId: "admin-1", email: "ops@example.com", role: "support" }),
}));
vi.mock("@/lib/admin/audit", () => ({
  logAdminAccess: async (row: unknown) => {
    state.audits.push(row);
  },
}));
vi.mock("@/lib/admin/locale", () => ({
  getAdminLocale: async () => "ar",
  getAdminCurrency: async () => "sar",
}));
vi.mock("@/lib/admin/db", () => ({ adminDb: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));
// The account actions pull the service-role client; nothing here submits.
vi.mock("@/app/admin/actions", () => ({
  setSubscriberActive: vi.fn(),
  deleteSubscriberAccount: vi.fn(),
}));

const { FamilyTabBody } = await import("./tabs");
const { preloadFamilyTab } = await import("./data");
const { tabSections } = await import("./model");
const { AccountFromHead, BillingFromHead, FamilyHeadProvider } = await import("./headSnapshot");
const { default: FamilyPage } = await import(
  "@/app/admin/(console)/subscribers/[userId]/(family)/page"
);
const { default: FamilyLayout } = await import(
  "@/app/admin/(console)/subscribers/[userId]/(family)/layout"
);

const ID = "00000000-0000-4000-8000-0000000000aa";
const CTX = {
  userId: ID,
  locale: "ar" as const,
  currency: "sar" as const,
  nowIso: "2026-09-30T09:00:00Z",
  todayIso: "2026-09-30",
};

beforeEach(() => {
  state.reads.length = 0;
  state.audits.length = 0;
  state.header = null;
});

const isAsync = (fn: unknown) => Object.prototype.toString.call(fn) === "[object AsyncFunction]";

/** The reads a tab's body makes when it renders (its async server component, run). */
async function bodyReads(tab: FamilyTab): Promise<string[]> {
  state.reads.length = 0;
  const body = FamilyTabBody({ tab, ...CTX });
  const render = body.type as (props: unknown) => unknown;
  if (isAsync(render)) await render(body.props);
  return [...state.reads].sort();
}

/** Every element in a rendered (not yet run) tree. */
function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const props = node.props as { children?: ReactNode };
  return [node, ...elements(props.children)];
}

describe("the tab bodies", () => {
  it("read only the sections their tab shows — never the header", async () => {
    for (const tab of FAMILY_TABS) {
      const got = await bodyReads(tab);
      expect(got, tab).not.toContain("header");
      expect(got, tab).toEqual([...tabSections(tab)].sort());
    }
  });

  it("billing and the account actions render the layout's header, reading nothing", async () => {
    expect(FamilyTabBody({ tab: "billing", ...CTX }).type).toBe(BillingFromHead);
    expect(FamilyTabBody({ tab: "account", ...CTX }).type).toBe(AccountFromHead);
    expect(await bodyReads("billing")).toEqual([]);
    expect(await bodyReads("account")).toEqual([]);
  });

  it("the page starts reading exactly what the body then awaits", async () => {
    for (const tab of FAMILY_TABS) {
      state.reads.length = 0;
      preloadFamilyTab(ID, tab);
      await Promise.resolve();
      expect([...state.reads].sort(), tab).toEqual(await bodyReads(tab));
    }
  });
});

describe("the page (what a tab switch renders)", () => {
  const page = (tab: FamilyTab | undefined, extra: Record<string, string> = {}) =>
    FamilyPage({
      params: Promise.resolve({ userId: ID.toUpperCase() }),
      searchParams: Promise.resolve({ ...(tab ? { tab } : {}), ...extra }),
    });

  it("writes the per-tab audit row and reads only that tab's sections, never the header", async () => {
    for (const tab of FAMILY_TABS) {
      state.reads.length = 0;
      state.audits.length = 0;
      await page(tab);
      await Promise.resolve();
      expect(state.reads, tab).not.toContain("header");
      expect([...state.reads].sort(), tab).toEqual([...tabSections(tab)].sort());
      expect(state.audits, tab).toEqual([
        {
          adminUserId: "admin-1",
          subscriberId: ID,
          action: "view_subscriber_detail",
          detail: { surface: "page", tab },
        },
      ]);
    }
  });

  it("states a refused account action above the body", async () => {
    const out = elements(await page("account", { error: "admin_check_failed" }));
    const note = out.find((el) => (el.props as { role?: string }).role === "alert");
    expect(note).toBeDefined();
    const plain = elements(await page("account"));
    expect(plain.some((el) => (el.props as { role?: string }).role === "alert")).toBe(false);
  });

  it("never audits a malformed id", async () => {
    await expect(
      FamilyPage({ params: Promise.resolve({ userId: "nope" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(state.audits).toEqual([]);
  });
});

describe("the layout (once per visit)", () => {
  const layout = (userId: string) =>
    FamilyLayout({ children: "body", params: Promise.resolve({ userId }) });

  it("reads the header once and hands that same read to the tabs", async () => {
    const head = { userId: ID, displayName: "هند" } as unknown as FamilyHeaderData;
    state.header = head;
    const tree = elements(await layout(ID.toUpperCase()));
    expect(state.reads).toEqual(["header"]);
    const provider = tree.find((el) => el.type === FamilyHeadProvider);
    expect((provider?.props as { head?: unknown }).head).toBe(head);
    expect((provider?.props as { children?: unknown }).children).toBe("body");
  });

  it("is a 404 for a family that does not exist, or a malformed id", async () => {
    await expect(layout(ID)).rejects.toThrow("NEXT_NOT_FOUND");
    state.reads.length = 0;
    await expect(layout("nope")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(state.reads).toEqual([]);
  });
});
