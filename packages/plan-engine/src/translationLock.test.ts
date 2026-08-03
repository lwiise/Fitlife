/**
 * The cook must not be the last person in the house to be served.
 *
 * Translation used to wait until EVERY member had EVERY day. At the six-member
 * cap a run yields roughly two days of seven, so the housekeeper — the only
 * person in the household who cannot read the plan at all without it — waited
 * through five more rounds for other people's weeks, none of which she needs to
 * cook tonight's dinner. Observed live: 0 of 36 meals translated, and a waiting
 * card where the plan should have been.
 *
 * Letting translation run on a partial week costs nothing extra (already-translated
 * meals are skipped, so the token total is identical) but it does make a latent
 * race reachable: generation and translation each persist the WHOLE plan_data
 * blob from their own in-memory copy, so interleaved they erase each other. The
 * translation therefore takes the same lock a generation takes — 00014's
 * `(user_id, plan_kind) where status='started'` unique index — which is what
 * these tests pin.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./anthropic", async () => {
  const actual = await vi.importActual<typeof import("./anthropic")>("./anthropic");
  return { ...actual, streamAnthropic: vi.fn() };
});

import { streamAnthropic } from "./anthropic";
import { runMealPlanTranslation } from "./generate";
import { MealPlanSchema, type MealPlan } from "./schema";

const mockedStream = vi.mocked(streamAnthropic);

function plan(): MealPlan {
  return MealPlanSchema.parse({
    week_start_date: "2026-06-06",
    days_total: 1,
    generating: false,
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
    members: [
      {
        member_id: "mom",
        member_name_ar: "هند",
        primary_goal: "fat_loss",
        daily_calories_target: 1600,
        macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
        days: [
          {
            day_index: 0,
            day_name_ar: "السبت",
            day_total: { calories: 400, protein_g: 30, carbs_g: 40, fat_g: 12 },
            meals: [
              {
                slot: "breakfast",
                slot_name_ar: "الفطور",
                recipe_name_ar: "بيض بالخضار",
                ingredients: [{ name_ar: "بيض", amount: 2, unit: "piece" }],
                prep_steps_ar: ["اخفقي البيض"],
                calories: 400,
                macros: { protein_g: 30, carbs_g: 40, fat_g: 12 },
              },
            ],
          },
        ],
      },
    ],
  });
}

/**
 * Minimal PostgREST stand-in that records the ORDER of writes — the point of the
 * lock is that the audit row opens before any plan_data is touched.
 */
function fakeSupabase(
  opts: { lockConflict?: boolean; insertFails?: boolean; planWriteFails?: boolean } = {},
) {
  const seq: string[] = [];
  const inserted: Record<string, unknown>[] = [];
  const auditUpdates: Record<string, unknown>[] = [];
  const planWrites: Record<string, unknown>[] = [];

  const client = {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          seq.push(`insert:${table}`);
          inserted.push(row);
          return {
            select() {
              return {
                maybeSingle: async () => {
                  if (opts.lockConflict)
                    return { data: null, error: { code: "23505", message: "duplicate key" } };
                  if (opts.insertFails)
                    return { data: null, error: { code: "42P01", message: "no such table" } };
                  return { data: { id: "audit-1" }, error: null };
                },
              };
            },
          };
        },
        update(fields: Record<string, unknown>) {
          return {
            eq: async () => {
              seq.push(`update:${table}`);
              if (table === "plan_generations") {
                auditUpdates.push(fields);
                return { error: null };
              }
              planWrites.push(fields);
              // Only the FINAL write fails: the progressive per-day persists are
              // non-fatal by design, so failing them would prove nothing.
              return opts.planWriteFails && planWrites.length > 1
                ? { error: { message: "row is gone" } }
                : { error: null };
            },
          };
        },
      };
    },
  };
  return { client, seq, inserted, auditUpdates, planWrites };
}

/** Name call, then meal call — the order translateMealPlan issues them in. */
function scriptHappyPath() {
  mockedStream
    .mockResolvedValueOnce({
      text: JSON.stringify([{ i: 0, name: "Hind" }]),
      tokensIn: 10,
      tokensOut: 5,
      stopReason: "end_turn",
    } as never)
    .mockResolvedValue({
      text: JSON.stringify([
        { i: 0, recipe_name: "Egg with vegetables", ingredient_names: ["Eggs"], steps: ["Beat the eggs"] },
      ]),
      tokensIn: 20,
      tokensOut: 30,
      stopReason: "end_turn",
    } as never);
}

const run = (client: unknown) =>
  runMealPlanTranslation({
    supabase: client as never,
    anthropicApiKey: "k",
    userId: "u1",
    mealPlanId: "p1",
    plan: plan(),
    locale: "tl",
  });

beforeEach(() => {
  mockedStream.mockReset();
});

describe("runMealPlanTranslation takes the generation lock", () => {
  it("opens a 'started' audit row BEFORE writing any plan_data", async () => {
    scriptHappyPath();
    const sb = fakeSupabase();
    await run(sb.client);

    expect(sb.seq[0]).toBe("insert:plan_generations");
    expect(sb.seq.indexOf("insert:plan_generations")).toBeLessThan(
      sb.seq.indexOf("update:meal_plans"),
    );
    expect(sb.inserted[0]).toMatchObject({
      user_id: "u1",
      meal_plan_id: "p1",
      status: "started",
    });
  });

  it("closes the row 'completed' with the pass's spend, so the lock frees", async () => {
    scriptHappyPath();
    const sb = fakeSupabase();
    await run(sb.client);

    const final = sb.auditUpdates[sb.auditUpdates.length - 1]!;
    expect(final).toMatchObject({ status: "completed" });
    expect(final.completed_at).toBeTruthy();
    expect(Number(final.tokens_in)).toBeGreaterThan(0);
    expect(Number(final.tokens_out)).toBeGreaterThan(0);
  });

  it("writes the translated plan", async () => {
    scriptHappyPath();
    const sb = fakeSupabase();
    await run(sb.client);

    const last = sb.planWrites[sb.planWrites.length - 1] as { plan_data: MealPlan };
    const meal = last.plan_data.members[0]!.days[0]!.meals[0]!;
    expect(meal.prep_steps_translated_locale).toBe("tl");
    expect(meal.recipe_name_translated).toBe("Egg with vegetables");
  });
});

describe("a conflict means someone else is writing — do not race them", () => {
  it("skips the whole pass on a unique violation, touching no plan_data", async () => {
    scriptHappyPath();
    const sb = fakeSupabase({ lockConflict: true });
    await run(sb.client);

    expect(sb.planWrites).toHaveLength(0);
    expect(sb.auditUpdates).toHaveLength(0);
    // And it never even called the model — a skipped pass costs nothing.
    expect(mockedStream).not.toHaveBeenCalled();
  });

  it("still translates when the audit row fails for a NON-concurrency reason", async () => {
    // A broken audit table is a bookkeeping problem. The maid is waiting on the
    // translation itself, so it proceeds unlocked exactly as it did before.
    scriptHappyPath();
    const sb = fakeSupabase({ insertFails: true });
    await run(sb.client);

    expect(sb.planWrites.length).toBeGreaterThan(0);
    expect(sb.auditUpdates).toHaveLength(0); // no row id to close
  });
});

describe("a failed pass releases the lock instead of wedging it", () => {
  // A row left 'started' holds the mutex until the staleness sweep, which would
  // block the household's next generation for fifteen minutes over a failure
  // that took two seconds.
  it("marks the row 'failed' and rethrows when the plan write fails", async () => {
    scriptHappyPath();
    const sb = fakeSupabase({ planWriteFails: true });

    await expect(run(sb.client)).rejects.toThrow(/row is gone/);

    const final = sb.auditUpdates[sb.auditUpdates.length - 1]!;
    expect(final).toMatchObject({ status: "failed" });
    expect(String(final.error_message)).toContain("row is gone");
  });
});
