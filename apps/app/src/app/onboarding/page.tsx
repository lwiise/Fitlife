import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
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

  return <OnboardingWizard initialProfile={profile} />;
}
