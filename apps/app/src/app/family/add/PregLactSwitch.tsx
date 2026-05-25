"use client";

import { useState } from "react";
import { PregnantWizard } from "./wizards/PregnantWizard";
import { LactatingWizard } from "./wizards/LactatingWizard";

/** The "امرأة حامل/مرضعة" picker leads here — choose which, then run the wizard. */
export function PregLactSwitch() {
  const [choice, setChoice] = useState<"pregnant" | "lactating" | null>(null);

  if (choice === "pregnant") return <PregnantWizard role="other_adult" />;
  if (choice === "lactating") return <LactatingWizard role="other_adult" />;

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
      </div>
    </main>
  );
}
