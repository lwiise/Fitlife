import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";

export const metadata = {
  title: "البدء",
};

/**
 * /onboarding is a router: it sends the user to the right phase based on their
 * progress, so the URL always does the right thing whether they're mid-flow or
 * returning later.
 *   family_wide_completed_at null → family-wide (5 Qs)
 *   mom_profile_completed_at  null → mom (8 Qs)
 *   onboarding_completed_at   null → members (add-a-member loop, then generate)
 *   otherwise                       → dashboard (family management is optional)
 */
export default async function OnboardingPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/login");

  if (!profile.family_wide_completed_at) redirect("/onboarding/family-wide");
  if (!profile.mom_profile_completed_at) redirect("/onboarding/mom");
  // Mom done but the plan isn't generated yet → the add-a-member loop, where she
  // adds the rest of the family and then generates everyone at once.
  if (!profile.onboarding_completed_at) redirect("/onboarding/members");
  redirect("/dashboard");
}
