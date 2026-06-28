"use client";

// Renders one appended exercise step. Fully controlled by the shared
// useExerciseProfile state; self-validates and shows an inline error so it can be
// dropped into any host wizard (MemberWizard inline, or the Mom exercise screen)
// without threading error state. Visuals reuse the meal-wizard primitives 1:1.

import { useState } from "react";
import {
  AVAILABILITY_OPTIONS,
  DELIVERY_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXERCISE_FOCUS_OPTIONS,
  EXERCISE_SYMPTOM_OPTIONS,
  EXERCISE_TYPE_OPTIONS,
  MSK_REGION_OPTIONS,
  SESSION_MINUTES_OPTIONS,
  SETTING_OPTIONS,
} from "@/lib/exercise/constants";
import {
  NumberField,
  OptionButton,
  PillGroup,
  PrimaryButton,
  StepHeader,
  TextField,
} from "./primitives";
import type { ExerciseStepKey } from "./exerciseSteps";
import type { ExerciseApi, ExerciseState } from "./useExerciseProfile";

type Ex = ExerciseApi;

const SYMPTOM_OPTIONS_WITH_NONE = [
  ...EXERCISE_SYMPTOM_OPTIONS.map((s) => ({ value: s.slug, label_ar: s.label_ar })),
  { value: "none", label_ar: "ولا واحد منهم" },
];

export function ExerciseStepView({
  stepKey,
  ex,
  onNext,
  primaryLabel,
  isPending,
}: {
  stepKey: ExerciseStepKey;
  ex: Ex;
  onNext: () => void;
  primaryLabel: string;
  isPending?: boolean;
}) {
  const { state, set, toggle, toggleSymptom } = ex;
  const [error, setError] = useState<string | null>(null);

  // Advance only if the step's required fields are filled.
  const advance = (validate?: () => string | null) => {
    const msg = validate?.() ?? null;
    if (msg) return setError(msg);
    setError(null);
    onNext();
  };

  const yesNo = (
    value: boolean | null,
    onPick: (v: boolean) => void,
    label: string,
  ) => (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
      <OptionButton active={value === false} onClick={() => onPick(false)}>
        لا
      </OptionButton>
      <OptionButton active={value === true} onClick={() => onPick(true)}>
        نعم
      </OptionButton>
    </div>
  );

  const body = renderBody(stepKey, state, set, toggle, toggleSymptom, yesNo);

  return (
    <div className="space-y-6">
      {body.content}
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-700 text-sm leading-relaxed">{error}</p>
        </div>
      )}
      <PrimaryButton onClick={() => advance(body.validate)} isPending={isPending}>
        {primaryLabel}
      </PrimaryButton>
    </div>
  );
}

// Returns the step's input UI + an optional validator. Kept as a plain function so
// the PrimaryButton can live once, below, with shared error handling.
function renderBody(
  key: ExerciseStepKey,
  state: ExerciseState,
  set: Ex["set"],
  toggle: Ex["toggle"],
  toggleSymptom: Ex["toggleSymptom"],
  yesNo: (
    value: boolean | null,
    onPick: (v: boolean) => void,
    label: string,
  ) => React.ReactNode,
): { content: React.ReactNode; validate?: () => string | null } {
  switch (key) {
    case "exerciseOptIn":
      return {
        content: (
          <>
            <StepHeader
              title="تبين خطة تمارين مع خطتك الغذائية؟"
              subtitle="نقدر نضيف خطة حركة على مقاسك، أو نكمل بالأكل بس."
            />
            <div className="grid gap-2">
              <OptionButton full active={state.optedIn === false} onClick={() => set("optedIn", false)}>
                الأكل بس
              </OptionButton>
              <OptionButton full active={state.optedIn === true} onClick={() => set("optedIn", true)}>
                أكل + تمارين
              </OptionButton>
            </div>
          </>
        ),
        validate: () => (state.optedIn == null ? "اختاري خيارك أولاً" : null),
      };

    case "exFocus":
      return {
        content: (
          <>
            <StepHeader title="وش تركيز التمارين اللي تبينه؟" subtitle="اختاري واحد، أو تجاوزي." />
            <div className="grid grid-cols-2 gap-2">
              {EXERCISE_FOCUS_OPTIONS.map((o) => (
                <OptionButton key={o.value} active={state.focus === o.value} onClick={() => set("focus", o.value)}>
                  {o.label_ar}
                </OptionButton>
              ))}
            </div>
          </>
        ),
      };

    case "exMsk":
      return {
        content: (
          <>
            <StepHeader
              title="عندك إصابات أو آلام بالمفاصل؟"
              subtitle="اختاري المناطق، أو تجاوزي إذا ما فيه."
            />
            <PillGroup options={MSK_REGION_OPTIONS} selected={state.mskRegions} onToggle={(v) => toggle("mskRegions", v)} ariaLabel="المناطق اللي فيها إصابة أو ألم" />
            <TextField
              id="ex-msk-notes"
              label="أي عمليات سابقة أو محدودية بالحركة؟ (اختياري)"
              value={state.mskNotes}
              onChange={(v) => set("mskNotes", v)}
              placeholder="اكتبيها هنا"
            />
          </>
        ),
      };

    case "exAvailability":
      return {
        content: (
          <>
            <StepHeader title="كم تقدرين تتمرنين؟" />
            <div>
              <p id="ex-days-label" className="text-sm font-bold text-brand-ink mb-2">كم يوم بالأسبوع؟</p>
              <div role="group" aria-labelledby="ex-days-label" className="grid grid-cols-3 gap-2">
                {AVAILABILITY_OPTIONS.map((o) => (
                  <OptionButton
                    key={o.value}
                    active={state.availabilityDays === o.value}
                    onClick={() => set("availabilityDays", o.value)}
                  >
                    {o.label_ar}
                  </OptionButton>
                ))}
              </div>
            </div>
            <div>
              <p id="ex-minutes-label" className="text-sm font-bold text-brand-ink mb-2">كم دقيقة بالجلسة؟</p>
              <div role="group" aria-labelledby="ex-minutes-label" className="grid grid-cols-3 gap-2">
                {SESSION_MINUTES_OPTIONS.map((o) => (
                  <OptionButton
                    key={o.value}
                    active={state.sessionMinutes === o.value}
                    onClick={() => set("sessionMinutes", o.value)}
                  >
                    {o.label_ar}
                  </OptionButton>
                ))}
              </div>
            </div>
          </>
        ),
        validate: () =>
          state.availabilityDays == null || state.sessionMinutes == null
            ? "اختاري عدد الأيام والمدة"
            : null,
      };

    case "exTypes":
      return {
        content: (
          <>
            <StepHeader title="وش التمارين اللي تحبينها؟" subtitle="اختاري المفضلة." />
            <PillGroup options={EXERCISE_TYPE_OPTIONS} selected={state.preferredTypes} onToggle={(v) => toggle("preferredTypes", v)} ariaLabel="التمارين المفضلة" />
            <div>
              <p className="text-sm font-bold text-brand-ink mb-2">وأي نوع ما تحبينه؟ (اختياري)</p>
              <PillGroup options={EXERCISE_TYPE_OPTIONS} selected={state.dislikedTypes} onToggle={(v) => toggle("dislikedTypes", v)} ariaLabel="التمارين اللي ما تحبينها" />
            </div>
          </>
        ),
      };

    case "exSetting":
      return {
        content: (
          <>
            <StepHeader title="وين بتتمرنين؟" />
            <div className="grid grid-cols-3 gap-2">
              {SETTING_OPTIONS.map((o) => (
                <OptionButton key={o.value} active={state.setting === o.value} onClick={() => set("setting", o.value)}>
                  {o.label_ar}
                </OptionButton>
              ))}
            </div>
            <div>
              <p className="text-sm font-bold text-brand-ink mb-2">وش متوفر عندك؟</p>
              <PillGroup options={EQUIPMENT_OPTIONS} selected={state.equipment} onToggle={(v) => toggle("equipment", v)} ariaLabel="الأدوات المتوفرة" />
            </div>
          </>
        ),
        validate: () => (state.setting == null ? "اختاري مكان التمرين" : null),
      };

    case "exHrMeds":
      return {
        content: (
          <>
            <StepHeader
              title="تاخذين حاصرات بيتا أو أدوية ضغط/قلب؟"
              subtitle="يأثر على طريقة حساب شدة التمرين."
            />
            {yesNo(state.hrMeds, (v) => set("hrMeds", v), "أدوية الضغط أو القلب")}
          </>
        ),
        validate: () => (state.hrMeds == null ? "اختاري نعم أو لا" : null),
      };

    case "exRestingHr":
      return {
        content: (
          <>
            <StepHeader title="نبض القلب وقت الراحة؟" subtitle="اختياري — يضبّط مناطق نبضك بشكل أدق." />
            <NumberField
              id="ex-resting-hr"
              label="النبض (نبضة/دقيقة)"
              value={state.restingHr}
              onChange={(v) => set("restingHr", v)}
              placeholder="65"
            />
          </>
        ),
      };

    case "exSymptoms":
      return {
        content: (
          <>
            <StepHeader
              title="قبل ما نبدأ — أي من هذي الأعراض؟"
              subtitle="لسلامتك. اختاري اللي ينطبق، أو 'ولا واحد منهم'."
            />
            <PillGroup
              options={SYMPTOM_OPTIONS_WITH_NONE}
              selected={state.symptoms}
              onToggle={(v) => toggleSymptom(String(v))}
              ariaLabel="الأعراض"
              accent="pink"
            />
          </>
        ),
        validate: () => (state.symptoms.length === 0 ? "اختاري إجابة، أو 'ولا واحد منهم'" : null),
      };

    case "exChildActivities":
      return {
        content: (
          <>
            <StepHeader
              title="أي حركة أو لعب يحبه الطفل؟"
              subtitle="يساعدنا نبني له خطة أفضل. أي محدودية في حركته؟ اكتبيها، أو تجاوزي."
            />
            <TextField
              id="ex-child-activities"
              label="الحركة المفضلة / أي محدودية (اختياري)"
              value={state.childActivities}
              onChange={(v) => set("childActivities", v)}
              placeholder="مثلاً: يحب الكورة، يسبح"
            />
          </>
        ),
      };

    case "exDelivery":
      return {
        content: (
          <>
            <StepHeader title="كانت الولادة طبيعية أو قيصرية؟" subtitle="يغيّر التحميل الآمن وتوقيت البداية." />
            <div className="grid grid-cols-2 gap-2">
              {DELIVERY_OPTIONS.map((o) => (
                <OptionButton key={o.value} active={state.deliveryType === o.value} onClick={() => set("deliveryType", o.value)}>
                  {o.label_ar}
                </OptionButton>
              ))}
            </div>
          </>
        ),
        validate: () => (state.deliveryType == null ? "اختاري نوع الولادة" : null),
      };

    case "exPelvicFloor":
      return {
        content: (
          <>
            <StepHeader
              title="عندك مشاكل بقاع الحوض أو انفصال بعضلات البطن؟"
              subtitle="يساعدنا نتجنب تمارين تضرّك."
            />
            {yesNo(state.pelvicFloor, (v) => set("pelvicFloor", v), "مشاكل قاع الحوض أو عضلات البطن")}
          </>
        ),
        validate: () => (state.pelvicFloor == null ? "اختاري نعم أو لا" : null),
      };
  }
}
