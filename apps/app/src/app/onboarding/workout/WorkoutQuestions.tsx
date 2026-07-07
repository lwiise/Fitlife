"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Which people are opted in (all pre-selected; the mom row is fixed).
  const [selected, setSelected] = useState<Set<string>>(
    new Set(people.map((p) => p.target)),
  );
  const [personIndex, setPersonIndex] = useState(-1); // -1 = selection screen
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(people.map((p) => [p.target, draftFrom(p.existing)])),
  );

  const chosen = people.filter((p) => selected.has(p.target));
  const current = personIndex >= 0 ? chosen[personIndex] : undefined;
  const draft = current ? drafts[current.target]! : undefined;

  const setDraft = (patch: Partial<Draft>) => {
    if (!current) return;
    setDrafts((d) => ({ ...d, [current.target]: { ...d[current.target]!, ...patch } }));
  };

  const toggleArr = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const validate = (d: Draft): string | null => {
    if (!d.location) return "اختاري مكان التدريب";
    if (!d.desired_days) return "حدّدي أيام التدريب";
    if (d.focus_areas.length === 0) return "اختاري منطقة تركيز واحدة على الأقل";
    if (!d.experience) return "حدّدي مستوى الخبرة";
    if (!d.session_minutes) return "حدّدي مدة الجلسة";
    return null;
  };

  const submitAll = () => {
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
      setPersonIndex(0);
      return;
    }
    const problem = validate(draft!);
    if (problem) return setError(problem);
    if (personIndex + 1 < chosen.length) {
      setPersonIndex(personIndex + 1);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      return;
    }
    submitAll();
  };

  const back = () => {
    setError(null);
    setPersonIndex((i) => Math.max(i - 1, -1));
  };

  const stepLabel =
    personIndex === -1 ? "اختيار الأفراد" : `${current!.name} (${personIndex + 1}/${chosen.length})`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
          أسئلة خطة التمارين
        </h1>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          سبع إجابات قصيرة تكفي لبرنامج أسبوعي مفصّل. {stepLabel}
        </p>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={personIndex}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-5"
        >
          {personIndex === -1 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-brand-ink">لمن خطة التمارين؟</p>
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
          )}

          {current && draft && (
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

              <div className="grid grid-cols-2 gap-3">
                <Field label="مستوى الخبرة">
                  <div className="grid gap-2">
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
                <Field label="مدة الجلسة">
                  <div className="grid gap-2">
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
              </div>
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
        {personIndex >= 0 && personIndex + 1 === chosen.length ? "حفظ ومتابعة" : "التالي"}
      </button>

      {personIndex >= -1 && personIndex !== -1 && (
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
