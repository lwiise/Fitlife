import { createElement, createRef } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  PANEL_TABS,
  type FamilyPanelData,
  type FamilyRow,
  type FamilyTab,
} from "@/lib/admin/console-types";
import type { SubscriptionRow } from "@/lib/admin/detail";
import { FamilySheet, type SheetActions, type SheetView } from "./FamilySheet";
import type { PanelEntry } from "./panelLoader";

/**
 * Renders the side panel's every tab from a realistic answer of the panel
 * route — the composition of the shared family blocks — and its loading,
 * missing and failed states. (The panel only ever renders in the browser
 * after its fetch; rendering it here proves every tab builds from the
 * contract without throwing.)
 */

const ID = "00000000-0000-4000-8000-0000000000aa";
const MEAL_ID = "00000000-0000-4000-8000-0000000000b1";
const PROGRAM_ID = "00000000-0000-4000-8000-0000000000c1";

const sub = (p: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  tier: "family",
  status: "past_due",
  cadence: "monthly",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-09-26T00:00:00Z",
  trialStartedAt: "2026-08-01T00:00:00Z",
  trialEndsAt: "2026-08-08T00:00:00Z",
  currentPeriodEnd: "2026-10-01T00:00:00Z",
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  lemonsqueezySubscriptionId: "123",
  lemonsqueezyCustomerId: "456",
  lemonsqueezyVariantId: "789",
  ...p,
});

const day = (dayIndex: number, calories: number) => ({
  dayIndex,
  meals: [
    { slot: "breakfast", name: "شكشوكة", calories: calories * 0.3, proteinG: 20, sharedBy: 2 },
    { slot: "lunch", name: "كبسة دجاج", calories: calories * 0.5, proteinG: 40, sharedBy: 1 },
  ],
  totalCalories: calories * 0.8,
  totalProteinG: 60,
});

const PANEL: FamilyPanelData = {
  header: {
    userId: ID,
    displayName: "هند العتيبي",
    email: "hind@example.com",
    deactivated: false,
    preferredLanguage: "ar",
    signupAt: "2026-08-01T00:00:00Z",
    onboardingCompletedAt: "2026-08-01T01:00:00Z",
    familyWideCompletedAt: "2026-08-01T00:30:00Z",
    momProfileCompletedAt: null,
    subscription: sub(),
    subscriptionHistory: [sub(), sub({ status: "trialing", createdAt: "2026-07-01T00:00:00Z" })],
    beneficiaries: 3,
    hasHousekeeper: true,
    tierMaxPeople: 6,
    overLimit: false,
    flags: ["past_due", "failed_meal_run"],
    medicalGateBlocked: true,
    reasons: [
      { flag: "past_due", severity: "high", at: "2026-09-26T00:00:00Z", tab: "billing" },
      { flag: "medical_gate", severity: "high", at: null, tab: "household" },
      { flag: "failed_meal_run", severity: "low", at: "2026-09-19T06:00:00Z", tab: "meal" },
    ],
    lifetimeAiCostUsd: 12.5,
    lastActivityAt: "2026-09-29T10:00:00Z",
    engagement: { chatCount: 14, lastChatAt: "2026-09-28T10:00:00Z", chatCostUsd: 0.35 },
  },
  meal: {
    served: {
      plan: {
        id: MEAL_ID,
        status: "ready",
        createdAt: "2026-09-27T08:00:00Z",
        generatedAt: "2026-09-27T08:12:00Z",
        daysReady: 7,
        daysTotal: 7,
        aiInputTokens: 48_000,
        aiOutputTokens: 61_000,
        aiModel: "claude-sonnet-5",
        costUsd: 3.28,
      },
      week: {
        weekStartDate: "2026-09-27",
        daysTotal: 7,
        generating: false,
        completeDays: [0, 1, 2, 3, 4, 5, 6],
        members: [
          {
            memberId: "mom",
            name: "هند",
            isChild: false,
            caloriesTarget: 1800,
            proteinTargetG: 110,
            days: [0, 1, 2, 3, 4, 5, 6].map((d) => day(d, 1800)),
          },
          {
            memberId: "kid",
            name: "لمى",
            isChild: true,
            caloriesTarget: null,
            proteinTargetG: null,
            days: [0, 1, 2].map((d) => day(d, 1200)),
          },
        ],
      },
      masked: false,
      maskedFailureAt: null,
    },
    plans: ["2026-09-27", "2026-09-20", "2026-09-19", "2026-09-13", "2026-09-06"].map((date, i) => ({
      id: i === 0 ? MEAL_ID : `00000000-0000-4000-8000-0000000000d${i}`,
      status: i === 2 ? "failed" : "ready",
      createdAt: `${date}T08:00:00Z`,
      generatedAt: null,
      daysReady: i === 2 ? 0 : 7,
      daysTotal: 7,
      aiInputTokens: null,
      aiOutputTokens: null,
      aiModel: null,
      costUsd: 3,
    })),
  },
  workout: {
    optedIn: true,
    served: {
      plan: {
        id: PROGRAM_ID,
        status: "ready",
        createdAt: "2026-09-27T08:20:00Z",
        generatedAt: "2026-09-27T08:22:00Z",
        updatedAt: "2026-09-27T08:22:00Z",
        errorMessage: null,
        traineeCount: 1,
        sessionsPerWeek: 3,
        aiModel: "claude-sonnet-5",
        costUsd: 0.94,
      },
      trainees: [
        {
          memberId: "mom",
          name: "هند",
          role: "mom",
          sex: "female",
          splitName: "جسم كامل ×3",
          progressionNotes: "زيادة التكرار أسبوعياً",
          profile: {
            location: "home",
            equipment: ["dumbbells", "bands"],
            injuries: [],
            desiredDays: 3,
            preferredDays: [0, 2, 4],
            focusAreas: ["full_body"],
            experience: "beginner",
            sessionMinutes: "m30_45",
          },
          sessions: [0, 2, 4].map((dayIndex) => ({
            dayIndex,
            name: "تمرين الجسم كامل",
            durationMin: 40,
            warmup: "مشي خفيف",
            cooldown: "إطالة",
            exercises: [
              {
                name: "سكوات",
                targetMuscles: "الأرجل",
                sets: 3,
                reps: "10-12",
                restSeconds: 60,
                rir: "2",
                homeVariant: null,
              },
            ],
            mark: dayIndex === 0 ? { status: "done", intensity: "right", localDate: "2026-09-27" } : null,
          })),
          doneThisWeek: 1,
        },
      ],
      masked: false,
    },
    latest: null,
    waitingForMeals: false,
    plans: [],
    ineligible: [
      { memberId: "kid", name: "لمى", reason: "child", age: 10 },
      { memberId: "cook", name: "Maria", reason: "housekeeper", age: null },
    ],
    marksWindow: { start: "2026-09-27", end: "2026-09-30" },
  },
  household: [
    {
      id: "mom",
      name: "هند",
      role: "mom",
      memberType: "adult",
      isHousekeeper: false,
      pickyEater: null,
      primaryGoal: "fat_loss",
      caloriesTarget: 1800,
      macros: { protein_g: 110, carbs_g: 180, fat_g: 60 },
      medicalGate: true,
      consultedDoctor: false,
      age: 34,
    },
    {
      id: "kid",
      name: "لمى",
      role: "daughter",
      memberType: "child",
      isHousekeeper: false,
      pickyEater: true,
      primaryGoal: null,
      caloriesTarget: 1200,
      macros: null,
      medicalGate: false,
      consultedDoctor: null,
      age: 10,
    },
    {
      id: "cook",
      name: "Maria",
      role: "housekeeper",
      memberType: "housekeeper",
      isHousekeeper: true,
      pickyEater: null,
      primaryGoal: null,
      caloriesTarget: null,
      macros: null,
      medicalGate: false,
      consultedDoctor: null,
      age: null,
    },
  ],
};

// The program history lists the served program too.
PANEL.workout.plans = [PANEL.workout.served!.plan];

const ENTRY: PanelEntry = {
  id: ID,
  result: { kind: "ok", data: PANEL },
  fetchedAt: Date.UTC(2026, 8, 30, 9),
  nowIso: "2026-09-30T09:00:00.000Z",
  todayIso: "2026-09-30",
};

const ROW = { userId: ID, displayName: "هند العتيبي", email: "hind@example.com" } as FamilyRow;

const actions: SheetActions = { close: vi.fn(), tab: vi.fn(), retry: vi.fn(), step: vi.fn() };

function render(tab: FamilyTab, view: SheetView, row: FamilyRow | null = ROW) {
  return renderToString(
    createElement(FamilySheet, {
      id: ID,
      tab,
      view,
      row,
      rowText: null,
      locale: "ar",
      currency: "sar",
      headingRef: createRef<HTMLHeadingElement>(),
      actions,
    }),
  );
}

const ready: SheetView = { id: ID, entry: ENTRY, busy: false };

describe("FamilySheet (render)", () => {
  it("renders every panel tab from the route's answer", () => {
    for (const tab of PANEL_TABS) {
      const html = render(tab, ready);
      expect(html).toContain("هند العتيبي");
      expect(html).toContain("عميلة منذ");
      expect(html).not.toContain('aria-busy="true"');
      expect(html).toContain(`aria-selected="true"`);
      // The footer's links carry their (idle) pending hint.
      expect(html).toMatch(/class="ad-sh-foot"[\s\S]*class="ad-lp"/);
    }
  });

  it("summary: reasons with a way to their tab, facts, the two plan cards, engagement", () => {
    const html = render("summary", ready);
    expect(html).toContain("الدفع متأخر");
    expect(html).toContain("فتح قسم الاشتراك");
    expect(html).toContain("فتح قسم الأسرة");
    expect(html).toContain('class="ad-summary-plans"');
    expect(html).toContain("بوابة طبية");
    expect(html).toContain("رسائل المساعد");
    // No primary action on the summary: only the full page.
    expect(html).not.toContain("فتح خطة الوجبات");
    expect(html).toContain(`href="/admin/subscribers/${ID}"`);
  });

  it("meal: the served week, three earlier plans and the rest on the full page", () => {
    const html = render("meal", ready);
    expect(html).toContain("كبسة دجاج");
    expect(html).toContain("الخطط السابقة");
    expect(html).toContain("كل الخطط");
    expect(html).toContain(`/admin/subscribers/${ID}/plan/${MEAL_ID}`);
    expect(html).toContain("فتح خطة الوجبات");
    expect(html).toContain(`href="/admin/subscribers/${ID}?tab=meal"`);
  });

  it("exercise: the program, its trainees and history, and the open-program action", () => {
    const html = render("exercise", ready);
    expect(html).toContain("المتدرّبون");
    expect(html).toContain("سجل البرامج");
    expect(html).toContain("خارج خطط التمارين");
    expect(html).toContain(`/admin/subscribers/${ID}/workout/${PROGRAM_ID}`);
    expect(html).toContain("فتح برنامج التمارين");
  });

  it("household and billing: the table with the audited health link; subscription, history, account", () => {
    const household = render("household", ready);
    expect(household).toContain("عرض التفاصيل الصحية");
    expect(household).toContain("Maria");
    const billing = render("billing", ready);
    expect(billing).toContain("سجل الاشتراك");
    expect(billing).toContain("123");
    expect(billing).toContain("hind@example.com");
  });

  it("shows the head from the list row and a skeleton while loading", () => {
    const html = render("summary", { id: null, entry: null, busy: true });
    expect(html).toContain("هند العتيبي");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("جارٍ تحميل بيانات العائلة");
  });

  it("says a deleted family is gone, and offers a retry after a failure", () => {
    const missing = render("summary", {
      id: ID,
      entry: { ...ENTRY, result: { kind: "missing" } },
      busy: false,
    });
    expect(missing).toContain("لم تعد هذه العائلة موجودة");
    expect(missing).not.toContain("ad-sh-foot");
    const failed = render("summary", {
      id: ID,
      entry: { ...ENTRY, result: { kind: "error" } },
      busy: false,
    }, null);
    expect(failed).toContain("تعذّر تحميل بيانات هذه العائلة");
    expect(failed).toContain("إعادة المحاولة");
  });
});
