import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { FamilyWideForm } from "./FamilyWideForm";

export const metadata = { title: "عائلتك" };

export default async function FamilyWidePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/login");
  if (profile.onboarding_completed_at) redirect("/dashboard");

  return <FamilyWideForm />;
}
