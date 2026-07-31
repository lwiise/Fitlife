/**
 * Builds the family-of-three the way the app builds it — through the same tables,
 * the same columns and (crucially) the same RLS policies, using the test user's
 * own session rather than the service-role key.
 *
 * Why not call the app's server actions directly? Next.js Server Actions are
 * addressed by an encrypted, per-build action id; there is no stable HTTP contract
 * to call from a test process. Driving the 10–11 step adaptive wizard UI for every
 * member would test the wizard, not the family model, and would be brittle against
 * an Arabic UI with no test ids. So the wizard is covered separately (see the UI
 * spec) and the family model is exercised here at the layer the wizard writes to.
 *
 * Column choice is deliberately conservative: only columns from migrations
 * 00001–00007, which CLAUDE.md records as verified-applied in production. That
 * keeps the suite runnable against a stack that has not yet applied 00013+.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { asUser } from "./supabase.js";
import { CHILD, FAMILY_MEMBERS, HOUSEKEEPER, HUSBAND, MOM, type MemberSpec } from "./scenario.js";

export interface FamilyMemberRow {
  id: string;
  user_id: string;
  name: string;
  role: string;
  member_type: string;
  sex: string | null;
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string | null;
  primary_goal: string | null;
  preferred_language: string;
  meal_mode: string;
  display_order: number;
}

export interface ProfileRow {
  id: string;
  display_name: string | null;
  sex: string | null;
  member_type: string;
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string | null;
  primary_goal: string | null;
  preferred_language: string;
  mom_profile_completed_at: string | null;
  onboarding_completed_at: string | null;
}

/**
 * Complete the owner's own profile — the equivalent of finishing the mom wizard.
 * Mirrors the fields `saveMomProfile` persists, minus the 00013+ questionnaire
 * columns.
 */
export async function completeMomProfile(accessToken: string, userId: string): Promise<void> {
  const db = asUser(accessToken);
  const { error } = await db
    .from("profiles")
    .update({
      display_name: MOM.display_name,
      sex: MOM.sex,
      member_type: MOM.member_type,
      birth_year: MOM.birth_year,
      height_cm: MOM.height_cm,
      weight_kg: MOM.weight_kg,
      activity_level: MOM.activity_level,
      primary_goal: MOM.primary_goal,
      preferred_language: MOM.preferred_language,
      cuisine_preference: "khaleeji",
      has_medical_conditions: false,
      medical_conditions: [],
      dietary_restrictions: [],
      allergies: [],
      dislikes: [],
      is_pregnant: false,
      consulted_doctor: false,
      mom_profile_completed_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(`completeMomProfile failed: ${error.message}`);
}

/** Insert one member, mirroring the shape `buildMemberRow` produces. */
export async function addMember(
  accessToken: string,
  userId: string,
  spec: MemberSpec,
  displayOrder: number,
): Promise<FamilyMemberRow> {
  const db = asUser(accessToken);
  const { data, error } = await db
    .from("family_members")
    .insert({
      user_id: userId,
      name: spec.name,
      role: spec.role,
      member_type: spec.member_type,
      sex: spec.sex,
      birth_year: spec.birth_year,
      height_cm: spec.height_cm,
      weight_kg: spec.weight_kg,
      activity_level: spec.activity_level,
      primary_goal: spec.primary_goal,
      preferred_language: spec.preferred_language,
      meal_mode: spec.meal_mode,
      medical_conditions: [],
      dietary_restrictions: [],
      allergies: [],
      dislikes: [],
      consulted_doctor: false,
      display_order: displayOrder,
    })
    .select()
    .single();

  if (error) throw new Error(`addMember(${spec.name}/${spec.role}) failed: ${error.message}`);
  return data as FamilyMemberRow;
}

/** Husband, child, and the housekeeper — in the order the household adds them. */
export async function addFamilyMembers(
  accessToken: string,
  userId: string,
): Promise<FamilyMemberRow[]> {
  const rows: FamilyMemberRow[] = [];
  for (const [index, spec] of FAMILY_MEMBERS.entries()) {
    rows.push(await addMember(accessToken, userId, spec, index));
  }
  return rows;
}

/** Equivalent of `finishOnboardingToSubscription`'s profile write. */
export async function markOnboardingComplete(
  accessToken: string,
  userId: string,
): Promise<void> {
  const db = asUser(accessToken);
  const { error } = await db
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(`markOnboardingComplete failed: ${error.message}`);
}

export async function fetchProfile(
  accessToken: string,
  userId: string,
): Promise<ProfileRow> {
  const db: SupabaseClient = asUser(accessToken);
  const { data, error } = await db
    .from("profiles")
    .select(
      "id, display_name, sex, member_type, birth_year, height_cm, weight_kg, activity_level, primary_goal, preferred_language, mom_profile_completed_at, onboarding_completed_at",
    )
    .eq("id", userId)
    .single();
  if (error) throw new Error(`fetchProfile failed: ${error.message}`);
  return data as ProfileRow;
}

export async function fetchFamilyMembers(
  accessToken: string,
  userId: string,
): Promise<FamilyMemberRow[]> {
  const db = asUser(accessToken);
  const { data, error } = await db
    .from("family_members")
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true });
  if (error) throw new Error(`fetchFamilyMembers failed: ${error.message}`);
  return (data ?? []) as FamilyMemberRow[];
}

/**
 * Reimplementation of `lib/subscription/access.ts#countBeneficiaries`:
 * mom (always 1) + every non-housekeeper member. Written out rather than
 * imported because importing it would pull in `server-only` and the app's env
 * validation — and because a test that restates the rule independently is the
 * point.
 */
export function countBeneficiaries(members: FamilyMemberRow[]): number {
  return members.filter((m) => m.role !== "housekeeper").length + 1;
}

export const EXPECTED_MEMBER_SPECS = { HUSBAND, CHILD, HOUSEKEEPER };
