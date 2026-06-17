import { describe, it, expect } from "vitest";
import { expandTerseDaySlice } from "./generate";
import { DaySliceSchema } from "./schema";

// The day prompt asks the model for a TERSE-keyed slice to cut output tokens.
// expandTerseDaySlice turns that back into the canonical DaySlice shape (and fills
// slot_name_ar from slot) before zod validation. These cover the terse path, the
// canonical-key tolerance, and the edge cases (0 amounts, optional fields).

describe("expandTerseDaySlice", () => {
  const terse = {
    d: 2,
    ms: [
      {
        id: "mom",
        m: [
          {
            s: "breakfast",
            r: "بيض بالطماطم",
            ig: [
              { n: "بيض", a: 2, u: "piece" },
              { n: "طماطم", a: 100, mn: 80, mx: 120, u: "g" },
            ],
            st: ["اخفقي البيض", "اطبخيه"],
            c: 320,
            mc: { p: 22, cb: 8, f: 18 },
          },
        ],
      },
    ],
  };

  it("expands terse keys into a valid canonical DaySlice", () => {
    const parsed = DaySliceSchema.parse(expandTerseDaySlice(terse));
    expect(parsed.day_index).toBe(2);
    expect(parsed.members[0]!.member_id).toBe("mom");
    const meal = parsed.members[0]!.meals[0]!;
    expect(meal.slot).toBe("breakfast");
    expect(meal.recipe_name_ar).toBe("بيض بالطماطم");
    expect(meal.ingredients[1]).toMatchObject({
      name_ar: "طماطم",
      amount: 100,
      amount_min: 80,
      amount_max: 120,
      unit: "g",
    });
    expect(meal.prep_steps_ar).toEqual(["اخفقي البيض", "اطبخيه"]);
    expect(meal.calories).toBe(320);
    expect(meal.macros).toEqual({ protein_g: 22, carbs_g: 8, fat_g: 18 });
  });

  it("fills slot_name_ar from slot; both snacks collapse to سناك", () => {
    const cases: [string, string][] = [
      ["breakfast", "الفطور"],
      ["lunch", "الغداء"],
      ["dinner", "العشاء"],
      ["snack", "سناك"],
    ];
    for (const [slot, label] of cases) {
      const out = expandTerseDaySlice({
        d: 0,
        ms: [{ id: "mom", m: [{ s: slot, r: "x", ig: [], st: [], c: 1, mc: { p: 1, cb: 1, f: 1 } }] }],
      });
      expect(out.members[0].meals[0].slot_name_ar).toBe(label);
    }
  });

  it("is tolerant of canonical keys (full-key slice round-trips)", () => {
    const canonical = {
      day_index: 0,
      members: [
        {
          member_id: "mom",
          meals: [
            {
              slot: "lunch",
              slot_name_ar: "غداء",
              recipe_name_ar: "كبسة",
              ingredients: [{ name_ar: "أرز", amount: 80, unit: "g" }],
              prep_steps_ar: ["اطبخي"],
              calories: 500,
              macros: { protein_g: 30, carbs_g: 60, fat_g: 12 },
            },
          ],
        },
      ],
    };
    const parsed = DaySliceSchema.parse(expandTerseDaySlice(canonical));
    // A model-supplied slot_name_ar wins over the static fill.
    expect(parsed.members[0]!.meals[0]!.slot_name_ar).toBe("غداء");
    expect(parsed.members[0]!.meals[0]!.recipe_name_ar).toBe("كبسة");
  });

  it("preserves a legitimate 0 (uses ?? not ||)", () => {
    const out = expandTerseDaySlice({
      d: 0,
      ms: [
        {
          id: "mom",
          m: [{ s: "snack", r: "ماء", ig: [{ n: "ماء", a: 0, u: "ml" }], st: [], c: 0, mc: { p: 0, cb: 0, f: 0 } }],
        },
      ],
    });
    expect(out.members[0].meals[0].calories).toBe(0);
    expect(out.members[0].meals[0].ingredients[0].amount).toBe(0);
  });

  it("carries optional sub/nt only when present", () => {
    const withOpt = expandTerseDaySlice({
      d: 0,
      ms: [{ id: "mom", m: [{ s: "lunch", r: "x", ig: [], st: [], c: 1, mc: { p: 1, cb: 1, f: 1 }, sub: ["بديل"], nt: "ملاحظة" }] }],
    });
    expect(withOpt.members[0].meals[0].substitutions_ar).toEqual(["بديل"]);
    expect(withOpt.members[0].meals[0].notes_ar).toBe("ملاحظة");

    const without = expandTerseDaySlice({
      d: 0,
      ms: [{ id: "mom", m: [{ s: "lunch", r: "x", ig: [], st: [], c: 1, mc: { p: 1, cb: 1, f: 1 } }] }],
    });
    expect("substitutions_ar" in without.members[0].meals[0]).toBe(false);
    expect("notes_ar" in without.members[0].meals[0]).toBe(false);
  });

  it("returns malformed input unchanged for zod to reject", () => {
    expect(expandTerseDaySlice(null)).toBeNull();
    expect(expandTerseDaySlice("nope")).toBe("nope");
    expect(expandTerseDaySlice({ foo: 1 })).toEqual({ foo: 1 });
  });
});
