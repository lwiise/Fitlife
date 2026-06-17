"use client";

import { useState, useTransition } from "react";
import {
  Loader2,
  Check,
  Minus,
  Plus,
  User,
  UserPlus,
  Baby,
  HeartPulse,
  ChefHat,
} from "lucide-react";
import { MemberWizard } from "@/app/family/add/MemberWizard";
import { PregLactSwitch } from "@/app/family/add/PregLactSwitch";
import { HousekeeperForm } from "@/app/family/add/HousekeeperForm";
import { finishOnboardingToSubscription } from "@/app/onboarding/actions";

const MAX = 8;

// One step of the guided sequence. Husband and maid are singular; the rest carry a count.
type Task =
  | { kind: "husband" }
  | { kind: "adult"; count: number }
  | { kind: "child"; count: number }
  | { kind: "preg"; count: number }
  | { kind: "maid" };

/**
 * The onboarding family builder. Reached after mom finishes her profile. She first
 * SELECTS who's in the household (no navigation on tap), then a single CTA walks her
 * through each selected member's details in order — husband → adults → children →
 * pregnant/lactating → maid — and only at the very end finalizes onboarding and
 * generates the whole family at once. Each member is saved as it's completed;
 * generation stays deferred until the sequence ends.
 */
export function OnboardingFamilyBuilder() {
  const [phase, setPhase] = useState<"select" | "fill" | "finalizing">("select");
  const [queue, setQueue] = useState<Task[]>([]);
  const [index, setIndex] = useState(0);
  const [, startTransition] = useTransition();

  // Selection: husband/maid are checkmarks; the rest are 0-default steppers.
  const [husband, setHusband] = useState(false);
  const [maid, setMaid] = useState(false);
  const [adult, setAdult] = useState(0);
  const [child, setChild] = useState(0);
  const [preg, setPreg] = useState(0);

  const totalSelected =
    (husband ? 1 : 0) + (maid ? 1 : 0) + adult + child + preg;

  const finalize = () => {
    setPhase("finalizing");
    startTransition(() => finishOnboardingToSubscription());
  };

  const start = () => {
    const q: Task[] = [];
    if (husband) q.push({ kind: "husband" });
    if (adult > 0) q.push({ kind: "adult", count: adult });
    if (child > 0) q.push({ kind: "child", count: child });
    if (preg > 0) q.push({ kind: "preg", count: preg });
    if (maid) q.push({ kind: "maid" });
    if (q.length === 0) {
      finalize();
      return;
    }
    setQueue(q);
    setIndex(0);
    setPhase("fill");
  };

  const advance = () => {
    if (index + 1 >= queue.length) finalize();
    else setIndex(index + 1);
  };

  if (phase === "finalizing") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-brand-surface px-4 text-center">
        <Loader2
          className="size-8 animate-spin motion-reduce:animate-none text-brand-purple-900"
          aria-hidden="true"
        />
        <p className="text-brand-ink font-bold text-lg">نكمل الإعداد…</p>
        <p className="text-brand-ink-muted text-sm">لحظة من فضلك</p>
      </div>
    );
  }

  if (phase === "fill") {
    const task = queue[index]!;
    const isLastTask = index === queue.length - 1;
    // For MemberWizard tasks, label the very last member "التالي" when more types
    // still follow, so it doesn't read "أنشئي الخطة" mid-sequence.
    const terminalLabel = isLastTask ? "أنشئي الخطة" : "التالي";
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-surface">
        {task.kind === "husband" && (
          <MemberWizard
            key={`husband-${index}`}
            type="adult"
            role="dad"
            onboarding
            count={1}
            onComplete={advance}
            onSkip={finalize}
            terminalLabel={terminalLabel}
          />
        )}
        {task.kind === "adult" && (
          <MemberWizard
            key={`adult-${index}`}
            type="adult"
            role="other_adult"
            onboarding
            count={task.count}
            onComplete={advance}
            onSkip={finalize}
            terminalLabel={terminalLabel}
          />
        )}
        {task.kind === "child" && (
          <MemberWizard
            key={`child-${index}`}
            type="child"
            role="son"
            onboarding
            count={task.count}
            onComplete={advance}
            onSkip={finalize}
            terminalLabel={terminalLabel}
          />
        )}
        {task.kind === "preg" && (
          <PregLactSwitch
            key={`preg-${index}`}
            onboarding
            count={task.count}
            onComplete={advance}
            onSkip={finalize}
          />
        )}
        {task.kind === "maid" && (
          <HousekeeperForm
            key={`maid-${index}`}
            onboarding
            onComplete={advance}
            onSkip={finalize}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="builder-title"
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-xl">
        <header className="space-y-2">
          <h2
            id="builder-title"
            className="font-extrabold text-2xl text-brand-ink leading-tight"
          >
            مين معك في البيت؟
          </h2>
          <p className="text-brand-ink-muted text-sm leading-relaxed">
            أضيفي عيلتك، ولكل واحد خطته — أطباق فردية أو مشتركة، بضغطة وحدة
          </p>
        </header>

        <div className="space-y-2">
          <CheckRow
            label="زوج"
            Icon={User}
            checked={husband}
            onToggle={() => setHusband((v) => !v)}
          />
          <StepperRow label="بالغ ثاني" Icon={UserPlus} value={adult} onChange={setAdult} />
          <StepperRow label="طفل" Icon={Baby} value={child} onChange={setChild} />
          <StepperRow
            label="امرأة حامل/مرضعة"
            Icon={HeartPulse}
            value={preg}
            onChange={setPreg}
          />
          <CheckRow
            label="خدامة تطبخ للعائلة"
            Icon={ChefHat}
            checked={maid}
            onToggle={() => setMaid((v) => !v)}
          />
        </div>

        <div className="space-y-1">
          <button
            type="button"
            onClick={start}
            className="w-full flex items-center justify-center gap-2 min-h-11 bg-brand-ink hover:bg-brand-purple-900 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {totalSelected > 0 ? "التالي — أكملي بيانات العائلة" : "جاهزة — أنشئي خطتي"}
          </button>

          {/* Family is optional — let her skip and add them later from /family.
              Always visible so the way out is clear before any selection. */}
          <button
            type="button"
            onClick={finalize}
            className="w-full min-h-11 text-center text-brand-ink-muted hover:text-brand-ink text-sm font-bold py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          >
            تخطّي الآن — أضيفهم لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckRow({
  label,
  Icon,
  checked,
  onToggle,
}: {
  label: string;
  Icon: typeof User;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`w-full flex items-center gap-3 min-h-11 rounded-xl border px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
        checked
          ? "border-brand-purple-900 bg-brand-lavender/30 text-brand-ink"
          : "border-brand-ink/10 bg-brand-surface/50 text-brand-ink hover:border-brand-purple-900/40"
      }`}
    >
      <span
        className={`size-6 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
          checked ? "bg-brand-purple-900 border-brand-purple-900" : "border-brand-ink/20 bg-white"
        }`}
      >
        {checked && <Check className="size-4 text-white" aria-hidden="true" />}
      </span>
      <Icon className="size-4 text-brand-purple-900 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 text-start">{label}</span>
    </button>
  );
}

function StepperRow({
  label,
  Icon,
  value,
  onChange,
}: {
  label: string;
  Icon: typeof User;
  value: number;
  onChange: (n: number) => void;
}) {
  const set = (n: number) => onChange(Math.min(MAX, Math.max(0, n)));
  return (
    <div className="flex items-center gap-2 rounded-xl border border-brand-ink/10 bg-brand-surface/50 p-1.5 ps-4">
      <Icon className="size-4 text-brand-purple-900 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 text-sm font-bold text-brand-ink">{label}</span>
      <div className="flex items-center gap-0.5 bg-white rounded-lg border border-brand-ink/10 p-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => set(value - 1)}
          disabled={value <= 0}
          aria-label={`إنقاص عدد ${label}`}
          className="size-11 inline-flex items-center justify-center rounded-md text-brand-ink hover:bg-brand-surface disabled:text-brand-ink/25 disabled:hover:bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span
          className="w-6 text-center font-bold text-brand-ink tabular-nums"
          aria-live="polite"
          aria-label={`${label}: ${value}`}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => set(value + 1)}
          disabled={value >= MAX}
          aria-label={`زيادة عدد ${label}`}
          className="size-11 inline-flex items-center justify-center rounded-md text-brand-ink hover:bg-brand-surface disabled:text-brand-ink/25 disabled:hover:bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
