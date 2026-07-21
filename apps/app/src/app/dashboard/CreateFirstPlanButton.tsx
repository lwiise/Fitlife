"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { genderPick } from "@/lib/copy/gender";

export function CreateFirstPlanButton({ ownerSex }: { ownerSex?: string | null }) {
  const router = useRouter();
  const g = genderPick(ownerSex);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleClick() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/plans/generate", { method: "POST" });
        if (res.ok) {
          router.push("/plan");
          return;
        }
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          busy?: boolean;
        };
        // Already generating → that IS the goal; show the progress screen.
        if (res.status === 409 || body.busy) {
          router.push("/plan");
          return;
        }
        setErrorMessage(body.error ?? g("حدث خطأ. حاولي مرة ثانية", "حدث خطأ. حاول مرة ثانية"));
      } catch {
        setErrorMessage(g("حدث خطأ في الاتصال. حاولي مرة ثانية", "حدث خطأ في الاتصال. حاول مرة ثانية"));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-sm px-4 py-2 rounded-full transition-colors disabled:cursor-not-allowed mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white min-h-[2.75rem]"
      >
        {isPending ? (
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        {g("أنشئي خطتك الأولى", "أنشئ خطتك الأولى")}
      </button>
      {errorMessage && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-2 text-red-600 text-xs leading-relaxed"
        >
          {errorMessage}
        </p>
      )}
    </>
  );
}
