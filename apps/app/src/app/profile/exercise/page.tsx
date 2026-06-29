import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { mapSaraGoalToUser, type SaraGoal } from "@/lib/plans/goalMapping";
import { ExerciseEditWizard } from "@/components/exercise/ExerciseEditWizard";
import { updateMomExerciseProfile } from "@/app/onboarding/actions";
import type { ExerciseProfile } from "@/lib/exercise/types";

export const metadata = {
  title: "تعديل خطة التمارين — فت لايف",
  robots: { index: false, follow: false },
};

export default async function EditMomExercisePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.onboarding_completed_at) redirect("/onboarding");
  // The edit page only exists once she has opted in — otherwise nothing to edit
  // (the /plan banner / onboarding flow is where opt-in happens).
  if (!profile.exercise_profile) redirect("/profile");

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
    <ExerciseEditWizard
      reused={{
        member_type: memberType,
        age,
        activity_level: profile.activity_level,
        conditions,
        goalIsSpecific,
      }}
      initialProfile={profile.exercise_profile as unknown as ExerciseProfile}
      save={updateMomExerciseProfile}
      doneHref="/profile?edited=exercise"
      cancelHref="/profile"
    />
  );
}
