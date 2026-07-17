"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PregnantWizard } from "./wizards/PregnantWizard";
import { LactatingWizard } from "./wizards/LactatingWizard";

/**
 * The "امرأة حامل/مرضعة" picker leads here — choose which, then run the wizard.
 * The choice applies to the whole batch of `count`: to mix one pregnant and one
 * lactating, add them in two passes (the pop-up repeats) with count 1 each.
 */
export function PregLactSwitch({
  onboarding = false,
  count = 1,
  onComplete,
  onSkip,
}: {
  onboarding?: boolean;
  count?: number;
  onComplete?: () => void;
  // When provided (the onboarding family builder), renders a "skip for now" escape
  // hatch so she can generate the plan now and add this member later.
  onSkip?: () => void;
}) {
  const [choice, setChoice] = useState<"pregnant" | "lactating" | null>(null);

  if (choice === "pregnant")
    return (
      <PregnantWizard
        role="other_adult"
        onboarding={onboarding}
        count={count}
        onComplete={onComplete}
        onSkip={onSkip}
      />
    );
  if (choice === "lactating")
    return (
      <LactatingWizard
        role="other_adult"
        onboarding={onboarding}
        count={count}
        onComplete={onComplete}
        onSkip={onSkip}
      />
    );

  return (
    <main className="min-h-screen bg-brand-surface">
      <div className="container-app py-8 md:py-12 max-w-2xl space-y-6">
        <header>
          <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
            حامل أو مرضعة؟
          </h1>
          <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
            نختار الأسئلة المناسبة لحالتها.
          </p>
        </header>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setChoice("pregnant")}
            className="min-h-11 rounded-xl border border-brand-ink/10 bg-white px-4 py-6 text-base font-bold text-brand-ink hover:border-brand-purple-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          >
            حامل
          </button>
          <button
            type="button"
            onClick={() => setChoice("lactating")}
            className="min-h-11 rounded-xl border border-brand-ink/10 bg-white px-4 py-6 text-base font-bold text-brand-ink hover:border-brand-purple-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          >
            مرضعة
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          {!onComplete ? (
            // URL-driven visit: exit to where she came from. The onboarding
            // builder (onComplete set) has its own escapes — don't leave mid-flow.
            <Link
              href={onboarding ? "/onboarding/members" : "/family"}
              className="inline-flex items-center gap-1 min-h-11 px-3 -ms-3 text-brand-ink-muted hover:text-brand-ink text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface rounded-md"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
              {onboarding ? "رجوع" : "رجوع للعائلة"}
            </Link>
          ) : (
            <span />
          )}

          {/* Family is optional — let her bail out and generate the plan now. */}
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex items-center min-h-11 px-3 -me-3 text-brand-ink-muted hover:text-brand-ink text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface rounded-md"
            >
              تخطّي الآن — أضيفهم لاحقاً
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
