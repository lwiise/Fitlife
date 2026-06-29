import { describe, it, expect } from "vitest";
import { SAFE_EXERCISE_PROTOCOLS } from "./exerciseProtocols";
import { STATIC_SYSTEM } from "./systemPrompt";

// A distinctive marker only this block contains — used for the leak guard.
const MARKER = "# بروتوكولات التمارين الآمنة";

describe("SAFE_EXERCISE_PROTOCOLS", () => {
  it("carries the core safety invariants", () => {
    // screening verdict is a hard cap
    expect(SAFE_EXERCISE_PROTOCOLS).toContain("intensityCeiling");
    expect(SAFE_EXERCISE_PROTOCOLS).toContain("intensityMode");
    // no deficit for pregnant / lactating / child
    expect(SAFE_EXERCISE_PROTOCOLS).toContain("لا عجز سعرات");
    // pregnancy absolute contraindication (gate → refuse + clearance)
    expect(SAFE_EXERCISE_PROTOCOLS).toContain("placenta previa");
    // hypertension: no Valsalva, and RPE when on rate-limiting meds
    expect(SAFE_EXERCISE_PROTOCOLS).toContain("Valsalva");
    expect(SAFE_EXERCISE_PROTOCOLS).toContain("hr_meds");
    expect(SAFE_EXERCISE_PROTOCOLS).toContain("RPE");
    // children are never prescribed like adults
    expect(SAFE_EXERCISE_PROTOCOLS).toContain("لا توصف للطفل كالبالغ");
    // MSK region exclusion
    expect(SAFE_EXERCISE_PROTOCOLS).toContain("أسفل الظهر");
  });

  it("is NOT part of STATIC_SYSTEM (no leak into chat / meal-only generation)", () => {
    // STATIC_SYSTEM is the chat advisor's cached base and is sent on every meal
    // generation. The exercise protocols must never reach it — Phase 2 injects them
    // as a separate, gated cached block instead. This guard fails loudly if a future
    // edit splices the block into STATIC_SYSTEM.
    expect(STATIC_SYSTEM).not.toContain(MARKER);
    expect(STATIC_SYSTEM).not.toContain("Valsalva");
    expect(STATIC_SYSTEM).not.toContain("intensityCeiling");
  });
});
