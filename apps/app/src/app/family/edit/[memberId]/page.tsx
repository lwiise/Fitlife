import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { AdultWizard } from "../../add/wizards/AdultWizard";
import { ChildWizard } from "../../add/wizards/ChildWizard";
import { PregnantWizard } from "../../add/wizards/PregnantWizard";
import { LactatingWizard } from "../../add/wizards/LactatingWizard";
import type { MemberWizardInitial } from "../../add/MemberWizard";

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

  if (!m || m.role === "housekeeper") redirect("/family");

  const type = (m.member_type ?? "adult") as
    | "adult"
    | "child"
    | "pregnant"
    | "lactating"
    | "housekeeper";

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
  };

  const common = { role: m.role, editMemberId: memberId, initial };
  switch (type) {
    case "child":
      return <ChildWizard {...common} />;
    case "pregnant":
      return <PregnantWizard {...common} />;
    case "lactating":
      return <LactatingWizard {...common} />;
    default:
      return <AdultWizard {...common} />;
  }
}
