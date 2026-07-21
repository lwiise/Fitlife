import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { Logo } from "@/components/Logo";
import { BackButton } from "@/components/BackButton";
import { asStringArray } from "../labels";
import { DeepDiveForm } from "./DeepDiveForm";

export const metadata = {
  title: "أسئلة إضافية لخطة أدق — فت لايف",
  robots: { index: false, follow: false },
};

/** Optional post-onboarding lifestyle questionnaire (Coach Sara's deep dive). */
export default async function DeepDivePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/onboarding");

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
        <DeepDiveForm
          initial={{
            waist_cm: profile.waist_cm,
            steps_daily: profile.steps_daily,
            exercise_duration:
              (profile.exercise_duration as "lt30" | "m30_60" | "gt60" | null) ?? null,
            liked_foods: asStringArray(profile.liked_foods),
            meals_per_day: profile.meals_per_day,
            snacks_habit: (profile.snacks_habit as "yes" | "no" | null) ?? null,
            breakfast_habit:
              (profile.breakfast_habit as "regular" | "sometimes" | "never" | null) ??
              null,
            intermittent_fasting:
              (profile.intermittent_fasting as "yes" | "no" | null) ?? null,
            food_recall_24h: profile.food_recall_24h,
            sleep_quality:
              (profile.sleep_quality as "excellent" | "good" | "fair" | "poor" | null) ??
              null,
            stress_level: (profile.stress_level as "low" | "medium" | "high" | null) ?? null,
            who_cooks:
              (profile.who_cooks as "me" | "family_member" | "cook" | "delivery" | null) ??
              null,
            cooking_time: (profile.cooking_time as "lt20" | "m20_40" | "gt40" | null) ?? null,
            previous_diets: profile.previous_diets,
            food_budget: profile.food_budget,
          }}
          ownerSex={profile.sex}
        />
      </div>
    </main>
  );
}
