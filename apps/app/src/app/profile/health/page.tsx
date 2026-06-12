import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { mapSaraGoalToUser, type UserGoal } from "@/lib/plans/goalMapping";
import {
  GATE_CONDITIONS,
  STABLE_CONDITIONS,
} from "@/lib/plans/medicalConditions";
import { Logo } from "@/components/Logo";
import { BackButton } from "@/components/BackButton";
import { asStringArray } from "../labels";
import { HealthEditForm } from "./HealthEditForm";

export const metadata = {
  title: "الصحة والأهداف — فت لايف",
  robots: { index: false, follow: false },
};

export default async function HealthEditPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/onboarding");

  const knownSlugs = new Set(
    [...GATE_CONDITIONS, ...STABLE_CONDITIONS].map((c) => c.slug),
  );
  const stored = profile.medical_conditions ?? [];
  const conditions = stored.filter((c) => knownSlugs.has(c));
  const otherCondition = stored.filter((c) => !knownSlugs.has(c)).join("، ");

  const pregnancyStatus: "none" | "pregnant" | "lactating" = profile.is_pregnant
    ? "pregnant"
    : profile.member_type === "lactating"
      ? "lactating"
      : "none";

  const userGoal: UserGoal | undefined = profile.primary_goal
    ? mapSaraGoalToUser(profile.primary_goal as never)
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
          <BackButton href="/profile" />
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl">
        <HealthEditForm
          initial={{
            activity_level: profile.activity_level,
            user_goal: userGoal,
            pregnancy_status: pregnancyStatus,
            trimester: profile.pregnancy_trimester ?? null,
            high_risk_pregnancy: profile.high_risk_pregnancy ?? false,
            months_postpartum: profile.months_postpartum ?? null,
            allergies: asStringArray(profile.allergies),
            dislikes: asStringArray(profile.dislikes),
            conditions,
            other_condition: otherCondition,
            consulted_doctor: profile.consulted_doctor,
          }}
        />
      </div>
    </main>
  );
}
