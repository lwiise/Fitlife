import type { SupabaseClient } from "@supabase/supabase-js";
import { OnboardingIncompleteError, MedicalGateError } from "./errors";

// Accepts any Supabase client shape — the app's <Database>-typed cookie client
// or the plain service-role admin client. The engine queries untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

type Activity = "sedentary" | "light" | "moderate" | "active" | "very_active" | null;

// Sara's "no plan without doctor sign-off" conditions. Most aren't captured by
// the current onboarding yet (Prompt 1.8c expands it) — the check is ?.-safe and
// OR'd with the existing broad gate, so today's behavior is unchanged and it's
// ready to enforce these as soon as onboarding surfaces them.
export const HIGH_RISK_MEDICAL_FLAGS = [
  "unstable_diabetes",
  "uncontrolled_hypertension",
  "heart_disease",
  "kidney_disease",
  "liver_disease",
  "unstable_thyroid",
  "severe_food_allergy",
  "acute_digestive",
  "eating_disorder",
  "post_surgical",
  "unexplained_symptoms",
];

export interface PlanPromptContextMom {
  id: string;
  display_name: string | null;
  sex: string | null;
  member_type: string;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: Activity;
  primary_goal: string | null;
  dietary_restrictions: string[];
  cuisine_preference: string;
  medical_conditions: string[];
  allergies: string[];
  dislikes: string[];
  is_pregnant: boolean;
  pregnancy_trimester: number | null;
  months_postpartum: number | null;
  high_risk_pregnancy: boolean;
  consulted_doctor: boolean;
}

export interface PlanPromptContextMember {
  id: string;
  name: string;
  role: string;
  member_type: string;
  sex: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: Activity;
  primary_goal: string | null;
  dietary_restrictions: string[];
  medical_conditions: string[];
  allergies: string[];
  dislikes: string[];
  trimester: number | null;
  months_postpartum: number | null;
  high_risk_pregnancy: boolean;
  school_meal_handling: string | null;
  picky_eater: boolean;
  consulted_doctor: boolean;
  is_child: boolean;
  preferred_language: string;
}

export interface PlanPromptContextFamilyWide {
  dietary_restrictions: string[];
  dislikes: string[];
  cooking_methods: string[];
  meal_out_frequency: string | null;
}

export interface PlanPromptContext {
  mom: PlanPromptContextMom;
  family_members: PlanPromptContextMember[];
  family_wide: PlanPromptContextFamilyWide;
  composition_summary: string;
}

function ageFromBirthYear(birthYear: number | null): number | null {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}

/** jsonb columns come back as unknown JSON — coerce to a string[] defensively. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function arabicNumber(n: number): string {
  return new Intl.NumberFormat("ar-SA", { useGrouping: false }).format(n);
}

function pluralizeAr(count: number, singular: string, dual: string, plural: string) {
  if (count === 1) return singular;
  if (count === 2) return dual;
  return plural;
}

function buildCompositionSummary(members: PlanPromptContextMember[]): string {
  const partners = members.filter((m) => m.role === "dad");
  const kids = members.filter((m) => m.role === "son" || m.role === "daughter");
  const housekeepers = members.filter((m) => m.role === "housekeeper");

  const totalCount = 1 + partners.length + kids.length;

  const parts: string[] = [
    `عائلة من ${arabicNumber(totalCount)} ${pluralizeAr(totalCount, "فرد", "فردين", "أفراد")}: الأم`,
  ];
  if (partners.length > 0) parts.push("الأب");
  if (kids.length > 0) {
    const ages = kids.map((k) => k.age).filter((a): a is number => a !== null);
    if (ages.length === kids.length && kids.length > 0) {
      parts.push(
        `و${pluralizeAr(kids.length, "طفل", "طفلان", "أطفال")} (${ages
          .map((a) => `${arabicNumber(a)} سنة`)
          .join("، ")})`,
      );
    } else {
      parts.push(
        `و${arabicNumber(kids.length)} ${pluralizeAr(kids.length, "طفل", "طفلان", "أطفال")}`,
      );
    }
  }

  let summary = parts.join("، ") + ".";
  if (housekeepers.length > 0) {
    summary +=
      " يوجد خادمة تطبخ للعائلة وتنفذ الوصفات (ليست من المستفيدين من الخطة الغذائية).";
  }
  return summary;
}

/**
 * Build the prompt context for a user from their profile + family members,
 * using an injected Supabase client (cookie-bound in a request, or service-role
 * in a background function). Queries by explicit userId — no cookie helpers.
 *
 * Throws:
 *  - OnboardingIncompleteError if no profile or onboarding_completed_at is null
 *  - MedicalGateError if medical conditions / pregnancy but doctor not consulted
 */
export async function buildPlanContext(
  supabase: AnyClient,
  userId: string,
): Promise<PlanPromptContext> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new OnboardingIncompleteError();
  }
  if (!profile.onboarding_completed_at) {
    throw new OnboardingIncompleteError();
  }

  const medicalConditions: string[] = profile.medical_conditions ?? [];
  const hasMedical =
    profile.has_medical_conditions || medicalConditions.length > 0;
  const hasHighRiskFlag = medicalConditions.some((c: string) =>
    HIGH_RISK_MEDICAL_FLAGS.includes(c),
  );
  const isHighRiskPregnancy =
    !!profile.is_pregnant && !!profile.high_risk_pregnancy;
  if (
    (hasMedical ||
      profile.is_pregnant ||
      hasHighRiskFlag ||
      isHighRiskPregnancy) &&
    !profile.consulted_doctor
  ) {
    throw new MedicalGateError();
  }

  const { data: family } = await supabase
    .from("family_members")
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  // Per-member medical gate: a family member with a high-risk condition or a
  // high-risk pregnancy may not get a plan until their own doctor sign-off.
  for (const m of (family ?? []) as Record<string, unknown>[]) {
    const conds = toStringArray(m.medical_conditions);
    const memberHighRisk =
      conds.some((c) => HIGH_RISK_MEDICAL_FLAGS.includes(c)) ||
      !!m.high_risk_pregnancy;
    if (memberHighRisk && m.consulted_doctor !== true) {
      throw new MedicalGateError();
    }
  }

  const mom: PlanPromptContextMom = {
    id: profile.id,
    display_name: profile.display_name,
    sex: profile.sex ?? null,
    member_type: profile.member_type ?? "adult",
    age: ageFromBirthYear(profile.birth_year),
    height_cm: profile.height_cm,
    weight_kg: profile.weight_kg,
    activity_level: (profile.activity_level ?? null) as Activity,
    primary_goal: profile.primary_goal,
    dietary_restrictions: profile.dietary_restrictions ?? [],
    cuisine_preference: profile.cuisine_preference,
    medical_conditions: medicalConditions,
    allergies: toStringArray(profile.allergies),
    dislikes: toStringArray(profile.dislikes),
    is_pregnant: profile.is_pregnant,
    pregnancy_trimester: profile.pregnancy_trimester,
    months_postpartum: profile.months_postpartum ?? null,
    high_risk_pregnancy: !!profile.high_risk_pregnancy,
    consulted_doctor: profile.consulted_doctor,
  };

  const family_members: PlanPromptContextMember[] = (family ?? []).map(
    (m: Record<string, unknown>) => {
      const age = ageFromBirthYear((m.birth_year as number | null) ?? null);
      const memberType = (m.member_type as string | null) ?? "adult";
      return {
        id: m.id as string,
        name: m.name as string,
        role: m.role as string,
        member_type: memberType,
        sex: (m.sex as string | null) ?? null,
        age,
        height_cm: (m.height_cm as number | null) ?? null,
        weight_kg: (m.weight_kg as number | null) ?? null,
        activity_level: ((m.activity_level as string | null) ?? null) as Activity,
        primary_goal: (m.primary_goal as string | null) ?? null,
        dietary_restrictions: toStringArray(m.dietary_restrictions),
        medical_conditions: toStringArray(m.medical_conditions),
        allergies: toStringArray(m.allergies),
        dislikes: toStringArray(m.dislikes),
        trimester: (m.trimester as number | null) ?? null,
        months_postpartum: (m.months_postpartum as number | null) ?? null,
        high_risk_pregnancy: !!m.high_risk_pregnancy,
        school_meal_handling: (m.school_meal_handling as string | null) ?? null,
        picky_eater: !!m.picky_eater,
        consulted_doctor: m.consulted_doctor === true,
        is_child: memberType === "child" || (age != null && age < 18),
        preferred_language: m.preferred_language as string,
      };
    },
  );

  const family_wide: PlanPromptContextFamilyWide = {
    dietary_restrictions: toStringArray(profile.family_dietary_restrictions),
    dislikes: toStringArray(profile.family_dislikes),
    cooking_methods: toStringArray(profile.cooking_methods),
    meal_out_frequency: profile.meal_out_frequency ?? null,
  };

  return {
    mom,
    family_members,
    family_wide,
    composition_summary: buildCompositionSummary(family_members),
  };
}

export interface Beneficiary {
  /** "mom" (the profile owner) or a family_members.id (uuid string). */
  member_id: string;
  member_name_ar: string;
  role: string;
}

/**
 * The members who each get their own plan: the mom, plus every family member
 * except the housekeeper (she executes the recipes but isn't a beneficiary).
 * Used to fan out one Anthropic call per person and to assemble the result, so
 * prompt-building and assembly agree on ids/names/order.
 */
export function getBeneficiaries(context: PlanPromptContext): Beneficiary[] {
  const list: Beneficiary[] = [
    {
      member_id: "mom",
      member_name_ar: context.mom.display_name ?? "العميلة",
      role: "mom",
    },
  ];
  for (const m of context.family_members) {
    if (m.role === "housekeeper") continue;
    list.push({
      member_id: m.id,
      member_name_ar: m.name,
      role: m.role,
    });
  }
  return list;
}
