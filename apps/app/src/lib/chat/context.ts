import "server-only";

import type { MealPlan } from "@fitlife/plan-engine";
import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
} from "@/lib/supabase/queries";
import { getLatestPlan } from "@/lib/plans/getLatestPlan";

/** Render a jsonb-ish value (usually a string[]) as a compact comma list. */
function list(value: unknown): string {
  if (Array.isArray(value)) {
    const items = value
      .map((v) => (typeof v === "string" ? v : typeof v === "object" && v && "name_ar" in v ? String((v as { name_ar: unknown }).name_ar) : ""))
      .filter(Boolean);
    return items.length ? items.join("، ") : "لا شيء";
  }
  return "لا شيء";
}

function strList(value: string[] | null | undefined): string {
  return value && value.length ? value.join("، ") : "لا شيء";
}

function lifeStage(m: {
  member_type?: string | null;
  trimester?: number | null;
  months_postpartum?: number | null;
  high_risk_pregnancy?: boolean | null;
}): string {
  if (m.member_type === "pregnant") {
    return `حامل${m.trimester ? ` (الثلث ${m.trimester})` : ""}${m.high_risk_pregnancy ? " — حمل عالي الخطورة" : ""}`;
  }
  if (m.member_type === "lactating") {
    return `مرضع${m.months_postpartum != null ? ` (${m.months_postpartum} شهر بعد الولادة)` : ""}`;
  }
  if (m.member_type === "child") return "طفل";
  return "";
}

function planSummary(plan: MealPlan): string {
  const lines: string[] = [`الخطة الحالية (أسبوع يبدأ ${plan.week_start_date}):`];
  for (const member of plan.members) {
    const macros = member.macros_target;
    lines.push(
      `- ${member.member_name_ar}: هدف يومي ~${member.daily_calories_target} سعرة (بروتين ${macros.protein_g}جم · كارب ${macros.carbs_g}جم · دهون ${macros.fat_g}جم)`,
    );
    for (const day of member.days) {
      if (day.meals.length === 0) continue;
      const meals = day.meals
        .map((meal) => `${meal.slot_name_ar}: ${meal.recipe_name_ar}`)
        .join(" / ");
      lines.push(`    ${day.day_name_ar}: ${meals}`);
    }
  }
  return lines.join("\n");
}

/**
 * Assemble a COMPACT Arabic summary of the caller's household for the advisor
 * chat — read with the RLS-scoped client (via the query helpers), so it can only
 * ever describe the caller's own family. Deliberately a summary (roster + the
 * current plan's meal NAMES + per-member targets), never the raw plan_data jsonb,
 * to stay inside the token budget.
 */
export async function buildHouseholdContext(userId: string): Promise<string> {
  const [profile, family, latest] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentUserFamilyMembers(),
    getLatestPlan(userId),
  ]);

  const sections: string[] = [];

  if (profile) {
    sections.push(
      [
        "صاحبة الحساب:",
        `- الاسم: ${profile.display_name ?? "غير محدد"}`,
        `- الهدف: ${profile.primary_goal ?? "غير محدد"}`,
        `- المطبخ المفضل: ${profile.cuisine_preference ?? "غير محدد"}`,
        `- الحساسيات: ${list(profile.allergies)}`,
        `- أطعمة لا تحبها: ${list(profile.dislikes)}`,
        `- قيود غذائية: ${strList(profile.dietary_restrictions)}`,
        `- حالات طبية: ${strList(profile.medical_conditions)}${profile.consulted_doctor ? " (راجعت الطبيب)" : ""}`,
        profile.is_pregnant
          ? `- الحمل: نعم${profile.pregnancy_trimester ? ` (الثلث ${profile.pregnancy_trimester})` : ""}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const beneficiaries = family.filter((m) => m.role !== "housekeeper");
  if (beneficiaries.length) {
    const roster = beneficiaries.map((m) => {
      const stage = lifeStage(m);
      return [
        `- ${m.name} (${m.role}${stage ? `، ${stage}` : ""}):`,
        `حساسيات: ${list(m.allergies)}`,
        `قيود: ${strList(m.dietary_restrictions)}`,
        `حالات طبية: ${strList(m.medical_conditions)}`,
      ].join(" ");
    });
    sections.push(["أفراد الأسرة:", ...roster].join("\n"));
  }

  if (latest?.status === "ready" && latest.plan_data) {
    sections.push(planSummary(latest.plan_data));
  } else {
    sections.push("لا توجد خطة حالية جاهزة بعد.");
  }

  return sections.join("\n\n");
}
