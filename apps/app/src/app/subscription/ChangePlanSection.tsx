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
import { genderPick } from "@/lib/copy/gender";

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
  // TEMPORARY (pre-launch diagnosis): /api/subscription/change returns a
  // `debug` string on failure so the cause is visible on-page without
  // Netlify log access. Remove together with the route's `debug` field
  // once payments work.
  const [debugDetail, setDebugDetail] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function choose(tier: Tier) {
    setError(null);
    setDebugDetail(null);
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
          debug?: string;
        };
        if (res.ok && body.checkout_url) {
          window.location.href = body.checkout_url;
          return;
        }
        if (res.ok && body.updated) {
          setDone(true);
          router.refresh();
          return;
        }
        setError(body.error ?? g("حدث خطأ. حاولي مرة ثانية", "حدث خطأ. حاول مرة ثانية"));
        if (body.debug) setDebugDetail(body.debug);
      } catch {
        setError(g("حدث خطأ في الاتصال. حاولي مرة ثانية", "حدث خطأ في الاتصال. حاول مرة ثانية"));
      } finally {
        setPendingTier(null);
      }
    });
  }

  return (
    <section className="bg-white rounded-3xl border border-brand-ink/5 p-6 md:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="font-extrabold text-xl text-brand-ink leading-tight">
          {isTrial ? g("اختاري خطتك للاستمرار بعد التجربة", "اختر خطتك للاستمرار بعد التجربة") : "تغيير الخطة"}
        </h2>
        {/* Monthly / annual toggle */}
        <div className="inline-flex rounded-full border border-brand-ink/10 p-1 self-start">
          <button
            type="button"
            onClick={() => setCadence("monthly")}
            aria-pressed={cadence === "monthly"}
            className={`min-h-9 px-4 rounded-full text-sm font-bold transition-colors ${
              cadence === "monthly"
                ? "bg-brand-purple-900 text-white"
                : "text-brand-ink-muted hover:text-brand-ink"
            }`}
          >
            شهري
          </button>
          <button
            type="button"
            onClick={() => setCadence("annual")}
            aria-pressed={cadence === "annual"}
            className={`min-h-9 px-4 rounded-full text-sm font-bold transition-colors ${
              cadence === "annual"
                ? "bg-brand-purple-900 text-white"
                : "text-brand-ink-muted hover:text-brand-ink"
            }`}
          >
            سنوي
          </button>
        </div>
      </div>

      {done && (
        <div
          role="status"
          className="mt-4 rounded-xl bg-brand-emerald/10 border border-brand-emerald/20 px-4 py-3"
        >
          <p className="text-brand-emerald text-sm font-bold leading-relaxed">
            تم تغيير خطتك
          </p>
        </div>
      )}
      {error && (
        <div role="alert" className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-red-700 text-sm leading-relaxed">{error}</p>
          {debugDetail && (
            <p
              dir="ltr"
              className="mt-1 text-brand-ink-muted text-[11px] leading-relaxed break-all text-start"
            >
              {debugDetail}
            </p>
          )}
        </div>
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
              className={`rounded-2xl border p-4 ${
                isCurrent
                  ? "border-brand-purple-900/40 bg-brand-lavender/15"
                  : "border-brand-ink/10 bg-white"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-bold text-brand-ink">{t.name_ar}</h3>
                <p className="text-brand-ink-muted text-xs">
                  <span className="font-extrabold text-brand-ink text-lg tabular-nums">
                    {displayPrice}
                  </span>{" "}
                  ر.س / شهر
                </p>
              </div>
              <p className="mt-1 text-brand-ink-muted text-xs leading-relaxed">
                {t.max_people === null
                  ? "أفراد غير محدودين"
                  : `حتى ${t.max_people} ${t.max_people === 1 ? "فرد" : "أفراد"}`}
                {cadence === "annual" ? ` · يُحتسب ${t.price_annual_sar} ر.س سنوياً` : ""}
              </p>

              {isCurrent ? (
                <p className="mt-3 inline-flex items-center gap-1 text-brand-purple-900 text-sm font-bold">
                  <Check className="size-4" aria-hidden="true" />
                  خطتك الحالية
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => choose(tierId)}
                  disabled={isPending}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-sm py-2.5 rounded-xl transition-colors disabled:cursor-not-allowed min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
