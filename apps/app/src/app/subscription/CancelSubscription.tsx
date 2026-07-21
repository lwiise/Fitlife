"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, MessageCircleHeart, ArrowDownCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { genderPick } from "@/lib/copy/gender";

const DATE_FMT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function fmtDate(iso: string | null): string {
  if (!iso) return "نهاية الفترة الحالية";
  try {
    return DATE_FMT.format(new Date(iso));
  } catch {
    return "نهاية الفترة الحالية";
  }
}

type CancelReason = "traveling" | "not_using" | "price" | "not_suitable";
type Step = "reason" | "offer" | "confirm";

// Reason-matched deflection: the offer answers the stated reason (pause for
// time-based reasons, downgrade for price, Sara for fit) — never one generic
// plea. «متابعة الإلغاء» stays one tap away at every step: honest retention,
// no dark patterns, no confirm-shaming loops.
const REASONS: Array<{ key: CancelReason; label: string }> = [
  { key: "traveling", label: "مسافرة أو مشغولة هذه الفترة" },
  { key: "not_using", label: "ما أستخدمه كفاية" },
  { key: "price", label: "السعر ما يناسبني" },
  { key: "not_suitable", label: "الخطط ما ناسبتنا" },
];

export function CancelSubscription({
  tierName,
  endsAt,
  ledgerLine,
  ownerSex,
}: {
  tierName: string;
  endsAt: string | null;
  /** Factual accumulated-value line («١٤ خطة أسبوعية لبيتٍ من ٥») — shown
   *  once in the reason step, never repeated, never dramatized. */
  ledgerLine?: string | null;
  ownerSex?: string | null;
}) {
  const router = useRouter();
  const g = genderPick(ownerSex);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  function close() {
    if (isPending) return;
    setOpen(false);
    setError(null);
    setStep("reason");
    setReason(null);
  }

  function handleCancelConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/subscription/cancel", { method: "POST" });
        if (res.ok) {
          setOpen(false);
          router.refresh();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? g("حدث خطأ. حاولي مرة ثانية", "حدث خطأ. حاول مرة ثانية"));
      } catch {
        setError(g("حدث خطأ في الاتصال. حاولي مرة ثانية", "حدث خطأ في الاتصال. حاول مرة ثانية"));
      }
    });
  }

  function handlePause() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/subscription/pause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          setPaused(true);
          setOpen(false);
          router.refresh();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? g("حدث خطأ. حاولي مرة ثانية", "حدث خطأ. حاول مرة ثانية"));
      } catch {
        setError(g("حدث خطأ في الاتصال. حاولي مرة ثانية", "حدث خطأ في الاتصال. حاول مرة ثانية"));
      }
    });
  }

  const showPauseOffer = reason === "traveling" || reason === "not_using";

  const dialogTitle =
    step === "reason"
      ? g("قبل ما تلغين", "قبل ما تلغي")
      : step === "offer"
        ? showPauseOffer
          ? "استراحة بدل الإلغاء؟"
          : reason === "price"
            ? "خيار أوفر بدل الإلغاء؟"
            : "خلينا نعدّلها لك"
        : "إلغاء اشتراكك";

  const dialogBody =
    step === "reason"
      ? g(
          "وش السبب؟ اختيارك يساعدنا نقترح الأنسب لك — وتقدرين تكملين الإلغاء مباشرة.",
          "وش السبب؟ اختيارك يساعدنا نقترح الأنسب لك — وتقدر تكمل الإلغاء مباشرة.",
        )
      : step === "confirm"
        ? `${g("بتلغين", "بتلغي")} خطة ${tierName}. اشتراكك بيستمر شغّال حتى ${fmtDate(endsAt)}، وبعدها بيتوقف التجديد التلقائي. ما فيه استرداد للفترة الحالية.`
        : undefined;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setStep("reason");
          setOpen(true);
        }}
        disabled={isPending}
        className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 rounded-full border border-red-300 text-red-600 hover:bg-red-50 text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        إلغاء الاشتراك
      </button>
      {paused && (
        <p role="status" className="mt-3 text-sm font-bold text-brand-purple-900">
          تم — اشتراكك في استراحة شهر، بلا رسوم، ويعود تلقائياً.
        </p>
      )}

      <ConfirmDialog
        open={open}
        title={dialogTitle}
        body={dialogBody}
        confirmLabel={step === "confirm" ? "تأكيد الإلغاء" : "متابعة الإلغاء"}
        cancelLabel="تراجع"
        isPending={isPending}
        error={error}
        onConfirm={() => {
          if (step === "confirm") handleCancelConfirm();
          else setStep("confirm");
        }}
        onCancel={close}
      >
        {step === "reason" && ledgerLine && (
          <p className="mb-3 text-sm text-brand-purple-900 bg-brand-lavender/20 rounded-xl px-4 py-3 leading-relaxed">
            {ledgerLine}
          </p>
        )}
        {step === "reason" && (
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  setReason(r.key);
                  setStep("offer");
                }}
                className="min-h-11 px-4 rounded-full border border-brand-ink/15 text-sm font-bold text-brand-ink hover:bg-brand-lavender/30 hover:border-brand-purple-900/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {step === "offer" && showPauseOffer && (
          <div className="rounded-2xl bg-brand-lavender/20 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <PauseCircle
                className="size-5 text-brand-purple-900 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm text-brand-ink leading-relaxed">
                وقّفيه شهراً كاملاً بدل الإلغاء — بلا رسوم خلال الاستراحة،
                وخططك وسجلّ بيتك يبقى محفوظاً، ويعود كل شيء تلقائياً.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePause}
              disabled={isPending}
              className="w-full min-h-11 rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 text-sm font-bold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
            >
              {isPending ? "لحظات…" : "استراحة شهر — بلا رسوم"}
            </button>
          </div>
        )}

        {step === "offer" && reason === "price" && (
          <div className="rounded-2xl bg-brand-lavender/20 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <ArrowDownCircle
                className="size-5 text-brand-purple-900 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm text-brand-ink leading-relaxed">
                تقدرين تنزلين لخطة أصغر وأوفر بدل ما تخسرين كل شيء — التبديل
                فوري ومن نفس الصفحة.
              </p>
            </div>
            <a
              href="#change-plan"
              onClick={close}
              className="block w-full text-center min-h-11 leading-[2.75rem] rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
            >
              شوفي الخطط الأصغر
            </a>
          </div>
        )}

        {step === "offer" && reason === "not_suitable" && (
          <div className="rounded-2xl bg-brand-lavender/20 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <MessageCircleHeart
                className="size-5 text-brand-purple-900 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm text-brand-ink leading-relaxed">
                {g("قولي", "قل")} للمستشارة وش اللي ما ناسبكم — أغلب الأحيان تعديل
                واحد في الخطة القادمة يغيّر كل شيء.
              </p>
            </div>
            <a
              href="/chat"
              className="block w-full text-center min-h-11 leading-[2.75rem] rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
            >
              {g("اكتبي للمستشارة", "اكتب للمستشارة")}
            </a>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

/** Shown instead of the cancel section while the subscription is paused. */
export function PausedNotice({
  resumesAt,
  ownerSex,
}: {
  resumesAt: string | null;
  ownerSex?: string | null;
}) {
  const router = useRouter();
  const g = genderPick(ownerSex);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleResume() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/subscription/pause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume: true }),
        });
        if (res.ok) {
          router.refresh();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? g("حدث خطأ. حاولي مرة ثانية", "حدث خطأ. حاول مرة ثانية"));
      } catch {
        setError(g("حدث خطأ في الاتصال. حاولي مرة ثانية", "حدث خطأ في الاتصال. حاول مرة ثانية"));
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-brand-ink text-sm leading-relaxed">
        اشتراكك في استراحة حتى {fmtDate(resumesAt)} — بلا رسوم، وكل خططك
        وسجلّ بيتك محفوظ. يعود تلقائياً في موعده.
      </p>
      <button
        type="button"
        onClick={handleResume}
        disabled={isPending}
        className="inline-flex items-center justify-center min-h-11 px-5 rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 text-sm font-bold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        {isPending ? "لحظات…" : "عودة مبكرة الآن"}
      </button>
      {error && (
        <p role="alert" className="text-sm font-bold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
