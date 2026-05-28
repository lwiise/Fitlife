"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function RegenerateButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [issues, setIssues] = useState("");
  const [improvements, setImprovements] = useState("");

  function openDialog() {
    setErrorMessage(null);
    setConfirmOpen(true);
  }

  function closeDialog() {
    setConfirmOpen(false);
    setErrorMessage(null);
    setIssues("");
    setImprovements("");
  }

  function handleConfirm() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/plans/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            issues: issues.trim(),
            improvements: improvements.trim(),
          }),
        });
        if (res.ok) {
          closeDialog();
          router.refresh();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        // Keep the dialog open and surface the error inside it.
        setErrorMessage(body.error ?? "حدث خطأ. حاولي مرة ثانية");
      } catch {
        setErrorMessage("حدث خطأ في الاتصال. حاولي مرة ثانية");
      }
    });
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={openDialog}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-sm px-5 py-2.5 rounded-full transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface min-h-[2.75rem]"
      >
        {isPending ? (
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        إنشاء خطة جديدة
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="إنشاء خطة جديدة"
        body="عشان نصمم لكِ خطة أنسب، قوليلنا ايش تبين نغيّر. الخطة الحالية بتنحفظ في السجل."
        confirmLabel="أنشئي الخطة"
        cancelLabel="إلغاء"
        isPending={isPending}
        error={errorMessage}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (isPending) return;
          closeDialog();
        }}
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="regen-issues"
              className="block text-sm font-bold text-brand-ink mb-1.5"
            >
              ايش ما عجبك في الخطة الحالية؟ <span className="text-brand-ink-muted font-medium">(اختياري)</span>
            </label>
            <textarea
              id="regen-issues"
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              disabled={isPending}
              rows={2}
              placeholder="مثلاً: الوجبات متكررة، أو ما أحب السمك"
              className="w-full px-3 py-2.5 rounded-xl border border-brand-ink/10 bg-white text-brand-ink text-sm leading-relaxed placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 resize-none"
            />
          </div>
          <div>
            <label
              htmlFor="regen-improvements"
              className="block text-sm font-bold text-brand-ink mb-1.5"
            >
              ايش تحبين نغيّر أو نحسّن؟ <span className="text-brand-ink-muted font-medium">(اختياري)</span>
            </label>
            <textarea
              id="regen-improvements"
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              disabled={isPending}
              rows={2}
              placeholder="مثلاً: تنوع أكثر، وجبات أخف للعشاء"
              className="w-full px-3 py-2.5 rounded-xl border border-brand-ink/10 bg-white text-brand-ink text-sm leading-relaxed placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 resize-none"
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
