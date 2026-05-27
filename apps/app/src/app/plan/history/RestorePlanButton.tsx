"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { restorePlan } from "./actions";

export function RestorePlanButton({
  planId,
  className = "",
}: {
  planId: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await restorePlan(planId);
      if (result.ok) {
        setOpen(false);
        router.push("/plan");
        return;
      }
      setError(result.error);
    });
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <RotateCcw className="size-4" aria-hidden="true" />
        )}
        استعادة
      </button>

      <ConfirmDialog
        open={open}
        title="استعادة هذه الخطة"
        body="بتصير خطتك الحالية لهذا الأسبوع، بنفس الوجبات. تأكدين؟"
        confirmLabel="استعادة"
        cancelLabel="إلغاء"
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
