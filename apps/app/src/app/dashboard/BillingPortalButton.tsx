"use client";

import { useState, useTransition } from "react";
import { Loader2, ExternalLink } from "lucide-react";

export function BillingPortalButton({
  label = "إدارة الاشتراك",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "ghost";
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleClick() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/portal", { method: "POST" });
        const body = (await res.json().catch(() => ({}))) as {
          portal_url?: string;
          error?: string;
        };
        if (res.ok && body.portal_url) {
          window.location.assign(body.portal_url);
          return;
        }
        setErrorMessage(body.error ?? "حدث خطأ. يرجى المحاولة مرة أخرى");
      } catch {
        setErrorMessage("حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى");
      }
    });
  }

  const baseClasses =
    "inline-flex items-center gap-2 font-bold text-sm px-4 py-2 rounded-full transition-colors min-h-[2.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed";
  const variantClasses =
    variant === "primary"
      ? "bg-white text-brand-purple-900 hover:bg-brand-yellow focus-visible:ring-offset-brand-purple-900"
      : "bg-brand-ink text-white hover:bg-brand-purple-900 focus-visible:ring-offset-white";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`${baseClasses} ${variantClasses}`}
      >
        {isPending ? (
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <ExternalLink className="size-4" aria-hidden="true" />
        )}
        {label}
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
