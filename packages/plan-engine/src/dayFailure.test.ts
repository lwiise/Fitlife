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
