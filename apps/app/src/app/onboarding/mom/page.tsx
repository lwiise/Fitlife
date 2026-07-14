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

  return <MomWizard />;
}
