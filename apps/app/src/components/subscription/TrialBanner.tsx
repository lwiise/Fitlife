import { Clock, AlertTriangle, Check, ChefHat } from "lucide-react";

import type { SubscriptionRow } from "@/lib/subscription/state";
import { getTrialDaysRemaining } from "@/lib/subscription/state";
import { buildTrialEndsMessage } from "@/lib/subscription/strings";

/**
 * The day-3 activation checklist inside the trial window. Health & Fitness
 * trial conversions are bimodal (day 0 or days 4–7): these three steps walk
 * the trial user to the product's aha moments BEFORE the decision window.
 * All states are DB-derived — nothing is tracked client-side.
 */
export interface TrialChecklist {
  planReady: boolean;
  advisorTried: boolean;
  weightLogged: boolean;
  /** The cook-view handoff — only for non-Arabic housekeeper households. */
  showHousekeeperStep: boolean;
}

function ChecklistRow({
  done,
  href,
  label,
}: {
  done: boolean;
  href: string;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`size-5 rounded-full flex items-center justify-center flex-shrink-0 ${
          done
            ? "bg-brand-purple-900 text-white"
            : "border-2 border-brand-ink/25"
        }`}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </span>
      {done ? (
        <span className="text-sm text-brand-ink-muted line-through">{label}</span>
      ) : (
        <a
          href={href}
          className="text-sm font-bold text-brand-purple-900 underline underline-offset-4 hover:text-brand-purple-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 min-h-11 inline-flex items-center"
        >
          {label}
        </a>
      )}
    </li>
  );
}

/**
 * Trial countdown banner. Renders nothing unless the subscription is trialing.
 * Background swaps to warm-orange when 2 or fewer days remain. When a
 * checklist is provided and incomplete, the banner carries the three steps.
 */
export function TrialBanner({
  subscription,
  checklist,
}: {
  subscription: SubscriptionRow;
  checklist?: TrialChecklist;
}) {
  if (subscription.status !== "trialing") return null;

  const daysRemaining = getTrialDaysRemaining(subscription);
  const urgent = daysRemaining <= 2;

  const steps = checklist
    ? [
        { done: checklist.planReady, href: "/plan", label: "أنشئي خطة بيتك" },
        { done: checklist.advisorTried, href: "/chat", label: "اسألي المستشارة سؤالك الأول" },
        { done: checklist.weightLogged, href: "/journey", label: "سجّلي وزنك الأول — لكِ وحدك" },
      ]
    : null;
  const showChecklist = steps !== null && steps.some((s) => !s.done);

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
      className={`rounded-2xl border-2 px-4 py-3 mb-6 ${bg}`}
    >
      <div className="flex items-start sm:items-center gap-3">
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

      {showChecklist && steps && (
        <div className="mt-3 pt-3 border-t border-brand-ink/10">
          <p className="text-xs font-bold text-brand-ink-muted mb-2">
            جرّبي هذه الثلاث خلال تجربتك — لتقرري عن معرفة
          </p>
          <ul className="space-y-1.5 list-none p-0 m-0">
            {steps.map((s) => (
              <ChecklistRow key={s.label} {...s} />
            ))}
          </ul>
          {checklist?.showHousekeeperStep && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-brand-ink-muted">
              <ChefHat className="size-3.5 flex-shrink-0" aria-hidden="true" />
              <span>
                وعندك أيضاً{" "}
                <a
                  href="/plan/housekeeper"
                  className="font-bold text-brand-purple-900 underline underline-offset-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                >
                  وصفات الطبخ بلغة الخدامة
                </a>{" "}
                — أريها إياها مرة واحدة وتدبّر الباقي
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
