import { describe, expect, it } from "vitest";
import { WorkoutPlanSchema, type WorkoutPlan } from "@fitlife/plan-engine";

import { pickServedWorkoutRow, type WorkoutPlanRow } from "@/lib/plans/workoutPlanRows";
import { STALE_GENERATION_MIN } from "@/lib/plans/generationTiming";
import {
  marksByMemberDay,
  pickServedWorkoutLite,
  projectWorkoutTrainees,
  sexOf,
  summarizeWorkoutProfile,
  toRawWorkoutRows,
  workoutCellFromRows,
  workoutIneligibleMembers,
  workoutPlanStats,
  type WorkoutRosterEntry,
} from "./workoutProjection";

const NOW = Date.parse("2026-09-29T12:00:00.000Z");
const minAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

// ── fixtures (packages/plan-engine/src/workout/schema.ts) ───────────────────

const exercise = (name: string, extra: Record<string, unknown> = {}) => ({
  exercise_id: null,
  name_ar: name,
  target_muscles_ar: "الأرجل",
  sets: 3,
  reps: "10",
  rest_seconds: 90,
  ...extra,
});

const session = (dayIndex: number, name: string, extra: Record<string, unknown> = {}) => ({
  day_index: dayIndex,
  session_name_ar: name,
  warmup_ar: ["مشي خفيف", "تدوير الكتفين"],
  exercises: [
    exercise("سكوات بالدمبل"),
    exercise("جسر الورك", { rir: "2-3", home_variant_ar: "جسر على الأرض" }),
  ],
  duration_min: 45,
  ...extra,
});

function program(): WorkoutPlan {
  return WorkoutPlanSchema.parse({
    week_start_date: "2026-09-27",
    members: [
      {
        member_id: "mom",
        member_name_ar: "هند (قديم)",
        split_name_ar: "جسم كامل ×٣",
        weekly_sessions: [
          session(4, "جسم كامل ج"),
          session(0, "جسم كامل أ"),
          session(2, "جسم كامل ب"),
        ],
        progression_notes_ar: "زيدي التكرار أسبوعياً",
      },
      {
        member_id: "gone",
        member_name_ar: "عضو محذوف",
        split_name_ar: "علوي/سفلي",
        weekly_sessions: [session(1, "علوي")],
        progression_notes_ar: "ثبات",
      },
    ],
  });
}

const PROFILE = {
  location: "home",
  equipment: ["dumbbells", "bands"],
  injuries: ["knee"],
  injury_notes: "ألم في الركبة اليسرى",
  desired_days: 3,
  preferred_days: [4, 0, 2, 2],
  focus_areas: ["full_body"],
  experience: "beginner",
  session_minutes: "m30_45",
};

// ── profiles ────────────────────────────────────────────────────────────────

describe("summarizeWorkoutProfile", () => {
  it("summarises a valid profile and leaves the injury notes out", () => {
    expect(summarizeWorkoutProfile(PROFILE)).toEqual({
      location: "home",
      equipment: ["dumbbells", "bands"],
      injuries: ["knee"],
      desiredDays: 3,
      preferredDays: [0, 2, 4],
      focusAreas: ["full_body"],
      experience: "beginner",
      sessionMinutes: "m30_45",
    });
  });

  it("returns null for missing or invalid data instead of throwing", () => {
    expect(summarizeWorkoutProfile(null)).toBeNull();
    expect(summarizeWorkoutProfile(undefined)).toBeNull();
    expect(summarizeWorkoutProfile({ location: "moon" })).toBeNull();
    expect(summarizeWorkoutProfile("x")).toBeNull();
  });

  it("reports no chosen weekdays for a legacy profile", () => {
    const { preferred_days: _drop, ...legacy } = PROFILE;
    void _drop;
    expect(summarizeWorkoutProfile(legacy)?.preferredDays).toBeNull();
  });
});

describe("sexOf", () => {
  it("accepts only the two stored values", () => {
    expect(sexOf("male")).toBe("male");
    expect(sexOf("female")).toBe("female");
    expect(sexOf("x")).toBeNull();
    expect(sexOf(null)).toBeNull();
  });
});

// ── marks ───────────────────────────────────────────────────────────────────

describe("marksByMemberDay", () => {
  it("keeps the last write per member and date, keyed by weekday", () => {
    const marks = marksByMemberDay([
      { local_date: "2026-09-27", day_index: 0, member_id: "mom", status: "skipped" },
      {
        local_date: "2026-09-27",
        day_index: 0,
        member_id: "mom",
        status: "done",
        intensity: "hard",
      },
      {
        local_date: "2026-09-29",
        day_index: 2,
        member_id: "mom",
        status: "moved",
        intensity: "easy",
      },
    ]);
    expect(marks.get("mom|0")).toEqual({
      status: "done",
      intensity: "hard",
      localDate: "2026-09-27",
    });
    // Intensity only means something on a done session.
    expect(marks.get("mom|2")).toEqual({
      status: "moved",
      intensity: null,
      localDate: "2026-09-29",
    });
  });

  it("drops unknown statuses, bad days, missing members and bad intensities", () => {
    const marks = marksByMemberDay([
      { local_date: "2026-09-27", day_index: 0, member_id: "mom", status: "maybe" },
      { local_date: "2026-09-28", day_index: 9, member_id: "mom", status: "done" },
      { local_date: "2026-09-28", day_index: 1, member_id: null, status: "done" },
      {
        local_date: "2026-09-29",
        day_index: 2,
        member_id: "mom",
        status: "done",
        intensity: "brutal",
      },
    ]);
    expect([...marks.keys()]).toEqual(["mom|2"]);
    expect(marks.get("mom|2")?.intensity).toBeNull();
  });

  it("toRawWorkoutRows tolerates select('*') rows without the intensity column", () => {
    expect(
      toRawWorkoutRows([
        { local_date: "2026-09-27", day_index: 0, member_id: "mom", status: "done" },
        { day_index: "3", status: "moved" },
        { day_index: "x", status: "done" },
        null,
        "junk",
      ]),
    ).toEqual([
      { local_date: "2026-09-27", day_index: 0, member_id: "mom", status: "done", intensity: null },
      { local_date: null, day_index: 3, member_id: null, status: "moved", intensity: null },
    ]);
  });
});

// ── projection ──────────────────────────────────────────────────────────────

describe("projectWorkoutTrainees", () => {
  const roster = new Map<string, WorkoutRosterEntry>([
    ["mom", { memberId: "mom", name: "هند", role: "mom", sex: "female", workoutProfile: PROFILE }],
  ]);

  it("projects each trainee with sorted sessions, marks and done count", () => {
    const marks = marksByMemberDay([
      {
        local_date: "2026-09-27",
        day_index: 0,
        member_id: "mom",
        status: "done",
        intensity: "right",
      },
      { local_date: "2026-09-29", day_index: 2, member_id: "mom", status: "skipped" },
    ]);
    const [mom, gone] = projectWorkoutTrainees(program(), roster, marks);
    expect(mom).toMatchObject({
      memberId: "mom",
      name: "هند",
      role: "mom",
      sex: "female",
      splitName: "جسم كامل ×٣",
      progressionNotes: "زيدي التكرار أسبوعياً",
      doneThisWeek: 1,
    });
    expect(mom!.profile?.location).toBe("home");
    expect(mom!.sessions.map((s) => s.dayIndex)).toEqual([0, 2, 4]);
    expect(mom!.sessions[0]).toMatchObject({
      name: "جسم كامل أ",
      durationMin: 45,
      warmup: "مشي خفيف، تدوير الكتفين",
      cooldown: null,
      mark: { status: "done", intensity: "right", localDate: "2026-09-27" },
    });
    expect(mom!.sessions[0]!.exercises[1]).toEqual({
      name: "جسر الورك",
      targetMuscles: "الأرجل",
      sets: 3,
      reps: "10",
      restSeconds: 90,
      rir: "2-3",
      homeVariant: "جسر على الأرض",
    });
    expect(mom!.sessions[1]!.mark?.status).toBe("skipped");
    expect(mom!.sessions[2]!.mark).toBeNull();

    // A trainee no longer in the household keeps the plan's name, no role, no profile.
    expect(gone).toMatchObject({
      name: "عضو محذوف",
      role: "",
      sex: null,
      profile: null,
      doneThisWeek: 0,
    });
  });

  it("counts trainees and weekly sessions", () => {
    expect(workoutPlanStats(program())).toEqual({ traineeCount: 2, sessionsPerWeek: 4 });
  });
});

describe("workoutIneligibleMembers", () => {
  it("mirrors the app's gate: children (by type or age) and the housekeeper", () => {
    const out = workoutIneligibleMembers(
      {
        owner: { name: "هند", birthYear: 1990 },
        members: [
          { id: "dad", name: "فيصل", role: "dad", memberType: "adult", birthYear: 1988 },
          { id: "lama", name: "لمى", role: "daughter", memberType: "child", birthYear: 2016 },
          { id: "saud", name: "سعود", role: "son", memberType: "adult", birthYear: 2010 },
          { id: "maria", name: "ماريا", role: "housekeeper", memberType: "adult", birthYear: 1995 },
          {
            id: "preg",
            name: "نورة",
            role: "other_adult",
            memberType: "pregnant",
            birthYear: 1994,
          },
        ],
      },
      2026,
    );
    expect(out).toEqual([
      { memberId: "lama", name: "لمى", reason: "child", age: 10 },
      { memberId: "saud", name: "سعود", reason: "child", age: 16 },
      { memberId: "maria", name: "ماريا", reason: "housekeeper", age: null },
    ]);
  });

  it("applies the age gate to an under-18 owner", () => {
    expect(
      workoutIneligibleMembers({ owner: { name: "ريم", birthYear: 2011 }, members: [] }, 2026),
    ).toEqual([{ memberId: "mom", name: "ريم", reason: "child", age: 15 }]);
  });
});

// ── the served rule: column path == the app's pickServedWorkoutRow ───────────

const PLAN_DATA = program();
const row = (id: string, status: string, updatedMinAgo: number): WorkoutPlanRow => ({
  id,
  status,
  plan_data: status === "ready" ? PLAN_DATA : null,
  error_message: null,
  updated_at: minAgo(updatedMinAgo),
});
const lite = (r: WorkoutPlanRow) => ({
  id: r.id,
  status: r.status,
  created_at: r.updated_at,
  updated_at: r.updated_at,
});

describe("workoutCellFromRows agrees with pickServedWorkoutRow", () => {
  const cases: Array<
    [string, WorkoutPlanRow[], { id: string | null; state: string; masked: boolean }]
  > = [
    ["ready", [row("a", "ready", 5)], { id: "a", state: "ready", masked: false }],
    [
      "live run",
      [row("a", "generating", 3), row("b", "ready", 900)],
      { id: "a", state: "generating", masked: false },
    ],
    [
      "dead run falls back",
      [row("a", "generating", 30), row("b", "ready", 900)],
      { id: "b", state: "ready", masked: true },
    ],
    [
      "failed falls back past failures",
      [row("a", "failed", 3), row("b", "failed", 30), row("c", "ready", 900)],
      { id: "c", state: "ready", masked: true },
    ],
    [
      "failed with nothing to fall back to",
      [row("a", "failed", 3), row("b", "failed", 30)],
      { id: "a", state: "failed", masked: false },
    ],
  ];

  it.each(cases)("%s", (_label, rows, expected) => {
    const app = pickServedWorkoutRow(rows, NOW, STALE_GENERATION_MIN)!;
    expect(app.id).toBe(expected.id);
    expect(app.status).toBe(expected.state);

    const pick = pickServedWorkoutLite(rows.map(lite), NOW);
    expect(pick.served?.id).toBe(expected.id);
    expect(workoutCellFromRows(rows.map(lite), NOW)).toEqual({
      state: expected.state,
      masked: expected.masked,
    });
  });

  it("is none without rows, and skips archived rows", () => {
    expect(workoutCellFromRows([], NOW)).toEqual({ state: "none", masked: false });
    expect(
      workoutCellFromRows([lite(row("x", "archived", 1)), lite(row("a", "ready", 5))], NOW),
    ).toEqual({ state: "ready", masked: false });
  });
});
