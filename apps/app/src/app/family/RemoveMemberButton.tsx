"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeFamilyMember } from "@/app/onboarding/actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { genderPick } from "@/lib/copy/gender";

export function RemoveMemberButton({
  memberId,
  name,
  ownerSex,
}: {
  memberId: string;
  name: string;
  ownerSex?: string | null;
}) {
  const router = useRouter();
  const g = genderPick(ownerSex);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await removeFamilyMember(memberId);
      if (!result.ok) {
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
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        disabled={isPending}
        className="text-brand-ink-muted hover:text-red-600 text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md px-1 min-h-11"
      >
        {isPending ? "جاري الحذف…" : "حذف"}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title={`حذف ${name}`}
        body={g("بنعيد تنسيق خطط العائلة بعد الحذف. تأكدين؟", "بنعيد تنسيق خطط العائلة بعد الحذف. تأكد؟")}
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        isPending={isPending}
        error={error}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (isPending) return;
          setConfirmOpen(false);
          setError(null);
        }}
      />
    </>
  );
}
