import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { MomWizard } from "./MomWizard";

export const metadata = { title: "ملفك الشخصي" };

export default async function MomOnboardingPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/login");
  // The personal wizard is the FIRST onboarding screen — the family-wide
  // questions moved after the members step and only appear for multi-person
  // households.
  // Mom already done → hand back to the onboarding router, which sends her into
  // the add-a-member loop (/onboarding/members) when the plan isn't generated
  // yet, or to /dashboard once it is. Don't skip straight to /plan (old flow).
  if (profile.mom_profile_completed_at) redirect("/onboarding");

  // Restore what she already answered. The first three steps save
  // progressively (saveProfileStep), but the wizard was mounted with no props
  // — so those writes were effectively write-only: abandoning at step 8 and
  // coming back meant retyping name, birth year, height, weight, waist, target
  // weight and activity level, all of which were already on her row. This is
  // the top-of-funnel drop-off surface, so re-asking is expensive.
  //
  // Only genuinely-persisted columns are passed. The goal and the health
  // answers still land at final submit (primary_goal is the SARA-mapped value,
  // and the mapping needs the medical answers from later steps), so there is
  // nothing to restore for them yet.
  return (
    <MomWizard
      saved={{
        sex: profile.sex,
        display_name: profile.display_name,
        birth_year: profile.birth_year,
        phone: profile.phone,
        height_cm: profile.height_cm,
        weight_kg: profile.weight_kg,
        waist_cm: profile.waist_cm,
        hip_cm: profile.hip_cm,
        target_weight_kg: profile.target_weight_kg,
        activity_level: profile.activity_level,
      }}
    />
  );
}
