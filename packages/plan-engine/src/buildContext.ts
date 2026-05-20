import type { SupabaseClient } from "@supabase/supabase-js";
import { OnboardingIncompleteError, MedicalGateError } from "./errors";

// Accepts any Supabase client shape — the app's <Database>-typed cookie client
// or the plain service-role admin client. The engine queries untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

type Activity = "sedentary" | "light" | "moderate" | "active" | "very_active" | null;

export interface PlanPromptContextMom {
  id: string;
  display_name: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: Activity;
  primary_goal: string | null;
  dietary_restrictions: string[];
  cuisine_preference: string;
  medical_conditions: string[];
  is_pregnant: boolean;
  pregnancy_trimester: number | null;
  consulted_doctor: boolean;
}

export interface PlanPromptContextMember {
  id: string;
  name: string;
  role: string;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: Activity;
  primary_goal: string | null;
  dietary_restrictions: string[];
  preferred_language: string;
}

export interface PlanPromptContext {
  mom: PlanPromptContextMom;
  family_members: PlanPromptContextMember[];
  composition_summary: string;
}

function ageFromBirthYear(birthYear: number | null): number | null {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
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
  if ((hasMedical || profile.is_pregnant) && !profile.consulted_doctor) {
    throw new MedicalGateError();
  }

  const { data: family } = await supabase
    .from("family_members")
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  const mom: PlanPromptContextMom = {
    id: profile.id,
    display_name: profile.display_name,
    age: ageFromBirthYear(profile.birth_year),
    height_cm: profile.height_cm,
    weight_kg: profile.weight_kg,
    activity_level: (profile.activity_level ?? null) as Activity,
    primary_goal: profile.primary_goal,
    dietary_restrictions: profile.dietary_restrictions ?? [],
    cuisine_preference: profile.cuisine_preference,
    medical_conditions: medicalConditions,
    is_pregnant: profile.is_pregnant,
    pregnancy_trimester: profile.pregnancy_trimester,
    consulted_doctor: profile.consulted_doctor,
  };

  const family_members: PlanPromptContextMember[] = (family ?? []).map(
    (m: Record<string, unknown>) => ({
      id: m.id as string,
      name: m.name as string,
      role: m.role as string,
      age: ageFromBirthYear((m.birth_year as number | null) ?? null),
      height_cm: (m.height_cm as number | null) ?? null,
      weight_kg: (m.weight_kg as number | null) ?? null,
      activity_level: ((m.activity_level as string | null) ?? null) as Activity,
      primary_goal: (m.primary_goal as string | null) ?? null,
      dietary_restrictions: (m.dietary_restrictions as string[] | null) ?? [],
      preferred_language: m.preferred_language as string,
    }),
  );

  return {
    mom,
    family_members,
    composition_summary: buildCompositionSummary(family_members),
  };
}
