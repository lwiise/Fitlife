import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { MomWizard } from "./MomWizard";

export const metadata = { title: "ملفك الشخصي" };

export default async function MomOnboardingPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/login");
  // Must finish the family-wide screen first.
  if (!profile.family_wide_completed_at) redirect("/onboarding/family-wide");
  if (profile.mom_profile_completed_at) redirect("/plan");

  return <MomWizard />;
}
