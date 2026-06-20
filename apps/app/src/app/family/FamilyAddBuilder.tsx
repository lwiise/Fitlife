"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, User, UserPlus, Baby, HeartPulse, ChefHat } from "lucide-react";
import { MemberWizard } from "./add/MemberWizard";
import { PregLactSwitch } from "./add/PregLactSwitch";
import { HousekeeperForm } from "./add/HousekeeperForm";
import { CheckRow, StepperRow } from "./add/FamilyComposerControls";

// One step of the guided sequence. Husband and maid are singular; the rest carry a count.
type Task =
  | { kind: "husband" }
  | { kind: "adult"; count: number }
  | { kind: "child"; count: number }
  | { kind: "preg"; count: number }
  | { kind: "maid" };

/**
 * Post-onboarding multi-member add (lives on /family). She first SELECTS the whole
 * composition — checkboxes for the singular roles (husband, maid) and 0-default
 * steppers for the repeatable ones (adult, child, pregnant/lactating) — then a single
 * guided sequence walks through every selected member's wizard in order, saving each
 * as it's completed. Mirrors the onboarding family builder, but post-onboarding each
 * save regenerates the plan incrementally (the first kicks off the shared-group
 * rebuild; the rest are saved and drained on /plan), so the end lands on /plan.
 *
 * `canAddHusband` / `canAddHousekeeper` hide those singular rows when one already
 * exists in the household.
 */
export function FamilyAddBuilder({
  canAddHusband = true,
  canAddHousekeeper = true,
}: {
  canAddHusband?: boolean;
  canAddHousekeeper?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"select" | "fill" | "finalizing">("select");
  const [queue, setQueue] = useState<Task[]>([]);
  const [index, setIndex] = useState(0);

  // Selection: husband/maid are checkmarks; the rest are 0-default steppers.
  const [husband, setHusband] = useState(false);
  const [maid, setMaid] = useState(false);
  const [adult, setAdult] = useState(0);
  const [child, setChild] = useState(0);
  const [preg, setPreg] = useState(0);

  const totalSelected =
    (husband ? 1 : 0) + (maid ? 1 : 0) + adult + child + preg;

  const start = () => {
    const q: Task[] = [];
    if (husband) q.push({ kind: "husband" });
    if (adult > 0) q.push({ kind: "adult", count: adult });
    if (child > 0) q.push({ kind: "child", count: child });
    if (preg > 0) q.push({ kind: "preg", count: preg });
    if (maid) q.push({ kind: "maid" });
    if (q.length === 0) return;
    setQueue(q);
    setIndex(0);
    setPhase("fill");
  };

  // Each member's plan generation already fired (incrementally) as it was saved, so
  // the end just lands on /plan, which shows progress and drains any deferred members.
  const finish = () => {
    setPhase("finalizing");
    router.push("/plan");
  };

  const advance = () => {
    if (index + 1 >= queue.length) finish();
    else setIndex(index + 1);
  };

  if (phase === "finalizing") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-brand-surface px-4 text-center">
        <Loader2
          className="size-8 animate-spin motion-reduce:animate-none text-brand-purple-900"
          aria-hidden="true"
        />
        <p className="text-brand-ink font-bold text-lg">نحضّر خطط العائلة…</p>
        <p className="text-brand-ink-muted text-sm">لحظة من فضلك</p>
      </div>
    );
  }

  if (phase === "fill") {
    const task = queue[index]!;
    const isLastTask = index === queue.length - 1;
    // Label the very last member "أنشئي الخطة"; earlier ones continue with "التالي".
    const terminalLabel = isLastTask ? "أنشئي الخطة" : "التالي";
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-surface">
        {task.kind === "husband" && (
          <MemberWizard
            key={`husband-${index}`}
            type="adult"
            role="dad"
            count={1}
            onComplete={advance}
            terminalLabel={terminalLabel}
          />
        )}
        {task.kind === "adult" && (
          <MemberWizard
            key={`adult-${index}`}
            type="adult"
            role="other_adult"
            count={task.count}
            onComplete={advance}
            terminalLabel={terminalLabel}
          />
        )}
        {task.kind === "child" && (
          <MemberWizard
            key={`child-${index}`}
            type="child"
            role="son"
            count={task.count}
            onComplete={advance}
            terminalLabel={terminalLabel}
          />
        )}
        {task.kind === "preg" && (
          <PregLactSwitch key={`preg-${index}`} count={task.count} onComplete={advance} />
        )}
        {task.kind === "maid" && (
          <HousekeeperForm key={`maid-${index}`} onComplete={advance} />
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-dashed border-brand-purple-900/30">
      <p className="font-bold text-brand-ink text-sm">إضافة أفراد جدد</p>
      <p className="mt-1 mb-4 text-brand-ink-muted text-xs leading-relaxed">
        اختاري مين تضيفين، وكل فرد ياخذ خطته ضمن وجبات العائلة.
      </p>

      <div className="space-y-2">
        {canAddHusband && (
          <CheckRow
            label="زوج"
            Icon={User}
            checked={husband}
            onToggle={() => setHusband((v) => !v)}
          />
        )}
        <StepperRow label="بالغ ثاني" Icon={UserPlus} value={adult} onChange={setAdult} />
        <StepperRow label="طفل" Icon={Baby} value={child} onChange={setChild} />
        <StepperRow
          label="امرأة حامل/مرضعة"
          Icon={HeartPulse}
          value={preg}
          onChange={setPreg}
        />
        {canAddHousekeeper && (
          <CheckRow
            label="خدامة تطبخ للعائلة"
            Icon={ChefHat}
            checked={maid}
            onToggle={() => setMaid((v) => !v)}
          />
        )}
      </div>

      <button
        type="button"
        onClick={start}
        disabled={totalSelected === 0}
        className="mt-4 w-full flex items-center justify-center gap-2 min-h-11 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/30 disabled:cursor-not-allowed text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        {totalSelected > 0 ? "التالي — أكملي بيانات العائلة" : "اختاري فرداً للإضافة"}
      </button>
    </div>
  );
}
