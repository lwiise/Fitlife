"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeFamilyMember } from "@/app/onboarding/actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function RemoveMemberButton({
  memberId,
  name,
}: {
  memberId: string;
  name: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await removeFamilyMember(memberId);
      if (!result.ok) {
        setConfirmOpen(false);
        setError(result.error);
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
        className="text-brand-ink-muted hover:text-red-600 text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md px-1 min-h-11"
      >
        {isPending ? "جاري الحذف…" : "حذف"}
      </button>
      {error && <span className="text-red-600 text-xs ms-2">{error}</span>}

      <ConfirmDialog
        open={confirmOpen}
        title={`حذف ${name}`}
        body="بنعيد تنسيق خطط العائلة بعد الحذف. تأكدين؟"
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => !isPending && setConfirmOpen(false)}
      />
    </>
  );
}
