import { describe, it, expect } from "vitest";
import { LOCALE_CODES_ORDERED, getPlanActionStrings, getPlanStrings } from "./locales";

/**
 * Two things a live six-person household could not do.
 *
 * 1. Ask for a fresh week for the FAMILY. Both `RegenerateButton` mounts on
 *    /plan pass the viewed member's id, and the dashboard's «أنشئي خطة جديدة
 *    لأسبوع جديد» is a plain <Link> to /plan — so the only regeneration a
 *    customer could request was one person at a time. The route has always
 *    treated "no memberId" as a full regen; nothing sent it.
 *
 * 2. See what happened when the tap did nothing. Every /plan and /dashboard
 *    visit fires the deferred-member drain, which takes the per-kind generation
 *    lock for the whole run — so on a household whose week never fills, the
 *    user's own «إنشاء خطة جديدة» reliably came back 409 and the dialog closed
 *    as if it had worked.
 *
 * 3. The cook keeps her week during a regeneration. The new plan row is EMPTY
 *    and supersedes the translated one immediately.
 */

/** Mirrors RegenerateButton: "household" is the ABSENCE of a member scope. */
function regenBody(opts: {
  memberId?: string;
  hasSharedMeals: boolean;
  scope: "both" | "shared" | "individual" | "household";
}): Record<string, unknown> {
  const { memberId, hasSharedMeals, scope } = opts;
  return {
    issues: "",
    improvements: "",
    ...(memberId && scope !== "household" ? { memberId } : {}),
    ...(memberId && hasSharedMeals && scope !== "household" ? { scope } : {}),
  };
}

describe("asking for a whole-household week", () => {
  it("sends NO memberId, which is what the route reads as a full regen", () => {
    const body = regenBody({ memberId: "saud", hasSharedMeals: true, scope: "household" });
    expect(body).not.toHaveProperty("memberId");
    expect(body).not.toHaveProperty("scope");
  });

  it("still scopes to the member for every per-member choice", () => {
    for (const scope of ["both", "shared", "individual"] as const) {
      const body = regenBody({ memberId: "saud", hasSharedMeals: true, scope });
      expect(body.memberId).toBe("saud");
      expect(body.scope).toBe(scope);
    }
  });

  it("omits the scope for a member with no shared meals, as before", () => {
    const body = regenBody({ memberId: "saud", hasSharedMeals: false, scope: "both" });
    expect(body.memberId).toBe("saud");
    expect(body).not.toHaveProperty("scope");
  });
});

describe("the chooser only appears when there is a real choice", () => {
  // Mirrors PlanViewer → RegenerateButton: a solo plan's only member IS the
  // household, so offering both would be two names for one action.
  const showChooser = (memberId: string | undefined, memberCount: number) =>
    !!memberId && memberCount > 1;

  it("is shown for a household", () => {
    expect(showChooser("saud", 5)).toBe(true);
  });

  it("is hidden for a solo plan", () => {
    expect(showChooser("mom", 1)).toBe(false);
  });

  it("is hidden when the button carries no member at all", () => {
    expect(showChooser(undefined, 5)).toBe(false);
  });
});

describe("every language has the strings these states need", () => {
  it("names the household scope in each locale", () => {
    for (const code of LOCALE_CODES_ORDERED) {
      const t = getPlanActionStrings(code);
      expect(t.regen_scope_household, code).toBeTruthy();
      expect(t.regen_scope_household_hint, code).toBeTruthy();
      // It must not read as one of the per-member scopes.
      expect(t.regen_scope_household, code).not.toBe(t.regen_scope_both);
    }
  });

  it("tells the cook when she is looking at the PREVIOUS week", () => {
    for (const code of LOCALE_CODES_ORDERED) {
      const t = getPlanStrings(code);
      expect(t.previous_week, code).toBeTruthy();
      // Three distinct states, three distinct sentences — a shared string would
      // tell her the wrong thing in two of them.
      expect(t.previous_week, code).not.toBe(t.partial_week);
      expect(t.previous_week, code).not.toBe(t.awaiting_family);
    }
  });
});
