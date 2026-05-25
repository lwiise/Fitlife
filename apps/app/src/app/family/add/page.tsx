import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { AdultWizard } from "./wizards/AdultWizard";
import { ChildWizard } from "./wizards/ChildWizard";
import { PregLactSwitch } from "./PregLactSwitch";

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

  switch (type) {
    case "husband":
      return <AdultWizard role="dad" />;
    case "adult":
      return <AdultWizard role="other_adult" />;
    case "child":
      return <ChildWizard role="son" />;
    case "preg":
      return <PregLactSwitch />;
    default:
      redirect("/family");
  }
}
