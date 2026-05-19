import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSubscription, getTierLimit } from "@/lib/subscription/state";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata = {
  title: "البدء",
};

export default async function OnboardingPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/login");
  }

  if (profile.onboarding_completed_at) {
    redirect("/dashboard");
  }

  // Fetch the user's current tier so Step 4 can show a soft warning when
  // the household exceeds the tier's person limit.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const subscription = user ? await getCurrentSubscription(user.id) : null;
  const tierLimit = subscription ? getTierLimit(subscription.tier) : 1;

  return <OnboardingWizard initialProfile={profile} tierLimit={tierLimit} />;
}
