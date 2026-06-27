import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { mapSaraGoalToUser, type SaraGoal } from "@/lib/plans/goalMapping";
import { MomExerciseWizard } from "./MomExerciseWizard";

export const metadata = {
  title: "خطة التمارين — فت لايف",
  robots: { index: false, follow: false },
};

export default async function MomExercisePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.onboarding_completed_at) redirect("/onboarding");
  // Already opted in (profile saved) → nothing to collect here.
  if (profile.exercise_profile) redirect("/plan");

  const age =
    profile.birth_year && profile.birth_year > 0
      ? new Date().getFullYear() - profile.birth_year
      : 0;
  const memberType =
    profile.member_type === "pregnant" || profile.member_type === "lactating"
      ? profile.member_type
      : "adult";
  const conditions = profile.medical_conditions ?? [];
  const userGoal = mapSaraGoalToUser(
    (profile.primary_goal as SaraGoal | null) ?? "body_recomposition",
  );
  const goalIsSpecific = userGoal === "build_muscle" || userGoal === "athletic";

  return (
    <MomExerciseWizard
      reused={{
        member_type: memberType,
        age,
        activity_level: profile.activity_level,
        conditions,
        goalIsSpecific,
      }}
    />
  );
}
