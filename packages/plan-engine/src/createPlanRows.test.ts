import { describe, it, expect, vi } from "vitest";
import { createPlanRows } from "./generate";
import { GenerationInFlightError } from "./errors";

/**
 * createPlanRows dispatch-race behavior (migration 00012 unique index):
 * a 23505 on the plan_generations insert means another generation is live —
 * the placeholder meal_plans row must be ARCHIVED (not failed: 'failed' would
 * become the user's latest plan and flash the failure UI over a healthy run)
 * and GenerationInFlightError thrown so the dispatcher returns "busy".
 */

type TableCall = { insert?: Record<string, unknown>; update?: Record<string, unknown> };

/** Chainable fake of the two supabase calls createPlanRows makes per table. */
function makeFakeClient(opts: {
  mealInsertError?: { message: string; code?: string } | null;
  genInsertError?: { message: string; code?: string } | null;
  updateError?: { message: string } | null;
}) {
  const calls: Record<string, TableCall[]> = { meal_plans: [], plan_generations: [] };
  const client = {
    from(table: "meal_plans" | "plan_generations") {
      return {
        insert(row: Record<string, unknown>) {
          calls[table]!.push({ insert: row });
          const error =
            table === "meal_plans"
              ? (opts.mealInsertError ?? null)
              : (opts.genInsertError ?? null);
          return Promise.resolve({ error });
        },
        update(row: Record<string, unknown>) {
          return {
            eq(_col: string, _val: string) {
              calls[table]!.push({ update: row });
              return Promise.resolve({ error: opts.updateError ?? null });
            },
          };
        },
      };
    },
  };
  return { client: client as never, calls };
}

describe("createPlanRows — dispatch race (23505)", () => {
  it("archives the placeholder and throws GenerationInFlightError on 23505", async () => {
    const { client, calls } = makeFakeClient({
      genInsertError: { message: "duplicate key value", code: "23505" },
    });

    await expect(createPlanRows(client, "user-1")).rejects.toBeInstanceOf(
      GenerationInFlightError,
    );

    const update = calls.meal_plans!.find((c) => c.update);
    expect(update?.update).toMatchObject({ status: "archived" });
    expect(update?.update?.status).not.toBe("failed");
  });

  it("still throws GenerationInFlightError when the archive update itself fails", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeFakeClient({
      genInsertError: { message: "duplicate key value", code: "23505" },
      updateError: { message: "network blip" },
    });

    await expect(createPlanRows(client, "user-1")).rejects.toBeInstanceOf(
      GenerationInFlightError,
    );
    errSpy.mockRestore();
  });

  it("keeps the existing failed-path for non-23505 insert errors", async () => {
    const { client, calls } = makeFakeClient({
      genInsertError: { message: "permission denied", code: "42501" },
    });

    await expect(createPlanRows(client, "user-1")).rejects.toThrow(
      /Failed to create plan_generations row/,
    );
    const update = calls.meal_plans!.find((c) => c.update);
    expect(update?.update).toMatchObject({ status: "failed" });
  });

  it("happy path inserts meal_plans before plan_generations and returns the id", async () => {
    const { client, calls } = makeFakeClient({});

    const id = await createPlanRows(client, "user-1");

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls.meal_plans![0]?.insert).toMatchObject({
      id,
      user_id: "user-1",
      status: "generating",
    });
    expect(calls.plan_generations![0]?.insert).toMatchObject({
      user_id: "user-1",
      meal_plan_id: id,
      status: "started",
    });
  });
});
