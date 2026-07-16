import { describe, expect, it } from "vitest";

import {
  CANONICAL_KEY_VERSION,
  canonicalRecipeKey,
} from "./canonicalRecipeKey";

describe("canonicalRecipeKey", () => {
  it("exports a version for re-minting stored keys", () => {
    expect(CANONICAL_KEY_VERSION).toBe(1);
  });

  it("ignores the definite article", () => {
    expect(canonicalRecipeKey("كبسة الدجاج")).toBe(canonicalRecipeKey("كبسة دجاج"));
  });

  it("is order-independent and prefix-insensitive across rewordings", () => {
    expect(canonicalRecipeKey("كبسة دجاج بالفريكة")).toBe(
      canonicalRecipeKey("كبسة الفريكة بالدجاج"),
    );
  });

  it("ignores harakat and tatweel", () => {
    expect(canonicalRecipeKey("كَبْسَة دَجاج")).toBe(canonicalRecipeKey("كبسة دجاج"));
    expect(canonicalRecipeKey("كبـــسة دجاج")).toBe(canonicalRecipeKey("كبسة دجاج"));
  });

  it("unifies ta-marbuta / ha and alef variants", () => {
    expect(canonicalRecipeKey("كبسه دجاج")).toBe(canonicalRecipeKey("كبسة دجاج"));
    expect(canonicalRecipeKey("أرز بالخضار")).toBe(canonicalRecipeKey("ارز بالخضار"));
  });

  it("drops praise adjectives but keeps identity", () => {
    expect(canonicalRecipeKey("كبسة دجاج شهية")).toBe(canonicalRecipeKey("كبسة دجاج"));
    expect(canonicalRecipeKey("طبق كبسة الدجاج الصحية")).toBe(
      canonicalRecipeKey("كبسة دجاج"),
    );
  });

  it("keeps preparation style as identity (veto on fried must not kill grilled)", () => {
    expect(canonicalRecipeKey("دجاج مشوي")).not.toBe(canonicalRecipeKey("دجاج مقلي"));
    expect(canonicalRecipeKey("دجاج بالفرن")).not.toBe(canonicalRecipeKey("دجاج مشوي"));
  });

  it("distinguishes genuinely different dishes sharing an ingredient", () => {
    expect(canonicalRecipeKey("شوربة عدس")).not.toBe(canonicalRecipeKey("سلطة عدس"));
  });

  it("does not mangle words that merely start with prefix letters", () => {
    // بطاطس starts with ب but is not a بـ prefix; ورق starts with و.
    expect(canonicalRecipeKey("بطاطس مشوية")).toContain("بطاطس");
    expect(canonicalRecipeKey("ورق عنب")).toContain("ورق");
  });

  it("strips digits and punctuation", () => {
    expect(canonicalRecipeKey("كبسة دجاج (٢ حصص)")).toBe(canonicalRecipeKey("كبسة دجاج"));
  });

  it("returns empty string when nothing identifying remains", () => {
    expect(canonicalRecipeKey("  ")).toBe("");
    expect(canonicalRecipeKey("طبق صحي لذيذ")).toBe("");
  });

  it("dedupes repeated tokens", () => {
    expect(canonicalRecipeKey("دجاج مع دجاج")).toBe(canonicalRecipeKey("دجاج"));
  });
});
