import { Suspense } from "react";
import Link from "next/link";
import { Sparkles, UtensilsCrossed } from "lucide-react";
import { planHasContent } from "@fitlife/plan-engine";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { TrialBanner } from "@/components/subscription/TrialBanner";
import { staleMemberIds } from "@/lib/plans/memberEdit";
import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
  getCurrentUserLatestPlan,
  getCurrentUserCookablePlan,
} from "@/lib/supabase/queries";
import { getLatestWorkoutPlan } from "@/lib/plans/getLatestWorkoutPlan";
import {
  dayIndexFromWeekStart,
  riyadhDateLabelAr,
  riyadhHour,
  dayNameFromWeekStart,
  riyadhTodayISO,
  riyadhWeekday,
} from "@/lib/plans/dayMapping";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  getCurrentSubscription,
  hasLiveLemonsqueezySubscription,
} from "@/lib/subscription/state";
import { canGenerateForFamilyChange } from "@/lib/subscription/access";
import { isWithinRenewalWindow, loadFamilyLedger } from "@/lib/engagement/ledger";
import { getFamilySeasonProps } from "@/lib/engagement/seasonProps";
import { computeSeasonStats } from "@/lib/engagement/seasonMath";
import { buildTodayTable } from "@/lib/dashboard/todayTable";
import { getTodayAbsences } from "@/lib/dashboard/todayAbsences";
import { daysReady } from "@/lib/dashboard/planProgress";
import { genderPick } from "@/lib/copy/gender";
import { arNum } from "@/lib/copy/numbers";
import { DeferredMemberDrain } from "../plan/DeferredMemberDrain";
import { RenewalRecapCard } from "./RenewalRecapCard";
import { CheckoutSuccessHandler } from "./CheckoutSuccessHandler";
import { RefreshOnFocus } from "./RefreshOnFocus";
import { BillingPortalButton } from "./BillingPortalButton";
import { EmptyPlanCTA } from "./EmptyPlanCTA";
import { GeneratingPlanWatcher } from "./GeneratingPlanWatcher";
import { KitchenToday, type KitchenCook } from "./KitchenToday";
import { MoreCard, type NextStep } from "./MoreCard";
import { RegenerateButton } from "../plan/RegenerateButton";
import { getLocaleInfo, isLocaleCode } from "@/lib/plans/locales";
import { SeasonBoard } from "./SeasonBoard";
import { SoloWeekCard } from "./SoloWeekCard";
import { WorkoutTodayCard, type WorkoutToday } from "./WorkoutTodayCard";
import { GenerationProgress } from "./GenerationProgress";

export const metadata = {
  title: "الرئيسية",
};

/**
 * Home (09/2026 redesign, «سفرة اليوم»). Answers one question first — what
 * are we eating today, and what needs me — then the week:
 *   greeting + one-line summary → ONE notice (by priority) → today's table
 *   (one-tap «طبختها كما هي») → today's workout → «موسم بيتنا» (or a solo
 *   «أسبوعكِ») → quick tiles → ONE next-step suggestion.
 * Desktop lays the same blocks in two asymmetric columns (7:5).
 */
export default async function DashboardPage() {
  // Independent reads in one round-trip (auth is deduped via React.cache).
  const [profile, familyMembers, latestPlan, cookable, user, supabase] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentUserFamilyMembers(),
    getCurrentUserLatestPlan(),
    getCurrentUserCookablePlan(),
    getAuthUser(),
    createClient(),
  ]);

  if (!profile) {
    return (
      <main className="container-shell py-10">
        <p className="text-base text-brand-ink-muted">نجهّز حسابكم…</p>
      </main>
    );
  }

  const g = genderPick(profile.sex);
  const onboardingDone = profile.onboarding_completed_at !== null;

  // A 'ready' row with empty day shells isn't usable yet — still generating.
  const planHasMeals = latestPlan?.plan_data ? planHasContent(latestPlan.plan_data) : false;
  const planIsReady = latestPlan?.status === "ready" && planHasMeals;
  const generating =
    !!latestPlan &&
    (latestPlan.status === "generating" ||
      (latestPlan.status === "ready" && !planHasMeals) ||
      latestPlan.in_progress);

  // The week the table reads from: the latest plan once it has meals, else the
  // previous complete week while a regeneration runs (a new run's empty row
  // must not take today's dinner off the screen).
  const tablePlan =
    cookable?.plan.status === "ready" &&
    cookable.plan.plan_data &&
    planHasContent(cookable.plan.plan_data)
      ? cookable.plan
      : null;

  const [subscription, workoutPlan] = user
    ? await Promise.all([getCurrentSubscription(user.id), getLatestWorkoutPlan(user.id)])
    : [null, null];

  const beneficiaries = familyMembers.filter((m) => m.role !== "housekeeper");
  const housekeeper = familyMembers.find((m) => m.role === "housekeeper");

  // Members not in the current plan yet → the drain generates them.
  const planMemberIds = latestPlan?.member_ids ?? [];
  const pendingMembers = beneficiaries.filter((m) => !planMemberIds.includes(m.id));
  const needsFamilyPlan = planIsReady && pendingMembers.length > 0;
  const pendingNamesText = pendingMembers.map((m) => m.name).join("، ");
  // The drain also aligns a plan with a removed member still in it (ghost) or
  // a member edited after the plan was built (stale).
  const liveMemberIds = new Set(familyMembers.map((m) => m.id));
  const hasGhostMember = planMemberIds.some((id) => id !== "mom" && !liveMemberIds.has(id));
  const hasStaleMember =
    planIsReady && staleMemberIds(familyMembers, latestPlan?.generated_at).length > 0;
  const drainForAlignment = planIsReady && (hasGhostMember || hasStaleMember);

  const showRenewalRecap =
    !!user &&
    subscription?.status === "active" &&
    !!subscription.lemonsqueezy_subscription_id &&
    !subscription.cancel_at_period_end &&
    !!subscription.current_period_end &&
    isWithinRenewalWindow(subscription.current_period_end);

  const todayISO = riyadhTodayISO();
  const weekStart = tablePlan?.plan_data?.week_start_date ?? null;
  const rawTodayIndex = weekStart ? dayIndexFromWeekStart(weekStart) : null;
  const todayIndex =
    rawTodayIndex !== null && rawTodayIndex >= 0 && rawTodayIndex <= 6 ? rawTodayIndex : null;

  const [familyChangeAccess, seasonProps, renewalLedger, trialCounts, absences] =
    await Promise.all([
      needsFamilyPlan && user ? canGenerateForFamilyChange(user.id) : null,
      // Same numbers for a solo household — its «أسبوعكِ» card reads them.
      getFamilySeasonProps(profile, familyMembers, tablePlan, workoutPlan, { allowSolo: true }),
      showRenewalRecap && user ? loadFamilyLedger(supabase, user.id) : null,
      user && subscription?.status === "trialing"
        ? Promise.all([
            supabase
              .from("chat_messages")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .limit(1),
            supabase
              .from("body_logs")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .limit(1),
          ])
        : null,
      tablePlan && todayIndex !== null
        ? getTodayAbsences(profile.id, todayISO, todayIndex)
        : [],
    ]);

  const pendingBlocked = familyChangeAccess?.allowed === false;
  const isFamily = (seasonProps?.members.length ?? 0) >= 2;
  const stats = seasonProps ? computeSeasonStats(seasonProps) : null;

  // ── Today's table ──────────────────────────────────────────────────────
  const roster = seasonProps?.members ?? [];
  const today =
    tablePlan?.plan_data && todayIndex !== null
      ? buildTodayTable({
          // A member removed while a run held the lock stays in plan_data;
          // they are nobody's dinner any more.
          members: tablePlan.plan_data.members.filter(
            (m) => m.member_id === "mom" || liveMemberIds.has(m.member_id),
          ),
          rosterOrder: roster.map((m) => m.id),
          dayIndex: todayIndex,
          checkins: (seasonProps?.checkins ?? []).map((c) => ({
            day_index: c.day_index,
            slot: c.slot,
            member_id: c.member_id ?? null,
            status: c.status ?? "",
          })),
          absences,
        })
      : null;
  const people = roster.map((m, i) => ({ id: m.id, name: m.name, rosterIndex: i }));

  // ── Today's workout (owner, once opted in) ─────────────────────────────
  let workoutToday: WorkoutToday | null = null;
  if (profile.workout_profile !== null && workoutPlan) {
    if (workoutPlan.status === "generating") {
      workoutToday = { kind: "generating", waitingForMeals: latestPlan?.in_progress ?? false };
    } else if (workoutPlan.status === "failed") {
      workoutToday = { kind: "failed" };
    } else {
      const mine = workoutPlan.plan_data?.members.find((m) => m.member_id === "mom");
      if (mine) {
        const weekday = riyadhWeekday();
        const session = mine.weekly_sessions.find((s) => s.day_index === weekday);
        if (session) {
          const done = (seasonProps?.workoutCheckins ?? []).some(
            (w) => w.member_id === "mom" && w.local_date === todayISO && w.status === "done",
          );
          workoutToday = {
            kind: "session",
            name: session.session_name_ar,
            minutes: session.duration_min,
            exercises: session.exercises.length,
            done,
          };
        } else {
          const sorted = [...mine.weekly_sessions].sort((a, b) => a.day_index - b.day_index);
          const next = sorted.find((s) => s.day_index > weekday) ?? sorted[0];
          workoutToday = { kind: "rest", nextName: next?.session_name_ar ?? null };
        }
      }
    }
  }

  // ── Greeting ───────────────────────────────────────────────────────
  const hour = riyadhHour();
  const hello = hour < 12 ? "صباح الخير" : "مساء الخير";
  const greeting = profile.display_name
    ? `${hello} يا ${profile.display_name}`
    : g("أهلاً بكِ", "أهلاً بك");
  // «السبت ٢٦ سبتمبر | اليوم ٤ من ٧ في خطتكم» — a rule, not a comma or a
  // pipe character, between the two facts.
  const dateLabel = riyadhDateLabelAr().replace("،", "");
  const dateLine =
    todayIndex !== null ? (
      <>
        {dateLabel}
        <i className="sep" aria-hidden="true" />
        اليوم {arNum(todayIndex + 1)} من ٧ في خطتكم
      </>
    ) : (
      dateLabel
    );
  const lead = !onboardingDone
    ? g(
        "أسئلة قصيرة عنكِ وعن بيتكِ، ثم نجهّز خطة الأسبوع.",
        "أسئلة قصيرة عنك وعن بيتك، ثم نجهّز خطة الأسبوع.",
      )
    : generating && !tablePlan
      ? "نجهّز خطة أسبوعكم الأولى."
      : null;

  // ── The cook's stub on the ticket ──────────────────────────────────────
  const cookLocale =
    housekeeper && isLocaleCode(housekeeper.preferred_language)
      ? housekeeper.preferred_language
      : null;
  const cookInfo = cookLocale ? getLocaleInfo(cookLocale) : null;
  const cook: KitchenCook | null =
    housekeeper && cookLocale && cookInfo
      ? {
          name: housekeeper.name,
          sex: (housekeeper.sex as string | null) ?? null,
          languageAr: `ب${cookInfo.ar_name}`,
          locale: cookLocale,
          dir: cookInfo.direction === "rtl" ? "rtl" : "ltr",
        }
      : null;

  // ── «سفرة الغد»: evening rows under the run-sheet, or the closed ticket's
  // look ahead once today is answered (KitchenToday decides which). ─────────
  const tomorrow =
    tablePlan?.plan_data && todayIndex !== null && todayIndex < 6
      ? {
          dayName: dayNameFromWeekStart(tablePlan.plan_data.week_start_date, todayIndex + 1),
          rows: buildTodayTable({
            members: tablePlan.plan_data.members.filter(
              (m) => m.member_id === "mom" || liveMemberIds.has(m.member_id),
            ),
            rosterOrder: roster.map((m) => m.id),
            dayIndex: todayIndex + 1,
            checkins: [],
            absences: [],
          }).rows,
        }
      : null;

  // ── ONE notice, by priority ────────────────────────────────────────────
  const liveSub = hasLiveLemonsqueezySubscription(subscription);
  let notice: React.ReactNode = null;
  if (subscription?.status === "past_due") {
    notice = (
      <Notice
        tone="critical"
        title="لم يتجدّد اشتراككم"
        action={<BillingPortalButton label="تحديث الدفع" variant="ghost" />}
      >
        {g(
          "حدّثي بيانات الدفع حتى لا تتوقف الخدمة.",
          "حدّث بيانات الدفع حتى لا تتوقف الخدمة.",
        )}
      </Notice>
    );
  } else if (latestPlan?.masked_failure) {
    notice = (
      <Notice
        tone="warning"
        action={
          <ButtonLink href="/plan" variant="secondary">
            الخطة
          </ButtonLink>
        }
      >
        آخر محاولة لإنشاء خطة جديدة لم تكتمل، وخطتكم السابقة ما زالت كما هي.
      </Notice>
    );
  } else if (needsFamilyPlan && pendingBlocked) {
    notice = (
      <Notice
        tone="info"
        action={
          <ButtonLink href={liveSub ? "/subscription" : "/pricing"} variant="secondary">
            {liveSub ? "إدارة الاشتراك" : "عرض الباقات"}
          </ButtonLink>
        }
      >
        {liveSub
          ? `خطط ${pendingNamesText} تحتاج باقة أكبر. ${g("رقّي باقتكِ", "رقِّ باقتك")} ونجهّز خططهم مع وجبات البيت.`
          : `خطط ${pendingNamesText} متاحة مع الاشتراك. ${g("اشتركي", "اشترك")} ونجهّز خططهم مع وجبات البيت.`}
      </Notice>
    );
  } else if (needsFamilyPlan) {
    notice = (
      <Notice tone="progress">
        {latestPlan?.in_progress
          ? `أُضيف ${pendingNamesText}، ونبدأ خططهم بعد اكتمال الخطة الحالية.`
          : `نجهّز خطة ${pendingNamesText} الآن، وتظهر وجباتهم هنا خلال دقائق.`}
      </Notice>
    );
  } else if (generating && tablePlan) {
    notice = (
      <Notice tone="progress">
        {cookable?.superseded
          ? "نجهّز خطة أسبوع جديد، وتبقى خطتكم الحالية هنا حتى تجهز."
          : "نكمل تجهيز بقية أيام الأسبوع، وتظهر هنا تباعاً."}
        <GeneratingPlanWatcher />
      </Notice>
    );
  } else if (subscription?.status === "trialing") {
    const [chatCount, weightCount] = trialCounts ?? [];
    notice = (
      <TrialBanner
        subscription={subscription}
        checklist={
          trialCounts
            ? {
                planReady: planIsReady,
                advisorTried: (chatCount?.count ?? 0) > 0,
                weightLogged: !weightCount?.error && (weightCount?.count ?? 0) > 0,
                showHousekeeperStep:
                  latestPlan?.status === "ready" &&
                  !!housekeeper &&
                  housekeeper.preferred_language !== "ar",
              }
            : undefined
        }
        ownerSex={profile.sex}
      />
    );
  }

  if (!notice && todayIndex === 6) {
    notice = (
      <Notice tone="info">
        {g(
          "اليوم آخر أيام خطتكم. من الغد تبدئين أسبوعاً جديداً بضغطة واحدة من هنا.",
          "اليوم آخر أيام خطتكم. من الغد تبدأ أسبوعاً جديداً بضغطة واحدة من هنا.",
        )}
      </Notice>
    );
  }

  // ── ONE next step, by priority: family > workout > deep-dive ───────────
  const settled = planIsReady && !latestPlan?.in_progress;
  let nextStep: NextStep | null = null;
  if (settled && profile.mom_profile_completed_at !== null && beneficiaries.length === 0) {
    nextStep = {
      id: "family",
      title: g("أضيفي أفراد بيتكِ إلى الخطة", "أضف أفراد بيتك إلى الخطة"),
      meta: "اشتراك واحد يخدم البيت كله: طبخة واحدة، وحصة محسوبة لكل فرد",
      href: "/family",
    };
  } else if (settled && profile.workout_profile === null && workoutPlan === null) {
    nextStep = {
      id: "workout",
      title: g("أكملي خطتكِ ببرنامج تمارين", "أكمل خطتك ببرنامج تمارين"),
      meta: g("برنامج أسبوعي يوافق هدفكِ، بعد بضع إجابات", "برنامج أسبوعي يوافق هدفك، بعد بضع إجابات"),
      href: "/onboarding/workout",
    };
  } else if (settled && profile.deep_dive_completed_at === null) {
    nextStep = {
      id: "deep-dive",
      title: g(
        "أجيبي عن أسئلة التفضيلات لتكون الخطة أدق",
        "أجب عن أسئلة التفضيلات لتكون الخطة أدق",
      ),
      meta: "أسئلة اختيارية | ٣ دقائق تقريباً",
      href: "/profile/deep-dive",
    };
  }

  // ── Today block ────────────────────────────────────────────────────────
  let todayBlock: React.ReactNode;
  const kitchenShown = !!(onboardingDone && tablePlan && today && today.rows.length > 0);
  if (!onboardingDone) {
    todayBlock = (
      <Card tone="feature" aria-labelledby="start-title">
        <Sparkles className="size-6 text-brand-yellow" aria-hidden="true" />
        <h2 id="start-title" className="mt-3 text-app-section">
          خطتكم على بُعد دقائق
        </h2>
        <p className="mt-1 text-base leading-relaxed text-white/85">
          {g(
            "أجيبي عن أسئلة قصيرة عنكِ وعن بيتكِ، ونصمّم لكم خطة غذائية لكل فرد.",
            "أجب عن أسئلة قصيرة عنك وعن بيتك، ونصمّم لكم خطة غذائية لكل فرد.",
          )}
        </p>
        <Link
          href="/onboarding"
          className="mt-4 inline-flex min-h-12 items-center rounded-full bg-brand-card px-6 text-base font-bold text-brand-purple-900 hover:bg-brand-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple-900"
        >
          {g("ابدئي الآن", "ابدأ الآن")}
        </Link>
      </Card>
    );
  } else if (tablePlan && today && today.rows.length > 0) {
    todayBlock = (
      <KitchenToday
        planId={tablePlan.id}
        dayIndex={todayIndex!}
        dayName={dayNameFromWeekStart(tablePlan.plan_data!.week_start_date, todayIndex!)}
        rows={today.rows}
        people={people}
        ownerSex={profile.sex ?? null}
        householdSize={Math.max(1, roster.length)}
        hour={hour}
        cook={cook}
        ownerDay={today.ownerDay}
        ownerWeek={stats?.ranked.find((m) => m.id === "mom") ?? null}
        tomorrow={tomorrow}
        workout={
          workoutToday ? <WorkoutTodayCard today={workoutToday} ownerSex={profile.sex ?? null} /> : null
        }
      />
    );
  } else if (tablePlan && todayIndex === null) {
    todayBlock = (
      <section className="kt-ticket" aria-labelledby="week-ended">
        <div className="kt-head solo-end">
          <div className="kt-stamp">
            <p className="kt-slot">
              <b>أسبوع خطتكم</b>
              <span>انتهى</span>
            </p>
          </div>
          <h2 className="kt-dish" id="week-ended">
            {g("أنشئي خطة الأسبوع الجديد", "أنشئ خطة الأسبوع الجديد")}
          </h2>
          <p className="kt-note">
            للبيت كله في طلب واحد. يستغرق ذلك من ٥ إلى ١٠ دقائق، وتبقى الأسابيع السابقة في السجل.
          </p>
          <div className="mt-4">
            <RegenerateButton
              memberCount={Math.max(1, roster.length)}
              ownerSex={profile.sex ?? null}
              label={g("أنشئي الخطة الآن", "أنشئ الخطة الآن")}
            />
          </div>
        </div>
      </section>
    );
  } else if (tablePlan) {
    todayBlock = (
      <Card aria-labelledby="today-title">
        <CardHeader
          id="today-title"
          title="سفرة اليوم"
          action={{ href: "/plan", label: "الأسبوع كاملاً" }}
        />
        <p className="flex items-center gap-2 text-base text-brand-ink-muted">
          <UtensilsCrossed className="size-5" aria-hidden="true" />
          وجبات اليوم لم تُجهَّز بعد.
        </p>
      </Card>
    );
  } else if (generating) {
    todayBlock = (
      <GenerationProgress
        daysReady={daysReady(latestPlan?.plan_data)}
        ownerSex={profile.sex ?? null}
        firstPlan={!cookable?.superseded}
      />
    );
  } else if (latestPlan?.status === "failed") {
    todayBlock = (
      <Card aria-labelledby="today-title">
        <CardHeader id="today-title" title="لم تكتمل خطتكم" />
        <p className="text-base leading-relaxed text-brand-ink-muted">
          حدث خطأ أثناء إعداد الخطة، ويمكن إعادة المحاولة الآن.
        </p>
        <div className="mt-3">
          <EmptyPlanCTA isOnboarded variant="failed" ownerSex={profile.sex} />
        </div>
      </Card>
    );
  } else {
    todayBlock = (
      <Card aria-labelledby="today-title">
        <CardHeader id="today-title" title="لا توجد خطة بعد" />
        <p className="text-base leading-relaxed text-brand-ink-muted">
          {g(
            "أنشئي خطتكِ الأولى لتظهر هنا وجبات اليوم.",
            "أنشئ خطتك الأولى لتظهر هنا وجبات اليوم.",
          )}
        </p>
        <div className="mt-3">
          <EmptyPlanCTA isOnboarded ownerSex={profile.sex} />
        </div>
      </Card>
    );
  }

  return (
    <main className="container-shell kt">
      {/* Marks made on /plan or another device reach an open dashboard on the
          next fetch — refresh when the tab wakes. */}
      <RefreshOnFocus />
      <Suspense fallback={null}>
        <CheckoutSuccessHandler />
      </Suspense>
      {onboardingDone && ((needsFamilyPlan && !pendingBlocked) || drainForAlignment) && (
        <DeferredMemberDrain generating={latestPlan?.in_progress ?? false} />
      )}

      <header>
        <p className="kt-date">{dateLine}</p>
        <h1 className="kt-h1">{greeting}</h1>
        {lead && <p className="kt-lead max-w-prose">{lead}</p>}
      </header>

      {notice && <div className="kt-notice">{notice}</div>}

      <div className="kt-grid">
        <div className="kt-main">
          {todayBlock}
          {workoutToday && !kitchenShown && (
            <WorkoutTodayCard today={workoutToday} ownerSex={profile.sex ?? null} />
          )}
        </div>
        <aside className="kt-aside">
          {seasonProps && stats && isFamily && <SeasonBoard props={seasonProps} stats={stats} />}
          {seasonProps && stats && !isFamily && stats.ranked[0] && (
            <SoloWeekCard me={stats.ranked[0]} ownerSex={profile.sex ?? null} />
          )}
          {renewalLedger && (
            <RenewalRecapCard
              ledger={renewalLedger}
              cadence={subscription?.cadence ?? null}
              ownerSex={profile.sex}
            />
          )}
          {onboardingDone && <MoreCard nextStep={nextStep} ownerSex={profile.sex ?? null} />}
        </aside>
      </div>
    </main>
  );
}
