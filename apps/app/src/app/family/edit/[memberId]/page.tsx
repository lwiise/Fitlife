import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { HousekeeperForm } from "../../add/HousekeeperForm";
import type { MemberWizardInitial } from "../../add/MemberWizard";
import { MemberEditForm } from "./MemberEditForm";
import { mapSaraGoalToUser, type SaraGoal } from "@/lib/plans/goalMapping";

type FamilyMemberRow = Database["public"]["Tables"]["family_members"]["Row"];

export const metadata = { title: "تعديل فرد" };

function toStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: row } = await supabase
    .from("family_members")
    .select("*")
    .eq("id", memberId)
    .eq("user_id", user.id)
    .single();
  const m = row as FamilyMemberRow | null;

  if (!m) redirect("/family");

  // The maid isn't a plan beneficiary — she has only a name + reading language, so
  // she's edited via the HousekeeperForm (prefilled), not the member wizards.
  if (m.role === "housekeeper") {
    return (
      <HousekeeperForm
        editing
        initial={{ name: m.name, preferred_language: m.preferred_language }}
      />
    );
  }

  const type = (m.member_type ?? "adult") as "adult" | "child" | "pregnant" | "lactating";

  const initial: MemberWizardInitial = {
    name: m.name,
    birth_year: m.birth_year ?? undefined,
    sex: m.sex ?? null,
    height_cm: m.height_cm ?? null,
    weight_kg: m.weight_kg ?? null,
    activity_level: m.activity_level ?? null,
    allergies: toStrings(m.allergies),
    dislikes: toStrings(m.dislikes),
    conditions: toStrings(m.medical_conditions),
    trimester: m.trimester ?? null,
    months_postpartum: m.months_postpartum ?? null,
    high_risk_pregnancy: !!m.high_risk_pregnancy,
    school_meal_handling: m.school_meal_handling ?? null,
    picky_eater: !!m.picky_eater,
    consulted_doctor: !!m.consulted_doctor,
    // Pre-select the goal radio from the stored Sara goal (lossy inverse; the real
    // goal is re-derived from the full form on save) and keep the meal mode, so an
    // edit doesn't silently reset them.
    user_goal: m.primary_goal ? mapSaraGoalToUser(m.primary_goal as SaraGoal) : undefined,
    meal_mode: m.meal_mode === "independent" ? "independent" : "shared",
  };

  // Editing shows every field for the member's type on one page (not the
  // step-by-step add wizard). The wizards remain in use for /family/add.
  return (
    <MemberEditForm
      type={type}
      role={m.role}
      editMemberId={memberId}
      initial={initial}
    />
  );
}
