import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";

export const metadata = {
  title: "البدء",
};

/**
 * /onboarding is a router: it sends the user to the right phase based on their
 * progress, so the URL always does the right thing whether they're mid-flow or
 * returning later.
 *   mom_profile_completed_at null → the personal wizard (first thing they see)
 *   onboarding_completed_at  null → members (add-a-member loop, then generate)
 *   otherwise                      → dashboard (family management is optional)
 * The family-wide questions are NOT a gate anymore: the members flow routes
 * through /onboarding/family-wide, which renders the 5 questions only when the
 * household has more than one person and skips itself otherwise.
 */
export default async function OnboardingPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/login");

  if (!profile.mom_profile_completed_at) redirect("/onboarding/mom");
  // Personal profile done but the plan isn't generated yet → the add-a-member
  // loop, where the family is added and everyone generates at once.
  if (!profile.onboarding_completed_at) redirect("/onboarding/members");
  redirect("/dashboard");
}
