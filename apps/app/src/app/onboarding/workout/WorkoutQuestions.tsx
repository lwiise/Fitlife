"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronRight, Loader2 } from "lucide-react";
import type { WorkoutProfile } from "@fitlife/plan-engine";
import { saveWorkoutProfiles, continueAfterWorkoutOptIn } from "./actions";

export interface WorkoutPerson {
  target: "mom" | string;
  name: string;
  existing: WorkoutProfile | null;
}

const LOCATIONS = [
  { value: "home", label: "المنزل" },
  { value: "gym", label: "النادي" },
  { value: "both", label: "كلاهما" },
] as const;
const EQUIPMENT = [
  { value: "none", label: "بدون أدوات" },
  { value: "dumbbells", label: "دمبل" },
  { value: "bands", label: "أحبال مقاومة" },
  { value: "machines", label: "أجهزة" },
] as const;
const INJURIES = [
  { value: "shoulder", label: "الكتف" },
  { value: "knee", label: "الركبة" },
  { value: "back", label: "الظهر" },
  { value: "other", label: "أخرى" },
] as const;
const DAYS = [3, 4, 5, 6] as const;
const FOCUS = [
  { value: "full_body", label: "الجسم كامل" },
  { value: "core", label: "البطن والكور" },
  { value: "lower_glutes", label: "الأرجل والمؤخرة" },
  { value: "strength", label: "القوة العامة" },
  { value: "endurance", label: "اللياقة والتحمل" },
  { value: "definition", label: "إبراز التفاصيل العضلية" },
  { value: "balanced", label: "برنامج متوازن" },
] as const;
const EXPERIENCE = [
  { value: "beginner", label: "مبتدئة" },
  { value: "intermediate", label: "متوسطة" },
  { value: "advanced", label: "متقدمة" },
] as const;
const SESSION = [
  { value: "m20_30", label: "20-30 دقيقة" },
  { value: "m30_45", label: "30-45 دقيقة" },
  { value: "m45_60", label: "45-60 دقيقة" },
] as const;

type Draft = {
  location: WorkoutProfile["location"] | "";
  equipment: WorkoutProfile["equipment"];
  injuries: WorkoutProfile["injuries"];
  injury_notes: string;
  desired_days: WorkoutProfile["desired_days"] | 0;
  focus_areas: WorkoutProfile["focus_areas"];
  experience: WorkoutProfile["experience"] | "";
  session_minutes: WorkoutProfile["session_minutes"] | "";
};

function draftFrom(existing: WorkoutProfile | null): Draft {
  return {
    location: existing?.location ?? "",
    equipment: existing?.equipment ?? [],
    injuries: existing?.injuries ?? [],
    injury_notes: existing?.injury_notes ?? "",
    desired_days: existing?.desired_days ?? 0,
    focus_areas: existing?.focus_areas ?? [],
    experience: existing?.experience ?? "",
    session_minutes: existing?.session_minutes ?? "",
  };
}

// The 7 questions split into three short screens per person, matching the mom
// wizard's one-focus-per-screen rhythm. Aspirational first (what the program
// looks like), logistics second, safety last — each screen validates itself so
// errors are always in view on a phone.
const STEPS = [
  {
    key: "shape",
    title: "شكل البرنامج",
    description: "مناطق التركيز وعدد الأيام ومدة كل جلسة.",
    validate: (d: Draft): string | null => {
      if (d.focus_areas.length === 0) return "اختاري منطقة تركيز واحدة على الأقل";
      if (!d.desired_days) return "حدّدي أيام التدريب";
      if (!d.session_minutes) return "حدّدي مدة الجلسة";
      return null;
    },
  },
  {
    key: "place",
    title: "مكان التدريب وأدواته",
    description: "نختار تمارين تناسب المكان والأدوات المتاحة.",
    validate: (d: Draft): string | null =>
      d.location ? null : "اختاري مكان التدريب",
  },
  {
    key: "safety",
    title: "الخبرة والسلامة",
    description: "نضبط شدة التمارين حسب الخبرة ونراعي أي إصابة.",
    validate: (d: Draft): string | null =>
      d.experience ? null : "حدّدي مستوى الخبرة",
  },
] as const;

function OptionButton({
  active,
  onClick,
  children,
  full,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-2xl border-2 px-4 py-3 text-sm font-bold text-brand-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
        full ? "w-full text-start" : ""
      } ${
        active
          ? "border-brand-purple-900 bg-brand-purple-900/5"
          : "border-brand-ink/10 bg-white hover:border-brand-ink/20"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold text-brand-ink mb-2">{label}</p>
      {children}
    </div>
  );
}

export function WorkoutQuestions({ people }: { people: WorkoutPerson[] }) {
  const reduceMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Which people are opted in (all pre-selected; the mom row is fixed).
  const [selected, setSelected] = useState<Set<string>>(
    new Set(people.map((p) => p.target)),
  );
  // Solo flows skip the selection screen — one pre-selected row is a wasted tap.
  const hasSelectionScreen = people.length > 1;
  const [personIndex, setPersonIndex] = useState(hasSelectionScreen ? -1 : 0); // -1 = selection screen
  const [stepIndex, setStepIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(people.map((p) => [p.target, draftFrom(p.existing)])),
  );

  const chosen = people.filter((p) => selected.has(p.target));
  const current = personIndex >= 0 ? chosen[personIndex] : undefined;
  const draft = current ? drafts[current.target]! : undefined;
  const stepDef = STEPS[stepIndex] ?? STEPS[0];

  // Overall progress across every screen in the flow. The total stretches as
  // people are toggled on the selection screen — the bar reflects it honestly.
  const totalScreens =
    (hasSelectionScreen ? 1 : 0) + STEPS.length * Math.max(chosen.length, 1);
  const screenNumber =
    personIndex === -1
      ? 1
      : (hasSelectionScreen ? 1 : 0) + personIndex * STEPS.length + stepIndex + 1;

  const setDraft = (patch: Partial<Draft>) => {
    if (!current) return;
    setDrafts((d) => ({ ...d, [current.target]: { ...d[current.target]!, ...patch } }));
  };

  const toggleArr = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const goTo = (p: number, s: number) => {
    setPersonIndex(p);
    setStepIndex(s);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const submitAll = () => {
    // Safety net: land on the first incomplete screen instead of failing the
    // server-side parse (per-step validation should already have caught it).
    for (let p = 0; p < chosen.length; p++) {
      const d = drafts[chosen[p]!.target]!;
      for (let s = 0; s < STEPS.length; s++) {
        const problem = STEPS[s]!.validate(d);
        if (problem) {
          goTo(p, s);
          setError(problem);
          return;
        }
      }
    }
    startTransition(async () => {
      const entries = chosen.map((p) => {
        const d = drafts[p.target]!;
        return {
          target: p.target,
          profile: {
            location: d.location as WorkoutProfile["location"],
            equipment: d.location === "gym" ? [] : d.equipment,
            injuries: d.injuries,
            injury_notes: d.injuries.length > 0 ? d.injury_notes.trim() || null : null,
            desired_days: d.desired_days as WorkoutProfile["desired_days"],
            focus_areas: d.focus_areas,
            experience: d.experience as WorkoutProfile["experience"],
            session_minutes: d.session_minutes as WorkoutProfile["session_minutes"],
          },
        };
      });
      const saved = await saveWorkoutProfiles(entries);
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      await continueAfterWorkoutOptIn();
    });
  };

  const next = () => {
    setError(null);
    if (personIndex === -1) {
      if (chosen.length === 0) return setError("اختاري فرداً واحداً على الأقل");
      goTo(0, 0);
      return;
    }
    const problem = stepDef.validate(draft!);
    if (problem) return setError(problem);
    if (stepIndex + 1 < STEPS.length) return goTo(personIndex, stepIndex + 1);
    if (personIndex + 1 < chosen.length) return goTo(personIndex + 1, 0);
    submitAll();
  };

  const back = () => {
    setError(null);
    if (stepIndex > 0) return goTo(personIndex, stepIndex - 1);
    if (personIndex > 0) return goTo(personIndex - 1, STEPS.length - 1);
    if (hasSelectionScreen && personIndex === 0) return goTo(-1, 0);
  };

  const canGoBack =
    personIndex >= 0 && (stepIndex > 0 || personIndex > 0 || hasSelectionScreen);
  const isLastScreen =
    personIndex >= 0 &&
    personIndex + 1 === chosen.length &&
    stepIndex + 1 === STEPS.length;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-bold text-base text-brand-ink">أسئلة خطة التمارين</h1>
          <span className="text-brand-ink-muted text-xs font-medium tabular-nums">
            {screenNumber} / {totalScreens}
          </span>
        </div>
        <div
          className="h-1.5 bg-white rounded-full overflow-hidden"
          role="progressbar"
          aria-label="تقدم أسئلة التمارين"
          aria-valuenow={screenNumber}
          aria-valuemin={1}
          aria-valuemax={totalScreens}
          aria-valuetext={`الشاشة ${screenNumber} من ${totalScreens}`}
        >
          <motion.div
            className="h-full bg-gradient-to-l from-brand-purple-900 via-brand-pink to-brand-yellow"
            initial={false}
            animate={{ width: `${(screenNumber / totalScreens) * 100}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${personIndex}-${stepIndex}`}
          initial={{ opacity: 0, x: reduceMotion ? 0 : 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduceMotion ? 0 : -30 }}
          transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
          className="space-y-5"
        >
          {personIndex === -1 && (
            <>
              <header>
                <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                  لمن خطة التمارين؟
                </h2>
                <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                  سبع إجابات قصيرة لكل فرد تكفي لبرنامج أسبوعي مفصّل. أزيلي من لا
                  يرغب بخطة تمارين.
                </p>
              </header>
              <div className="space-y-2">
                {people.map((p) => (
                  <OptionButton
                    key={p.target}
                    full
                    active={selected.has(p.target)}
                    onClick={() =>
                      setSelected((s) => {
                        const nextSet = new Set(s);
                        if (nextSet.has(p.target)) nextSet.delete(p.target);
                        else nextSet.add(p.target);
                        return nextSet;
                      })
                    }
                  >
                    {p.name}
                  </OptionButton>
                ))}
              </div>
            </>
          )}

          {current && draft && (
            <>
              <header>
                {people.length > 1 && (
                  <p className="text-sm font-bold text-brand-purple-900 mb-1">
                    {current.name} · {personIndex + 1} من {chosen.length}
                  </p>
                )}
                <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                  {stepDef.title}
                </h2>
                <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                  {stepDef.description}
                </p>
              </header>

              {stepDef.key === "shape" && (
                <>
                  <Field label="مناطق التركيز (يمكن اختيار أكثر من خيار)">
                    <div className="flex flex-wrap gap-2">
                      {FOCUS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() =>
                            setDraft({ focus_areas: toggleArr(draft.focus_areas, o.value) })
                          }
                          aria-pressed={draft.focus_areas.includes(o.value)}
                          className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                            draft.focus_areas.includes(o.value)
                              ? "border-brand-purple-900 bg-brand-purple-900/10 text-brand-purple-900"
                              : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-purple-900/40"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="كم يوماً في الأسبوع؟">
                    <div className="grid grid-cols-4 gap-2">
                      {DAYS.map((d) => (
                        <OptionButton
                          key={d}
                          active={draft.desired_days === d}
                          onClick={() => setDraft({ desired_days: d })}
                        >
                          {String(d)}
                        </OptionButton>
                      ))}
                    </div>
                  </Field>

                  <Field label="مدة الجلسة">
                    <div className="grid grid-cols-3 gap-2">
                      {SESSION.map((o) => (
                        <OptionButton
                          key={o.value}
                          active={draft.session_minutes === o.value}
                          onClick={() => setDraft({ session_minutes: o.value })}
                        >
                          {o.label}
                        </OptionButton>
                      ))}
                    </div>
                  </Field>
                </>
              )}

              {stepDef.key === "place" && (
                <>
                  <Field label="أين ستكون التمارين؟">
                    <div className="grid grid-cols-3 gap-2">
                      {LOCATIONS.map((o) => (
                        <OptionButton
                          key={o.value}
                          active={draft.location === o.value}
                          onClick={() => setDraft({ location: o.value })}
                        >
                          {o.label}
                        </OptionButton>
                      ))}
                    </div>
                  </Field>

                  {draft.location !== "gym" && draft.location !== "" && (
                    <Field label="الأدوات المتاحة في المنزل (يمكن اختيار أكثر من خيار)">
                      <div className="grid grid-cols-2 gap-2">
                        {EQUIPMENT.map((o) => (
                          <OptionButton
                            key={o.value}
                            active={draft.equipment.includes(o.value)}
                            onClick={() =>
                              setDraft({ equipment: toggleArr(draft.equipment, o.value) })
                            }
                          >
                            {o.label}
                          </OptionButton>
                        ))}
                      </div>
                    </Field>
                  )}
                </>
              )}

              {stepDef.key === "safety" && (
                <>
                  <Field label="مستوى الخبرة">
                    <div className="grid grid-cols-3 gap-2">
                      {EXPERIENCE.map((o) => (
                        <OptionButton
                          key={o.value}
                          active={draft.experience === o.value}
                          onClick={() => setDraft({ experience: o.value })}
                        >
                          {o.label}
                        </OptionButton>
                      ))}
                    </div>
                  </Field>

                  <Field label="هل توجد إصابة أو مشكلة تمنع بعض التمارين؟">
                    <div className="grid grid-cols-4 gap-2">
                      {INJURIES.map((o) => (
                        <OptionButton
                          key={o.value}
                          active={draft.injuries.includes(o.value)}
                          onClick={() =>
                            setDraft({ injuries: toggleArr(draft.injuries, o.value) })
                          }
                        >
                          {o.label}
                        </OptionButton>
                      ))}
                    </div>
                    {draft.injuries.length > 0 && (
                      <input
                        type="text"
                        value={draft.injury_notes}
                        onChange={(e) => setDraft({ injury_notes: e.target.value })}
                        maxLength={300}
                        placeholder="وضّحي الإصابة باختصار (اختياري)"
                        className="mt-2 w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                      />
                    )}
                  </Field>
                </>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-700 text-sm leading-relaxed">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={next}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        {isPending && (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        )}
        {isLastScreen ? "حفظ ومتابعة" : "التالي"}
      </button>

      {canGoBack && (
        <button
          type="button"
          onClick={back}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-3 py-2 -ms-3 text-brand-ink-muted hover:text-brand-ink text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
          رجوع
        </button>
      )}
    </div>
  );
}
