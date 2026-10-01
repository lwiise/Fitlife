import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The family name reads behind the titles and crumbs. The family page's
 * title is re-made on every tab switch from ONE column (not the header the
 * layout holds), and must still tell a nameless family («بدون اسم», as its
 * head says) from a family that does not exist (no name at all).
 */

const db = vi.hoisted(() => ({
  answer: { data: null as { display_name: string | null } | null, error: null as unknown },
  reads: 0,
}));

vi.mock("@/lib/admin/db", () => ({
  adminDb: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            db.reads += 1;
            return db.answer;
          },
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/admin/audit", () => ({ logAdminAccess: vi.fn() }));
vi.mock("@/lib/admin/family", () => ({
  loadHousehold: vi.fn(),
  loadMealSection: vi.fn(),
  loadRuns: vi.fn(),
  loadWorkoutSection: vi.fn(),
}));

const { loadFamilyName, loadProfileName } = await import("./data");

beforeEach(() => {
  db.reads = 0;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("family name reads", () => {
  it("a named family: its name, trimmed, for the title and the crumb alike", async () => {
    db.answer = { data: { display_name: "  هند العتيبي " }, error: null };
    expect(await loadProfileName("a")).toBe("هند العتيبي");
    expect(await loadFamilyName("b")).toBe("هند العتيبي");
  });

  it("a nameless family: the title still knows it exists; the crumb falls back", async () => {
    for (const display_name of [null, "", "   "]) {
      db.answer = { data: { display_name }, error: null };
      expect(await loadProfileName("a")).toBe("");
      expect(await loadFamilyName("b")).toBeNull();
    }
  });

  it("no such family, or a failed read: no name at all", async () => {
    db.answer = { data: null, error: null };
    expect(await loadProfileName("a")).toBeNull();
    db.answer = { data: null, error: { message: "timeout" } };
    expect(await loadProfileName("b")).toBeNull();
    expect(await loadFamilyName("c")).toBeNull();
  });

  it("is one single-column read", async () => {
    db.answer = { data: { display_name: "هند" }, error: null };
    await loadProfileName("a");
    expect(db.reads).toBe(1);
  });
});
