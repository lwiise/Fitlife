"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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

export function CancelSubscription({
  tierName,
  endsAt,
}: {
  tierName: string;
  endsAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
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
        setError(body.error ?? "حدث خطأ. حاولي مرة ثانية");
      } catch {
        setError("حدث خطأ في الاتصال. حاولي مرة ثانية");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={isPending}
        className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 rounded-full border border-red-300 text-red-600 hover:bg-red-50 text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        إلغاء الاشتراك
      </button>

      <ConfirmDialog
        open={open}
        title="إلغاء اشتراكك"
        body={`بتلغين خطة ${tierName}. اشتراكك بيستمر شغّال حتى ${fmtDate(endsAt)}، وبعدها بيتوقف التجديد التلقائي. ما فيه استرداد للفترة الحالية.`}
        confirmLabel="تأكيد الإلغاء"
        cancelLabel="تراجع"
        isPending={isPending}
        error={error}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (isPending) return;
          setOpen(false);
          setError(null);
        }}
      />
    </div>
  );
}
