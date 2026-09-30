import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentUserFamilyMembers,
  getCurrentUserProfilePhotos,
} from "@/lib/supabase/queries";
import { householdPhotoSrcs } from "@/lib/profilePhoto/shared";
import { getPlanById } from "@/lib/plans/getPlanHistory";
import { BackButton } from "@/components/BackButton";
import { PlanViewer } from "../../PlanViewer";
import { RestorePlanButton } from "../RestorePlanButton";

export const metadata = {
  title: "خطة سابقة — فت لايف",
  robots: { index: false, follow: false },
};

export default async function HistoryPlanViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ member?: string }>;
}) {
  const { planId } = await params;
  const { member } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const result = await getPlanById(user.id, planId);
  if (!result) notFound();

  const [{ data: ownerProfile }, members, photoPaths] = await Promise.all([
    supabase.from("profiles").select("sex").eq("id", user.id).single(),
    getCurrentUserFamilyMembers(),
    getCurrentUserProfilePhotos(),
  ]);
  const ownerSex = (ownerProfile as { sex?: string | null } | null)?.sex ?? null;
  // Today's photos on an old week: the person is the same person.
  const photos = householdPhotoSrcs(photoPaths, members);

  return (
    <main className="min-h-screen bg-brand-surface">
      {/* Padded like /plan: PlanViewer's bar replaces the app header on phones
          and sticks at the very top once the back row above it scrolls away.
          That row is the first thing on a phone screen, so it keeps a small
          top gap of its own instead of the bar's flush pt-0. */}
      <div className="container-app pb-8 pt-2 md:pb-12 lg:pt-8">
        <div className="mb-2 flex items-center justify-between gap-3 lg:mb-4">
          <BackButton
            href={member ? `/plan/history?member=${member}` : "/plan/history"}
            label="كل الخطط"
          />
          {!result.isCurrent && member && (
            <RestorePlanButton planId={result.id} memberId={member} ownerSex={ownerSex} />
          )}
        </div>

        <PlanViewer
          plan={result.plan}
          planId={result.id}
          readOnly
          preselectedMember={member}
          ownerSex={ownerSex}
          photos={photos}
        />
      </div>
    </main>
  );
}
