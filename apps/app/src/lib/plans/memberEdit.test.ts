import { describe, it, expect } from "vitest";
import { memberEditIsSubstantive, sameFieldValue } from "./memberEdit";

/** A representative buildMemberRow() output. */
function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    user_id: "u1",
    name: "ريان",
    role: "son",
    member_type: "child",
    sex: "male",
    birth_year: 2016,
    height_cm: 122,
    weight_kg: 23,
    activity_level: "active",
    primary_goal: null,
    preferred_language: "ar",
    meal_mode: "shared",
    medical_conditions: [],
    allergies: [],
    dislikes: [],
    consulted_doctor: false,
    trimester: null,
    months_postpartum: null,
    high_risk_pregnancy: false,
    school_meal_handling: "home_packed",
    picky_eater: false,
    target_weight_kg: null,
    day_nature: null,
    exercise_days: null,
    exercise_type: null,
    sleep_hours: null,
    water_liters: null,
    medications: [],
    supplements: [],
    nausea_foods: [],
    feeding_mode: null,
    ...over,
  };
}

describe("memberEditIsSubstantive", () => {
  it("an unchanged row needs no regeneration", () => {
    expect(memberEditIsSubstantive(row(), row())).toBe(false);
  });

  it("a rename alone needs no regeneration (the read-time overlay shows it)", () => {
    expect(memberEditIsSubstantive(row(), row({ name: "ريان الصغير" }))).toBe(false);
  });

  it("adding an ALLERGY regenerates — the old hand-written list missed this", () => {
    expect(memberEditIsSubstantive(row(), row({ allergies: ["مكسرات"] }))).toBe(true);
  });

  it.each([
    ["height_cm", { height_cm: 128 }],
    ["dislikes", { dislikes: ["باذنجان"] }],
    ["trimester", { trimester: 3 }],
    ["months_postpartum", { months_postpartum: 6 }],
    ["school_meal_handling", { school_meal_handling: "school_provided" }],
    ["picky_eater", { picky_eater: true }],
    ["weight_kg", { weight_kg: 26 }],
    ["medical_conditions", { medical_conditions: ["anemia"] }],
    ["meal_mode", { meal_mode: "independent" }],
    ["activity_level", { activity_level: "light" }],
  ])("changing %s regenerates", (_label, patch) => {
    expect(memberEditIsSubstantive(row(), row(patch))).toBe(true);
  });

  it("a missing prior row always regenerates", () => {
    expect(memberEditIsSubstantive(null, row())).toBe(true);
  });

  it("tolerates Postgres numerics arriving as strings", () => {
    const stored = { ...row(), weight_kg: "23.00", height_cm: "122.00" };
    expect(memberEditIsSubstantive(stored, row())).toBe(false);
  });

  it("ignores columns the built row does not carry", () => {
    const stored = { ...row(), created_at: "2026-01-01", display_order: 4 };
    expect(memberEditIsSubstantive(stored, row())).toBe(false);
  });
});

describe("sameFieldValue", () => {
  it.each([
    [null, undefined, true],
    [null, 0, false],
    ["23.00", 23, true],
    [[], [], true],
    [["a"], ["a"], true],
    [["a"], ["b"], false],
    [false, false, true],
    [false, null, false],
  ])("(%s, %s) → %s", (a, b, expected) => {
    expect(sameFieldValue(a, b)).toBe(expected);
  });
});
