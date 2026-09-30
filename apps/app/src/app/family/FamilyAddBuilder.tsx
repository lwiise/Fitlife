"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, User, UserPlus, Baby, HeartPulse, ChefHat } from "lucide-react";
import { MemberWizard } from "./add/MemberWizard";
import { PregLactSwitch } from "./add/PregLactSwitch";
import { HousekeeperForm } from "./add/HousekeeperForm";
import { CheckRow, StepperRow } from "./add/FamilyComposerControls";
import { genderPick } from "@/lib/copy/gender";
import { SPOUSE_ROLE } from "@fitlife/plan-engine/familyRole";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

// One step of the guided sequence. Spouse and maid are singular; the rest carry a count.
type Task =
  | { kind: "spouse" }
  | { kind: "adult"; count: number }
  | { kind: "child"; count: number }
  | { kind: "preg"; count: number }
  | { kind: "maid" };

/**
 * Post-onboarding multi-member add (lives on /family). She first SELECTS the whole
 * composition — checkboxes for the singular roles (spouse, maid) and 0-default
 * steppers for the repeatable ones (adult, child, pregnant/lactating) — then a single
 * guided sequence walks through every selected member's wizard in order, saving each
 * as it's completed. Mirrors the onboarding family builder, but post-onboarding each
 * save regenerates the plan incrementally (the first kicks off the shared-group
 * rebuild; the rest are saved and drained on /plan), so the end lands on /plan.
 *
 * `canAddSpouse` / `canAddHousekeeper` hide those singular rows when one already
 * exists in the household.
 */
export function FamilyAddBuilder({
  canAddSpouse = true,
  canAddHousekeeper = true,
  ownerSex,
}: {
  canAddSpouse?: boolean;
  canAddHousekeeper?: boolean;
  ownerSex?: string | null;
}) {
  const router = useRouter();
  const g = genderPick(ownerSex);
  const [phase, setPhase] = useState<"select" | "fill" | "finalizing">("select");
  const [queue, setQueue] = useState<Task[]>([]);
  const [index, setIndex] = useState(0);

  // Selection: spouse/maid are checkmarks; the rest are 0-default steppers.
  const [spouse, setSpouse] = useState(false);
  const [maid, setMaid] = useState(false);
  const [adult, setAdult] = useState(0);
  const [child, setChild] = useState(0);
  const [preg, setPreg] = useState(0);

  const totalSelected =
    (spouse ? 1 : 0) + (maid ? 1 : 0) + adult + child + preg;

  const start = () => {
    const q: Task[] = [];
    if (spouse) q.push({ kind: "spouse" });
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
    const terminalLabel = isLastTask ? g("أنشئي الخطة", "أنشئ الخطة") : "التالي";
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-surface">
        {task.kind === "spouse" && (
          <MemberWizard
            key={`spouse-${index}`}
            type="adult"
            // A wife as well as a husband: the wizard takes the spouse's sex
            // from the owner's, so it titles her «إضافة الزوجة» and never asks.
            role={SPOUSE_ROLE}
            count={1}
            onComplete={advance}
            terminalLabel={terminalLabel}
            ownerSex={ownerSex}
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
            ownerSex={ownerSex}
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
            ownerSex={ownerSex}
          />
        )}
        {task.kind === "preg" && (
          <PregLactSwitch
            key={`preg-${index}`}
            count={task.count}
            onComplete={advance}
            ownerSex={ownerSex}
          />
        )}
        {task.kind === "maid" && (
          <HousekeeperForm key={`maid-${index}`} onComplete={advance} />
        )}
      </div>
    );
  }

  return (
    <Card aria-labelledby="family-add-title">
      <CardHeader
        id="family-add-title"
        title="إضافة أفراد جدد"
        icon={<UserPlus className="size-5 text-brand-purple-900" aria-hidden="true" />}
        className="mb-1"
      />
      <p className="mb-4 text-meta leading-relaxed text-brand-ink-muted">
        {g(
          "اختاري من تضيفين، ويأخذ كل فرد خطته ضمن وجبات العائلة.",
          "اختر من تضيف، ويأخذ كل فرد خطته ضمن وجبات العائلة.",
        )}
      </p>

      <div className="space-y-2">
        {canAddSpouse && (
          <CheckRow
            label={g("زوج", "زوجة")}
            Icon={User}
            checked={spouse}
            onToggle={() => setSpouse((v) => !v)}
          />
        )}
        <StepperRow label="بالغ ثانٍ" Icon={UserPlus} value={adult} onChange={setAdult} />
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

      <Button
        onClick={start}
        disabled={totalSelected === 0}
        size="lg"
        block
        className="mt-4"
      >
        {totalSelected > 0
          ? g("التالي: أكملي بيانات العائلة", "التالي: أكمل بيانات العائلة")
          : g("اختاري فرداً للإضافة", "اختر فرداً للإضافة")}
      </Button>
    </Card>
  );
}
