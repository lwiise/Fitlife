import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { mapSaraGoalToUser, type SaraGoal } from "@/lib/plans/goalMapping";
import { ExerciseEditWizard } from "@/components/exercise/ExerciseEditWizard";
import { updateMemberExercise } from "../actions";
import type { ExerciseProfile } from "@/lib/exercise/types";

type FamilyMemberRow = Database["public"]["Tables"]["family_members"]["Row"];

export const metadata = {
  title: "تعديل خطة التمارين — فت لايف",
  robots: { index: false, follow: false },
};

export default async function EditMemberExercisePage({
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
  // The maid isn't a plan beneficiary and never has an exercise profile; an edit
  // entry only exists once the member opted in.
  if (m.role === "housekeeper" || !m.exercise_profile) {
    redirect(`/family/edit/${memberId}`);
  }

  const memberType = (m.member_type ?? "adult") as
    | "adult"
    | "child"
    | "pregnant"
    | "lactating";
  const age =
    m.birth_year && m.birth_year > 0
      ? new Date().getFullYear() - m.birth_year
      : 0;
  const conditions = m.medical_conditions ?? [];
  const userGoal = m.primary_goal
    ? mapSaraGoalToUser(m.primary_goal as SaraGoal)
    : undefined;
  const goalIsSpecific = userGoal === "build_muscle" || userGoal === "athletic";

  const save = updateMemberExercise.bind(null, memberId);

  return (
    <ExerciseEditWizard
      reused={{
        member_type: memberType,
        age,
        activity_level: m.activity_level,
        conditions,
        goalIsSpecific,
      }}
      initialProfile={m.exercise_profile as unknown as ExerciseProfile}
      save={save}
      doneHref={`/family/edit/${memberId}?edited=exercise`}
      cancelHref={`/family/edit/${memberId}`}
    />
  );
}
