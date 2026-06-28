"use client";

// State container for the appended exercise steps, shared by MemberWizard (inline)
// and the Mom exercise screen. Holds raw answers; `buildProfile()` assembles the
// persisted ExerciseProfile and runs the §4 safety screen. The host owns the
// reused meal-wizard fields (age, activity, conditions) and passes them in — we
// never re-ask them.

import { useState } from "react";
import { computeExerciseScreening } from "@/lib/exercise/screening";
import type {
  AvailabilityDays,
  DeliveryType,
  Equipment,
  ExerciseFocus,
  ExerciseProfile,
  ExerciseSetting,
  ExerciseType,
  MskRegion,
  SessionMinutes,
} from "@/lib/exercise/types";

export interface ExerciseState {
  optedIn: boolean | null;
  focus: ExerciseFocus | null;
  mskRegions: MskRegion[];
  mskNotes: string;
  availabilityDays: AvailabilityDays | null;
  sessionMinutes: SessionMinutes | null;
  preferredTypes: ExerciseType[];
  dislikedTypes: ExerciseType[];
  setting: ExerciseSetting | null;
  equipment: Equipment[];
  hrMeds: boolean | null;
  restingHr: string;
  symptoms: string[];
  deliveryType: DeliveryType | null;
  pelvicFloor: boolean | null;
  childActivities: string;
}

// The multi-select (array) fields — the only ones `toggle` operates on.
type ArrayKey = "mskRegions" | "preferredTypes" | "dislikedTypes" | "equipment";

const EMPTY: ExerciseState = {
  optedIn: null,
  focus: null,
  mskRegions: [],
  mskNotes: "",
  availabilityDays: null,
  sessionMinutes: null,
  preferredTypes: [],
  dislikedTypes: [],
  setting: null,
  equipment: [],
  hrMeds: null,
  restingHr: "",
  symptoms: [],
  deliveryType: null,
  pelvicFloor: null,
  childActivities: "",
};

// Reused meal-wizard fields needed to assemble + screen. Never collected here.
export interface ReusedFields {
  member_type: "adult" | "child" | "pregnant" | "lactating";
  age: number;
  activity_level: string | null | undefined;
  conditions: string[];
}

export function buildExerciseProfile(
  state: ExerciseState,
  reused: ReusedFields,
): ExerciseProfile | null {
  if (!state.optedIn) return null;

  // Children: context only — no prescription inputs, no screening.
  if (reused.member_type === "child") {
    return {
      child_activities: state.childActivities.trim() || null,
      screening: null,
    };
  }

  const restingHr = state.restingHr ? Number(state.restingHr) : null;
  const symptoms = state.symptoms.filter((s) => s && s !== "none");

  const screening = computeExerciseScreening({
    member_type: reused.member_type,
    age: reused.age,
    activity_level: reused.activity_level,
    conditions: reused.conditions,
    hr_meds: state.hrMeds,
    resting_hr: restingHr,
    symptoms,
  });

  return {
    focus: state.focus,
    msk_regions: state.mskRegions,
    msk_notes: state.mskNotes.trim() || null,
    availability_days: state.availabilityDays,
    session_minutes: state.sessionMinutes,
    preferred_types: state.preferredTypes,
    disliked_types: state.dislikedTypes,
    setting: state.setting,
    equipment: state.equipment,
    hr_meds: state.hrMeds,
    resting_hr: restingHr,
    symptoms,
    delivery_type: reused.member_type === "lactating" ? state.deliveryType : null,
    pelvic_floor_issues:
      reused.member_type === "lactating" ? state.pelvicFloor : null,
    screening,
  };
}

export function useExerciseProfile(initial?: Partial<ExerciseState>) {
  const [state, setState] = useState<ExerciseState>({ ...EMPTY, ...initial });

  const set = <K extends keyof ExerciseState>(key: K, value: ExerciseState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  function toggle<K extends ArrayKey>(key: K, value: ExerciseState[K][number]) {
    setState((s) => {
      const list = s[key] as ExerciseState[K][number][];
      const next = (
        list.includes(value)
          ? list.filter((v) => v !== value)
          : [...list, value]
      ) as ExerciseState[K];
      return { ...s, [key]: next };
    });
  }

  // Symptom screen: "none" is mutually exclusive with the real symptoms.
  function toggleSymptom(slug: string) {
    setState((s) => {
      if (slug === "none") return { ...s, symptoms: ["none"] };
      const without = s.symptoms.filter((v) => v !== "none" && v !== slug);
      const next = s.symptoms.includes(slug) ? without : [...without, slug];
      return { ...s, symptoms: next };
    });
  }

  const reset = () => setState({ ...EMPTY });

  return { state, set, toggle, toggleSymptom, reset };
}

export type ExerciseApi = ReturnType<typeof useExerciseProfile>;
