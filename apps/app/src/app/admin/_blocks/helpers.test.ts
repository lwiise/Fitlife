import { describe, expect, it } from "vitest";
import {
  CHILD_AGE_CUTOFF as ENGINE_CHILD_AGE_CUTOFF,
  MealSchema,
  PRIMARY_GOALS,
  WorkoutProfileSchema,
  isChildByAge,
} from "@fitlife/plan-engine";
import { goalLabel } from "@/lib/admin/i18n";
import type {
  AttentionReason,
  MealSection,
  MealWeekMember,
  MealWeekProjection,
  WorkoutPlanListItem,
  WorkoutSection,
  WorkoutSessionView,
  WorkoutTraineeView,
} from "@/lib/admin/console-types";
import {
  CHILD_AGE_CUTOFF,
  addDaysIso,
  chipFlags,
  countMinutes,
  countPeople,
  daysBetweenIso,
  defaultSessionDay,
  doneThisWeek,
  effectiveMark,
  equipmentLabel,
  experienceLabel,
  fill,
  focusLabel,
  fmtDateTime,
  fmtDay,
  fmtDuration,
  fmtRelativeTo,
  fmtWeekday,
  fraction,
  initialMealDay,
  isPlannedByPortions,
  localizeDigits,
  locationLabel,
  macrosText,
  markView,
  mealCellFromSection,
  mealDayCount,
  mealDayTabs,
  mealPlanHref,
  mealTodayIndex,
  memberRoleLabel,
  onTarget,
  programFigures,
  programHref,
  reasonSentence,
  sessionMinutesLabel,
  showsCancelScheduled,
  slotLabel,
  todayWeekdayFrom,
  traineeProfileParts,
  traineeRoleLabel,
  trainingWeekSundayFrom,
  weekdayOfIso,
  widthClass,
  workoutCellFromSection,
} from "./helpers";

// ── fixtures ────────────────────────────────────────────────────────────────

function member(over: Partial<MealWeekMember> = {}): MealWeekMember {
  return {
    memberId: "mom",
    name: "هند",
    isChild: false,
    caloriesTarget: 1800,
    proteinTargetG: 130,
    days: [
      { dayIndex: 0, meals: [], totalCalories: 1790, totalProteinG: 129 },
      { dayIndex: 1, meals: [], totalCalories: 1810, totalProteinG: 131 },
    ],
    ...over,
  };
}

function week(over: Partial<MealWeekProjection> = {}): MealWeekProjection {
  return {
    weekStartDate: "2026-09-27",
    daysTotal: 7,
    generating: false,
    members: [member()],
    completeDays: [0, 1],
    ...over,
  };
}

function session(dayIndex: number, mark: WorkoutSessionView["mark"] = null): WorkoutSessionView {
  return {
    dayIndex,
    name: "جسم كامل أ",
    durationMin: 45,
    warmup: null,
    cooldown: null,
    exercises: [],
    mark,
  };
}

function trainee(sessions: WorkoutSessionView[], doneThisWeek = 0): WorkoutTraineeView {
  return {
    memberId: "mom",
    name: "هند",
    role: "mom",
    sex: "female",
    splitName: "جسم كامل ×3",
    progressionNotes: null,
    profile: null,
    sessions,
    doneThisWeek,
  };
}

const done = { status: "done" as const, intensity: "right" as const, localDate: null };

function workoutItem(over: Partial<WorkoutPlanListItem> = {}): WorkoutPlanListItem {
  return {
    id: "w1",
    status: "ready",
    createdAt: "2026-09-27T09:00:00Z",
    generatedAt: "2026-09-27T09:04:00Z",
    updatedAt: "2026-09-27T09:04:00Z",
    errorMessage: null,
    traineeCount: 1,
    sessionsPerWeek: 3,
    aiModel: null,
    costUsd: 0.9,
    ...over,
  };
}

function workoutSection(over: Partial<WorkoutSection> = {}): WorkoutSection {
  return {
    optedIn: true,
    served: null,
    latest: null,
    waitingForMeals: false,
    plans: [],
    ineligible: [],
    marksWindow: null,
    ...over,
  };
}

// ── text ────────────────────────────────────────────────────────────────────

describe("fill", () => {
  it("replaces known placeholders and keeps unknown ones", () => {
    expect(fill("{a} and {b}", { a: "x" })).toBe("x and {b}");
    expect(fill("{n}{n}", { n: 3 })).toBe("33");
  });
});

describe("Arabic counting", () => {
  it("agrees the noun with the number", () => {
    expect(countPeople(1, "ar")).toBe("فرد واحد");
    expect(countPeople(2, "ar")).toBe("فردان");
    expect(countPeople(5, "ar")).toBe("٥ أفراد");
    expect(countPeople(12, "ar")).toBe("١٢ فرداً");
    expect(countPeople(100, "ar")).toBe("١٠٠ فرد");
    expect(countMinutes(10, "ar")).toBe("١٠ دقائق");
    expect(countMinutes(45, "ar")).toBe("٤٥ دقيقة");
  });

  it("uses one/other in English", () => {
    expect(countPeople(1, "en")).toBe("1 person");
    expect(countPeople(7, "en")).toBe("7 people");
    expect(countMinutes(45, "en")).toBe("45 min");
  });
});

describe("localizeDigits", () => {
  it("swaps digits one by one in Arabic and leaves English alone", () => {
    expect(localizeDigits("10 لكل جهة", "ar")).toBe("١٠ لكل جهة");
    expect(localizeDigits("8-12", "ar")).toBe("٨-١٢");
    expect(localizeDigits("05", "ar")).toBe("٠٥");
    expect(localizeDigits("8-12", "en")).toBe("8-12");
  });
});

// ── dates ───────────────────────────────────────────────────────────────────

describe("calendar days", () => {
  it("reads weekdays Sunday-first and does day math in UTC", () => {
    expect(weekdayOfIso("2026-09-27")).toBe(0);
    expect(weekdayOfIso("2026-09-29")).toBe(2);
    expect(weekdayOfIso("not a date")).toBeNull();
    expect(weekdayOfIso(null)).toBeNull();
    expect(addDaysIso("2026-09-30", 2)).toBe("2026-10-02");
    expect(daysBetweenIso("2026-09-27", "2026-09-29")).toBe(2);
    expect(daysBetweenIso("2026-09-27", "bad")).toBeNull();
  });

  it("names weekdays from a Sunday anchor", () => {
    expect(fmtWeekday(0, "en")).toBe("Sunday");
    expect(fmtWeekday(6, "en", "short")).toBe("Sat");
    expect(fmtWeekday(0, "ar")).toBe("الأحد");
    expect(fmtWeekday(7, "en")).toBe("Sunday");
  });

  it("pins the Gregorian calendar so server and browser agree", () => {
    // A bare "ar-SA" is Gregorian in Node but Hijri (Umm al-Qura) in Chromium.
    expect(fmtDay("2026-09-27T00:00:00Z", "ar")).toBe("٢٧ سبتمبر ٢٠٢٦");
    expect(fmtDay("2026-09-27T00:00:00Z", "en")).toBe("Sep 27, 2026");
    expect(fmtDay(null, "en")).toBe("—");
    expect(fmtDay("garbage", "en")).toBe("—");
  });

  it("dates a timestamp in Riyadh, the same day fmtDateTime shows", () => {
    // 22:30 UTC is 01:30 the next day in Riyadh: one failed run must not read
    // 27 Sep in the attention list and 28 Sep in the runs table.
    const late = "2026-09-27T22:30:00Z";
    expect(fmtDay(late, "ar")).toBe("٢٨ سبتمبر ٢٠٢٦");
    expect(fmtDay(late, "en")).toBe("Sep 28, 2026");
    expect(fmtDateTime(late, "en")).toContain("Sep 28");
    expect(reasonSentence(
      { flag: "failed_meal_run", severity: "high", at: late, tab: "meal" },
      "en",
    )).toContain("Sep 28, 2026");
  });

  it("keeps a plain calendar day as written", () => {
    expect(fmtDay("2026-09-27", "en")).toBe("Sep 27, 2026");
    expect(fmtDay("2026-09-27", "ar")).toBe("٢٧ سبتمبر ٢٠٢٦");
  });

  it("formats durations as m:ss", () => {
    expect(fmtDuration(761_000, "en")).toBe("12:41");
    expect(fmtDuration(64_000, "ar")).toBe("١:٠٤");
    expect(fmtDuration(null, "en")).toBe("—");
    expect(fmtDuration(-5, "en")).toBe("—");
  });

  it("adds the year to a date-time on request (runs span months)", () => {
    const at = "2026-09-27T10:30:00Z";
    expect(fmtDateTime(at, "en")).not.toContain("2026");
    expect(fmtDateTime(at, "en", { year: true })).toContain("2026");
    expect(fmtDateTime(at, "en", { year: true })).toContain("Sep 27");
    expect(fmtDateTime(at, "ar", { year: true })).toContain("٢٠٢٦");
    expect(fmtDateTime(null, "en", { year: true })).toBe("—");
  });

  it("measures a relative time from the caller's now, never the clock", () => {
    const now = "2026-09-29T12:00:00Z";
    expect(fmtRelativeTo("2026-09-29T10:00:00Z", now, "en")).toBe("2 hours ago");
    expect(fmtRelativeTo("2026-09-28T12:00:00Z", now, "en")).toBe("yesterday");
    // The same inputs give the same text however long after `now` it runs.
    expect(fmtRelativeTo("2026-09-29T11:59:00Z", now, "en")).toBe("1 minute ago");
    expect(fmtRelativeTo(null, now, "en")).toBe("—");
    expect(fmtRelativeTo("garbage", now, "en")).toBe("—");
    // An unusable "now" falls back to the day itself.
    expect(fmtRelativeTo("2026-09-27T10:00:00Z", "", "en")).toBe("Sep 27, 2026");
  });
});

// ── states and flags ────────────────────────────────────────────────────────

describe("widthClass / fraction", () => {
  it("clamps to 0–100", () => {
    expect(widthClass(0.4)).toBe("ad-w40");
    expect(widthClass(1.7)).toBe("ad-w100");
    expect(widthClass(Number.NaN)).toBe("ad-w0");
    expect(fraction(4, 7)).toBeCloseTo(4 / 7);
    expect(fraction(null, 7)).toBe(0);
    expect(fraction(3, 0)).toBe(0);
  });
});

describe("chipFlags", () => {
  it("leaves past-due to the status pill", () => {
    expect(chipFlags(["past_due"], false)).toEqual([]);
    expect(chipFlags(["past_due", "cancel_scheduled"], false)).toEqual(["cancel_scheduled"]);
  });

  it("places the medical gate after over-limit, else first", () => {
    expect(chipFlags(["past_due", "over_limit", "failed_meal_run"], true)).toEqual([
      "over_limit",
      "medical_gate",
      "failed_meal_run",
    ]);
    expect(chipFlags(["failed_meal_run"], true)).toEqual(["medical_gate", "failed_meal_run"]);
    expect(chipFlags([], true)).toEqual(["medical_gate"]);
    expect(chipFlags(["onboarding_incomplete"], false)).toEqual(["onboarding_incomplete"]);
  });
});

describe("reasonSentence", () => {
  const base = { at: null, tab: "summary" } as const;

  it("states the over-limit counts with agreement", () => {
    const r: AttentionReason = {
      ...base,
      flag: "over_limit",
      severity: "high",
      tab: "household",
      people: 7,
      maxPeople: 6,
    };
    expect(reasonSentence(r, "ar")).toBe("٧ أفراد في الأسرة، والحد المسموح في الباقة ٦.");
    expect(reasonSentence(r, "en")).toBe("7 people in the household; the tier allows 6.");
  });

  it("words a failed run by what the family still sees", () => {
    const at = "2026-09-19T06:02:00Z";
    const high = reasonSentence(
      { ...base, flag: "failed_meal_run", severity: "high", at, tab: "meal" },
      "en",
    );
    const medium = reasonSentence(
      { ...base, flag: "failed_workout_run", severity: "medium", at, tab: "exercise" },
      "en",
    );
    const low = reasonSentence(
      { ...base, flag: "failed_meal_run", severity: "low", at: null, tab: "meal" },
      "en",
    );
    expect(high).toBe(
      "The meal plan run on Sep 19, 2026 failed, and the family has no plan to see.",
    );
    expect(medium).toContain("still sees the previous program");
    expect(low).toBe("A meal run failed; the current plan is ready.");
  });

  it("keeps sentences whole without a date", () => {
    expect(reasonSentence({ ...base, flag: "past_due", severity: "high" }, "en")).toBe(
      "Payment is past due.",
    );
    expect(
      reasonSentence({ ...base, flag: "onboarding_incomplete", severity: "medium" }, "ar"),
    ).toBe("التسجيل غير مكتمل.");
    expect(reasonSentence({ ...base, flag: "medical_gate", severity: "high" }, "ar")).toContain(
      "استشارة الطبيب",
    );
  });
});

describe("showsCancelScheduled", () => {
  it("marks a scheduled cancellation on every status that has not ended", () => {
    // 'cancelled' included: a portal cancellation lands as status 'cancelled'
    // with the flag set, while the customer is still paid through the period.
    for (const status of ["trialing", "active", "cancelled", "past_due", "paused"]) {
      expect(showsCancelScheduled(status, true), status).toBe(true);
      expect(showsCancelScheduled(status, false), status).toBe(false);
    }
  });

  it("never on an expired subscription or no subscription", () => {
    expect(showsCancelScheduled("expired", true)).toBe(false);
    expect(showsCancelScheduled(null, true)).toBe(false);
  });
});

describe("cells from sections", () => {
  it("rebuilds the meal cell the list shows", () => {
    const none: MealSection = { served: null, plans: [] };
    expect(mealCellFromSection(none).state).toBe("none");
    const served: MealSection = {
      served: {
        plan: {
          id: "p1",
          status: "generating",
          createdAt: "2026-09-27T09:00:00Z",
          generatedAt: null,
          daysReady: 4,
          daysTotal: 7,
          aiInputTokens: null,
          aiOutputTokens: null,
          aiModel: null,
          costUsd: null,
        },
        week: null,
        masked: false,
        maskedFailureAt: null,
      },
      plans: [],
    };
    expect(mealCellFromSection(served)).toEqual({
      state: "generating",
      daysReady: 4,
      daysTotal: 7,
      masked: false,
    });
  });

  it("rebuilds the workout cell from the served program or the newest row", () => {
    expect(workoutCellFromSection(workoutSection()).state).toBe("none");
    expect(
      workoutCellFromSection(workoutSection({ latest: workoutItem({ status: "generating" }) })),
    ).toEqual({ state: "generating", masked: false });
    expect(
      workoutCellFromSection(
        workoutSection({
          latest: workoutItem({ status: "failed" }),
          served: { plan: workoutItem(), trainees: [], masked: true },
        }),
      ),
    ).toEqual({ state: "ready", masked: true });
  });
});

// ── meal week ───────────────────────────────────────────────────────────────

describe("meal week", () => {
  it("labels days from week_start_date, or by ordinal without one", () => {
    const tabs = mealDayTabs(week(), "en");
    expect(tabs).toHaveLength(7);
    expect(tabs[0]?.short).toBe("Sun");
    expect(tabs[2]?.short).toBe("Tue");
    expect(tabs[0]?.num).toBe("27");
    const bare = mealDayTabs(week({ weekStartDate: null }), "en");
    expect(bare[0]).toMatchObject({ short: null, num: "1", long: "Day 1" });
  });

  it("counts the day slots, never fewer than a day that exists", () => {
    expect(mealDayCount(week())).toBe(7);
    expect(mealDayCount(week({ daysTotal: 3 }))).toBe(3);
    expect(
      mealDayCount(
        week({
          daysTotal: 3,
          members: [
            member({
              days: [{ dayIndex: 5, meals: [], totalCalories: null, totalProteinG: null }],
            }),
          ],
        }),
      ),
    ).toBe(6);
  });

  it("finds today inside the plan week only", () => {
    expect(mealTodayIndex(week(), "2026-09-29")).toBe(2);
    expect(mealTodayIndex(week(), "2026-10-04")).toBeNull();
    expect(mealTodayIndex(week(), "2026-09-26")).toBeNull();
    expect(mealTodayIndex(week(), null)).toBeNull();
  });

  it("opens on today, else the member's first day", () => {
    expect(initialMealDay(member(), 3, 7)).toBe(3);
    expect(initialMealDay(member(), null, 7)).toBe(0);
    expect(initialMealDay(member({ days: [] }), null, 7)).toBe(0);
    expect(initialMealDay(null, null, 7)).toBe(0);
  });

  it("names every engine slot", () => {
    for (const slot of MealSchema.shape.slot.options) {
      expect(slotLabel(slot, "ar")).not.toBe(slot);
      expect(slotLabel(slot, "en")).not.toBe(slot);
    }
    expect(slotLabel("suhoor", "en")).toBe("suhoor");
  });

  it("judges a day total against the ±10% band", () => {
    expect(onTarget(1790, 1800)).toBe(true);
    expect(onTarget(1500, 1800)).toBe(false);
    expect(onTarget(null, 1800)).toBe(true);
  });
});

// ── exercise week ───────────────────────────────────────────────────────────

describe("exercise week", () => {
  it("reads today's weekday from the mark window", () => {
    expect(todayWeekdayFrom({ marksWindow: { start: "2026-09-27", end: "2026-09-29" } })).toBe(2);
    expect(todayWeekdayFrom({ marksWindow: null })).toBeNull();
  });

  it("takes the week's Sunday from the loader's window, never recomputing it", () => {
    // 2026-09-27 is a Sunday; the loader's window opens on it.
    expect(trainingWeekSundayFrom({ marksWindow: { start: "2026-09-27", end: "2026-09-29" } })).toBe(
      "2026-09-27",
    );
    // A window that does not open on a Sunday cannot number a Sunday-first grid.
    expect(
      trainingWeekSundayFrom({ marksWindow: { start: "2026-09-28", end: "2026-09-29" } }),
    ).toBeNull();
    expect(trainingWeekSundayFrom({ marksWindow: { start: "nope", end: "2026-09-29" } })).toBeNull();
    expect(trainingWeekSundayFrom({ marksWindow: null })).toBeNull();
  });

  it("drops marks on days still ahead (last week's grace-window tail)", () => {
    expect(effectiveMark(session(5, done), 0)).toBeNull();
    expect(effectiveMark(session(0, done), 0)).toEqual(done);
    expect(effectiveMark(session(5, done), null)).toEqual(done);
  });

  it("counts this week's done sessions", () => {
    const tr = trainee([session(0, done), session(2, done), session(5, done)], 3);
    expect(doneThisWeek(tr, 2)).toBe(2);
    expect(doneThisWeek(tr, null)).toBe(3);
  });

  it("opens on today's session, else the next, else the first", () => {
    const tr = trainee([session(0), session(2), session(4)]);
    expect(defaultSessionDay(tr, 2)).toBe(2);
    expect(defaultSessionDay(tr, 3)).toBe(4);
    expect(defaultSessionDay(tr, 5)).toBe(0);
    expect(defaultSessionDay(tr, null)).toBe(0);
    expect(defaultSessionDay(trainee([]), 2)).toBeNull();
  });

  it("shows the mark, else where the day sits relative to today", () => {
    expect(markView(session(0, done), 2, "en", true)).toEqual({
      tone: "ok",
      plain: false,
      label: "Done · Intensity: right",
    });
    expect(markView(session(0, done), 2, "en", false)?.label).toBe("Done");
    expect(markView(session(2), 2, "en", false)).toMatchObject({ tone: "pur", label: "Today" });
    expect(markView(session(1), 2, "en", false)).toMatchObject({ label: "Not marked" });
    expect(markView(session(4), 2, "en", false)).toMatchObject({ plain: true, label: "Upcoming" });
    expect(markView(session(4), null, "en", false)).toBeNull();
  });
});

// ── questionnaire labels ────────────────────────────────────────────────────

describe("workout questionnaire labels", () => {
  const shape = WorkoutProfileSchema.shape;

  it("maps every answer the schema allows", () => {
    for (const v of shape.location.options) {
      expect(locationLabel(v, "ar")).not.toBe(v);
    }
    for (const v of shape.equipment.removeDefault().element.options) {
      expect(equipmentLabel(v, "ar")).not.toBe(v);
    }
    for (const v of shape.focus_areas.element.options) {
      expect(focusLabel(v, "ar")).not.toBe(v);
    }
    for (const v of shape.experience.options) {
      expect(experienceLabel(v, "female", "ar")).not.toBe(v);
      expect(experienceLabel(v, "male", "ar")).not.toBe(v);
    }
    for (const v of shape.session_minutes.options) {
      expect(sessionMinutesLabel(v, "en")).not.toBe(v);
    }
  });

  it("inflects the level by sex, feminine by default", () => {
    expect(experienceLabel("beginner", "male", "ar")).toBe("مبتدئ");
    expect(experienceLabel("beginner", "female", "ar")).toBe("مبتدئة");
    expect(experienceLabel("beginner", null, "ar")).toBe("مبتدئة");
    expect(experienceLabel("beginner", "male", "en")).toBe("Beginner");
    expect(sessionMinutesLabel("m30_45", "en")).toBe("30–45 min");
  });

  it("summarises a trainee without guessing missing answers", () => {
    expect(traineeProfileParts(null, null, "en")).toEqual([]);
    expect(
      traineeProfileParts(
        {
          location: "gym",
          equipment: [],
          injuries: [],
          desiredDays: 4,
          preferredDays: null,
          focusAreas: ["strength"],
          experience: "intermediate",
          sessionMinutes: "m45_60",
        },
        "male",
        "en",
      ),
    ).toEqual(["Gym", "Intermediate"]);
  });
});

// ── household and links ─────────────────────────────────────────────────────

describe("household", () => {
  it("labels every canonical goal", () => {
    for (const goal of PRIMARY_GOALS) {
      expect(goalLabel(goal, "ar")).not.toBe(goal);
      expect(goalLabel(goal, "en")).not.toBe(goal);
    }
  });

  it("calls the housekeeper the cook", () => {
    expect(memberRoleLabel("housekeeper", true, "ar")).toBe("الطبّاخة");
    expect(memberRoleLabel("dad", false, "en")).toBe("Father");
    expect(memberRoleLabel("", false, "en")).toBe("");
  });

  it("never calls a male account owner «الأم»", () => {
    expect(traineeRoleLabel("mom", "male", "ar")).toBe("صاحب الحساب");
    expect(traineeRoleLabel("mom", "male", "en")).toBe("Account owner");
    // Female or unanswered keeps the stored role (the feminine fallback).
    expect(traineeRoleLabel("mom", "female", "ar")).toBe("الأم");
    expect(traineeRoleLabel("mom", null, "ar")).toBe("الأم");
    expect(traineeRoleLabel("dad", "male", "en")).toBe("Father");
    expect(traineeRoleLabel("", null, "en")).toBe("");
  });

  it("rounds macros P / C / F", () => {
    expect(macrosText({ protein_g: 129.6, carbs_g: 180, fat_g: 56.2 }, "en")).toBe(
      "130 / 180 / 56",
    );
  });

  it("links to the audited views", () => {
    expect(mealPlanHref("u1", "p1")).toBe("/admin/subscribers/u1/plan/p1");
    expect(programHref("u1", "w1")).toBe("/admin/subscribers/u1/workout/w1");
  });

  it("classifies children by the engine's own rule", () => {
    expect(CHILD_AGE_CUTOFF).toBe(ENGINE_CHILD_AGE_CUTOFF);
    for (const memberType of ["adult", "child", "pregnant", "lactating"]) {
      for (const age of [null, 5, 12, 13, 16, 17, 18, 19, 40]) {
        expect(isPlannedByPortions({ memberType, isHousekeeper: false, age })).toBe(
          isChildByAge(memberType, age),
        );
      }
    }
  });

  it("shows an under-18 owner or a minor saved as an adult by portions", () => {
    expect(isPlannedByPortions({ memberType: "adult", isHousekeeper: false, age: 16 })).toBe(true);
    expect(isPlannedByPortions({ memberType: "adult", isHousekeeper: false, age: 18 })).toBe(false);
    expect(isPlannedByPortions({ memberType: "adult", isHousekeeper: false, age: null })).toBe(
      false,
    );
    expect(isPlannedByPortions({ memberType: "housekeeper", isHousekeeper: true, age: 16 })).toBe(
      false,
    );
  });
});

describe("programFigures", () => {
  it("reads nothing when no program is served", () => {
    expect(programFigures(null)).toEqual({ trainees: null, sessions: null });
  });

  it("prefers the row's own figures", () => {
    const served = { plan: workoutItem(), trainees: [], masked: false };
    expect(programFigures(served)).toEqual({ trainees: 1, sessions: 3 });
  });

  it("counts from the projection when the row carries none", () => {
    const served = {
      plan: workoutItem({ traineeCount: null, sessionsPerWeek: null }),
      trainees: [trainee([session(0), session(2)]), trainee([session(4)])],
      masked: false,
    };
    expect(programFigures(served)).toEqual({ trainees: 2, sessions: 3 });
  });

  it("reads an empty projection as unknown, never zero", () => {
    // A program decided from the row columns alone: no trainees, no figures.
    const served = {
      plan: workoutItem({ traineeCount: null, sessionsPerWeek: null }),
      trainees: [],
      masked: true,
    };
    expect(programFigures(served)).toEqual({ trainees: null, sessions: null });
  });
});
