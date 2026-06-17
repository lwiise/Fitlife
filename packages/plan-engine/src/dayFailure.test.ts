import { describe, it, expect, vi, beforeEach } from "vitest";

// Fake only streamAnthropic; keep the real pure helpers (stripMarkdownFence etc.).
vi.mock("./anthropic", async () => {
  const actual = await vi.importActual<typeof import("./anthropic")>("./anthropic");
  return { ...actual, streamAnthropic: vi.fn() };
});

import { streamAnthropic } from "./anthropic";
import {
  generateMealPlan,
  summarizeDayErrors,
  retryWaitMs,
  isTransientContentError,
} from "./generate";
import { AnthropicCallError, PlanValidationError } from "./errors";
import type { PlanPromptContext } from "./buildContext";

const mockedStream = vi.mocked(streamAnthropic);

const DAY_INDICES = [0, 1, 2];

/** Minimal solo-mom context → a from-scratch full generation (skeleton + days). */
function makeSoloContext(): PlanPromptContext {
  return {
    mom: {
      id: "user-1",
      display_name: "أم محمد",
      sex: "female",
      member_type: "adult",
      age: 35,
      height_cm: 165,
      weight_kg: 70,
      activity_level: "moderate",
      primary_goal: "fat_loss",
      dietary_restrictions: [],
      cuisine_preference: "khaleeji",
      medical_conditions: [],
      allergies: [],
      dislikes: [],
      is_pregnant: false,
      pregnancy_trimester: null,
      months_postpartum: null,
      high_risk_pregnancy: false,
      consulted_doctor: false,
      meal_mode: "shared",
    },
    family_members: [],
    family_wide: {
      dietary_restrictions: [],
      dislikes: [],
      cooking_methods: [],
      meal_out_frequency: null,
    },
    composition_summary: "عائلة",
  };
}

function skeletonResponse() {
  const skeleton = {
    members: [
      {
        member_id: "mom",
        member_name_ar: "mom",
        primary_goal: "fat_loss",
        daily_calories_target: 1600,
        macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
        days: DAY_INDICES.map((di) => ({
          day_index: di,
          day_name_ar: `اليوم ${di + 1}`,
          meals: [
            {
              slot: "breakfast",
              slot_name_ar: "الفطور",
              recipe_name_ar: `mom-fresh-${di}`,
            },
          ],
        })),
      },
    ],
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
  };
  return { text: JSON.stringify(skeleton), tokensIn: 10, tokensOut: 20, stopReason: null };
}

function validMeal(recipeName: string) {
  return {
    slot: "breakfast",
    slot_name_ar: "الفطور",
    recipe_name_ar: recipeName,
    ingredients: [{ name_ar: "بيض", amount: 2, unit: "piece" }],
    prep_steps_ar: ["اخفقي البيض", "اطبخيه"],
    calories: 300,
    macros: { protein_g: 20, carbs_g: 10, fat_g: 15 },
  };
}

/** A valid canonical DaySlice for whichever members the prompt asks to expand. */
function validDayResponse(systemPrompt: string, stopReason: string | null = null) {
  const ids = [...systemPrompt.matchAll(/member_id="([^"]+)"/g)].map((m) => m[1]!);
  const memberIds = ids.length > 0 ? ids : ["mom"];
  const dayIndex = Number(systemPrompt.match(/day_index=(\d+)/)?.[1] ?? 0);
  const slice = {
    day_index: dayIndex,
    members: memberIds.map((id) => ({
      member_id: id,
      meals: [validMeal(`${id}-d${dayIndex}`)],
    })),
  };
  return { text: JSON.stringify(slice), tokensIn: 10, tokensOut: 20, stopReason };
}

beforeEach(() => mockedStream.mockReset());

describe("summarizeDayErrors", () => {
  it("returns empty string for no errors", () => {
    expect(summarizeDayErrors([])).toBe("");
  });
  it("returns the single error", () => {
    expect(summarizeDayErrors(["boom"])).toBe("boom");
  });
  it("returns the most frequent error (ties → earliest seen)", () => {
    expect(summarizeDayErrors(["a", "b", "a"])).toBe("a");
    expect(summarizeDayErrors(["x", "y"])).toBe("x"); // tie → first
  });
  it("truncates to 300 chars", () => {
    const long = "z".repeat(500);
    expect(summarizeDayErrors([long])).toHaveLength(300);
  });
});

describe("retryWaitMs", () => {
  it("honors Retry-After (capped at 60s) when present", () => {
    const w = retryWaitMs(1, 5000);
    expect(w).toBeGreaterThanOrEqual(5000);
    expect(w).toBeLessThan(5400);
    const capped = retryWaitMs(1, 90_000);
    expect(capped).toBeGreaterThanOrEqual(60_000);
    expect(capped).toBeLessThan(60_400);
  });
  it("falls back to exponential backoff (capped at 30s) without Retry-After", () => {
    const first = retryWaitMs(1);
    expect(first).toBeGreaterThanOrEqual(800);
    expect(first).toBeLessThan(1200);
    const high = retryWaitMs(10); // 800*2^9 → clamped to 30s
    expect(high).toBeGreaterThanOrEqual(30_000);
    expect(high).toBeLessThan(30_400);
  });
});

describe("generateMealPlan — surfaces the real cause when all days fail", () => {
  it("includes the underlying day error in the thrown message (not just a count)", async () => {
    // Skeleton (opus) succeeds; every day call (haiku) fails with a non-retryable
    // API error carrying a distinctive cause. Nothing is carried (from-scratch),
    // so the run throws — and the throw must surface the real cause.
    mockedStream.mockImplementation(async (params) => {
      // Read defensively: a prompt carrying day_index=N is a day call → fail it;
      // anything else (the skeleton) succeeds.
      const systemPrompt =
        (params as { systemPrompt?: string } | undefined)?.systemPrompt ?? "";
      if (/day_index=\d+/.test(systemPrompt)) {
        throw new AnthropicCallError(
          "Anthropic API 400: invalid_request_error SURFACED_CAUSE_MARKER",
        );
      }
      return skeletonResponse();
    });

    let err: unknown;
    try {
      await generateMealPlan({
        anthropicApiKey: "test-key",
        context: makeSoloContext(),
      });
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(PlanValidationError);
    const message = (err as Error).message;
    expect(message).toMatch(/All 3 day generations failed/);
    expect(message).toMatch(/SURFACED_CAUSE_MARKER/);
  });
});

describe("isTransientContentError", () => {
  it("treats malformed JSON (SyntaxError) and validation misses as transient", () => {
    expect(isTransientContentError(new SyntaxError("Unexpected token"))).toBe(true);
    expect(
      isTransientContentError(new PlanValidationError("Day 2 failed validation: ...")),
    ).toBe(true);
  });
  it("does NOT treat max_tokens, generic errors, or API errors as transient content", () => {
    expect(
      isTransientContentError(new PlanValidationError("Day 2 hit max_tokens (12000)")),
    ).toBe(false);
    expect(isTransientContentError(new Error("boom"))).toBe(false);
    expect(
      isTransientContentError(new AnthropicCallError("Anthropic API 429: rate_limit_error")),
    ).toBe(false);
  });
});

describe("generateMealPlan — Part D: auto-retry transient per-day failures", () => {
  it("re-rolls a day that returns malformed output once, then succeeds", async () => {
    // Solo mom (concurrency 1 → sequential days). Day 1's FIRST call returns
    // malformed JSON (transient content failure → SyntaxError); the re-roll succeeds.
    let day1Calls = 0;
    mockedStream.mockImplementation(async (params) => {
      const systemPrompt =
        (params as { systemPrompt?: string } | undefined)?.systemPrompt ?? "";
      if (!/day_index=\d+/.test(systemPrompt)) return skeletonResponse();
      if (/day_index=1\b/.test(systemPrompt)) {
        day1Calls++;
        if (day1Calls === 1)
          return { text: "{{ not valid json", tokensIn: 5, tokensOut: 5, stopReason: null };
      }
      return validDayResponse(systemPrompt);
    });

    const { plan, missingDays } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeSoloContext(),
    });

    expect(day1Calls).toBeGreaterThanOrEqual(2); // failed once, re-rolled
    expect(missingDays).not.toContain(1); // recovered
    const mom = plan.members.find((m) => m.member_id === "mom")!;
    expect(mom.days.find((d) => d.day_index === 1)!.meals.length).toBeGreaterThan(0);
  });

  it("retries a truncated (max_tokens) day once at a DOUBLED cap", async () => {
    const calls: { day: number; maxTokens: number }[] = [];
    let day1Calls = 0;
    mockedStream.mockImplementation(async (params) => {
      // Guard the occasional stray no-arg call in the from-scratch path (harness quirk).
      const p = (params ?? {}) as { systemPrompt?: string; maxTokens?: number };
      const systemPrompt = p.systemPrompt ?? "";
      const dayMatch = systemPrompt.match(/day_index=(\d+)/);
      if (!dayMatch) return skeletonResponse();
      const dayIndex = Number(dayMatch[1]);
      calls.push({ day: dayIndex, maxTokens: p.maxTokens ?? 0 });
      if (dayIndex === 1) {
        day1Calls++;
        if (day1Calls === 1)
          return { text: "", tokensIn: 5, tokensOut: 5, stopReason: "max_tokens" };
      }
      return validDayResponse(systemPrompt);
    });

    const { missingDays } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeSoloContext(),
    });

    expect(missingDays).not.toContain(1);
    const day1Calls2 = calls.filter((c) => c.day === 1);
    expect(day1Calls2.length).toBe(2);
    expect(day1Calls2[1]!.maxTokens).toBe(day1Calls2[0]!.maxTokens * 2);
  });
});

describe("generateMealPlan — Part E: partial failures surface the cause", () => {
  it("a day failing every re-roll lands in missingDays AND missingDaysCause", async () => {
    // Day 1 returns malformed JSON on EVERY call → exhausts content re-rolls →
    // dropped. Days 0 + 2 succeed, so it's a PARTIAL (no all-days throw).
    mockedStream.mockImplementation(async (params) => {
      const systemPrompt =
        (params as { systemPrompt?: string } | undefined)?.systemPrompt ?? "";
      if (!/day_index=\d+/.test(systemPrompt)) return skeletonResponse();
      if (/day_index=1\b/.test(systemPrompt))
        return { text: "{{ not valid json", tokensIn: 5, tokensOut: 5, stopReason: null };
      return validDayResponse(systemPrompt);
    });

    const { missingDays, missingDaysCause } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeSoloContext(),
    });

    expect(missingDays).toContain(1);
    expect(missingDaysCause).toBeTruthy();
    expect((missingDaysCause ?? "").length).toBeGreaterThan(0);
  });
});
