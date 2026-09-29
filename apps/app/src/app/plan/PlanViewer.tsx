"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Loader2, Clock, UserPlus, History, ChefHat, AlertTriangle, Dumbbell, TrendingUp } from "lucide-react";
import type { MealPlan, MemberPlan, LocaleCode } from "@fitlife/plan-engine";
import { MealCard } from "./MealCard";
import { DayLine } from "./DayLine";
import {
  PlanBar,
  PlanBarEnd,
  PlanBarIdentity,
  PlanBarMore,
  PlanBarPill,
  PlanBarRail,
  PlanBarRow,
} from "./bar/PlanBar";
import { WeekStrip, type WeekStripDay } from "./bar/WeekStrip";
import { MemberSheet, type MemberSheetMember } from "./bar/MemberSheet";
import { MoreSheet } from "./bar/MoreSheet";
import { RecipesSheet, type RecipesSheetDish } from "./bar/RecipesSheet";
import { PLAN_MENU_ICON_CLASS, PLAN_MENU_ITEM_CLASS } from "./bar/menuItem";
import { SaraToast } from "./sara/SaraToast";
import { SaraChangesSheet } from "./sara/SaraChangesSheet";
import { useSaraUnread } from "./sara/useSaraUnread";
import { Avatar } from "@/components/ui/avatar";
import { Notice } from "@/components/ui/notice";
import { SaraAvatar } from "@/components/ui/SaraAvatar";
import {
  setMealAbsence as setMealAbsenceAction,
  setMealCheckin as setMealCheckinAction,
  setMealVerdict as setMealVerdictAction,
  setSharedMealCheckin as setSharedMealCheckinAction,
} from "@/lib/engagement/actions";
import {
  checkinClearKeys,
  checkinMapKey,
  ownCheckin,
  resolveCheckin,
} from "@/lib/engagement/checkinMap";
import {
  HOUSEHOLD_CHECKIN_MEMBER,
  OUT_OF_MEAL_CHECKIN_STATUSES,
} from "@/lib/engagement/types";
import { RegenerateButton } from "./RegenerateButton";
// @react-pdf is dynamically imported inside this button's click handler, so it
// doesn't enter the page bundle and never renders during the React tree render.
import { DownloadPDFButton } from "./pdf/DownloadPDFButton";
import { dayIndexFromWeekStart, formatWeekRange } from "@/lib/plans/dayMapping";
import {
  getPlanStrings,
  getLocaleInfo,
  isLocaleCode,
  LOCALE_INFO,
} from "@/lib/plans/locales";
import { orderDayMeals } from "@/lib/plans/mealOrder";
import { dayLineDate, mealStripDays } from "@/lib/plans/weekStrip";
import { householdDayDishes } from "@/lib/plans/householdDishes";
import { memberSheetStatus } from "@/lib/plans/memberSheetStatus";
import { genderPick } from "@/lib/copy/gender";
import { arNum } from "@/lib/copy/numbers";

// A day stuck "preparing" this long with no new write means the worker died —
// far longer than a healthy day stream (~1-2 min), far shorter than the 15-min
// server-side dead-man's switch.
const STALE_PREPARING_MS = 180_000;

// ─── Optimistic-state seeds ──────────────────────────────────────────────
// One implementation for the initial useState seed AND the props-resync below,
// so the optimistic maps can never drift from how server rows are read.

type CheckinRowProp = {
  day_index: number;
  slot: string;
  status: string;
  reason: string | null;
  member_id?: string | null;
};
type VerdictRowProp = {
  day_index: number;
  slot: string;
  member_id?: string | null;
  verdict: string;
};
type AbsenceRowProp = { day_index: number; slot: string; member_id: string };

function seedCheckinMap(checkins: CheckinRowProp[] | undefined) {
  return new Map(
    (checkins ?? [])
      .filter(
        (c): c is typeof c & { status: "cooked" | "swapped" | "skipped" } =>
          c.status === "cooked" || c.status === "swapped" || c.status === "skipped",
      )
      .map((c) => [
        checkinMapKey(c.day_index, c.slot, c.member_id ?? HOUSEHOLD_CHECKIN_MEMBER),
        { status: c.status, reason: c.reason },
      ]),
  );
}

function seedVerdictMap(verdicts: VerdictRowProp[] | undefined) {
  return new Map(
    (verdicts ?? [])
      .filter(
        (v): v is typeof v & { verdict: "loved" | "fine" | "not_again" } =>
          v.verdict === "loved" ||
          v.verdict === "fine" ||
          v.verdict === "not_again",
      )
      .map((v) => [`${v.day_index}|${v.slot}|${v.member_id ?? "mom"}`, v.verdict]),
  );
}

function seedAbsenceSet(absences: AbsenceRowProp[] | undefined) {
  return new Set(
    (absences ?? []).map((a) => `${a.day_index}|${a.slot}|${a.member_id}`),
  );
}

export function PlanViewer({
  plan,
  planId,
  generating = false,
  updatedAt,
  preselectedMember,
  readOnly = false,
  hideExport = false,
  housekeeperLocale,
  locale,
  showWorkoutOptIn = false,
  checkins,
  verdicts,
  absences,
  journeyMembers,
  planTypeToggle,
  notice,
  ownerSex,
  partialWeekMemberIds = [],
}: {
  plan: MealPlan;
  planId: string;
  generating?: boolean;
  // The week came back short — a household too big for one invocation's budget,
  // or a run that died. These are the members the mounted drain WILL refill
  // (short, under the attempt cap, drain mounted): their empty days say they
  // are on their way instead of offering a retry. Anyone else's empty day keeps
  // the failed box and its retry — nothing automatic will fill it. Interactive
  // Arabic view only.
  partialWeekMemberIds?: readonly string[];
  // Last write to the plan row. If a day stays "preparing" while this stops
  // advancing, the background worker died — surface the retry box instead of
  // spinning until the 15-min server-side dead-man's switch.
  updatedAt?: string;
  preselectedMember?: string;
  // Historical view (e.g. /plan/history/[id]): hide regenerate + add-member,
  // and don't rewrite the URL.
  readOnly?: boolean;
  // Hide the PDF export (the admin plan view: read-only, no customer export).
  hideExport?: boolean;
  // Set (to a non-Arabic locale) when the household has a housekeeper who reads
  // another language → the bar's «الوصفات» door opens HER translated view
  // (without one it opens the day's recipes in a sheet).
  housekeeperLocale?: string;
  // Housekeeper view: render translated content + localized chrome + dir/lang.
  locale?: LocaleCode;
  // No workout plan exists yet → offer the add-exercise-plan entry in the
  // ••• sheet (main /plan page only; read-only views never pass it).
  showWorkoutOptIn?: boolean;
  // Inline per-meal tracking (main /plan page only): current marks for this
  // plan. Presence of the prop enables the controls; read-only/translated
  // views never pass it. member_id: "mom" | family_members.id per person, or
  // "household"/null for legacy whole-house rows (pre-00019) — those act as a
  // fallback for every member of that meal. A SHARED meal shows ONE status
  // (owner directive 07/2026): read from any sharer's row (they're written in
  // one fan-out) with the whole-house row as the legacy fallback.
  checkins?: Array<{
    day_index: number;
    slot: string;
    status: string;
    reason: string | null;
    member_id?: string | null;
  }>;
  // Shared-meal absences (00021, main /plan page only): members excluded from
  // a meal occurrence — the card scales the batch for the remaining sharers.
  // Unlike marking, the toggle works on EVERY day of the plan week (planning,
  // not adherence). Absent prop = read-only surface, no absence controls.
  absences?: Array<{ day_index: number; slot: string; member_id: string }>;
  // Per-dish verdicts (main /plan page only, same scope as checkins). member_id
  // is whose verdict it is — verdicts are personal, so there is NO whole-house
  // fallback (unlike checkins). Feeds golden dishes / vetoes → «سارة عدّلت خطتك».
  verdicts?: Array<{
    day_index: number;
    slot: string;
    member_id?: string | null;
    verdict: string;
  }>;
  // «رحلتك الخاصة» entries (main /plan page only): the weigh-in journeys this
  // household may open — "mom" plus eligible adult family_members ids (name
  // null for the mom). The entry renders on the ACTIVE member's tab only;
  // read-only/translated views never pass it. `sex` genders the entry copy.
  journeyMembers?: Array<{ id: string; name: string | null; sex?: string | null }>;
  // The meal/workout plan-type switch, rendered by the server page and placed
  // full-width under the plan bar (and the notice), in the same slot the
  // workout viewer gives it. Null when no workout plan exists (nothing to
  // toggle) or on read-only/translated views.
  planTypeToggle?: ReactNode;
  // The page's ONE notice (or its onboarding banner), rendered right under the
  // plan bar — the bar is the top of the screen on phones, so anything the
  // page put above the viewer would sit above the header it replaced.
  notice?: ReactNode;
  // The account owner's sex (profiles.sex) → owner-directed Arabic copy on this
  // page (the «أنتِ/أنتَ» marker beside her name). Absent on translated views.
  ownerSex?: string | null;
}) {
  const router = useRouter();
  const translated = !!locale && locale !== "ar";
  const t = getPlanStrings(locale ?? "ar");
  const dir = translated ? getLocaleInfo(locale).direction : undefined;
  // Maid view: a day is shown only once ALL its recipes are translated to her
  // locale — otherwise we show a loading state, never the Arabic fallback.
  const isDayTranslated = (day?: MemberPlan["days"][number]) =>
    !!day &&
    day.meals.length > 0 &&
    day.meals.every((m) => m.prep_steps_translated_locale === locale);
  const [activeMemberId, setActiveMemberId] = useState<string>(
    preselectedMember && plan.members.some((m) => m.member_id === preselectedMember)
      ? preselectedMember
      : (plan.members[0]?.member_id ?? "mom"),
  );
  // The week is anchored to the generation day → default to today's slot.
  const [activeDayIndex, setActiveDayIndex] = useState<number>(() => {
    const i = dayIndexFromWeekStart(plan.week_start_date);
    return i >= 0 && i <= 6 ? i : 0;
  });

  // Inline per-meal tracking (see the checkins prop). Optimistic map keyed
  // day|slot|member — PER PERSON, so a shared meal carries a separate status
  // for each participant. Legacy whole-house rows (member_id null/"household")
  // sit under the "household" key and act as a fallback for every member of
  // that meal. The window is enforced server-side too — the client gate just
  // hides controls on future days so adherence can't be pre-marked.
  const [checkinMap, setCheckinMap] = useState(() => seedCheckinMap(checkins));
  // Per-dish verdicts, keyed day|slot|member. Personal by design → no
  // whole-house fallback (a verdict is never attested for someone else).
  const [verdictMap, setVerdictMap] = useState(() => seedVerdictMap(verdicts));
  // Shared-meal absences, keyed day|slot|member (00021). Optimistic like the
  // maps above. An absent member is out of THIS meal occurrence: the card
  // scales the batch for the rest, and the fan-out status write skips them.
  const [absenceSet, setAbsenceSet] = useState(() => seedAbsenceSet(absences));
  const [checkinError, setCheckinError] = useState<string | null>(null);

  // Marks in flight — while > 0 the optimistic maps are the truth and the
  // props-resync below must hold off (the server hasn't confirmed yet).
  const [pendingWrites, setPendingWrites] = useState(0);
  const endWrite = () => setPendingWrites((n) => Math.max(0, n - 1));

  /**
   * Run a write with a hard ceiling on how long it can hold the resync gate.
   *
   * `pendingWrites` blocks the re-seed below so an in-flight tap never flickers
   * back. That is right, but it made a HUNG action (one that neither resolves
   * nor rejects) permanent: the counter never returned to zero, so every later
   * server update was ignored and the plan view silently stopped reflecting
   * server truth — no error, no spinner, nothing to see. The ceiling releases
   * the gate; the pending promise's own .finally is idempotent via the clamp
   * above.
   */
  const WRITE_GATE_TIMEOUT_MS = 15_000;
  const beginWrite = (): (() => void) => {
    setPendingWrites((n) => n + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      endWrite();
    };
    setTimeout(release, WRITE_GATE_TIMEOUT_MS);
    return release;
  };

  // Re-seed the optimistic maps whenever the server sends fresh rows (an
  // action's own revalidation, the generation poll's router.refresh, a soft
  // navigation back) — otherwise the maps keep their first-mount seed forever
  // and silently drift from server truth. Render-phase adjust (the React
  // "adjusting state when props change" pattern — the set-state-in-effect rule
  // forbids the effect version), gated so in-flight optimistic taps never
  // flicker back.
  const [syncedCheckins, setSyncedCheckins] = useState(checkins);
  if (checkins !== syncedCheckins && pendingWrites === 0) {
    setSyncedCheckins(checkins);
    setCheckinMap(seedCheckinMap(checkins));
  }
  const [syncedVerdicts, setSyncedVerdicts] = useState(verdicts);
  if (verdicts !== syncedVerdicts && pendingWrites === 0) {
    setSyncedVerdicts(verdicts);
    setVerdictMap(seedVerdictMap(verdicts));
  }
  const [syncedAbsences, setSyncedAbsences] = useState(absences);
  if (absences !== syncedAbsences && pendingWrites === 0) {
    setSyncedAbsences(absences);
    setAbsenceSet(seedAbsenceSet(absences));
  }
  const checkinTodayIdx = dayIndexFromWeekStart(plan.week_start_date);
  // Every meal stays changeable for the WHOLE plan week (owner directive
  // 07/2026): any day that has already arrived (index ≤ today) is markable —
  // the mom can complete or correct earlier days anytime before the week rolls
  // over into history. Future days (index > today) stay locked so adherence is
  // never pre-marked. The server enforces the same rule.
  const canCheckinActiveDay =
    checkins !== undefined &&
    !readOnly &&
    !translated &&
    activeDayIndex <= checkinTodayIdx;
  // Absence is planning, not adherence — the toggle works on every day of the
  // plan week, future included («تسافر الخميس» is adjusted before Thursday).
  const canToggleAbsence = absences !== undefined && !readOnly && !translated;

  /** A member's effective mark: their own row, else the whole-house fallback. */
  function checkinFor(dayIndex: number, slot: string, memberId: string) {
    return resolveCheckin(checkinMap, dayIndex, slot, [memberId]);
  }

  /** A SHARED meal's single status: any PRESENT sharer's row (the fan-out keeps
   * them in agreement; legacy per-person rows surface the same way), else the
   * whole-house fallback. Callers pass the present sharers ONLY — a member
   * excluded from the occurrence keeps a personal mark about a meal they did
   * not share («بدّلتها»/«تجاوزتها»), and that must never become the dish's
   * status for everyone else. */
  function sharedCheckinFor(
    dayIndex: number,
    slot: string,
    sharerIds: string[],
  ) {
    return resolveCheckin(checkinMap, dayIndex, slot, sharerIds);
  }

  /** The mark of a member who is OUT of a shared occurrence: their own row and
   * nothing else. The whole-house fallback attests to the dish they were
   * excluded from, so it must not answer for them (owner directive 07/2026 —
   * an out-of-meal member records بديل/تجاوز for themselves, never «طُبخت»).
   * A «طبختها كما هي» row can only be a leftover from before they were excluded
   * (setMealAbsence clears it best-effort), never an answer they gave, so it
   * doesn't show as theirs either — tapping a chip overwrites it. */
  function outOfMealCheckinFor(dayIndex: number, slot: string, memberId: string) {
    const mark = ownCheckin(checkinMap, dayIndex, slot, memberId);
    return mark && OUT_OF_MEAL_CHECKIN_STATUSES.includes(mark.status)
      ? mark
      : null;
  }

  /** A member's own verdict for a dish (no fallback — verdicts are personal). */
  function verdictFor(dayIndex: number, slot: string, memberId: string) {
    return verdictMap.get(`${dayIndex}|${slot}|${memberId}`) ?? null;
  }

  function handleVerdict(
    memberId: string,
    slot: (typeof plan.members)[number]["days"][number]["meals"][number]["slot"],
    recipeNameAr: string,
    verdict: "loved" | "fine" | "not_again" | null,
  ) {
    const key = `${activeDayIndex}|${slot}|${memberId}`;
    const prev = verdictMap.get(key) ?? null;
    const next = new Map(verdictMap);
    if (verdict === null) next.delete(key);
    else next.set(key, verdict);
    setVerdictMap(next);
    setCheckinError(null);
    const release = beginWrite();
    void setMealVerdictAction({
      meal_plan_id: planId,
      day_index: activeDayIndex,
      slot,
      member_id: memberId,
      recipe_name_ar: recipeNameAr,
      verdict,
    })
      .then((result) => {
        if (!result.ok) {
          setVerdictMap((cur) => {
            const reverted = new Map(cur);
            if (prev) reverted.set(key, prev);
            else reverted.delete(key);
            return reverted;
          });
          setCheckinError(result.error);
        }
      })
      .catch(() => {
        /* transport failure — the next props-resync restores server truth */
      })
      .finally(release);
  }

  /** One member's own mark: an individual meal, or a member who is OUT of a
   * shared occurrence (`outOfMeal` — their mark is personal, so clearing it
   * leaves the whole-house attestation alone; the server derives the same scope
   * from meal_absences). */
  function handleCheckin(
    memberId: string,
    slot: (typeof plan.members)[number]["days"][number]["meals"][number]["slot"],
    status: "cooked" | "swapped" | "skipped" | null,
    reason: string | null,
    outOfMeal = false,
  ) {
    const key = checkinMapKey(activeDayIndex, slot, memberId);
    const prevEntries = new Map(
      checkinClearKeys(activeDayIndex, slot, [memberId], {
        sweepHousehold: !outOfMeal,
      }).map((k) => [k, checkinMap.get(k) ?? null]),
    );
    const next = new Map(checkinMap);
    if (status === null) {
      // Mirror the server: clearing removes the member's own mark AND the
      // whole-house fallback — leaving the fallback would re-light the chip
      // the user just un-tapped, with whatever the kitchen last attested.
      for (const k of prevEntries.keys()) next.delete(k);
    } else {
      // Setting never touches the whole-house row — it stays as the fallback
      // for the other members of this meal.
      next.set(key, { status, reason });
    }
    setCheckinMap(next);
    setCheckinError(null);
    const release = beginWrite();
    void setMealCheckinAction({
      meal_plan_id: planId,
      day_index: activeDayIndex,
      slot,
      member_id: memberId,
      status,
      reason: reason as never,
    })
      .then((result) => {
        if (!result.ok) {
          setCheckinMap((cur) => {
            const reverted = new Map(cur);
            for (const [k, v] of prevEntries) {
              if (v) reverted.set(k, v);
              else reverted.delete(k);
            }
            return reverted;
          });
          setCheckinError(result.error);
        }
      })
      .catch(() => {
        /* transport failure — the next props-resync restores server truth */
      })
      .finally(release);
  }

  /** ONE tap = one status for the whole shared dish: optimistic fan-out to
   * every present sharer, mirrored server-side by setSharedMealCheckin. One
   * tap un-answers it the same way — the sharers' own marks AND the
   * whole-house fallback go, so the dish reads as unmarked instead of falling
   * back to an older status (same as the individual clear). */
  function handleSharedCheckin(
    memberIds: string[],
    slot: (typeof plan.members)[number]["days"][number]["meals"][number]["slot"],
    status: "cooked" | "swapped" | "skipped" | null,
    reason: string | null,
  ) {
    const keys = memberIds.map((id) => checkinMapKey(activeDayIndex, slot, id));
    const prevEntries = new Map(
      checkinClearKeys(activeDayIndex, slot, memberIds).map((k) => [
        k,
        checkinMap.get(k) ?? null,
      ]),
    );
    const next = new Map(checkinMap);
    if (status === null) {
      for (const k of prevEntries.keys()) next.delete(k);
    } else {
      for (const k of keys) next.set(k, { status, reason });
    }
    setCheckinMap(next);
    setCheckinError(null);
    const release = beginWrite();
    void setSharedMealCheckinAction({
      meal_plan_id: planId,
      day_index: activeDayIndex,
      slot,
      member_ids: memberIds,
      status,
      reason: reason as never,
    })
      .then((result) => {
        if (!result.ok) {
          setCheckinMap((cur) => {
            const reverted = new Map(cur);
            for (const [k, v] of prevEntries) {
              if (v) reverted.set(k, v);
              else reverted.delete(k);
            }
            return reverted;
          });
          setCheckinError(result.error);
        }
      })
      .catch(() => {
        /* transport failure — the next props-resync restores server truth */
      })
      .finally(release);
  }

  /** Exclude/restore a sharer for one meal occurrence («إزالة من الوجبة»).
   * EITHER direction resets that member's own status mark for the meal, because
   * the mark means something different on each side of the line: outside the
   * meal it is personal («بدّلتها»/«تجاوزتها» — the dish never reached them),
   * while a present sharer's row speaks for the whole dish. So leaving it
   * behind would either attest to a serving they never had, or re-brand the
   * shared dish with the record of a meal they sat out. The server does the
   * same. Restoring then re-attaches them to the dish's single status: when the
   * other present sharers already carry a mark, it fans out to the restored
   * member too, so «تسجيل واحد يشمل كل من شاركها» stays literally true.
   * Works on any day of the plan week: absence is planning. */
  function handleToggleAbsence(
    memberId: string,
    slot: (typeof plan.members)[number]["days"][number]["meals"][number]["slot"],
    absent: boolean,
    sharerIds: string[],
  ) {
    const key = checkinMapKey(activeDayIndex, slot, memberId);
    const prevAbsent = absenceSet.has(key);
    const prevCheckin = checkinMap.get(key) ?? null;
    // The dish's current mark among the OTHER present sharers — the status a
    // restored member rejoins. Read before any optimistic mutation.
    const donorState = absent
      ? null
      : (sharerIds
          .filter(
            (id) =>
              id !== memberId &&
              !absenceSet.has(checkinMapKey(activeDayIndex, slot, id)),
          )
          .map((id) => checkinMap.get(checkinMapKey(activeDayIndex, slot, id)))
          .find(Boolean) ?? null);
    setAbsenceSet((cur) => {
      const next = new Set(cur);
      if (absent) next.add(key);
      else next.delete(key);
      return next;
    });
    if (prevCheckin) {
      setCheckinMap((cur) => {
        const next = new Map(cur);
        next.delete(key);
        return next;
      });
    }
    if (!absent && donorState) {
      setCheckinMap((cur) => new Map(cur).set(key, donorState));
    }
    setCheckinError(null);
    const release = beginWrite();
    void setMealAbsenceAction({
      meal_plan_id: planId,
      day_index: activeDayIndex,
      slot,
      member_id: memberId,
      absent,
    })
      .then((result) => {
        if (!result.ok) {
          setAbsenceSet((cur) => {
            const reverted = new Set(cur);
            if (prevAbsent) reverted.add(key);
            else reverted.delete(key);
            return reverted;
          });
          // One revert for both directions: the member's mark goes back to
          // whatever it was before the toggle (a donor mirror never ran).
          setCheckinMap((cur) => {
            const reverted = new Map(cur);
            if (prevCheckin) reverted.set(key, prevCheckin);
            else reverted.delete(key);
            return reverted;
          });
          setCheckinError(result.error);
          return;
        }
        // SEQUENCED after the absence delete on purpose: the fan-out write is
        // filtered against meal_absences server-side, so it must run once the
        // absence row is gone. Donor exists ⇒ the day is elapsed (marks only
        // land on elapsed days), so the week gate can't reject this. Returned
        // so the pending-writes counter stays held until the mirror settles.
        if (!absent && donorState) {
          return setSharedMealCheckinAction({
            meal_plan_id: planId,
            day_index: activeDayIndex,
            slot,
            member_ids: [memberId],
            status: donorState.status,
            reason: donorState.reason as never,
          }).then((mirror) => {
            if (!mirror.ok) {
              setCheckinMap((cur) => {
                const reverted = new Map(cur);
                reverted.delete(key);
                return reverted;
              });
            }
          });
        }
      })
      .catch(() => {
        /* transport failure — the next props-resync restores server truth */
      })
      .finally(release);
  }

  // The ?member= param only seeds the initial tab; strip it after mount so a
  // later refresh doesn't override the user's subsequent tab clicks.
  useEffect(() => {
    if (readOnly) return;
    if (typeof window !== "undefined" && window.location.search.includes("member=")) {
      window.history.replaceState(null, "", "/plan");
    }
  }, [readOnly]);

  // While later days are still being prepared, poll for them. A day landing
  // rewrites the plan row (bumping updated_at), so poll the lightweight status
  // endpoint and only pull the heavy server tree (router.refresh) when the row
  // has actually moved past this render's snapshot — a blind 4s refresh
  // re-rendered and re-downloaded the whole page dozens of times per
  // generation. After a refresh the new updatedAt prop re-arms the comparison.
  useEffect(() => {
    if (!generating) return;
    // Belt-and-suspenders: even if the `generating` flag were stranded true,
    // stop polling once every member's every day actually has meals — the plan
    // is complete, so there is nothing left to pull in.
    const allContentComplete = plan.members.every(
      (m) => m.days.length > 0 && m.days.every((d) => d.meals.length > 0),
    );
    if (allContentComplete) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch("/api/plans/status", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { updated_at?: string };
        if (body.updated_at !== updatedAt) router.refresh();
      } catch {
        // transient — keep polling
      }
    }, 4000);
    return () => clearInterval(t);
  }, [generating, plan.members, router, updatedAt]);

  // Ticking clock so `preparingStalled` re-evaluates without a server round-trip:
  // if the worker died, updatedAt stops advancing and no refresh changes props.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [generating]);

  // Cycle honest per-day process lines (~3s) while generating so the loader reads
  // as active. A day is one atomic AI call, so these describe the real work —
  // not fake per-meal completion. Text-only change (no motion).
  const [stepTick, setStepTick] = useState(0);
  useEffect(() => {
    if (!generating) return;
    const id = setInterval(() => setStepTick((s) => s + 1), 3000);
    return () => clearInterval(id);
  }, [generating]);
  // The plan row hasn't been written in a while but is still flagged generating
  // → treat the active "preparing" day as failed so the retry box appears,
  // instead of spinning until the server-side dead-man's switch (15 min).
  const preparingStalled =
    generating &&
    !!updatedAt &&
    now - Date.parse(updatedAt) > STALE_PREPARING_MS;

  const activeMember: MemberPlan | undefined = useMemo(
    () => plan.members.find((m) => m.member_id === activeMemberId) ?? plan.members[0],
    [plan.members, activeMemberId],
  );

  const activeDay = useMemo(() => {
    if (!activeMember) return undefined;
    return activeMember.days.find((d) => d.day_index === activeDayIndex);
  }, [activeMember, activeDayIndex]);

  // Canonical daily order (breakfast → morning snack → lunch → evening snack →
  // dinner). Passing every member's meals for this day keeps a SHARED meal in the
  // same position for everyone who shares it.
  const orderedMeals = useMemo(() => {
    if (!activeDay) return [];
    const familyDay = plan.members.map(
      (m) => m.days.find((d) => d.day_index === activeDayIndex)?.meals ?? [],
    );
    return orderDayMeals(activeDay.meals, familyDay);
  }, [activeDay, plan.members, activeDayIndex]);

  // Does the active member have any SHARED meal across the week? Drives the
  // regenerate-scope dialog (skipped when they have none — nothing to scope).
  const activeMemberHasShared = useMemo(
    () =>
      !!activeMember?.days.some((d) =>
        d.meals.some((m) => m.shared_recipe === true),
      ),
    [activeMember],
  );

  const memberLabel = (m: MemberPlan) =>
    translated ? (m.member_name_translated ?? m.member_name_ar) : m.member_name_ar;

  const memberNames = useMemo(
    () =>
      Object.fromEntries(
        plan.members.map((m) => [m.member_id, memberLabel(m)]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan.members, translated],
  );

  const isSolo = plan.members.length === 1;

  // Generation is one-at-a-time: a run fills a SINGLE member (plan.generating_member_id).
  // Scope all loading UI to that member so a different member's empty/failed day
  // never shows a spinner — it falls through to the "failed — regenerate" box.
  // No id stamped (initial plan / older data) → fall back to the global flag.
  const memberIsGenerating =
    generating &&
    (plan.generating_member_id == null ||
      activeMember?.member_id === plan.generating_member_id);

  // Maid (translated) view: translation runs strictly one member at a time, in
  // plan.members order (mom first). Infer the member being translated NOW = the
  // first member, in order, still missing a translation on a mealed day. Members
  // before it are done; members after it are queued. So the maid sees mom resolve
  // fully, then member 2, then member 3 — and a queued member shows a calm
  // "waiting" state instead of a spinner that reads as random/simultaneous.
  const dayNeedsTranslation = (day?: MemberPlan["days"][number]) =>
    !!day && day.meals.length > 0 && !isDayTranslated(day);
  const isMemberTranslated = (m: MemberPlan) =>
    m.days.every((d) => d.meals.length === 0 || isDayTranslated(d));
  const currentTranslatingIndex = translated
    ? plan.members.findIndex((m) => !isMemberTranslated(m))
    : -1;
  const memberTranslationStatus = (
    m: MemberPlan,
  ): "done" | "translating" | "queued" => {
    if (!translated || currentTranslatingIndex === -1) return "done";
    const idx = plan.members.findIndex((x) => x.member_id === m.member_id);
    if (idx < currentTranslatingIndex) return "done";
    if (idx === currentTranslatingIndex) return "translating";
    return "queued";
  };
  const activeMemberTranslation = activeMember
    ? memberTranslationStatus(activeMember)
    : "done";

  // Day generation runs today-first, one at a time (mirrors the engine). Compute
  // the same order so the UI shows ONE day "preparing" while the rest wait —
  // instead of every tab spinning at once (which reads as random).
  const currentPreparingIndex = useMemo(() => {
    if (!memberIsGenerating || !activeMember) return -1;
    const start = dayIndexFromWeekStart(plan.week_start_date);
    const today = start >= 0 && start <= 6 ? start : 0;
    const order = Array.from({ length: 7 }, (_, k) => (today + k) % 7);
    for (const di of order) {
      const day = activeMember.days.find((d) => d.day_index === di);
      if (!day || day.meals.length === 0) return di;
    }
    return -1;
  }, [memberIsGenerating, activeMember, plan.week_start_date]);

  // Real generation progress for the active member: days with meals vs total
  // expected. Days are generated atomically (a whole day lands at once), so
  // day-granularity is the truthful unit — drives the bar's progress rail so
  // the wait reads as active, not stalled.
  const genProgress = useMemo(() => {
    const total = plan.days_total ?? activeMember?.days.length ?? 7;
    const ready = activeMember
      ? activeMember.days.filter((d) => d.meals.length > 0).length
      : 0;
    return { ready, total };
  }, [activeMember, plan.days_total]);

  // ─── The plan bar (concept «شريط الأسبوع», 09/2026) ─────────────────────
  // One sheet at a time: opening one replaces whichever was open, and the
  // Sara toast waits while any is up.
  const [openSheet, setOpenSheet] = useState<
    "member" | "more" | "recipes" | "sara" | null
  >(null);
  // Spoken after a member switch when focus did NOT land back on the renamed
  // identity trigger (see selectMember) — otherwise nothing says the plan
  // below changed.
  const [announcement, setAnnouncement] = useState("");
  // The bar's sheet triggers, handed to each sheet as its focus-return target
  // (a tapped button is never focused on Safari, so "whatever was focused"
  // would be <body> there).
  const identityRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const recipesRef = useRef<HTMLButtonElement>(null);
  // The failed day's own «إنشاء خطة جديدة» opens a ConfirmDialog that is not
  // one of the sheets, so it reports itself: the Sara toast must wait it out
  // too, or its once-a-week note times out (and is marked seen) behind the
  // dialog's scrim.
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const dayLineRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  // The strip's seven dated cells, rebuilt only when the WEEK changes: a poll's
  // refresh within the week (drain, chain, a member's regeneration — each a
  // new plan row) keeps the same cells under her finger.
  const stripBase = useMemo(
    () => mealStripDays(plan.week_start_date, locale ?? "ar"),
    [plan.week_start_date, locale],
  );
  // «سارة عدّلت خطتكِ» is the owner's own فصحى narrative: the interactive
  // Arabic view only — never history, the cook's view, or admin.
  const saraChanges =
    !readOnly && !translated && plan.week_changes && plan.week_changes.length > 0
      ? plan.week_changes
      : null;
  const { unread: saraUnread, markOpened: markSaraOpened } = useSaraUnread(
    plan.week_start_date,
    saraChanges,
  );

  if (!activeMember) {
    return (
      <div className="text-center py-12">
        <p className="text-brand-ink-muted">{t.empty_plan}</p>
      </div>
    );
  }

  const g = genderPick(ownerSex);
  // The owner's own page. History, the cook's view and the admin view are
  // read-only variants of the same bar: identity + strip, and at most the PDF.
  const interactive = !readOnly && !translated;
  const activeName = memberLabel(activeMember);
  // Roster position = the avatar colour everywhere in the app.
  const activeRosterIndex = Math.max(
    0,
    plan.members.findIndex((m) => m.member_id === activeMember.member_id),
  );
  const weekRange = formatWeekRange(plan.week_start_date, locale);
  // Joins the name and «switch person» in the cook's aria-label.
  const listSep = locale === "ur" ? "، " : ", ";

  // The private «الوزن والمتابعة» journey link for the ACTIVE member (eligible
  // members, interactive Arabic view only) — a row of the ••• sheet, under the
  // name of the person it belongs to.
  const journeyEntry =
    journeyMembers?.find((j) => j.id === activeMemberId) ?? null;
  const showJourney = !!journeyEntry && !readOnly && !translated;

  // The «المزيد» menu only earns its slot when it has something to hold: a
  // read-only history view with the export hidden has no secondaries at all.
  const hasMenuActions =
    !readOnly || (!translated && !hideExport);

  // With a cook who reads another language, «الوصفات» opens HER view — the
  // translated one she cooks from; without one, the day's dishes in a sheet.
  const cookLanguage =
    housekeeperLocale && isLocaleCode(housekeeperLocale)
      ? LOCALE_INFO[housekeeperLocale].ar_name
      : null;
  // «بالفلبينية»: every ar_name carries its «ال», so «ب» is the whole join.
  const inCookLanguage = cookLanguage ? `ب${cookLanguage}` : null;

  const hasAnyMeals = plan.members.some((m) =>
    m.days.some((d) => d.meals.length > 0),
  );

  // Per-cell state for the active member: the day being prepared (or, on the
  // cook's view, translated) spins; a day with no meals is dashed.
  const stripDays: WeekStripDay[] = stripBase.map((d) => {
    const day = activeMember.days.find((x) => x.day_index === d.index);
    const pending =
      (memberIsGenerating && d.index === currentPreparingIndex) ||
      (translated &&
        activeMemberTranslation === "translating" &&
        dayNeedsTranslation(day));
    return {
      ...d,
      state: pending ? "pending" : day && day.meals.length > 0 ? "ready" : "empty",
    };
  });
  const activeStripDay =
    stripBase.find((d) => d.index === activeDayIndex) ?? stripBase[0];
  const { date: activeDate, relative: activeRelative } = activeStripDay
    ? dayLineDate(activeStripDay)
    : { date: "", relative: null };

  function selectDay(index: number) {
    setActiveDayIndex(index);
    // Picking a day from the pinned strip while deep in a long day of recipes:
    // start the new day at its top instead of mid-way down. Instant, not
    // smooth (restrained motion); the html scroll-padding clears the bar.
    const line = dayLineRef.current;
    const bar = document.querySelector("[data-plan-bar]");
    if (
      line &&
      bar &&
      line.getBoundingClientRect().top < bar.getBoundingClientRect().bottom
    ) {
      line.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }

  function selectMember(id: string) {
    const next = plan.members.find((m) => m.member_id === id);
    // The open day stays: switching person answers «what does he eat today».
    setActiveMemberId(id);
    setOpenSheet(null);
    if (next) {
      const name = memberLabel(next);
      const text = translated
        ? t.showing_member.replace("{name}", name)
        : `${g("تعرضين", "تعرض")} خطة ${name}`;
      // The closing sheet hands focus back to the identity trigger, whose label
      // already names the new person — a live message on top would say it
      // twice. Checked after that hand-back (a frame later); where focus did
      // not land there, the region is the only thing that speaks.
      requestAnimationFrame(() => {
        if (document.activeElement !== identityRef.current) setAnnouncement(text);
      });
    }
  }

  function openSaraSheet() {
    markSaraOpened();
    setOpenSheet("sara");
  }

  // «أفراد البيت»: one status line per person, most urgent true thing first
  // (memberSheetStatus pins the priority).
  const memberRows: MemberSheetMember[] = plan.members.map((m, i) => {
    const kind = memberSheetStatus({
      memberId: m.member_id,
      translation: memberTranslationStatus(m),
      generating: generating && !preparingStalled,
      generatingMemberId: plan.generating_member_id,
      weekComplete:
        m.days.filter((d) => d.meals.length > 0).length >= (plan.days_total ?? 7),
      dayHasMeals: !!m.days.find((d) => d.day_index === activeDayIndex)?.meals
        .length,
      isChild: !translated && !!m.is_child,
    });
    const target = m.daily_calories_target;
    const status: MemberSheetMember["status"] =
      kind === "translating"
        ? { text: t.member_translating, icon: "spinner" }
        : kind === "queued"
          ? { text: t.member_queued, icon: "clock" }
          : kind === "generating"
            ? { text: t.day_pending, icon: "spinner" }
            : kind === "day_empty"
              ? {
                  text: activeStripDay?.weekdayFull
                    ? `${activeStripDay.weekdayFull} · ${t.day_empty}`
                    : t.day_empty,
                }
              : kind === "portions"
                ? { text: "بالحصص حسب العمر" }
                : {
                    text: translated
                      ? `${t.daily_calories}: ${target} ${t.calories_unit}`
                      : `${arNum(target)} سعرة يومياً`,
                  };
    return {
      id: m.member_id,
      name: memberLabel(m),
      prefix:
        !translated && m.member_id === "mom" ? `${g("أنتِ", "أنتَ")} ·` : undefined,
      rosterIndex: i,
      status,
    };
  });

  // «الوصفات» (no cook): every dish of the open day for the whole house, a
  // shared pot once. «حصتك» marks the owner's portion — she is the reader.
  const recipeDishes: RecipesSheetDish[] =
    interactive && !housekeeperLocale
      ? householdDayDishes(plan.members, activeDayIndex).map(
          ({ meal, memberId, sharerIds }) => ({
            meal,
            forName: isSolo || sharerIds ? null : (memberNames[memberId] ?? null),
            currentMemberId: sharerIds?.includes("mom") ? "mom" : undefined,
            absentMemberIds: sharerIds
              ? sharerIds.filter((id) =>
                  absenceSet.has(`${activeDayIndex}|${meal.slot}|${id}`),
                )
              : undefined,
          }),
        )
      : [];

  // The ••• sheet: first what concerns the person on screen, then the week.
  const personItems: ReactNode[] = [];
  if (showJourney && journeyEntry) {
    personItems.push(
      <Link
        key="journey"
        href={
          journeyEntry.id === "mom"
            ? "/journey"
            : `/journey?member=${journeyEntry.id}`
        }
        className={PLAN_MENU_ITEM_CLASS}
      >
        <TrendingUp className={PLAN_MENU_ICON_CLASS} aria-hidden="true" />
        الوزن والمتابعة
      </Link>,
    );
  }
  if (!translated && !hideExport) {
    personItems.push(
      <DownloadPDFButton
        key="pdf"
        memberPlan={activeMember}
        planMetadata={{ week_start_date: plan.week_start_date }}
        memberNames={memberNames}
        absentKeys={absenceSet}
      />,
    );
  }
  const weekItems: ReactNode[] = [];
  if (saraChanges) {
    weekItems.push(
      <button
        key="sara"
        type="button"
        onClick={openSaraSheet}
        aria-haspopup="dialog"
        className={PLAN_MENU_ITEM_CLASS}
      >
        <SaraAvatar size={24} />
        <span className="min-w-0 flex-1">ما عدّلته سارة هذا الأسبوع</span>
        {saraUnread && (
          <span className="shrink-0 rounded-full bg-brand-purple-900 px-2 py-0.5 text-meta font-bold text-white">
            جديد
          </span>
        )}
      </button>,
    );
  }
  if (!readOnly) {
    weekItems.push(
      <Link key="history" href="/plan/history" className={PLAN_MENU_ITEM_CLASS}>
        <History className={PLAN_MENU_ICON_CLASS} aria-hidden="true" />
        الخطط السابقة
      </Link>,
    );
  }
  if (!readOnly && !translated && showWorkoutOptIn) {
    weekItems.push(
      <Link key="workout" href="/onboarding/workout" className={PLAN_MENU_ITEM_CLASS}>
        <Dumbbell className={PLAN_MENU_ICON_CLASS} aria-hidden="true" />
        {g("أضيفي خطة التمارين", "أضِف خطة التمارين")}
      </Link>,
    );
  }
  // A family adds people from the member sheet; a solo plan has none.
  if (!readOnly && isSolo) {
    weekItems.push(
      <Link key="add" href="/family" className={PLAN_MENU_ITEM_CLASS}>
        <UserPlus className={PLAN_MENU_ICON_CLASS} aria-hidden="true" />
        إضافة فرد
      </Link>,
    );
  }

  return (
    <div dir={dir} lang={translated ? locale : undefined}>
      <PlanBar>
        {/* The page's <h1>. On phones the bar IS the top of the screen — it
            replaced the app header — so the heading lives in it; visually the
            name and the dated strip already say what the page is. /plan,
            /plan/housekeeper and /plan/history/[planId] all get it from here. */}
        <h1 className="sr-only">
          {translated ? `${t.this_week} ${weekRange}` : `خطة الوجبات، ${weekRange}`}
        </h1>
        <PlanBarRow>
          <PlanBarIdentity
            avatar={
              <Avatar
                name={activeName}
                rosterIndex={activeRosterIndex}
                size="lg"
                className="ring-2 ring-brand-lavender"
              />
            }
            name={activeName}
            suffix={
              !translated && activeMember.member_id === "mom"
                ? g("أنتِ", "أنتَ")
                : undefined
            }
            ref={identityRef}
            onOpen={isSolo ? undefined : () => setOpenSheet("member")}
            expanded={openSheet === "member"}
            openLabel={
              translated
                ? `${activeName}${listSep}${t.switch_member}`
                : `خطة ${activeName}، تبديل الفرد`
            }
          />
          {(interactive || hasMenuActions) && (
            <PlanBarEnd>
              {interactive &&
                (housekeeperLocale ? (
                  <PlanBarPill
                    href="/plan/housekeeper"
                    icon={<ChefHat className="size-[18px]" aria-hidden="true" />}
                    ariaLabel={inCookLanguage ? `الوصفات ${inCookLanguage}` : undefined}
                  >
                    الوصفات
                  </PlanBarPill>
                ) : (
                  <PlanBarPill
                    ref={recipesRef}
                    onClick={() => setOpenSheet("recipes")}
                    expanded={openSheet === "recipes"}
                    icon={<ChefHat className="size-[18px]" aria-hidden="true" />}
                  >
                    الوصفات
                  </PlanBarPill>
                ))}
              {hasMenuActions && (
                <PlanBarMore
                  ref={moreRef}
                  onClick={() => setOpenSheet("more")}
                  expanded={openSheet === "more"}
                  unread={saraUnread}
                />
              )}
            </PlanBarEnd>
          )}
        </PlanBarRow>
        <WeekStrip
          days={stripDays}
          selected={activeDayIndex}
          onSelect={selectDay}
          todayLabel={translated ? undefined : "اليوم"}
          label={t.week_days}
          stateLabels={{ empty: t.day_empty, pending: t.day_pending }}
          panelId={panelId}
        />
        {/* Generation progress — real "N of M days" while the week streams in,
            as a rail over the bar's hairline rather than a card that pushed
            the meals down. Gone once the viewed member is complete. */}
        {memberIsGenerating &&
          !preparingStalled &&
          genProgress.ready < genProgress.total && (
            <PlanBarRail
              ready={genProgress.ready}
              total={genProgress.total}
              label={
                translated
                  ? `${t.preparing_title}: ${genProgress.ready}/${genProgress.total}`
                  : `${arNum(genProgress.ready)} من ${arNum(genProgress.total)} أيام جاهزة`
              }
            />
          )}
      </PlanBar>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {notice && <div className="mt-3">{notice}</div>}
      {planTypeToggle && <div className="mt-3">{planTypeToggle}</div>}

      {/* The strip's panel: the open day's numbers and its meals. */}
      <div
        id={panelId}
        role="tabpanel"
        aria-label={activeDate || undefined}
        className="mt-4"
      >
        <div ref={dayLineRef}>
          <DayLine
            date={activeDate}
            relative={activeRelative}
            total={activeDay && activeDay.meals.length > 0 ? activeDay.day_total : null}
            target={activeMember.daily_calories_target}
            // Children are planned by PORTIONS (healthy-plate servings), not a
            // calorie target, so a day's total naturally varies. Arabic view
            // only — the cook's view shows the numbers as they are.
            child={
              !translated && activeMember.is_child
                ? {
                    note: `خطة ${activeMember.member_name_ar} محسوبة بالحصص المناسبة للعمر، لا بهدف سعرات ثابت، فيختلف إجمالي كل يوم حسب أطباقه.`,
                  }
                : null
            }
            strings={t}
            arabic={!translated}
          />
        </div>

        {/* Meal list — a short cross-fade between days and people; none at
            all under reduced motion. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${activeMemberId}-${activeDayIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            className="mt-3 space-y-3"
          >
            {translated && activeMemberTranslation === "queued" ? (
              // This member's turn hasn't come yet — translation runs one member at
              // a time, in order. Show a calm waiting state, not a spinner (which
              // read as "loading randomly").
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Clock className="size-6 text-brand-purple-900 opacity-60" aria-hidden="true" />
                <p className="text-brand-ink-muted text-sm">{t.translation_queued}</p>
              </div>
            ) : translated && activeMemberTranslation === "translating" && dayNeedsTranslation(activeDay) ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Loader2
                  className="size-6 animate-spin motion-reduce:animate-none text-brand-purple-900"
                  aria-hidden="true"
                />
                <p className="text-brand-ink-muted text-sm">{t.translating}</p>
              </div>
            ) : activeDay && activeDay.meals.length > 0 ? (
              <>
                {checkinError && (
                  <p role="alert" className="text-sm font-bold text-red-700">
                    {checkinError}
                  </p>
                )}
                {orderedMeals.map((meal, i) => {
                  // A shared dish: one status for everyone who shares it, and an
                  // absence toggle per sharer (the batch re-scales for the rest).
                  const sharerIds =
                    meal.shared_recipe && meal.per_member_portions?.length
                      ? meal.per_member_portions.map((p) => p.member_id)
                      : null;
                  const absentIds = sharerIds
                    ? sharerIds.filter((id) =>
                        absenceSet.has(`${activeDayIndex}|${meal.slot}|${id}`),
                      )
                    : [];
                  const presentIds = sharerIds
                    ? sharerIds.filter((id) => !absentIds.includes(id))
                    : null;
                  // The open tab belongs to a sharer who is OUT of this
                  // occurrence (owner directive 07/2026): their controls become
                  // PERSONAL — their own row, read without the whole-house
                  // fallback, and MealCard drops «طبختها كما هي» from the chips.
                  // The everyone-absent edge (data only — the UI refuses to
                  // remove the last sharer) keeps the shared path.
                  const viewerOutOfMeal =
                    !!presentIds &&
                    presentIds.length > 0 &&
                    absentIds.includes(activeMember.member_id);
                  // The dish's own roster: the present sharers. Absentees are
                  // excluded from BOTH sides — their row is a personal record, so
                  // it neither lights the shared chip nor gets swept when the
                  // dish is un-marked. (Everyone-absent is a data-only edge: the
                  // status still needs someone to land on, so it keeps the full
                  // roster.)
                  const dishIds =
                    presentIds && presentIds.length > 0 ? presentIds : sharerIds;
                  return (
                    <MealCard
                      key={i}
                      meal={meal}
                      memberNames={memberNames}
                      locale={locale}
                      currentMemberId={activeMember.member_id}
                      checkin={
                        viewerOutOfMeal
                          ? outOfMealCheckinFor(
                              activeDayIndex,
                              meal.slot,
                              activeMember.member_id,
                            )
                          : dishIds
                            ? sharedCheckinFor(activeDayIndex, meal.slot, dishIds)
                            : checkinFor(
                                activeDayIndex,
                                meal.slot,
                                activeMember.member_id,
                              )
                      }
                      onCheckin={
                        canCheckinActiveDay
                          ? (status, reason) =>
                              dishIds && !viewerOutOfMeal
                                ? handleSharedCheckin(
                                    // One roster for set AND clear: the sharers
                                    // this dish actually belongs to. Setting gives
                                    // each of them the same status; clearing takes
                                    // it back from all of them (plus the
                                    // whole-house fallback), so an un-tap really
                                    // leaves the dish unmarked.
                                    dishIds,
                                    meal.slot,
                                    status,
                                    reason,
                                  )
                                : handleCheckin(
                                    activeMember.member_id,
                                    meal.slot,
                                    status,
                                    reason,
                                    viewerOutOfMeal,
                                  )
                          : undefined
                      }
                      absentMemberIds={sharerIds ? absentIds : undefined}
                      onToggleAbsence={
                        canToggleAbsence && sharerIds
                          ? (memberId, absent) =>
                              handleToggleAbsence(
                                memberId,
                                meal.slot,
                                absent,
                                sharerIds,
                              )
                          : undefined
                      }
                      verdict={verdictFor(
                        activeDayIndex,
                        meal.slot,
                        activeMember.member_id,
                      )}
                      onVerdict={
                        canCheckinActiveDay
                          ? (verdict) =>
                              handleVerdict(
                                activeMember.member_id,
                                meal.slot,
                                meal.recipe_name_ar,
                                verdict,
                              )
                          : undefined
                      }
                    />
                  );
                })}
              </>
            ) : memberIsGenerating &&
              !preparingStalled &&
              activeDayIndex === currentPreparingIndex ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Loader2
                  className="size-6 animate-spin motion-reduce:animate-none text-brand-purple-900"
                  aria-hidden="true"
                />
                <p className="text-brand-ink-muted text-sm">
                  {t.preparing_steps[stepTick % t.preparing_steps.length] ??
                    t.generating}
                </p>
              </div>
            ) : generating && !preparingStalled ? (
              // A run completes EVERY incomplete beneficiary, not just
              // generating_member_id — so while the plan is still generating, any
              // member's unfilled day is genuinely queued, not failed. Only fall
              // through to the failed box once generation stops or stalls.
              <div className="text-center py-10 text-brand-ink-muted text-sm leading-relaxed">
                {t.day_queued}
              </div>
            ) : partialWeekMemberIds.includes(activeMember.member_id) &&
              !generating &&
              !translated &&
              !readOnly ? (
              // A short week: the drain fills this day with no action from her,
              // so it says the day is coming instead of offering a retry that
              // would only race the refill.
              <Notice tone="info" title="هذا اليوم في الطريق">
                {g(
                  "يكتمل تلقائياً خلال دقائق، دون أي إجراء منكِ.",
                  "يكتمل تلقائياً خلال دقائق، دون أي إجراء منك.",
                )}
              </Notice>
            ) : activeDay ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-brand-pink bg-brand-pink/5 py-8 px-4 text-center">
                <AlertTriangle className="size-6 text-brand-pink" aria-hidden="true" />
                <p className="text-brand-ink font-bold text-sm leading-relaxed">
                  {t.day_failed}
                </p>
                {!readOnly && (
                  <RegenerateButton
                    memberId={activeMember.member_id}
                    memberName={activeMember.member_name_ar}
                    hasSharedMeals={activeMemberHasShared}
                    memberCount={plan.members.length}
                    locale={locale}
                    ownerSex={ownerSex}
                    onDialogOpenChange={setRegenDialogOpen}
                  />
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-brand-ink-muted text-sm">
                {t.no_meals}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {!isSolo && (
        <MemberSheet
          open={openSheet === "member"}
          onClose={() => setOpenSheet(null)}
          title={t.household}
          subtitle={weekRange}
          members={memberRows}
          selectedId={activeMember.member_id}
          onSelect={selectMember}
          footer={
            interactive ? (
              <>
                <Link href="/family" className={PLAN_MENU_ITEM_CLASS}>
                  <UserPlus className={PLAN_MENU_ICON_CLASS} aria-hidden="true" />
                  إضافة فرد
                </Link>
                {housekeeperLocale && (
                  <Link href="/plan/housekeeper" className={PLAN_MENU_ITEM_CLASS}>
                    <ChefHat className={PLAN_MENU_ICON_CLASS} aria-hidden="true" />
                    {inCookLanguage
                      ? `وصفات الخدامة · ${inCookLanguage}`
                      : "وصفات الخدامة"}
                  </Link>
                )}
              </>
            ) : undefined
          }
          dir={dir}
          lang={translated ? locale : undefined}
          closeLabel={t.close}
          returnFocusRef={identityRef}
        />
      )}

      {hasMenuActions && (
        <MoreSheet
          open={openSheet === "more"}
          onClose={() => setOpenSheet(null)}
          groups={[
            {
              key: "person",
              label: (
                <>
                  <Avatar name={activeName} rosterIndex={activeRosterIndex} size="sm" />
                  {activeName}
                </>
              ),
              items: personItems,
            },
            { key: "week", label: "هذا الأسبوع", items: weekItems },
          ]}
          tail={
            // Opens its ConfirmDialog ABOVE the sheet, so the sheet stays
            // mounted underneath (a button row never closes it).
            !readOnly ? (
              <RegenerateButton
                appearance="menu-item"
                memberId={activeMember.member_id}
                memberName={activeMember.member_name_ar}
                hasSharedMeals={activeMemberHasShared}
                memberCount={plan.members.length}
                locale={locale}
                ownerSex={ownerSex}
                onStarted={() => setOpenSheet(null)}
              />
            ) : undefined
          }
          closeLabel={t.close}
          returnFocusRef={moreRef}
        />
      )}

      {interactive && !housekeeperLocale && (
        <RecipesSheet
          open={openSheet === "recipes"}
          onClose={() => setOpenSheet(null)}
          title={`وصفات ${activeDate}`}
          note={isSolo ? undefined : "وصفات كل أطباق اليوم للبيت كله"}
          dishes={recipeDishes}
          memberNames={memberNames}
          emptyText="لم يُجهَّز هذا اليوم بعد."
          returnFocusRef={recipesRef}
        />
      )}

      {saraChanges && (
        <>
          <SaraChangesSheet
            open={openSheet === "sara"}
            onClose={() => setOpenSheet(null)}
            changes={saraChanges}
            ownerSex={ownerSex}
            // ••• even when the toast opened it — the toast is gone by then.
            returnFocusRef={moreRef}
          />
          {/* Once per plan week, and only over a plan that has something to
              show — never over a week that is still entirely empty. */}
          {hasAnyMeals && (
            <SaraToast
              changes={saraChanges}
              weekStart={plan.week_start_date}
              ownerSex={ownerSex}
              onView={openSaraSheet}
              blocked={openSheet !== null || regenDialogOpen}
            />
          )}
        </>
      )}
    </div>
  );
}
