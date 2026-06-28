import { redirect } from "next/navigation";
import { User } from "lucide-react";
import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
} from "@/lib/supabase/queries";
import { mapSaraGoalToUser, type SaraGoal } from "@/lib/plans/goalMapping";
import type { MomExerciseReused } from "@/app/onboarding/exercise/MomExerciseWizard";
import { Logo } from "@/components/Logo";
import { OnboardingFamilyBuilder } from "./OnboardingFamilyBuilder";

export const metadata = { title: "عائلتك" };

/**
 * Onboarding family builder. Reached after mom finishes her profile (before the plan
 * is generated). Shows the roster behind a composition selector (OnboardingFamilyBuilder):
 * she picks who's in the household, a single CTA walks her through each member's
 * details in order, and the end finalizes onboarding and generates everyone at once.
 */
export default async function OnboardingMembersPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.mom_profile_completed_at) redirect("/onboarding");
  // Already generated (loop finished or returning user) → the plan owns the view.
  if (profile.onboarding_completed_at) redirect("/plan");

  const members = (await getCurrentUserFamilyMembers()).filter(
    (m) => m.role !== "housekeeper",
  );

  // Mom's meal-profile answers, reused by the exercise opt-in (never re-asked).
  // Mirrors the post-gen /onboarding/exercise page so both entry points agree.
  const momMemberType: MomExerciseReused["member_type"] =
    profile.member_type === "pregnant" || profile.member_type === "lactating"
      ? profile.member_type
      : "adult";
  const momUserGoal = mapSaraGoalToUser(
    (profile.primary_goal as SaraGoal | null) ?? "body_recomposition",
  );
  const momReused: MomExerciseReused = {
    member_type: momMemberType,
    age:
      profile.birth_year && profile.birth_year > 0
        ? new Date().getFullYear() - profile.birth_year
        : 0,
    activity_level: profile.activity_level,
    conditions: profile.medical_conditions ?? [],
    goalIsSpecific:
      momUserGoal === "build_muscle" || momUserGoal === "athletic",
  };

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5">
        <div className="container-app py-4">
          <Logo className="h-9 w-auto" />
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl space-y-6">
        <header>
          <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
            عائلتك
          </h1>
          <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
            أضيفي أفراد عائلتك واحداً واحداً، ثم أنشئي الخطة للجميع دفعة واحدة.
          </p>
        </header>

        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-brand-ink/5">
            <div className="size-10 rounded-full bg-brand-pink-light flex items-center justify-center flex-shrink-0">
              <User className="size-5 text-brand-pink" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-brand-ink truncate">
                <span className="text-brand-pink">أنتِ</span>
                {profile.display_name ? ` — ${profile.display_name}` : ""}
              </p>
            </div>
          </div>

          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-brand-ink/5"
            >
              <div className="size-10 rounded-full bg-brand-lavender/40 flex items-center justify-center flex-shrink-0">
                <User className="size-5 text-brand-purple-900" aria-hidden="true" />
              </div>
              <p className="font-bold text-brand-ink truncate flex-1 min-w-0">
                {m.name}
              </p>
            </div>
          ))}
        </div>
      </div>

      <OnboardingFamilyBuilder
        momReused={momReused}
        momHasExercise={!!profile.exercise_profile}
      />
    </main>
  );
}
