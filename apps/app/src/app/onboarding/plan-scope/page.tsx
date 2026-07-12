import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { genderPick } from "@/lib/copy/gender";
import { PlanScopeChoice } from "./PlanScopeChoice";

export const metadata = {
  title: "اختيار نوع الخطة — فت لايف",
  robots: { index: false, follow: false },
};

/** Fork at the end of the meals questionnaire: meals only vs meals + workout. */
export default async function PlanScopePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("mom_profile_completed_at, onboarding_completed_at, sex")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.mom_profile_completed_at) redirect("/onboarding");
  if (profile.onboarding_completed_at) redirect("/dashboard");

  const g = genderPick(profile.sex);

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4">
          <Logo className="h-9 w-auto" />
        </div>
      </header>
      <div className="container-app py-8 md:py-12 max-w-2xl space-y-6">
        <header>
          <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
            {g("ماذا نجهّز لكِ؟", "ماذا نجهّز لكَ؟")}
          </h1>
          <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
            {g("اكتملت أسئلة الوجبات. اختاري نطاق خطتك.", "اكتملت أسئلة الوجبات. اختر نطاق خطتك.")}
          </p>
        </header>
        <PlanScopeChoice />
      </div>
    </main>
  );
}
