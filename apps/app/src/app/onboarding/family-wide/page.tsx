import { redirect } from "next/navigation";
import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
} from "@/lib/supabase/queries";
import { FamilyWideForm } from "./FamilyWideForm";

export const metadata = { title: "عائلتك" };

/**
 * The 5 family-wide questions. No longer the onboarding entry: the members
 * flow routes here after the add-a-member loop, and this page decides
 * server-side — render the questions only when the household actually has
 * more than one person (any non-housekeeper member) and they haven't been
 * answered; otherwise fall through to the plan-scope fork. Solo users never
 * see this screen.
 */
export default async function FamilyWidePage() {
  // Fetched together — the redirect guards below only need profile.
  const [profile, allMembers] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentUserFamilyMembers(),
  ]);
  if (!profile) redirect("/auth/login");
  if (profile.onboarding_completed_at) redirect("/dashboard");
  if (!profile.mom_profile_completed_at) redirect("/onboarding");
  if (profile.family_wide_completed_at) redirect("/onboarding/plan-scope");

  const members = allMembers.filter((m) => m.role !== "housekeeper");
  if (members.length === 0) redirect("/onboarding/plan-scope");

  return <FamilyWideForm />;
}
