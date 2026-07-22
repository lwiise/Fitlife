import { describe, it, expect } from "vitest";
import type { MealPlan, MemberPlan, Day, WorkoutPlan } from "@fitlife/plan-engine";
import { applyMemberDisplayNames } from "./memberNames";

function day(di: number): Day {
  return {
    day_index: di,
    day_name_ar: `اليوم ${di + 1}`,
    meals: [
      {
        slot: "breakfast",
        slot_name_ar: "الفطور",
        recipe_name_ar: `d${di}`,
        ingredients: [{ name_ar: "بيض", amount: 2, unit: "piece" }],
        prep_steps_ar: ["اخفقي"],
        calories: 500,
        macros: { protein_g: 30, carbs_g: 50, fat_g: 15 },
      },
    ],
    day_total: { calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15 },
  };
}

function member(id: string, nameAr: string, extra: Partial<MemberPlan> = {}): MemberPlan {
  return {
    member_id: id,
    member_name_ar: nameAr,
    primary_goal: "fat_loss",
    daily_calories_target: 1800,
    macros_target: { protein_g: 120, carbs_g: 180, fat_g: 60 },
    days: [day(0)],
    ...extra,
  };
}

function planWith(members: MemberPlan[]): MealPlan {
  return { week_start_date: "2026-07-17", members };
}

describe("applyMemberDisplayNames", () => {
  it("overlays the live family_members name onto a renamed member", () => {
    const plan = planWith([member("mom", "لؤي"), member("m-2", "أنس")]);
    const out = applyMemberDisplayNames(plan, {
      mom: { display_name: "لؤي" },
      members: [{ id: "m-2", name: "أنس الجديد" }],
    });
    expect(out.members[1]!.member_name_ar).toBe("أنس الجديد");
    // Untouched member is returned by reference.
    expect(out.members[0]!).toBe(plan.members[0]!);
  });

  it("overlays the mom's live display_name (member_id 'mom')", () => {
    const plan = planWith([member("mom", "لؤي القديم")]);
    const out = applyMemberDisplayNames(plan, {
      mom: { display_name: "لؤي" },
      members: [],
    });
    expect(out.members[0]!.member_name_ar).toBe("لؤي");
  });

  it("drops the stale transliteration when the Arabic name changed", () => {
    const plan = planWith([
      member("m-2", "أنس", {
        member_name_translated: "Anas",
        member_name_translated_locale: "en",
      }),
    ]);
    const out = applyMemberDisplayNames(plan, {
      mom: { display_name: "لؤي" },
      members: [{ id: "m-2", name: "خالد" }],
    });
    const m = out.members[0]!;
    expect(m.member_name_ar).toBe("خالد");
    // The old "Anas" transliteration is of the OLD name → cleared so the maid
    // view falls back to the live Arabic name until re-translation.
    expect(m.member_name_translated).toBeUndefined();
    expect(m.member_name_translated_locale).toBeUndefined();
  });

  it("keeps the transliteration when the Arabic name is unchanged", () => {
    const plan = planWith([
      member("m-2", "أنس", {
        member_name_translated: "Anas",
        member_name_translated_locale: "en",
      }),
    ]);
    const out = applyMemberDisplayNames(plan, {
      mom: { display_name: "لؤي" },
      members: [{ id: "m-2", name: "أنس" }],
    });
    // Nothing changed → same plan reference, transliteration preserved.
    expect(out).toBe(plan);
    expect(out.members[0]!.member_name_translated).toBe("Anas");
  });

  it("leaves a member absent from the roster with its snapshot name", () => {
    const plan = planWith([member("removed-member", "سارة")]);
    const out = applyMemberDisplayNames(plan, {
      mom: { display_name: "لؤي" },
      members: [],
    });
    expect(out).toBe(plan); // nothing to overlay → same reference
    expect(out.members[0]!.member_name_ar).toBe("سارة");
  });

  it("ignores blank/whitespace live names (keeps the snapshot name)", () => {
    const plan = planWith([member("m-2", "أنس")]);
    const out = applyMemberDisplayNames(plan, {
      mom: { display_name: "  " },
      members: [{ id: "m-2", name: "   " }],
    });
    expect(out).toBe(plan);
    expect(out.members[0]!.member_name_ar).toBe("أنس");
  });

  it("returns the same reference when every name already matches (idempotent)", () => {
    const plan = planWith([member("mom", "لؤي"), member("m-2", "أنس")]);
    const out = applyMemberDisplayNames(plan, {
      mom: { display_name: "لؤي" },
      members: [{ id: "m-2", name: "أنس" }],
    });
    expect(out).toBe(plan);
  });

  it("overlays workout plan members (no transliteration field)", () => {
    const workout = {
      week_start_date: "2026-07-17",
      members: [
        {
          member_id: "m-2",
          member_name_ar: "أنس",
          split_name_ar: "دفع/سحب",
          weekly_sessions: [],
          progression_notes_ar: "تقدّمي تدريجياً",
        },
      ],
    } as unknown as WorkoutPlan;
    const out = applyMemberDisplayNames(workout, {
      mom: { display_name: "لؤي" },
      members: [{ id: "m-2", name: "خالد" }],
    });
    expect(out.members[0]!.member_name_ar).toBe("خالد");
  });
});
