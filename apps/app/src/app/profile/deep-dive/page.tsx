import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
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
    <main className="container-shell py-6 lg:py-10">
      <div className="mx-auto max-w-2xl">
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
