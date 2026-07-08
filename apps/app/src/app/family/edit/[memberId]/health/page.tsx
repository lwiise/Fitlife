import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { Logo } from "@/components/Logo";
import { BackButton } from "@/components/BackButton";
import { mapSaraGoalToUser, type UserGoal, type SaraGoal } from "@/lib/plans/goalMapping";
import {
  GATE_CONDITIONS,
  STABLE_CONDITIONS,
} from "@/lib/plans/medicalConditions";
import { asStringArray, PREGNANT_CONDITIONS, LACTATING_CONDITIONS } from "../labels";
import { MemberHealthEditForm } from "./MemberHealthEditForm";

type FamilyMemberRow = Database["public"]["Tables"]["family_members"]["Row"];

export const metadata = {
  title: "الصحة والأهداف — فت لايف",
  robots: { index: false, follow: false },
};

export default async function MemberHealthEditPage({
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
  if (m.role === "housekeeper") redirect(`/family/edit/${memberId}`);

  const type = (m.member_type ?? "adult") as
    | "adult"
    | "child"
    | "pregnant"
    | "lactating";

  // Split stored conditions into the known pills (per type) vs the free-text note,
  // mirroring how the mom health page reconstructs its form state.
  const knownSlugs = new Set(
    type === "adult"
      ? [...GATE_CONDITIONS, ...STABLE_CONDITIONS].map((c) => c.slug)
      : type === "pregnant"
        ? PREGNANT_CONDITIONS.map((c) => c.slug)
        : type === "lactating"
          ? LACTATING_CONDITIONS.map((c) => c.slug)
          : [], // children have no condition pills
  );
  const stored = m.medical_conditions ?? [];
  const conditions = stored.filter((c) => knownSlugs.has(c));
  const otherCondition = stored.filter((c) => !knownSlugs.has(c)).join("، ");

  const userGoal: UserGoal | undefined =
    type === "adult" && m.primary_goal
      ? mapSaraGoalToUser(m.primary_goal as SaraGoal)
      : undefined;

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <a
            href="/dashboard"
            aria-label="فت لايف — الرئيسية"
            className="inline-flex items-center rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Logo className="h-9 w-auto" />
          </a>
          <BackButton href={`/family/edit/${memberId}`} />
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl">
        <MemberHealthEditForm
          memberId={memberId}
          type={type}
          initial={{
            activity_level: m.activity_level,
            day_nature: m.day_nature,
            exercise_days: m.exercise_days,
            exercise_type: m.exercise_type,
            target_weight_kg: m.target_weight_kg,
            water_liters: m.water_liters,
            sleep_hours: m.sleep_hours,
            medications: asStringArray(m.medications),
            supplements: asStringArray(m.supplements),
            nausea_foods: asStringArray(m.nausea_foods),
            feeding_mode: m.feeding_mode,
            user_goal: userGoal,
            allergies: asStringArray(m.allergies),
            dislikes: asStringArray(m.dislikes),
            conditions,
            other_condition: otherCondition,
            consulted_doctor: !!m.consulted_doctor,
            meal_mode: m.meal_mode === "independent" ? "independent" : "shared",
            trimester: m.trimester ?? null,
            high_risk_pregnancy: m.high_risk_pregnancy ?? null,
            months_postpartum: m.months_postpartum ?? null,
            school_meal_handling: m.school_meal_handling ?? null,
            picky_eater: !!m.picky_eater,
          }}
        />
      </div>
    </main>
  );
}
