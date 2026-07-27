import { Suspense } from "react";
import { PRICING_TIERS, type Cadence } from "@fitlife/config";
import { LogoutButton } from "../dashboard/LogoutButton";
import { PricingToggle } from "./PricingToggle";
import { TierCard } from "./TierCard";
import { PreselectionScroll } from "./PreselectionScroll";
import { SkipSubscriptionButton } from "./SkipSubscriptionButton";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";
import { createClient } from "@/lib/supabase/server";
import { genderPick } from "@/lib/copy/gender";

export const metadata = {
  title: "الأسعار — فت لايف",
  robots: { index: false, follow: false },
};

const TIER_ORDER = ["starter", "pro", "family", "premium"] as const;

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ cadence?: string; tier?: string; from?: string }>;
}) {
  const params = await searchParams;
  // Annual-first by default (explicit ?cadence=monthly still honored): Health &
  // Fitness is annual-dominant (60.6% of category revenue) and annual starts
  // retain at 19.9% vs 14.2% monthly at day 380 — the trial should begin on the
  // plan we want the customer to keep.
  const cadence: Cadence = params.cadence === "monthly" ? "monthly" : "annual";
  const fromOnboarding = params.from === "onboarding";

  // Owner-directed copy on this page ("اختاري باقتك") follows the answered
  // الجنس question, like every other in-app surface. The page is not behind
  // auth, so a logged-out visitor (or a profile from before the question
  // existed) resolves to null → feminine, the documented default voice.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let ownerSex: string | null = null;
  if (user) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("sex")
      .eq("id", user.id)
      .single();
    ownerSex = (ownerProfile as { sex?: string | null } | null)?.sex ?? null;
  }
  const g = genderPick(ownerSex);

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <a
            href="/dashboard"
            aria-label="فت لايف — الرئيسية"
            className="inline-flex items-center rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Logo className="h-9 w-auto" />
          </a>
          <div className="flex items-center gap-2">
            <BackToDashboard />
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="container-app py-10 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h1 className="font-extrabold text-3xl md:text-4xl text-brand-ink leading-tight">
            {g("اختاري الخطة المناسبة لعائلتك", "اختر الخطة المناسبة لعائلتك")}
          </h1>
          <p className="mt-3 text-brand-ink-muted text-base leading-relaxed">
            {fromOnboarding
              ? g(
                  "اشتركي عشان نجهّز خطط كل أفراد العائلة بوجبات منسقة. أو أكملي بخطتك أنتِ فقط الآن.",
                  "اشترك عشان نجهّز خطط كل أفراد العائلة بوجبات منسقة. أو أكمل بخطتك أنتَ فقط الآن.",
                )
              : // NOT "start a 7-day free trial" — the trial is granted at
                // SIGNUP (handle_new_user) and has usually already elapsed by
                // the time a user reads this page. Checkout passes no trial to
                // Lemonsqueezy, so choosing a tier here charges immediately;
                // promising a trial at this point is a chargeback waiting to
                // happen.
                g(
                  "اختاري باقتك وتبدأ اليوم. ألغي في أي وقت.",
                  "اختر باقتك وتبدأ اليوم. ألغِ في أي وقت.",
                )}
          </p>
        </div>

        <div className="flex justify-center mb-10">
          <Suspense fallback={<div className="h-12" />}>
            <PricingToggle cadence={cadence} ownerSex={ownerSex} />
          </Suspense>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {TIER_ORDER.map((tierId) => (
            <TierCard
              key={tierId}
              tier={PRICING_TIERS[tierId]}
              cadence={cadence}
              ownerSex={ownerSex}
            />
          ))}
        </div>

        {fromOnboarding && <SkipSubscriptionButton ownerSex={ownerSex} />}

        <p className="text-center mt-10 text-brand-ink-muted text-xs leading-relaxed">
          الأسعار بالريال السعودي. الفوترة سنوية تُحتسب مرة واحدة.
        </p>
      </div>

      <PreselectionScroll tier={params.tier} />
    </main>
  );
}
