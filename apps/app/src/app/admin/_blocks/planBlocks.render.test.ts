import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  MealPlanListItem,
  MealWeekProjection,
  WorkoutPlanListItem,
  WorkoutSection,
  WorkoutTraineeView,
} from "@/lib/admin/console-types";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtDay, mealDayTabs } from "./helpers";
import { MealPlanTable } from "./MealPlanHistory";
import { MealWeekExplorer } from "./MealWeekExplorer";
import { ProgramTable } from "./ProgramHistory";
import { ProgramWeekExplorer } from "./ProgramWeekExplorer";
import { PlanText } from "./parts";

const USER = "63636363-0000-4000-8000-000000000001";

/** Text content, tags and React's comment markers removed. */
const text = (html: string) => html.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, "");

// ── Generated plan text: one digit rule for the whole card ─────────────────

describe("PlanText", () => {
  it("is Arabic content in the admin's digits", () => {
    const ar = renderToString(createElement(PlanText, { text: "الجزء العلوي (3)", locale: "ar" }));
    expect(ar).toBe('<span lang="ar" dir="rtl" class="ad-ar-text">الجزء العلوي (٣)</span>');
    const en = renderToString(createElement(PlanText, { text: "الجزء العلوي (3)", locale: "en" }));
    expect(en).toContain("الجزء العلوي (3)");
  });
});

const trainee: WorkoutTraineeView = {
  memberId: "mom",
  name: "هند",
  role: "mom",
  sex: "female",
  splitName: "علوي/سفلي ×4",
  progressionNotes: "زيدي 2 كغ كل أسبوعين",
  profile: null,
  doneThisWeek: 0,
  sessions: [
    {
      dayIndex: 3,
      name: "الجزء العلوي (3)",
      durationMin: 40,
      warmup: "مشي 5 دقائق",
      cooldown: "إطالة 3 دقائق",
      mark: null,
      exercises: [
        {
          name: "ضغط 90 درجة",
          targetMuscles: "الصدر 1",
          sets: 3,
          reps: "10-12",
          restSeconds: 60,
          rir: "2",
          homeVariant: "ضغط على الركبتين 2",
        },
      ],
    },
  ],
};

const program: WorkoutPlanListItem = {
  id: "w1",
  status: "ready",
  createdAt: "2026-09-27T09:00:00Z",
  generatedAt: "2026-09-27T09:04:00Z",
  updatedAt: "2026-09-27T09:04:00Z",
  errorMessage: null,
  traineeCount: 1,
  sessionsPerWeek: 4,
  aiModel: null,
  costUsd: 0.9,
};

const section: WorkoutSection = {
  optedIn: true,
  served: { plan: program, trainees: [trainee], masked: false },
  latest: program,
  waitingForMeals: false,
  plans: [program],
  ineligible: [],
  marksWindow: { start: "2026-09-27", end: "2026-10-03" },
};

describe("ProgramWeekExplorer (Arabic)", () => {
  const html = renderToString(
    createElement(ProgramWeekExplorer, { section, locale: "ar", todayWeekday: 3 }),
  );
  const shown = text(html);

  it("never mixes Western digits into the card's plan text", () => {
    // The week cell and the session heading both name the session.
    expect(shown.match(/الجزء العلوي \(٣\)/g)).toHaveLength(2);
    for (const fragment of ["مشي ٥ دقائق", "إطالة ٣ دقائق", "ضغط ٩٠ درجة", "الصدر ١", "ضغط على الركبتين ٢", "١٠-١٢", "زيدي ٢ كغ"]) {
      expect(shown).toContain(fragment);
    }
    expect(shown).not.toMatch(/[0-9]/);
  });
});

// ── Plan and program tables: every link and row named by its date ──────────

const mealPlan = (id: string, generatedAt: string): MealPlanListItem => ({
  id,
  status: "ready",
  createdAt: generatedAt,
  generatedAt,
  daysReady: 7,
  daysTotal: 7,
  aiInputTokens: 1000,
  aiOutputTokens: 2000,
  aiModel: "claude-sonnet-5",
  costUsd: 0.5,
});

/** Accessible names of the table's links: their text, hidden parts included. */
const linkNames = (html: string) =>
  [...html.matchAll(/<a [^>]*>(.*?)<\/a>/g)].map((m) => text(m[1] ?? ""));

describe.each<AdminLocale>(["ar", "en"])("history tables (%s)", (locale) => {
  const DATES = ["2026-09-20T09:00:00Z", "2026-09-13T09:00:00Z", "2026-09-06T09:00:00Z"];

  it("gives every meal plan link its own name, with the one verb «فتح»", () => {
    const html = renderToString(
      createElement(MealPlanTable, {
        plans: DATES.map((d, i) => mealPlan(`m${i}`, d)),
        userId: USER,
        locale,
        currency: "sar",
      }),
    );
    const names = linkNames(html);
    const verb = locale === "ar" ? "فتح الخطة" : "Open plan";
    expect(names).toEqual(DATES.map((d) => `${verb}: ${fmtDay(d, locale)}`));
    // The date is the row's header, so a table reader announces it per cell.
    expect(html.match(/<th scope="row">/g)).toHaveLength(DATES.length);
  });

  it("does the same for programs", () => {
    const html = renderToString(
      createElement(ProgramTable, {
        plans: DATES.map((d, i) => ({ ...program, id: `w${i}`, createdAt: d, generatedAt: d })),
        userId: USER,
        locale,
        currency: "sar",
      }),
    );
    const verb = locale === "ar" ? "فتح البرنامج" : "Open program";
    expect(linkNames(html)).toEqual(DATES.map((d) => `${verb}: ${fmtDay(d, locale)}`));
    expect(html.match(/<th scope="row">/g)).toHaveLength(DATES.length);
  });
});

// ── The meal day strip on a phone ──────────────────────────────────────────

const week: MealWeekProjection = {
  weekStartDate: "2026-09-27",
  daysTotal: 7,
  generating: false,
  completeDays: [0],
  members: [
    {
      memberId: "mom",
      name: "هند",
      isChild: false,
      caloriesTarget: 1800,
      proteinTargetG: 120,
      days: [{ dayIndex: 0, meals: [], totalCalories: null, totalProteinG: null }],
    },
  ],
} as MealWeekProjection;

describe("meal day strip", () => {
  it("carries a one-letter day beside the short name", () => {
    expect(mealDayTabs(week, "ar").map((d) => d.narrow)).toEqual(["ح", "ن", "ث", "ر", "خ", "ج", "س"]);
    expect(mealDayTabs(week, "en")[3]).toMatchObject({ short: "Wed", narrow: "W" });
    expect(mealDayTabs({ ...week, weekStartDate: null }, "ar")[0]).toMatchObject({
      short: null,
      narrow: null,
    });
  });

  it("renders both, for CSS to pick by width, and names each day in full", () => {
    const html = renderToString(createElement(MealWeekExplorer, { week, locale: "ar" }));
    expect(html).toContain('<span class="ad-dt-short">الأربعاء</span><span class="ad-dt-narrow">ر</span>');
    expect(html).toMatch(/aria-label="الأربعاء [^"]*٣٠ سبتمبر ٢٠٢٦/);
  });
});
