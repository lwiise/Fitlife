/**
 * Exercise programs for the admin console — which program a household is
 * served, and a compact view of it with this week's session marks. Pure (no
 * I/O); the server loaders feed it rows, blobs and check-ins.
 *
 * The served-program rule is the app's own: `pickServedWorkoutRow` /
 * `resolveWorkoutRow` (lib/plans/workoutPlanRows.ts). The family page calls
 * them directly on rows with their blobs. The families list cannot read every
 * household's blob, so `workoutCellFromRows` runs the same rule on the row
 * columns alone — a workout row only turns 'ready' on its final write, with
 * the finished program in it, so "content" is "status is ready" (the probe
 * cannot see a blob that fails validation; everything else is identical, and
 * workoutProjection.test.ts pins the two against each other).
 */

import { WorkoutProfileSchema, type WorkoutPlan } from "@fitlife/plan-engine";
import { STALE_GENERATION_MIN } from "@/lib/plans/generationTiming";
import { collapseWorkoutMarks, type RawSeasonWorkoutRow } from "@/lib/engagement/seasonMath";
import { WORKOUT_CHECKIN_STATUSES, WORKOUT_INTENSITIES } from "@/lib/engagement/types";
import {
  momWorkoutIneligibleReason,
  workoutIneligibleReason,
} from "@/lib/plans/workoutEligibility";
import type {
  SessionMarkStatus,
  TraineeProfileSummary,
  WorkoutIneligibleMember,
  WorkoutPlanCell,
  WorkoutSessionMark,
  WorkoutSessionView,
  WorkoutTraineeView,
} from "./console-types";

/** getLatestWorkoutPlan's look-back window — the same as the meal side's. */
export const WORKOUT_SERVED_WINDOW = 5;

// ── The served program on row columns (the families list) ──────────────────

export interface WorkoutRowLite {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

type ResolvedStatus = "generating" | "ready" | "failed";

/** resolveWorkoutRow on columns only (content = status ready), without logging. */
export function resolveWorkoutRowLite(
  row: WorkoutRowLite,
  nowMs: number,
  staleMinutes: number = STALE_GENERATION_MIN,
): { status: ResolvedStatus; hasContent: boolean } {
  if (row.status === "ready") return { status: "ready", hasContent: true };
  if (row.status !== "generating") return { status: "failed", hasContent: false };
  const updatedMs = Date.parse(row.updated_at);
  const ageMin = Number.isNaN(updatedMs) ? Infinity : (nowMs - updatedMs) / 60_000;
  return ageMin >= staleMinutes
    ? { status: "failed", hasContent: false }
    : { status: "generating", hasContent: false };
}

/**
 * The fallback half of pickServedWorkoutRow on columns: the first READY row
 * among the older rows of the window (content = status ready). Also what the
 * family page falls back to when the older programs' blobs cannot be read.
 */
export function previousReadyWorkoutLite<R extends { status: string }>(
  older: readonly R[],
): R | null {
  return older.find((r) => r.status === "ready") ?? null;
}

/**
 * pickServedWorkoutRow on columns. `rows` = the household's workout_plans,
 * newest first; archived rows are skipped here.
 */
export function pickServedWorkoutLite<R extends WorkoutRowLite>(
  rows: readonly R[],
  nowMs: number,
): { served: R | null; status: ResolvedStatus | null; masked: boolean } {
  const window = rows.filter((r) => r.status !== "archived").slice(0, WORKOUT_SERVED_WINDOW);
  const newest = window[0];
  if (!newest) return { served: null, status: null, masked: false };
  const resolved = resolveWorkoutRowLite(newest, nowMs);
  if (resolved.status === "failed" && !resolved.hasContent) {
    const prev = previousReadyWorkoutLite(window.slice(1));
    if (prev) return { served: prev, status: "ready", masked: true };
  }
  return { served: newest, status: resolved.status, masked: false };
}

/** The families list's exercise column. */
export function workoutCellFromRows(
  rows: readonly WorkoutRowLite[],
  nowMs: number,
): WorkoutPlanCell {
  const pick = pickServedWorkoutLite(rows, nowMs);
  if (!pick.served || !pick.status) return { state: "none", masked: false };
  return { state: pick.status, masked: pick.masked };
}

// ── Questionnaire answers ───────────────────────────────────────────────────

/**
 * profiles.workout_profile / family_members.workout_profile → the fields the
 * console shows. Parsed with the app's schema; anything it rejects is null —
 * bad data never throws. The free-text injury notes are left out on purpose
 * (they are health detail, and the console never needs them).
 */
export function summarizeWorkoutProfile(raw: unknown): TraineeProfileSummary | null {
  if (raw === null || raw === undefined) return null;
  const parsed = WorkoutProfileSchema.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  return {
    location: p.location,
    equipment: [...p.equipment],
    injuries: [...p.injuries],
    desiredDays: p.desired_days,
    preferredDays: p.preferred_days && p.preferred_days.length > 0 ? [...p.preferred_days] : null,
    focusAreas: [...p.focus_areas],
    experience: p.experience,
    sessionMinutes: p.session_minutes,
  };
}

// ── Session marks ───────────────────────────────────────────────────────────

const MARK_STATUSES: ReadonlySet<string> = new Set(WORKOUT_CHECKIN_STATUSES);
const INTENSITIES: ReadonlySet<string> = new Set(WORKOUT_INTENSITIES);

const markKey = (memberId: string, dayIndex: number) => `${memberId}|${dayIndex}`;

/**
 * This week's marks by member and weekday. Rows are the calendar-keyed read
 * the app makes (user + `workoutMarkingWindow`, oldest first); the app's
 * `collapseWorkoutMarks` settles re-marks (last write wins), then each mark is
 * keyed by (member, day_index) exactly as the /plan viewer reads it. Unknown
 * statuses are dropped; intensity only means something on a done session.
 */
export function marksByMemberDay(
  rows: readonly RawSeasonWorkoutRow[],
): Map<string, WorkoutSessionMark> {
  const out = new Map<string, WorkoutSessionMark>();
  for (const m of collapseWorkoutMarks([...rows])) {
    const day = m.day_index;
    if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) continue;
    if (!m.member_id || !MARK_STATUSES.has(m.status)) continue;
    const status = m.status as SessionMarkStatus;
    const intensity =
      status === "done" && m.intensity && INTENSITIES.has(m.intensity)
        ? (m.intensity as WorkoutSessionMark["intensity"])
        : null;
    out.set(markKey(m.member_id, day), {
      status,
      intensity,
      localDate: m.local_date ?? null,
    });
  }
  return out;
}

/** Raw workout_checkins rows (select "*", untyped) → the season module's row shape. */
export function toRawWorkoutRows(rows: readonly unknown[]): RawSeasonWorkoutRow[] {
  const out: RawSeasonWorkoutRow[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const dayIndex = typeof r.day_index === "number" ? r.day_index : Number(r.day_index);
    if (!Number.isInteger(dayIndex) || typeof r.status !== "string") continue;
    out.push({
      local_date: typeof r.local_date === "string" ? r.local_date : null,
      day_index: dayIndex,
      member_id: typeof r.member_id === "string" ? r.member_id : null,
      status: r.status,
      intensity: typeof r.intensity === "string" ? r.intensity : null,
    });
  }
  return out;
}

// ── Projection ──────────────────────────────────────────────────────────────

/** A household member as the projection needs them ("mom" | family_members.id). */
export interface WorkoutRosterEntry {
  memberId: string;
  name: string;
  role: string;
  sex: "male" | "female" | null;
  /** The raw workout_profile column. */
  workoutProfile: unknown;
}

/** profiles.sex / family_members.sex → the contract's union (anything else is unknown). */
export function sexOf(raw: unknown): "male" | "female" | null {
  return raw === "male" || raw === "female" ? raw : null;
}

const joinSteps = (steps: readonly string[] | null | undefined): string | null => {
  const clean = (steps ?? []).map((s) => s.trim()).filter(Boolean);
  return clean.length > 0 ? clean.join("، ") : null;
};

/**
 * A validated program → one view per trainee, in plan order. Names, roles and
 * sex come from the CURRENT roster (the plan keeps the name it was generated
 * with); a trainee since removed from the household keeps the plan's name and
 * an empty role. Sessions are weekday-anchored (0 = Sunday) and sorted.
 */
export function projectWorkoutTrainees(
  plan: WorkoutPlan,
  roster: ReadonlyMap<string, WorkoutRosterEntry>,
  marks: ReadonlyMap<string, WorkoutSessionMark>,
): WorkoutTraineeView[] {
  return plan.members.map((m) => {
    const who = roster.get(m.member_id);
    const sessions: WorkoutSessionView[] = [...m.weekly_sessions]
      .sort((a, b) => a.day_index - b.day_index)
      .map((s) => ({
        dayIndex: s.day_index,
        name: s.session_name_ar,
        durationMin: Number.isFinite(s.duration_min) ? s.duration_min : null,
        warmup: joinSteps(s.warmup_ar),
        cooldown: joinSteps(s.cooldown_ar),
        exercises: s.exercises.map((e) => ({
          name: e.name_ar,
          targetMuscles: e.target_muscles_ar || null,
          sets: Number.isFinite(e.sets) ? e.sets : null,
          reps: e.reps || null,
          restSeconds: Number.isFinite(e.rest_seconds) ? e.rest_seconds : null,
          rir: e.rir ?? null,
          homeVariant: e.home_variant_ar ?? null,
        })),
        mark: marks.get(markKey(m.member_id, s.day_index)) ?? null,
      }));
    return {
      memberId: m.member_id,
      name: who?.name || m.member_name_ar,
      role: who?.role ?? "",
      sex: who?.sex ?? null,
      splitName: m.split_name_ar || null,
      progressionNotes: m.progression_notes_ar || null,
      profile: summarizeWorkoutProfile(who?.workoutProfile),
      sessions,
      doneThisWeek: sessions.filter((s) => s.mark?.status === "done").length,
    };
  });
}

/** Trainee count and sessions per week of one program. */
export function workoutPlanStats(plan: WorkoutPlan): {
  traineeCount: number;
  sessionsPerWeek: number;
} {
  return {
    traineeCount: plan.members.length,
    sessionsPerWeek: plan.members.reduce((n, m) => n + m.weekly_sessions.length, 0),
  };
}

// ── Who never gets a program ────────────────────────────────────────────────

export interface IneligibilityInput {
  owner: { name: string; birthYear: number | null };
  members: ReadonlyArray<{
    id: string;
    name: string;
    role: string | null;
    memberType: string | null;
    birthYear: number | null;
  }>;
}

/**
 * The household members the app's workout gate (lib/plans/workoutEligibility)
 * excludes, with the reason: children (by type or under 18) and the
 * housekeeper. The owner goes through the same age gate.
 */
export function workoutIneligibleMembers(
  input: IneligibilityInput,
  currentYear: number,
): WorkoutIneligibleMember[] {
  const ageOf = (birthYear: number | null) =>
    birthYear != null && Number.isFinite(birthYear) ? currentYear - birthYear : null;
  const out: WorkoutIneligibleMember[] = [];
  const ownerReason = momWorkoutIneligibleReason(
    { birth_year: input.owner.birthYear },
    currentYear,
  );
  if (ownerReason) {
    out.push({
      memberId: "mom",
      name: input.owner.name,
      reason: ownerReason,
      age: ageOf(input.owner.birthYear),
    });
  }
  for (const m of input.members) {
    const reason = workoutIneligibleReason(
      { member_type: m.memberType, role: m.role, birth_year: m.birthYear },
      currentYear,
    );
    if (!reason) continue;
    out.push({
      memberId: m.id,
      name: m.name,
      reason,
      age: reason === "housekeeper" ? null : ageOf(m.birthYear),
    });
  }
  return out;
}
