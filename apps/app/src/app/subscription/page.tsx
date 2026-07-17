import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PRICING_TIERS, type Cadence } from "@fitlife/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSubscription } from "@/lib/subscription/state";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";
import { SettingsLink } from "@/components/SettingsLink";
import { BillingPortalButton } from "../dashboard/BillingPortalButton";
import { CurrentPlanCard } from "./CurrentPlanCard";
import { CardOnFile } from "./CardOnFile";
import { ChangePlanSection } from "./ChangePlanSection";
import { BillingHistory } from "./BillingHistory";
import { CancelSubscription, PausedNotice } from "./CancelSubscription";
import { loadFamilyLedger } from "@/lib/engagement/ledger";

const LEDGER_NUM = new Intl.NumberFormat("ar-SA", { useGrouping: false });

/** «ذاكرة مائدتكم» in one factual sentence for the cancel dialog. */
async function buildLedgerLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const ledger = await loadFamilyLedger(supabase, userId);
  if (ledger.planWeeks === 0) return null;
  return `سجلّ بيتك حتى اليوم: ${LEDGER_NUM.format(ledger.planWeeks)} خطة أسبوعية لبيتٍ من ${LEDGER_NUM.format(ledger.membersServed)} — يبقى محفوظاً حتى نهاية اشتراكك.`;
}

export const metadata = {
  title: "الاشتراك — فت لايف",
  robots: { index: false, follow: false },
};

function SectionShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-3xl border border-brand-ink/5 p-6 md:p-7">
      <h2 className="font-extrabold text-xl text-brand-ink leading-tight mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string }>;
}) {
  const { changed } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const sub = await getCurrentSubscription(user.id);

  const header = (
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
          <SettingsLink />
        </div>
      </div>
    </header>
  );

  // No subscription at all → send to pricing.
  if (!sub) {
    return (
      <main className="min-h-screen bg-brand-surface">
        {header}
        <div className="container-app py-8 md:py-12 max-w-2xl">
          <div className="bg-white rounded-3xl border border-brand-ink/5 p-6 text-center">
            <p className="font-bold text-brand-ink">ما عندك اشتراك بعد</p>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center min-h-11 mt-4 px-5 rounded-full bg-brand-ink hover:bg-brand-purple-900 text-white text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
            >
              اختاري خطتك
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const hasLSSub = !!sub.lemonsqueezy_subscription_id;
  const cadence: Cadence = sub.cadence === "annual" ? "annual" : "monthly";

  return (
    <main className="min-h-screen bg-brand-surface">
      {header}

      <div className="container-app py-8 md:py-12 max-w-2xl space-y-6">
        <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
          اشتراكك
        </h1>

        {changed === "success" && (
          <div
            role="status"
            className="rounded-2xl bg-brand-emerald/10 border border-brand-emerald/20 px-4 py-3"
          >
            <p className="text-brand-emerald text-sm font-bold leading-relaxed">
              تم تحديث اشتراكك
            </p>
          </div>
        )}

        {/* Section 1 — Current plan */}
        <CurrentPlanCard sub={sub}>
          {hasLSSub && (
            <Suspense fallback={null}>
              <CardOnFile subId={sub.lemonsqueezy_subscription_id!} />
            </Suspense>
          )}
        </CurrentPlanCard>

        {/* Section 2 — Change plan */}
        <ChangePlanSection
          currentTier={sub.tier}
          currentCadence={cadence}
          isTrial={!hasLSSub}
        />

        {/* Section 3 — Billing history */}
        <SectionShell title="سجل الفواتير">
          {hasLSSub ? (
            <Suspense
              fallback={
                <div className="flex items-center gap-2 text-brand-ink-muted text-sm py-4">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  جاري تحميل الفواتير…
                </div>
              }
            >
              <BillingHistory subId={sub.lemonsqueezy_subscription_id!} />
            </Suspense>
          ) : (
            <p className="text-brand-ink-muted text-sm leading-relaxed">
              ما فيه فواتير بعد — أنتِ في الفترة التجريبية
            </p>
          )}
        </SectionShell>

        {/* Section 4 — Payment method */}
        {sub.lemonsqueezy_customer_id && (
          <SectionShell title="طريقة الدفع">
            <BillingPortalButton label="تحديث طريقة الدفع" variant="ghost" />
            <p className="mt-2 text-brand-ink-muted text-xs leading-relaxed">
              تحديث البطاقة يتم عبر بوابة الدفع الآمنة
            </p>
          </SectionShell>
        )}

        {/* Section 5 — Cancel (with reason-matched save offers) */}
        {hasLSSub &&
          sub.status === "active" &&
          !sub.cancel_at_period_end && (
            <SectionShell title="إلغاء الاشتراك">
              <p className="text-brand-ink-muted text-sm leading-relaxed mb-4">
                تقدرين تلغين في أي وقت. الخدمة تستمر حتى نهاية فترتك الحالية —
                وإن كان السبب سفراً أو انشغالاً، فالاستراحة المؤقتة متاحة أيضاً.
              </p>
              <CancelSubscription
                tierName={PRICING_TIERS[sub.tier].name_ar}
                endsAt={sub.current_period_end}
                ledgerLine={await buildLedgerLine(supabase, user.id)}
              />
            </SectionShell>
          )}

        {/* Paused state — resume early, or let it auto-resume */}
        {hasLSSub && sub.status === "paused" && (
          <SectionShell title="اشتراكك في استراحة">
            <PausedNotice resumesAt={sub.current_period_end} />
          </SectionShell>
        )}
      </div>
    </main>
  );
}
