"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deletePlan } from "./actions";

export function DeletePlanButton({
  planId,
  memberId,
  className = "",
}: {
  planId: string;
  memberId: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deletePlan(planId, memberId);
      if (result.ok) {
        setOpen(false);
        router.refresh();
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
        className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2 rounded-full border border-red-200 text-red-600 hover:bg-red-50 text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Trash2 className="size-4" aria-hidden="true" />
        )}
        حذف
      </button>

      <ConfirmDialog
        open={open}
        title="حذف هذه الخطة"
        body="بتنحذف هذه الخطة من سجلك ولا تقدرين تستعيدينها. تأكدين؟"
        confirmLabel="حذف"
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
