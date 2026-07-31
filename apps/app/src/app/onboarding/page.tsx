import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { isValidTier, isValidCadence } from "@/lib/tierIntent";

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
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; cadence?: string }>;
}) {
  const [{ tier, cadence }, profile] = await Promise.all([
    searchParams,
    getCurrentUserProfile(),
  ]);
  if (!profile) redirect("/auth/login");

  // Tier intent from a landing-page CTA. LoginForm builds
  // /onboarding?tier=…&cadence=… after signup, but this router took no
  // searchParams at all, so the choice the visitor made on the marketing page
  // evaporated the moment they arrived and they picked a plan again from
  // scratch. Carried through the wizard and honoured at the pricing step.
  const intent =
    isValidTier(tier) && isValidCadence(cadence)
      ? `?tier=${tier}&cadence=${cadence}`
      : "";

  if (!profile.mom_profile_completed_at) redirect(`/onboarding/mom${intent}`);
  // Personal profile done but the plan isn't generated yet → the add-a-member
  // loop, where the family is added and everyone generates at once.
  if (!profile.onboarding_completed_at) redirect(`/onboarding/members${intent}`);
  redirect(`/dashboard${intent}`);
}
