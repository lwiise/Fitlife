import { Suspense } from "react";
import { PRICING_TIERS, type Cadence } from "@fitlife/config";
import { LogoutButton } from "../dashboard/LogoutButton";
import { PricingToggle } from "./PricingToggle";
import { TierCard } from "./TierCard";
import { PreselectionScroll } from "./PreselectionScroll";
import { SkipSubscriptionButton } from "./SkipSubscriptionButton";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";

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
  const cadence: Cadence = params.cadence === "annual" ? "annual" : "monthly";
  const fromOnboarding = params.from === "onboarding";

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
            اختاري الخطة المناسبة لعائلتك
          </h1>
          <p className="mt-3 text-brand-ink-muted text-base leading-relaxed">
            {fromOnboarding
              ? "اشتركي عشان نجهّز خطط كل أفراد العائلة بوجبات منسقة. أو أكملي بخطتك أنتِ فقط الآن."
              : "ابدئي بفترة تجريبية مجانية لمدة 7 أيام. ألغي في أي وقت."}
          </p>
        </div>

        <div className="flex justify-center mb-10">
          <Suspense fallback={<div className="h-12" />}>
            <PricingToggle cadence={cadence} />
          </Suspense>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {TIER_ORDER.map((tierId) => (
            <TierCard
              key={tierId}
              tier={PRICING_TIERS[tierId]}
              cadence={cadence}
            />
          ))}
        </div>

        {fromOnboarding && <SkipSubscriptionButton />}

        <p className="text-center mt-10 text-brand-ink-muted text-xs leading-relaxed">
          الأسعار بالريال السعودي. الفوترة سنوية تُحتسب مرة واحدة.
        </p>
      </div>

      <PreselectionScroll tier={params.tier} />
    </main>
  );
}
