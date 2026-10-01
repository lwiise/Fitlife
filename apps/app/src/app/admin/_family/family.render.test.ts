import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  FAMILY_TABS,
  type FamilyHeaderData,
  type HouseholdMember,
  type MealSection,
  type RunRow,
  type WorkoutSection,
} from "@/lib/admin/console-types";
import type { MemberHealth, SubscriptionRow } from "@/lib/admin/detail";
import { subscriptionCancelState } from "@/lib/admin/familyFlags";

/**
 * Server-render tests for the family page's pieces: every view must render
 * from the console-types shapes alone (no window, no clock), link where the
 * page promises (the tabs; the audited plan and program views, never
 * prefetched; the health page only behind its confirmation), and cover the
 * exercise section's every state. Behaviour that needs a browser (the
 * dialogs) is kept out of here; their pure parts are in model.test.ts.
 */

const pathname = { current: "/admin/subscribers/x" };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => pathname.current,
}));
// next/link renders as the anchor it becomes, plus the one thing the real
// component keeps to itself: whether the link prefetches. Links to the audited
// views must not. `linkStatus` stands in for a navigation on its way.
const linkStatus = { pending: false };
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  function Link(props: Record<string, unknown>) {
    const { href, prefetch, ...rest } = props;
    for (const routerOnly of ["scroll", "replace", "onNavigate"]) delete rest[routerOnly];
    return createElement("a", {
      ...rest,
      href: String(href),
      "data-prefetch": prefetch === false ? "off" : "auto",
    });
  }
  return { default: Link, useLinkStatus: () => ({ pending: linkStatus.pending }) };
});
// The server actions module pulls the service-role client; the views only
// need its two functions as form actions.
vi.mock("@/app/admin/actions", () => ({
  setSubscriberActive: vi.fn(),
  deleteSubscriberAccount: vi.fn(),
}));

const { FamilyDeskHead, FamilyPhoneHead } = await import("./FamilyHead");
const { BillingView, ExerciseView, HouseholdView, MealView, RunsView, SummaryView } = await import(
  "./views"
);
const { AccountDangerZone } = await import("../_components/AccountDangerZone");
const { SummaryFacts } = await import("../_blocks");
const { HealthCards } = await import("./HealthCards");
const { ViewerHead } = await import("./ViewerHead");
const { FamilyPageSkeleton, TabSkeleton } = await import("./skeletons");
const { SubscriberRouteSkeleton } = await import("./RouteSkeleton");

function html<P extends object>(component: ComponentType<P>, props: P): string {
  const out = renderToString(createElement(component, props));
  // Every Arabic render: no «·» — beside an Arabic-Indic digit a middle dot
  // reads as the digit zero «٠». Items are set apart by <Sep/> instead.
  if ((props as { locale?: unknown }).locale === "ar") expect(out).not.toContain("·");
  return out;
}

const ID = "00000000-0000-4000-8000-0000000000aa";
const MEAL_ID = "00000000-0000-4000-8000-0000000000b1";
const PROGRAM_ID = "00000000-0000-4000-8000-0000000000c1";
const OLD_PROGRAM_ID = "00000000-0000-4000-8000-0000000000c2";
const NOW = "2026-09-30T09:00:00Z";
const TODAY = "2026-09-30";
const PAGE = `/admin/subscribers/${ID}`;

const sub = (p: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  tier: "family",
  status: "past_due",
  cadence: "monthly",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-09-26T00:00:00Z",
  trialStartedAt: "2026-08-01T00:00:00Z",
  trialEndsAt: "2026-08-08T00:00:00Z",
  currentPeriodEnd: "2026-10-01T00:00:00Z",
  endsAt: null,
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  lemonsqueezySubscriptionId: "sub_123",
  lemonsqueezyCustomerId: "cus_456",
  lemonsqueezyVariantId: "var_789",
  ...p,
});

function header(p: Partial<FamilyHeaderData> = {}): FamilyHeaderData {
  return {
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
    flags: ["past_due", "failed_meal_run", "onboarding_incomplete"],
    cancelState: "none",
    medicalGateBlocked: true,
    reasons: [
      { flag: "past_due", severity: "high", at: "2026-09-26T00:00:00Z", tab: "billing" },
      { flag: "medical_gate", severity: "high", at: null, tab: "household" },
      { flag: "failed_meal_run", severity: "low", at: "2026-09-19T06:00:00Z", tab: "meal" },
      { flag: "onboarding_incomplete", severity: "medium", at: null, tab: "summary" },
    ],
    lifetimeAiCostUsd: 12.5,
    lastActivityAt: "2026-09-29T10:00:00Z",
    engagement: { chatCount: 14, lastChatAt: "2026-09-28T10:00:00Z", chatCostUsd: 0.35 },
    ...p,
  };
}

const day = (dayIndex: number, calories: number) => ({
  dayIndex,
  meals: [
    { slot: "breakfast", name: "شكشوكة", calories: calories * 0.3, proteinG: 20, sharedBy: 2 },
    { slot: "lunch", name: "كبسة دجاج", calories: calories * 0.5, proteinG: 40, sharedBy: 1 },
  ],
  totalCalories: calories * 0.8,
  totalProteinG: 60,
});

const mealPlan = (i: number, status = "ready") => ({
  id: i === 0 ? MEAL_ID : `00000000-0000-4000-8000-0000000000d${i}`,
  status,
  createdAt: `2026-09-${String(27 - i * 3).padStart(2, "0")}T08:00:00Z`,
  generatedAt: status === "ready" ? `2026-09-${String(27 - i * 3).padStart(2, "0")}T08:12:00Z` : null,
  daysReady: status === "ready" ? 7 : 0,
  daysTotal: 7,
  aiInputTokens: 48_000 + i,
  aiOutputTokens: 61_000 + i,
  aiModel: "claude-sonnet-5",
  costUsd: 3.28,
});

const MEAL: MealSection = {
  served: {
    plan: mealPlan(0),
    week: {
      weekStartDate: "2026-09-27",
      daysTotal: 7,
      generating: false,
      completeDays: [0, 1, 2],
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
  // Seven plans: the served one, then six earlier ones (one failed).
  plans: [0, 1, 2, 3, 4, 5, 6].map((i) => mealPlan(i, i === 2 ? "failed" : "ready")),
};

const HOUSEHOLD: HouseholdMember[] = [
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
    caloriesTarget: 1300,
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
];

const programItem = (id: string, status: string, errorMessage: string | null = null) => ({
  id,
  status,
  createdAt: "2026-09-27T08:20:00Z",
  generatedAt: status === "ready" ? "2026-09-27T08:22:00Z" : null,
  updatedAt: "2026-09-27T08:22:00Z",
  errorMessage,
  traineeCount: status === "ready" ? 1 : null,
  sessionsPerWeek: status === "ready" ? 3 : null,
  aiModel: "claude-sonnet-5",
  costUsd: 0.94,
});

const READY_WORKOUT: WorkoutSection = {
  optedIn: true,
  served: {
    plan: programItem(PROGRAM_ID, "ready"),
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
          mark:
            dayIndex === 0 ? { status: "done" as const, intensity: "hard" as const, localDate: "2026-09-27" } : null,
        })),
        doneThisWeek: 1,
      },
    ],
    masked: false,
  },
  latest: programItem(PROGRAM_ID, "ready"),
  waitingForMeals: false,
  plans: [programItem(PROGRAM_ID, "ready"), programItem(OLD_PROGRAM_ID, "failed", "stream timeout")],
  ineligible: [
    { memberId: "kid", name: "لمى", reason: "child", age: 10 },
    { memberId: "cook", name: "Maria", reason: "housekeeper", age: null },
  ],
  marksWindow: { start: "2026-09-27", end: TODAY },
};

const EMPTY_WORKOUT: WorkoutSection = {
  optedIn: false,
  served: null,
  latest: null,
  waitingForMeals: false,
  plans: [],
  ineligible: [],
  marksWindow: null,
};

const RUNS: RunRow[] = [
  {
    id: "r1",
    kind: "workout",
    status: "failed",
    model: "claude-sonnet-5",
    tokensIn: 1200,
    tokensOut: 800,
    costUsd: 0.12,
    durationMs: 61_000,
    createdAt: "2026-09-28T08:00:00Z",
    completedAt: null,
    errorMessage: "Anthropic stream timeout after 202876ms",
    mealPlanId: null,
    workoutPlanId: OLD_PROGRAM_ID,
  },
  {
    id: "r2",
    kind: "meal",
    status: "completed",
    model: "claude-sonnet-5",
    tokensIn: 48_000,
    tokensOut: 61_000,
    costUsd: 3.28,
    durationMs: 700_000,
    createdAt: "2026-09-27T08:00:00Z",
    completedAt: "2026-09-27T08:12:00Z",
    errorMessage: null,
    mealPlanId: MEAL_ID,
    workoutPlanId: null,
  },
];

const count = (text: string, part: string) => text.split(part).length - 1;

/** The opening tag of every anchor in `out` that links to exactly `href`. */
function anchorsTo(out: string, href: string): string[] {
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return out.match(new RegExp(`<a [^>]*href="${escaped}"[^>]*>`, "g")) ?? [];
}

/** No link to an audited view (a plan or a program) may prefetch it;
 *  `expected` is how many such links the render holds. */
function expectNoPrefetch(out: string, hrefs: string[], expected: number) {
  const anchors = hrefs.flatMap((href) => anchorsTo(out, href));
  expect(anchors).toHaveLength(expected);
  for (const tag of anchors) expect(tag).toContain('data-prefetch="off"');
}

/** The one primary button in `out`, whole — the «open» link into an audited view. */
function primaryButton(out: string): string {
  const found = out.match(/<a class="ad-btn ad-btn-p"[^>]*>.*?<\/a>/g) ?? [];
  expect(found).toHaveLength(1);
  return found[0] ?? "";
}

/** `render()` as it looks while a link's navigation is on its way. */
function whilePending(render: () => string): string {
  linkStatus.pending = true;
  try {
    return render();
  } finally {
    linkStatus.pending = false;
  }
}

/** An «open» button at rest, then on its way: its label gives way to «جارٍ
 *  الفتح…» (announced), the other text keeps holding the button's width
 *  unseen, and the button is marked for its dimmed state. */
function expectOpeningLabel(idle: string, busy: string, label: string) {
  expect(idle).toContain(`<span aria-live="polite">${label}</span>`);
  expect(idle).toContain('<span aria-hidden="true">جارٍ الفتح…</span>');
  expect(idle).not.toContain("data-pending");
  expect(busy).toContain('<span class="ad-fp-swap" data-pending="true">');
  expect(busy).toContain('<span aria-live="polite">جارٍ الفتح…</span>');
  expect(busy).toContain(`<span aria-hidden="true">${label}</span>`);
}

// ── The head ────────────────────────────────────────────────────────────────

describe("family head", () => {
  it("desktop: crumb, name, email and customer-since, chips, health entry, all seven tabs", () => {
    const out = html(FamilyDeskHead, { header: header(), tab: "meal", locale: "ar" });
    expect(out).toContain("العائلات");
    expect(out).toContain("<h1>");
    expect(out).toContain("هند العتيبي");
    expect(out).toContain('dir="ltr"');
    expect(out).toContain("hind@example.com");
    expect(out).toContain("مشترك منذ");
    // Tier, status (past due), and the flags beside them — medical gate included.
    expect(out).toContain("ad-tier");
    expect(out).toContain("متأخر الدفع");
    expect(out).toContain("بوابة طبية");
    expect(out).toContain("فشل إنشاء الوجبات");
    // The protected health entry opens a dialog; it is not a link.
    expect(out).toContain('aria-haspopup="dialog"');
    expect(out).toContain("الأسرة والصحة");
    expect(out).not.toContain(`href="${PAGE}/health"`);
    // Its visible label is the household tab's name, which the tab bar also
    // carries; the rest of its accessible name says what it does instead.
    expect(out).toMatch(
      /aria-haspopup="dialog"[^>]*>(?:(?!<\/button>).)*الأسرة والصحة<span class="ad-sr"> — عرض التفاصيل الصحية \(مُسجّل\)<\/span><\/button>/,
    );
    // Seven tabs, the current one marked, summary on the bare URL.
    for (const tab of FAMILY_TABS) {
      expect(out).toContain(tab === "summary" ? `href="${PAGE}"` : `href="${PAGE}?tab=${tab}"`);
    }
    expect(count(out, 'aria-current="page"')).toBe(1);
    expect(out).toMatch(/aria-current="page" href="[^"]*\?tab=meal"/);
  });

  it("marks a deactivated account in the chips, and omits a missing tier", () => {
    const out = html(FamilyDeskHead, {
      header: header({ deactivated: true, subscription: null, flags: [], medicalGateBlocked: false }),
      tab: "summary",
      locale: "en",
    });
    expect(out).toContain("Account deactivated");
    expect(out).toContain("No subscription");
    expect(out).not.toContain("ad-tier");
    expect(out).toContain("No flags");
  });

  it("phone: the name, the chips and the tabs — no email line, no second bar", () => {
    const out = html(FamilyPhoneHead, { header: header(), tab: "summary", locale: "ar" });
    expect(out).toContain("ad-ph-top ad-phone-only");
    // The way back is in the top bar (_shell/PhoneBarTitle): one bar, as the
    // prototype's phone family screen has it.
    expect(out).not.toContain("ad-ph-back");
    expect(out).not.toContain("ad-ph-bar");
    expect(out).toContain("ad-ph-title");
    expect(out).toContain("هند العتيبي");
    expect(out).not.toContain("hind@example.com");
    expect(count(out, "href=")).toBe(FAMILY_TABS.length);
  });

  it("names a nameless family", () => {
    const out = html(FamilyDeskHead, { header: header({ displayName: "  " }), tab: "summary", locale: "ar" });
    expect(out).toContain("بدون اسم");
  });
});

// ── Summary ─────────────────────────────────────────────────────────────────

describe("summary", () => {
  const out = html(SummaryView, {
    userId: ID,
    header: header(),
    meal: MEAL,
    workout: READY_WORKOUT,
    locale: "ar",
    currency: "sar",
    nowIso: NOW,
  });

  it("explains each flag and links it to the tab that resolves it", () => {
    expect(out).toContain("التنبيهات");
    expect(out).toContain("الدفع متأخر");
    expect(out).toContain(`href="${PAGE}?tab=billing"`);
    expect(out).toContain("فتح قسم الاشتراك");
    expect(out).toContain(`href="${PAGE}?tab=household"`);
    // The onboarding reason is resolved on the summary itself: no link.
    expect(out).toContain("التسجيل غير مكتمل");
    expect(out).not.toContain(`href="${PAGE}"`);
  });

  it("shows the meal plan and the program at a glance, each with a way into its tab", () => {
    expect(out).toContain("الخطة الغذائية");
    expect(out).toContain("خطة التمارين");
    expect(out).toContain(`href="${PAGE}?tab=meal"`);
    expect(out).toContain(`href="${PAGE}?tab=exercise"`);
    expect(out).toContain("فتح قسم الخطة الغذائية");
    expect(out).toContain("فتح قسم خطة التمارين");
    expect(out).toContain("أيام جاهزة");
    expect(out).toContain("حصص أسبوعياً");
  });

  it("carries the account and engagement fields, and the key figures on phones", () => {
    expect(out).toContain("الحساب");
    expect(out).toContain("hind@example.com");
    expect(out).toContain("رسائل المساعد");
    expect(out).toContain("ad-phone-only");
    expect(out).toContain("تكلفة الذكاء الكلية");
  });

  it("drops the flags panel when there is nothing to explain", () => {
    const calm = html(SummaryView, {
      userId: ID,
      header: header({ reasons: [], flags: [], medicalGateBlocked: false }),
      meal: { served: null, plans: [] },
      workout: EMPTY_WORKOUT,
      locale: "ar",
      currency: "sar",
      nowIso: NOW,
    });
    expect(calm).not.toContain("التنبيهات");
    expect(calm).toContain("لا توجد خطة غذائية بعد");
    expect(calm).toContain("لم تشترك الأسرة في خطة التمارين");
  });
});

// ── The renewal cell (the page's and the panel's key figures) ───────────────

describe("renewal cell", () => {
  /** The «التجديد» figure for `subscription`, judged the way the loader judges it. */
  function renewal(subscription: SubscriptionRow): string {
    const cancelState = subscriptionCancelState(subscription, Date.parse(NOW));
    const out = html(SummaryFacts, {
      header: header({ subscription, cancelState }),
      locale: "ar",
      currency: "sar",
      nowIso: NOW,
    }).replace(/<!-- -->/g, "");
    const cell = out.match(/<dt>التجديد<\/dt><dd>(.*?)<\/dd>/)?.[1];
    expect(cell).toBeDefined();
    return cell ?? "";
  }
  const CANCEL = "إلغاء مجدول";

  it("a portal cancellation still paid up: the day it runs out (its ends_at), then «إلغاء مجدول»", () => {
    // Cancelled in the LemonSqueezy portal: status 'cancelled', no period end.
    const cell = renewal(
      sub({
        status: "cancelled",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: null,
        endsAt: "2026-10-20T00:00:00Z",
      }),
    );
    expect(cell).toMatch(
      /^<time dateTime="2026-10-20T00:00:00Z">[^<]+<\/time> <span class="ad-sep"[^>]*><\/span> <span class="ad-bad">إلغاء مجدول<\/span>$/,
    );
  });

  it("a cancellation that has run out: the day it ended, and no label", () => {
    const cell = renewal(
      sub({
        status: "cancelled",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: null,
        endsAt: "2026-09-01T00:00:00Z",
      }),
    );
    expect(cell).toMatch(/^<time dateTime="2026-09-01T00:00:00Z">[^<]+<\/time>$/);
    // Set to cancel but past its period end (a missed expiry webhook): the
    // flag is still raw on the row, and the label follows the verdict instead.
    expect(
      renewal(sub({ status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: "2026-09-01T00:00:00Z" })),
    ).not.toContain(CANCEL);
  });

  it("a trial set to cancel: the trial's end, then «إلغاء مجدول»", () => {
    const cell = renewal(
      sub({
        status: "trialing",
        cancelAtPeriodEnd: true,
        trialEndsAt: "2026-10-04T00:00:00Z",
        currentPeriodEnd: null,
      }),
    );
    expect(cell).toMatch(
      /^<span class="ad-muted">تنتهي التجربة<\/span> <time dateTime="2026-10-04T00:00:00Z">[^<]+<\/time> <span class="ad-sep"[^>]*><\/span> <span class="ad-bad">إلغاء مجدول<\/span>$/,
    );
    // A trial that runs on shows its end and nothing else.
    expect(
      renewal(sub({ status: "trialing", trialEndsAt: "2026-10-04T00:00:00Z", currentPeriodEnd: null })),
    ).not.toContain(CANCEL);
  });
});

// ── Meal plan ───────────────────────────────────────────────────────────────

describe("meal plan tab", () => {
  const out = html(MealView, {
    userId: ID,
    meal: MEAL,
    household: HOUSEHOLD,
    locale: "ar",
    currency: "sar",
    todayIso: TODAY,
  });

  it("explores the served week and opens the full plan without prefetching it", () => {
    expect(out).toContain("كبسة دجاج");
    expect(out).toContain("فتح الخطة كاملة");
    expect(out).toContain(`href="${PAGE}/plan/${MEAL_ID}"`);
    expect(out).toContain("فتح الخطة يُسجَّل في سجل التدقيق");
    expect(out).toContain("الخطة الحالية");
    // Opening a plan is audited, so none of the thirteen links to a plan view
    // (the button, five beside the week, seven in the ledger) prefetches it.
    expectNoPrefetch(
      out,
      MEAL.plans.map((plan) => `${PAGE}/plan/${plan.id}`),
      13,
    );
  });

  it("the open button says the plan is opening while it loads, without resizing", () => {
    const busy = whilePending(() =>
      html(MealView, {
        userId: ID,
        meal: MEAL,
        household: HOUSEHOLD,
        locale: "ar",
        currency: "sar",
        todayIso: TODAY,
      }),
    );
    expectOpeningLabel(primaryButton(out), primaryButton(busy), "فتح الخطة كاملة");
    expect(primaryButton(out)).toContain(`href="${PAGE}/plan/${MEAL_ID}"`);
  });

  it("lists recent earlier plans beside the week and every plan in the ledger", () => {
    expect(out).toContain("الخطط السابقة");
    expect(out).toContain("كل الخطط");
    // Every plan links to its view from the ledger; the six earlier ones once
    // more (five of them) beside the week.
    for (const plan of MEAL.plans) expect(out).toContain(`${PAGE}/plan/${plan.id}`);
    const earlierBeside = MEAL.plans.slice(1, 6);
    for (const plan of earlierBeside) expect(count(out, `${PAGE}/plan/${plan.id}"`)).toBe(2);
    expect(count(out, `${PAGE}/plan/${MEAL.plans[6]!.id}"`)).toBe(1);
    // The ledger carries the run detail the old page had.
    expect(out).toContain("claude-sonnet-5");
    expect(out).toContain("التوكنز");
  });

  it("with no served plan: the empty state, and still every plan in the ledger", () => {
    const none = html(MealView, {
      userId: ID,
      meal: { served: null, plans: [mealPlan(1, "archived")] },
      household: HOUSEHOLD,
      locale: "ar",
      currency: "sar",
      todayIso: TODAY,
    });
    expect(none).toContain("لا توجد خطة غذائية بعد");
    expect(none).toContain("كل الخطط");
    expect(none).toContain(`${PAGE}/plan/${mealPlan(1).id}`);
    expect(none).not.toContain("فتح الخطة كاملة");
  });
});

// ── Exercise plan ───────────────────────────────────────────────────────────

describe("exercise plan tab", () => {
  const view = (workout: WorkoutSection, todayWeekday = 3) =>
    html(ExerciseView, { userId: ID, workout, locale: "ar", currency: "sar", todayWeekday });

  it("ready: the program, its week with this week's marks, trainees, history and ledger", () => {
    const out = view(READY_WORKOUT);
    expect(out).toContain("البرنامج الحالي");
    expect(out).toContain("فتح البرنامج كاملاً");
    expect(out).toContain(`href="${PAGE}/workout/${PROGRAM_ID}"`);
    expect(out).toContain("فتح البرنامج يُسجَّل في سجل التدقيق");
    expect(out).toContain("تمرين الجسم كامل");
    expect(out).toContain("سكوات");
    // Sunday's session was marked done; Tuesday's passed unmarked; Thursday is ahead.
    expect(out).toContain("تمّت");
    expect(out).toContain("بلا تسجيل");
    expect(out).toContain("قادمة");
    // Opened on Sunday, the session's detail carries the mark's intensity.
    expect(view(READY_WORKOUT, 0)).toContain("صعبة");
    expect(out).toContain("المتدرّبون");
    expect(out).toContain("خارج خطط التمارين");
    expect(out).toContain("سجل البرامج");
    expect(out).toContain("كل البرامج");
    expect(out).toContain(`${PAGE}/workout/${OLD_PROGRAM_ID}`);
    expect(out).toContain("stream timeout");
    // Opening a program is audited too: none of the five links to a program
    // view (the button, two in the history, two in the ledger) prefetches it.
    expectNoPrefetch(
      out,
      [PROGRAM_ID, OLD_PROGRAM_ID].map((id) => `${PAGE}/workout/${id}`),
      5,
    );
  });

  it("the open button says the program is opening while it loads, without resizing", () => {
    const out = view(READY_WORKOUT);
    const busy = whilePending(() => view(READY_WORKOUT));
    expectOpeningLabel(primaryButton(out), primaryButton(busy), "فتح البرنامج كاملاً");
    expect(primaryButton(out)).toContain(`href="${PAGE}/workout/${PROGRAM_ID}"`);
  });

  it("not opted in: says so, with nothing to open", () => {
    const out = view(EMPTY_WORKOUT);
    expect(out).toContain("لم تشترك الأسرة في خطة التمارين");
    expect(out).not.toContain("فتح البرنامج كاملاً");
    expect(out).not.toContain("كل البرامج");
  });

  it("opted in, no run yet", () => {
    const out = view({ ...EMPTY_WORKOUT, optedIn: true });
    expect(out).toContain("ولم يُنشأ برنامج بعد");
  });

  it("waiting for the meal run", () => {
    const generating = programItem(PROGRAM_ID, "generating");
    const out = view({
      ...EMPTY_WORKOUT,
      optedIn: true,
      latest: generating,
      waitingForMeals: true,
      plans: [generating],
    });
    expect(out).toContain("ينتظر اكتمال الوجبات");
    expect(out).toContain("كل البرامج");
    expect(out).not.toContain("فتح البرنامج كاملاً");
  });

  it("generating", () => {
    const generating = programItem(PROGRAM_ID, "generating");
    const out = view({ ...EMPTY_WORKOUT, optedIn: true, latest: generating, plans: [generating] });
    expect(out).toContain("يُنشأ البرنامج الآن");
  });

  it("failed with nothing to show", () => {
    const failed = programItem(PROGRAM_ID, "failed", "boom");
    const out = view({ ...EMPTY_WORKOUT, optedIn: true, latest: failed, plans: [failed] });
    expect(out).toContain("ولا يوجد برنامج سابق يُعرض للعائلة");
    expect(out).not.toContain("فتح البرنامج كاملاً");
  });

  it("failed, the previous program still served — and still openable", () => {
    const failed = programItem(OLD_PROGRAM_ID, "failed", "boom");
    const out = view({
      ...READY_WORKOUT,
      served: { ...READY_WORKOUT.served!, masked: true },
      latest: failed,
    });
    expect(out).toContain("والبرنامج السابق ما زال معروضاً للعائلة");
    expect(out).toContain(`href="${PAGE}/workout/${PROGRAM_ID}"`);
  });
});

// ── Household, billing, runs ────────────────────────────────────────────────

describe("household, billing and runs tabs", () => {
  it("household: the table, flags, and the confirm-first health entry", () => {
    const out = html(HouseholdView, { userId: ID, members: HOUSEHOLD, locale: "ar" });
    expect(out).toContain("الأسرة والصحة");
    expect(out).toContain("عرض التفاصيل الصحية (مُسجّل)");
    expect(out).toContain('aria-haspopup="dialog"');
    expect(out).toContain("بوابة طبية");
    expect(out).toContain("صعب الإرضاء");
    expect(out).toContain("Maria");
  });

  it("billing: the subscription with its ids, the history when there is more than one row, the account", () => {
    const out = html(BillingView, { header: header(), locale: "ar" });
    expect(out).toContain("sub_123");
    expect(out).toContain("cus_456");
    expect(out).toContain("var_789");
    expect(out).toContain("سجل الاشتراك");
    expect(out).toContain("hind@example.com");
    const single = html(BillingView, {
      header: header({ subscriptionHistory: [sub()] }),
      locale: "ar",
    });
    expect(single).not.toContain("سجل الاشتراك");
  });

  it("runs: meal and exercise runs with kind, status, model, cost, duration and error", () => {
    const out = html(RunsView, { runs: RUNS, locale: "en", currency: "usd" });
    expect(out).toContain("Generation history");
    expect(out).toContain("Exercise");
    expect(out).toContain("Meal");
    expect(out).toContain("claude-sonnet-5");
    expect(out).toContain("stream timeout");
    expect(out).toContain("2026");
  });
});

// ── Account actions ─────────────────────────────────────────────────────────

describe("account actions", () => {
  const zone = (p: Partial<Parameters<typeof AccountDangerZone>[0]> = {}) =>
    html(AccountDangerZone, {
      userId: ID,
      email: "hind@example.com",
      displayName: "هند العتيبي",
      deactivated: false,
      locale: "ar",
      ...p,
    });

  it("an active account: deactivate (reversible) and delete behind a dialog", () => {
    const out = zone();
    expect(out).toContain("منطقة الخطر");
    expect(out).toContain("الحساب نشط");
    expect(out).toContain('name="active" value="false"');
    expect(out).toContain(`name="userId" value="${ID}"`);
    expect(out).toContain("حذف الحساب");
    expect(out).toContain('aria-haspopup="dialog"');
    // The dialog is not in the page until it is opened.
    expect(out).not.toContain('role="dialog"');
    expect(out).not.toContain("confirmEmail");
  });

  it("a deactivated account offers reactivation", () => {
    const out = zone({ deactivated: true, locale: "en" });
    expect(out).toContain("Account deactivated");
    expect(out).toContain("Reactivate");
    expect(out).toContain('name="active" value="true"');
  });

  it("without a readable email the deletion cannot start, and says why", () => {
    const out = zone({ email: null });
    expect(out).toContain("تعذّرت قراءة البريد الإلكتروني");
    expect(out).toMatch(/aria-disabled="true"[^>]*aria-describedby=/);
  });
});

// ── Health, plan/program heads, skeletons ───────────────────────────────────

describe("health cards", () => {
  const MEMBERS: MemberHealth[] = [
    {
      id: "mom",
      name: "هند",
      role: "mom",
      isPregnant: true,
      trimester: 2,
      monthsPostpartum: null,
      highRiskPregnancy: true,
      consultedDoctor: false,
      medicalConditions: ["pcos", "حالة نادرة"],
      allergies: [{ name_ar: "فول سوداني" }],
      dislikes: ["باذنجان"],
    },
    {
      id: "kid",
      name: "لمى",
      role: "daughter",
      isPregnant: null,
      trimester: null,
      monthsPostpartum: null,
      highRiskPregnancy: null,
      consultedDoctor: null,
      medicalConditions: [],
      allergies: null,
      dislikes: [],
    },
  ];

  it("shows every field, the owner's pregnancy only on the owner's card", () => {
    const out = html(HealthCards, { members: MEMBERS, locale: "ar" });
    expect(count(out, "ad-hcard")).toBe(2);
    expect(count(out, "حامل")).toBe(1);
    expect(out).toContain("الثلث");
    expect(out).toContain("أشهر بعد الولادة");
    expect(out).toContain("حمل عالي الخطورة");
    expect(out).toContain("استشارة الطبيب");
    expect(out).toContain("٢");
    // A known condition reads by name in Arabic; free text stays as written.
    expect(out).toContain("تكيس المبايض");
    expect(out).toContain("حالة نادرة");
    expect(out).toContain("فول سوداني");
    expect(out).toContain("باذنجان");
    expect(out).toContain("لا شيء");
  });

  it("keeps the stored condition value in the English console", () => {
    const out = html(HealthCards, { members: MEMBERS, locale: "en" });
    expect(out).toContain("pcos");
    expect(out).toContain("Pregnant");
  });
});

describe("plan and program heads", () => {
  it("links back to the family's tab, names the view, dates it, and says it is recorded", () => {
    const out = html(ViewerHead, {
      userId: ID,
      backTab: "exercise",
      familyName: "هند العتيبي",
      title: "برنامج التمارين",
      status: "ready",
      createdAt: "2026-09-27T08:20:00Z",
      generatedAt: "2026-09-27T08:22:00Z",
      audit: "تم تسجيل عرض برنامج المشترك في سجل التدقيق.",
      locale: "ar",
    });
    expect(out).toContain(`href="${PAGE}?tab=exercise"`);
    expect(out).toContain("هند العتيبي");
    expect(out).toContain("<h1>");
    expect(out).toContain("برنامج التمارين");
    expect(out).toContain("أُنشئت");
    expect(out).toContain("عرض للقراءة فقط");
    expect(out).toContain("جاهزة");
    expect(out).toContain("ad-audit-line");
  });

  it("falls back to «صفحة العائلة» without a name, and dates an unfinished run by its start", () => {
    const out = html(ViewerHead, {
      userId: ID,
      backTab: "meal",
      familyName: null,
      title: "الخطة الغذائية",
      status: "generating",
      createdAt: "2026-09-27T08:20:00Z",
      generatedAt: null,
      audit: "x",
      locale: "ar",
    });
    expect(out).toContain("صفحة العائلة");
    expect(out).toContain("بدأت");
    expect(out).toContain(`href="${PAGE}?tab=meal"`);
  });
});

describe("loading shapes", () => {
  it("every tab has a body skeleton, announced once", () => {
    for (const tab of FAMILY_TABS) {
      const out = html(TabSkeleton, { tab, label: "جارٍ تحميل هذا القسم…" });
      expect(count(out, 'role="status"')).toBe(1);
      expect(out).toContain("ad-skel");
    }
  });

  it("the route skeleton follows the path being opened", () => {
    const labels = { family: "family-loading", view: "view-loading" };
    pathname.current = PAGE;
    const family = html(SubscriberRouteSkeleton, { labels });
    expect(family).toContain("family-loading");
    expect(family).toContain("ad-fp-skel-tabs");
    pathname.current = `${PAGE}/health`;
    const health = html(SubscriberRouteSkeleton, { labels });
    expect(health).toContain("view-loading");
    expect(health).toContain("ad-health-grid");
    pathname.current = `${PAGE}/plan/${MEAL_ID}`;
    const viewer = html(SubscriberRouteSkeleton, { labels });
    expect(viewer).toContain("ad-fp-skel-viewer");
    expect(html(FamilyPageSkeleton, { label: "x" })).toContain("ad-ph-top");
  });
});
