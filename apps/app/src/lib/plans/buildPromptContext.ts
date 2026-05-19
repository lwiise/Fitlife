import "server-only";

import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
} from "@/lib/supabase/queries";
import { OnboardingIncompleteError, MedicalGateError } from "./errors";

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

function buildCompositionSummary(
  mom: PlanPromptContextMom,
  members: PlanPromptContextMember[],
): string {
  const partners = members.filter((m) => m.role === "dad");
  const kids = members.filter((m) => m.role === "son" || m.role === "daughter");
  const housekeepers = members.filter((m) => m.role === "housekeeper");

  const totalCount =
    1 + partners.length + kids.length; // housekeeper is NOT a beneficiary

  const parts: string[] = [
    `عائلة من ${arabicNumber(totalCount)} ${pluralizeAr(totalCount, "فرد", "فردين", "أفراد")}: الأم`,
  ];
  if (partners.length > 0) parts.push("الأب");
  if (kids.length > 0) {
    const ages = kids
      .map((k) => k.age)
      .filter((a): a is number => a !== null);
    if (ages.length === kids.length && kids.length > 0) {
      parts.push(
        `و${pluralizeAr(kids.length, "طفل", "طفلان", "أطفال")} (${ages
          .map((a) => `${arabicNumber(a)} سنة`)
          .join("، ")})`,
      );
    } else {
      parts.push(`و${arabicNumber(kids.length)} ${pluralizeAr(kids.length, "طفل", "طفلان", "أطفال")}`);
    }
  }

  let summary = parts.join("، ") + ".";

  if (housekeepers.length > 0) {
    summary +=
      " يوجد خادمة تطبخ للعائلة وتنفذ الوصفات (ليست من المستفيدين من الخطة الغذائية).";
  }

  // Silence unused-var lint for `mom` — kept in signature for future use.
  void mom;

  return summary;
}

/**
 * Assemble the prompt context from the authenticated user's profile + family.
 *
 * Throws:
 *  - OnboardingIncompleteError if profiles.onboarding_completed_at is null
 *  - MedicalGateError if user has medical conditions or is pregnant but has
 *    not confirmed they consulted their doctor
 *
 * The `userId` argument is used for an explicit safety assertion: the cookie-
 * bound profile must match the requested user. RLS already enforces this, but
 * the assert catches mistakes earlier.
 */
export async function buildPromptContext(userId: string): Promise<PlanPromptContext> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    throw new OnboardingIncompleteError();
  }
  if (profile.id !== userId) {
    // Should not happen under RLS, but a defensive check makes mistakes loud.
    throw new Error("Profile mismatch");
  }
  if (!profile.onboarding_completed_at) {
    throw new OnboardingIncompleteError();
  }

  const medicalConditions = profile.medical_conditions ?? [];
  const hasMedical =
    profile.has_medical_conditions || medicalConditions.length > 0;
  const isPregnant = profile.is_pregnant;
  if ((hasMedical || isPregnant) && !profile.consulted_doctor) {
    throw new MedicalGateError();
  }

  const family = await getCurrentUserFamilyMembers();

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

  const family_members: PlanPromptContextMember[] = family.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    age: ageFromBirthYear(m.birth_year),
    height_cm: m.height_cm,
    weight_kg: m.weight_kg,
    activity_level: (m.activity_level ?? null) as Activity,
    primary_goal: m.primary_goal,
    dietary_restrictions: m.dietary_restrictions ?? [],
    preferred_language: m.preferred_language,
  }));

  return {
    mom,
    family_members,
    composition_summary: buildCompositionSummary(mom, family_members),
  };
}
