import { Clock, AlertTriangle } from "lucide-react";

import type { SubscriptionRow } from "@/lib/subscription/state";
import { getTrialDaysRemaining } from "@/lib/subscription/state";
import { buildTrialEndsMessage } from "@/lib/subscription/strings";

/**
 * Trial countdown banner. Renders nothing unless the subscription is trialing.
 * Background swaps to warm-orange when 2 or fewer days remain.
 */
export function TrialBanner({ subscription }: { subscription: SubscriptionRow }) {
  if (subscription.status !== "trialing") return null;

  const daysRemaining = getTrialDaysRemaining(subscription);
  const urgent = daysRemaining <= 2;

  const bg = urgent
    ? "bg-brand-warm-orange/15 border-brand-warm-orange/40"
    : "bg-brand-yellow/15 border-brand-yellow/40";
  const iconColor = urgent ? "text-brand-warm-orange" : "text-brand-ink";

  const Icon = urgent ? AlertTriangle : Clock;
  const message = urgent
    ? "تجربتك تنتهي قريباً — اشتركي الآن"
    : buildTrialEndsMessage(daysRemaining);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start sm:items-center gap-3 rounded-2xl border-2 px-4 py-3 mb-6 ${bg}`}
    >
      <Icon
        className={`size-5 flex-shrink-0 mt-0.5 sm:mt-0 ${iconColor}`}
        aria-hidden="true"
      />
      <p className="flex-1 text-brand-ink text-sm font-medium leading-relaxed">
        {message}
      </p>
      <a
        href="/pricing"
        className="flex-shrink-0 inline-flex items-center justify-center bg-brand-ink hover:bg-brand-purple-900 text-white font-bold text-xs px-4 py-2 rounded-full transition-colors min-h-[2.25rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        اختيار خطة
      </a>
    </div>
  );
}
