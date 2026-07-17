"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { Tier, Cadence } from "@fitlife/config";

export function CheckoutButton({
  tier,
  cadence,
  tierName,
}: {
  tier: Tier;
  cadence: Cadence;
  tierName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleClick() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier, cadence }),
        });

        if (res.status === 401) {
          router.push("/auth/login?next=/pricing");
          return;
        }

        const body = (await res.json().catch(() => ({}))) as {
          checkout_url?: string;
          error?: string;
        };

        if (res.ok && body.checkout_url) {
          window.location.href = body.checkout_url;
          return;
        }

        setErrorMessage(body.error ?? "حدث خطأ. حاولي مرة ثانية");
      } catch {
        setErrorMessage("حدث خطأ في الاتصال. حاولي مرة ثانية");
      }
    });
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 bg-brand-purple-900 hover:bg-brand-purple-700 disabled:bg-brand-purple-900/40 text-white font-bold text-sm px-5 py-3 rounded-xl transition-colors disabled:cursor-not-allowed min-h-[3rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        {isPending ? (
          <>
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            جاري التحضير...
          </>
        ) : (
          `اختاري ${tierName}`
        )}
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
    </div>
  );
}
