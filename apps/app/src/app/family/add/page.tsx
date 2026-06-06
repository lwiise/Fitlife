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
  searchParams: Promise<{ type?: string; count?: string }>;
}) {
  const { type, count: countParam } = await searchParams;
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/login");
  // Mom must have finished her profile before adding family.
  if (!profile.mom_profile_completed_at) redirect("/onboarding");

  // Onboarding add-a-member loop (plan not generated yet): adds are deferred and
  // the wizard returns to the pop-up at /onboarding/members instead of /plan.
  const onboarding = !profile.onboarding_completed_at;

  // How many members of this type to walk through in sequence (1–8). Husband and
  // housekeeper are singular and ignore this.
  const parsed = Number(countParam);
  const count = Number.isFinite(parsed) ? Math.min(8, Math.max(1, Math.trunc(parsed))) : 1;

  switch (type) {
    case "husband":
      return <AdultWizard role="dad" onboarding={onboarding} />;
    case "adult":
      return <AdultWizard role="other_adult" onboarding={onboarding} count={count} />;
    case "child":
      return <ChildWizard role="son" onboarding={onboarding} count={count} />;
    case "preg":
      return <PregLactSwitch onboarding={onboarding} count={count} />;
    case "housekeeper":
      return <HousekeeperForm onboarding={onboarding} />;
    default:
      redirect("/family");
  }
}
