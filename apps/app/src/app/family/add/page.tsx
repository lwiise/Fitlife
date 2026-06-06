import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { AdultWizard } from "./wizards/AdultWizard";
import { ChildWizard } from "./wizards/ChildWizard";
import { PregLactSwitch } from "./PregLactSwitch";
import { HousekeeperForm } from "./HousekeeperForm";

export const metadata = { title: "إضافة فرد" };

export default async function AddMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/login");
  // Mom must have finished her profile before adding family.
  if (!profile.mom_profile_completed_at) redirect("/onboarding");

  // Onboarding add-a-member loop (plan not generated yet): adds are deferred and
  // the wizard returns to the pop-up at /onboarding/members instead of /plan.
  const onboarding = !profile.onboarding_completed_at;

  switch (type) {
    case "husband":
      return <AdultWizard role="dad" onboarding={onboarding} />;
    case "adult":
      return <AdultWizard role="other_adult" onboarding={onboarding} />;
    case "child":
      return <ChildWizard role="son" onboarding={onboarding} />;
    case "preg":
      return <PregLactSwitch onboarding={onboarding} />;
    case "housekeeper":
      return <HousekeeperForm onboarding={onboarding} />;
    default:
      redirect("/family");
  }
}
