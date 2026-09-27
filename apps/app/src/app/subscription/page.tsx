import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PRICING_TIERS, type Cadence } from "@fitlife/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSubscription } from "@/lib/subscription/state";
import { BillingPortalButton } from "../dashboard/BillingPortalButton";
import { CurrentPlanCard } from "./CurrentPlanCard";
import { CardOnFile } from "./CardOnFile";
import { ChangePlanSection } from "./ChangePlanSection";
import { BillingHistory } from "./BillingHistory";
import { CancelSubscription, PausedNotice } from "./CancelSubscription";
import { genderPick } from "@/lib/copy/gender";
import { arNum } from "@/lib/copy/numbers";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { loadFamilyLedger } from "@/lib/engagement/ledger";

/** «ذاكرة مائدتكم» in one factual sentence for the cancel dialog. */
async function buildLedgerLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const ledger = await loadFamilyLedger(supabase, userId);
  if (ledger.planWeeks === 0) return null;
  return `سجلّ بيتك حتى اليوم: ${arNum(ledger.planWeeks)} خطة أسبوعية لبيتٍ من ${arNum(ledger.membersServed)} — يبقى محفوظاً حتى نهاية اشتراكك.`;
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
    <Card>
      <CardHeader title={title} className="mb-3" />
      {children}
    </Card>
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

  const [sub, { data: ownerProfile }] = await Promise.all([
    getCurrentSubscription(user.id),
    supabase.from("profiles").select("sex").eq("id", user.id).single(),
  ]);
  const ownerSex = (ownerProfile as { sex?: string | null } | null)?.sex ?? null;
  const g = genderPick(ownerSex);

  // No subscription at all → send to pricing.
  if (!sub) {
    return (
      <main className="container-shell py-6 lg:py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          <PageHeader className="mb-0" title="اشتراكك" />
          <Card className="space-y-4 text-center">
            <p className="text-app-item text-brand-ink">لا يوجد اشتراك بعد</p>
            <ButtonLink href="/pricing">{g("اختاري خطتك", "اختر خطتك")}</ButtonLink>
          </Card>
        </div>
      </main>
    );
  }

  const hasLSSub = !!sub.lemonsqueezy_subscription_id;
  const cadence: Cadence = sub.cadence === "annual" ? "annual" : "monthly";

  return (
    <main className="container-shell py-6 lg:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          className="mb-0"
          title="اشتراكك"
          description="الباقة، الفواتير، وطريقة الدفع."
        />

        {changed === "success" && <Notice tone="success" title="تم تحديث اشتراكك" />}

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
          ownerSex={ownerSex}
        />

        {/* Section 3 — Billing history */}
        <SectionShell title="سجل الفواتير">
          {hasLSSub ? (
            <Suspense
              fallback={
                <div className="flex items-center gap-2 py-4 text-[15px] text-brand-ink-muted">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  جارٍ تحميل الفواتير…
                </div>
              }
            >
              <BillingHistory subId={sub.lemonsqueezy_subscription_id!} />
            </Suspense>
          ) : (
            <p className="text-[15px] leading-relaxed text-brand-ink-muted">
              {g("لا توجد فواتير بعد، فأنتِ في الفترة التجريبية.", "لا توجد فواتير بعد، فأنتَ في الفترة التجريبية.")}
            </p>
          )}
        </SectionShell>

        {/* Section 4 — Payment method */}
        {sub.lemonsqueezy_customer_id && (
          <SectionShell title="طريقة الدفع">
            <BillingPortalButton label="تحديث طريقة الدفع" variant="ghost" />
            <p className="mt-2 text-meta leading-relaxed text-brand-ink-muted">
              تحديث البطاقة يتم عبر بوابة الدفع الآمنة.
            </p>
          </SectionShell>
        )}

        {/* Section 5 — Cancel (with reason-matched save offers) */}
        {hasLSSub &&
          sub.status === "active" &&
          !sub.cancel_at_period_end && (
            <SectionShell title="إلغاء الاشتراك">
              <p className="mb-4 text-[15px] leading-relaxed text-brand-ink-muted">
                {g("يمكنكِ الإلغاء في أي وقت.", "يمكنك الإلغاء في أي وقت.")} الخدمة تستمر
                حتى نهاية فترتك الحالية، وإن كان السبب سفراً أو انشغالاً
                فالاستراحة المؤقتة متاحة أيضاً.
              </p>
              <CancelSubscription
                tierName={PRICING_TIERS[sub.tier].name_ar}
                endsAt={sub.current_period_end}
                ledgerLine={await buildLedgerLine(supabase, user.id)}
                ownerSex={ownerSex}
              />
            </SectionShell>
          )}

        {/* Paused state — resume early, or let it auto-resume */}
        {hasLSSub && sub.status === "paused" && (
          <SectionShell title="اشتراكك في استراحة">
            <PausedNotice resumesAt={sub.current_period_end} ownerSex={ownerSex} />
          </SectionShell>
        )}
      </div>
    </main>
  );
}
