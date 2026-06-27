import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./anthropic", async () => {
  const actual = await vi.importActual<typeof import("./anthropic")>("./anthropic");
  return { ...actual, streamAnthropic: vi.fn() };
});

import { streamAnthropic } from "./anthropic";
import { distillPreferences, mergePreferences } from "./preferences";
import { buildSkeletonPrompt } from "./systemPrompt";
import type { PlanPromptContext, FoodPreferences } from "./buildContext";

const mockedStream = vi.mocked(streamAnthropic);

const empty: FoodPreferences = { loves: [], avoids: [], notes: [] };

describe("mergePreferences", () => {
  it("unions, dedups (whitespace/case-folded), keeps existing first", () => {
    const merged = mergePreferences(
      { loves: ["كبسة"], avoids: ["مقالي"], notes: [] },
      { loves: ["كبسة ", "مندي"], avoids: [], notes: ["تحب الخضار"] },
    );
    expect(merged.loves).toEqual(["كبسة", "مندي"]);
    expect(merged.avoids).toEqual(["مقالي"]);
    expect(merged.notes).toEqual(["تحب الخضار"]);
  });

  it("caps each list", () => {
    const many = (p: string) => Array.from({ length: 30 }, (_, i) => `${p}-${i}`);
    const merged = mergePreferences(
      { loves: many("a"), avoids: [], notes: [] },
      { loves: many("b"), avoids: [], notes: [] },
      15,
    );
    expect(merged.loves).toHaveLength(15);
  });
});

describe("distillPreferences", () => {
  beforeEach(() => mockedStream.mockReset());

  it("returns null for empty feedback without calling the model", async () => {
    const out = await distillPreferences("k", "   ", empty);
    expect(out).toBeNull();
    expect(mockedStream).not.toHaveBeenCalled();
  });

  it("parses the model's structured output", async () => {
    mockedStream.mockResolvedValue({
      text: JSON.stringify({ loves: ["كبسة"], avoids: ["مقالي"], notes: [] }),
      tokensIn: 5,
      tokensOut: 5,
      stopReason: null,
    });
    const out = await distillPreferences("k", "نحب الكبسة ونكره المقالي", empty);
    expect(out).toEqual({ loves: ["كبسة"], avoids: ["مقالي"], notes: [] });
  });

  it("returns null on malformed model output (non-fatal)", async () => {
    mockedStream.mockResolvedValue({
      text: "not json",
      tokensIn: 1,
      tokensOut: 1,
      stopReason: null,
    });
    expect(await distillPreferences("k", "feedback", empty)).toBeNull();
  });

  it("returns null when the model finds nothing durable", async () => {
    mockedStream.mockResolvedValue({
      text: JSON.stringify({ loves: [], avoids: [], notes: [] }),
      tokensIn: 1,
      tokensOut: 1,
      stopReason: null,
    });
    expect(await distillPreferences("k", "feedback", empty)).toBeNull();
  });
  // Note: a model-call rejection hits the same `catch` as the malformed-JSON case
  // above (both return null). We don't assert it with a throwing async mock because
  // tinyspy flags the spy's stored rejected result as "unhandled" even though
  // distillPreferences handles it — the malformed case already covers the catch.
});

function ctx(prefs?: FoodPreferences): PlanPromptContext {
  return {
    mom: {
      id: "user-1",
      display_name: "أم",
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
    family_wide: { dietary_restrictions: [], dislikes: [], cooking_methods: [], meal_out_frequency: null },
    composition_summary: "عائلة",
    food_preferences: prefs,
  };
}

describe("buildSkeletonPrompt — durable preferences block (WS5a)", () => {
  it("includes the block when preferences have content", () => {
    const prompt = buildSkeletonPrompt(ctx({ loves: ["كبسة"], avoids: ["مقالي"], notes: [] }));
    expect(prompt).toContain("تفضيلات العميلة المتراكمة");
    expect(prompt).toContain("تحبّ: كبسة");
    expect(prompt).toContain("تفضّل تجنّب: مقالي");
  });

  it("omits the block when preferences are empty or absent", () => {
    expect(buildSkeletonPrompt(ctx(empty))).not.toContain("تفضيلات العميلة المتراكمة");
    expect(buildSkeletonPrompt(ctx(undefined))).not.toContain("تفضيلات العميلة المتراكمة");
  });
});
