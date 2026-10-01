import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The account actions' guards, in their order: the admin check (which fails
 * CLOSED — a lookup that errored refuses the action), the typed email
 * (deletion), the REQUIRED audit row, and only then the act. Every refusal
 * reaches the operator: deactivation's on the account tab (`?error=`),
 * deletion's as the action's answer, which its dialog states.
 */

const h = vi.hoisted(() => ({
  log: [] as string[],
  adminLookup: { data: null as unknown, error: null as { message: string } | null },
  auditOk: true,
  authUser: {
    data: { user: { email: " Hind@Example.com " } as { email?: string | null } | null },
    error: null as { message: string } | null,
  },
}));

class Redirect extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    h.log.push(`redirect ${url}`);
    throw new Redirect(url);
  },
}));
vi.mock("next/cache", () => ({
  refresh: () => h.log.push("refresh"),
  updateTag: (tag: string) => h.log.push(`updateTag ${tag}`),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: async () => {
    h.log.push("requireAdmin");
    return { userId: "admin-1", email: "ops@example.com", role: "support" };
  },
}));
vi.mock("@/lib/admin/db", () => ({
  adminDb: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_column: string, id: string) => ({
          maybeSingle: async () => {
            h.log.push(`${table} ${id}`);
            return h.adminLookup;
          },
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/admin/audit", () => ({
  logAdminAccessRequired: async (row: { action: string; detail?: unknown }) => {
    h.log.push(`audit ${row.action}${row.detail ? ` ${JSON.stringify(row.detail)}` : ""}`);
    return { ok: h.auditOk };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        getUserById: async (id: string) => {
          h.log.push(`getUserById ${id}`);
          return h.authUser;
        },
        updateUserById: async (id: string, attrs: { ban_duration: string }) => {
          h.log.push(`updateUserById ${id} ${attrs.ban_duration}`);
          return { error: null };
        },
      },
    },
  }),
}));
vi.mock("@/lib/account/erase", () => ({
  eraseUserAccount: async (id: string) => {
    h.log.push(`erase ${id}`);
  },
}));

const { deleteSubscriberAccount, setSubscriberActive } = await import("./actions");

const ID = "63636363-0000-4000-8000-000000000001";
const TAB = `/admin/subscribers/${ID}?tab=account`;

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** Runs an action: what it returned, or where it redirected. */
async function run(action: () => Promise<unknown>): Promise<{ returned?: unknown; to?: string }> {
  try {
    return { returned: await action() };
  } catch (error) {
    if (error instanceof Redirect) return { to: error.url };
    throw error;
  }
}

const deactivate = () =>
  run(() => setSubscriberActive(form({ userId: ID, active: "false" })));
const reactivate = () => run(() => setSubscriberActive(form({ userId: ID, active: "true" })));
const erase = (confirmEmail = "hind@example.com") =>
  run(() => deleteSubscriberAccount(form({ userId: ID, confirmEmail })));

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  h.log.length = 0;
  h.adminLookup = { data: null, error: null };
  h.auditOk = true;
  h.authUser = { data: { user: { email: " Hind@Example.com " } }, error: null };
  consoleError?.mockRestore();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("deactivate / reactivate", () => {
  it("fails closed: a failed admin lookup refuses, writes nothing, and says why", async () => {
    h.adminLookup = { data: null, error: { message: "connection refused" } };
    expect(await deactivate()).toEqual({ to: `${TAB}&error=admin_check_failed` });
    expect(h.log).toEqual([
      "requireAdmin",
      `admin_users ${ID}`,
      `redirect ${TAB}&error=admin_check_failed`,
    ]);
    expect(consoleError).toHaveBeenCalled();
  });

  it("never touches an admin's account, and says so", async () => {
    h.adminLookup = { data: { user_id: ID }, error: null };
    expect(await reactivate()).toEqual({ to: `${TAB}&error=admin_target` });
    expect(h.log.some((line) => line.startsWith("audit") || line.startsWith("update"))).toBe(false);
  });

  it("stops before acting when the audit row cannot be written", async () => {
    h.auditOk = false;
    expect(await deactivate()).toEqual({ to: `${TAB}&error=audit_failed` });
    expect(h.log).toEqual([
      "requireAdmin",
      `admin_users ${ID}`,
      "audit deactivate_subscriber_account",
      `redirect ${TAB}&error=audit_failed`,
    ]);
  });

  it("audits, acts, then re-renders the family — head included — on its account tab", async () => {
    expect(await deactivate()).toEqual({ to: TAB });
    expect(h.log).toEqual([
      "requireAdmin",
      `admin_users ${ID}`,
      "audit deactivate_subscriber_account",
      `updateUserById ${ID} 876000h`,
      "refresh",
      `redirect ${TAB}`,
    ]);
    h.log.length = 0;
    await reactivate();
    expect(h.log).toContain(`updateUserById ${ID} none`);
    expect(h.log).toContain("audit reactivate_subscriber_account");
  });

  it("does nothing for an id that is not one", async () => {
    expect(await run(() => setSubscriberActive(form({ userId: "x", active: "false" })))).toEqual({
      to: "/admin",
    });
    expect(h.log).toEqual(["requireAdmin", "redirect /admin"]);
  });
});

describe("delete", () => {
  /** Nothing about the account was read past the refusal, audited or erased. */
  const nothingDone = () =>
    expect(h.log.some((line) => /^(audit|erase|updateTag|redirect)/.test(line))).toBe(false);

  it("fails closed: a failed admin lookup refuses before anything else, and says why", async () => {
    h.adminLookup = { data: null, error: { message: "timeout" } };
    expect(await erase()).toEqual({ returned: "admin_check_failed" });
    expect(h.log).toEqual(["requireAdmin", `admin_users ${ID}`]);
    expect(consoleError).toHaveBeenCalled();
  });

  it("refuses an admin's account", async () => {
    h.adminLookup = { data: { user_id: ID }, error: null };
    expect(await erase()).toEqual({ returned: "admin_target" });
    expect(h.log).toEqual(["requireAdmin", `admin_users ${ID}`]);
  });

  it("refuses when the account's email cannot be read to check the typed one", async () => {
    h.authUser = { data: { user: null }, error: { message: "GoTrue 503" } };
    expect(await erase()).toEqual({ returned: "email_unavailable" });
    nothingDone();
    h.authUser = { data: { user: { email: null } }, error: null };
    expect(await erase()).toEqual({ returned: "email_unavailable" });
    nothingDone();
  });

  it("refuses an email that is not the account's", async () => {
    expect(await erase("hind@example.co")).toEqual({ returned: "email_mismatch" });
    expect(await erase("")).toEqual({ returned: "email_mismatch" });
    nothingDone();
  });

  it("stops before erasing when the audit row cannot be written", async () => {
    h.auditOk = false;
    expect(await erase()).toEqual({ returned: "audit_failed" });
    expect(h.log.some((line) => line.startsWith("erase"))).toBe(false);
  });

  it("checks, audits (with the email), erases, expires the list, then leaves for the list", async () => {
    // The dialog's comparison: trimmed, any case.
    expect(await erase("  HIND@example.COM ")).toEqual({ to: "/admin/families" });
    // Which caches an erasure expires is the cache layer's list; here only
    // that the families list's are among them, after the erasure.
    const expired = h.log.filter((line) => line.startsWith("updateTag "));
    expect(expired).toEqual(
      expect.arrayContaining(["updateTag admin-dataset", "updateTag admin-email-map"]),
    );
    expect(h.log.filter((line) => !line.startsWith("updateTag "))).toEqual([
      "requireAdmin",
      `admin_users ${ID}`,
      `getUserById ${ID}`,
      'audit delete_subscriber_account {"email":"hind@example.com"}',
      `erase ${ID}`,
      "redirect /admin/families",
    ]);
    expect(h.log.indexOf(expired[0] ?? "")).toBe(h.log.indexOf(`erase ${ID}`) + 1);
    expect(h.log.at(-1)).toBe("redirect /admin/families");
  });
});
