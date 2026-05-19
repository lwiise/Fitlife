"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 30_000;

export function CheckoutSuccessHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("checkout") === "success";

  const [stage, setStage] = useState<"activating" | "active" | "timeout">(
    "activating",
  );

  useEffect(() => {
    if (!isSuccess) return;

    let cancelled = false;
    const startedAt = Date.now();

    const interval = setInterval(async () => {
      if (cancelled) return;
      if (Date.now() - startedAt > TIMEOUT_MS) {
        clearInterval(interval);
        setStage("timeout");
        // Strip the URL param even on timeout — refresh once more in case.
        history.replaceState(null, "", "/dashboard");
        router.refresh();
        return;
      }

      try {
        const res = await fetch("/api/subscription/status", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { status?: string };
        if (body.status === "active") {
          clearInterval(interval);
          setStage("active");
          history.replaceState(null, "", "/dashboard");
          router.refresh();
        }
      } catch {
        // network blip — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isSuccess, router]);

  if (!isSuccess) return null;

  const isActivating = stage === "activating";
  const Icon = isActivating ? Loader2 : CheckCircle2;
  const message = isActivating
    ? "جاري تفعيل اشتراكك..."
    : stage === "active"
      ? "تم تفعيل اشتراكك. مرحباً بك"
      : "إذا لم يتحدث اشتراكك خلال دقيقة، حدّثي الصفحة";

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-2xl border-2 border-brand-emerald/40 bg-brand-emerald/10 px-4 py-3 mb-6"
    >
      <Icon
        className={`size-5 flex-shrink-0 text-brand-emerald ${isActivating ? "animate-spin motion-reduce:animate-none" : ""}`}
        aria-hidden="true"
      />
      <p className="flex-1 text-brand-ink text-sm font-medium leading-relaxed">
        {message}
      </p>
    </div>
  );
}
