"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import {
  PRICING_TIERS,
  getAnnualMonthlyEquivalent,
  type Tier,
  type Cadence,
} from "@fitlife/config";
import { clsx } from "clsx";
import { genderPick } from "@/lib/copy/gender";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

const TIER_ORDER: Tier[] = ["starter", "pro", "family", "premium"];

export function ChangePlanSection({
  currentTier,
  currentCadence,
  isTrial,
  ownerSex,
}: {
  currentTier: Tier;
  currentCadence: Cadence;
  isTrial: boolean;
  ownerSex?: string | null;
}) {
  const router = useRouter();
  const g = genderPick(ownerSex);
  const [cadence, setCadence] = useState<Cadence>(currentCadence);
  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function choose(tier: Tier) {
    setError(null);
    setPendingTier(tier);
    startTransition(async () => {
      try {
        const res = await fetch("/api/subscription/change", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tier, cadence }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          checkout_url?: string;
          updated?: boolean;
          error?: string;
        };
        if (res.ok && body.checkout_url) {
          window.location.assign(body.checkout_url);
          return;
        }
        if (res.ok && body.updated) {
          setDone(true);
          router.refresh();
          return;
        }
        setError(body.error ?? g("حدث خطأ. حاولي مرة أخرى", "حدث خطأ. حاول مرة أخرى"));
      } catch {
        setError(g("حدث خطأ في الاتصال. حاولي مرة أخرى", "حدث خطأ في الاتصال. حاول مرة أخرى"));
      } finally {
        setPendingTier(null);
      }
    });
  }

  return (
    // The cancel flow's «شوفي الخطط الأصغر» links here (#change-plan); the
    // anchor didn't exist, so that retention link went nowhere.
    <section
      id="change-plan"
      className="scroll-mt-[calc(var(--app-header-h)+1rem)] rounded-[1.375rem] border border-brand-line bg-brand-card p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-app-section text-brand-ink">
          {isTrial ? g("اختاري خطتك للاستمرار بعد التجربة", "اختر خطتك للاستمرار بعد التجربة") : "تغيير الخطة"}
        </h2>
        {/* Monthly / annual toggle */}
        <div className="inline-flex self-start rounded-full border border-brand-line bg-brand-surface p-1">
          <button
            type="button"
            onClick={() => setCadence("monthly")}
            aria-pressed={cadence === "monthly"}
            className={clsx(
              "min-h-11 rounded-full px-5 text-[15px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 motion-reduce:transition-none",
              cadence === "monthly"
                ? "bg-brand-purple-900 text-white"
                : "text-brand-ink-muted hover:text-brand-ink",
            )}
          >
            شهري
          </button>
          <button
            type="button"
            onClick={() => setCadence("annual")}
            aria-pressed={cadence === "annual"}
            className={clsx(
              "min-h-11 rounded-full px-5 text-[15px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 motion-reduce:transition-none",
              cadence === "annual"
                ? "bg-brand-purple-900 text-white"
                : "text-brand-ink-muted hover:text-brand-ink",
            )}
          >
            سنوي
          </button>
        </div>
      </div>

      {done && <Notice tone="success" title="تم تغيير خطتك" className="mt-4" />}
      {error && (
        <Notice tone="critical" className="mt-4">
          {error}
        </Notice>
      )}

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TIER_ORDER.map((tierId) => {
          const t = PRICING_TIERS[tierId];
          const isCurrent =
            !isTrial && tierId === currentTier && cadence === currentCadence;
          const displayPrice =
            cadence === "annual"
              ? getAnnualMonthlyEquivalent(t)
              : t.price_monthly_sar;
          const thisPending = isPending && pendingTier === tierId;

          return (
            <div
              key={tierId}
              className={clsx(
                "rounded-2xl border p-4",
                isCurrent
                  ? "border-brand-purple-900/40 bg-brand-tint"
                  : "border-brand-line bg-brand-card",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-app-item text-brand-ink">{t.name_ar}</h3>
                <p className="text-meta text-brand-ink-muted">
                  <span className="text-lg font-extrabold tabular-nums text-brand-ink">
                    {displayPrice}
                  </span>{" "}
                  ر.س / شهر
                </p>
              </div>
              <p className="mt-1 text-meta leading-relaxed text-brand-ink-muted">
                {t.max_people === null
                  ? "أفراد غير محدودين"
                  : `حتى ${t.max_people} ${t.max_people === 1 ? "فرد" : "أفراد"}`}
                {cadence === "annual" ? ` · يُحتسب ${t.price_annual_sar} ر.س سنوياً` : ""}
              </p>

              {isCurrent ? (
                <p className="mt-3 inline-flex min-h-11 items-center gap-1 text-[15px] font-bold text-brand-purple-900">
                  <Check className="size-4" aria-hidden="true" />
                  خطتك الحالية
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => choose(tierId)}
                  disabled={isPending}
                  className={buttonClasses({ variant: "secondary", block: true, className: "mt-3" })}
                >
                  {thisPending && (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  )}
                  {isTrial ? `${g("اختاري", "اختر")} ${t.name_ar}` : `التغيير إلى ${t.name_ar}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
