import { describe, it, expect } from "vitest";
import {
  summarizeWorkoutFeedback,
  workoutFeedbackClause,
  FEEDBACK_MIN_RATED,
} from "./feedback";

const row = (member_id: string, status: string, intensity?: string | null) => ({
  member_id,
  status,
  intensity,
});

describe("summarizeWorkoutFeedback", () => {
  it("aggregates per member, counting intensity only on done sessions", () => {
    const out = summarizeWorkoutFeedback([
      row("mom", "done", "hard"),
      row("mom", "done", "right"),
      row("mom", "done", null),
      row("mom", "skipped", "hard"), // stale rating on a non-done row — ignored
      row("m2", "done", "easy"),
      row("m2", "moved"),
    ]);
    expect(out["mom"]).toEqual({ done: 3, rated: 2, easy: 0, hard: 1 });
    expect(out["m2"]).toEqual({ done: 1, rated: 1, easy: 1, hard: 0 });
  });

  it("ignores null member ids and unknown intensities", () => {
    const out = summarizeWorkoutFeedback([
      row("mom", "done", "brutal"),
      { member_id: null, status: "done", intensity: "hard" },
    ]);
    expect(out["mom"]).toEqual({ done: 1, rated: 0, easy: 0, hard: 0 });
    expect(Object.keys(out)).toEqual(["mom"]);
  });
});

describe("workoutFeedbackClause", () => {
  it("stays silent below the minimum rated threshold — one tap is an anecdote", () => {
    expect(workoutFeedbackClause(undefined)).toBeNull();
    expect(workoutFeedbackClause(null)).toBeNull();
    expect(
      workoutFeedbackClause({ done: 4, rated: FEEDBACK_MIN_RATED - 1, easy: 0, hard: 1 }),
    ).toBeNull();
  });

  it("mostly-hard weeks direct a deload", () => {
    const clause = workoutFeedbackClause({ done: 3, rated: 3, easy: 0, hard: 2 });
    expect(clause).toContain("شاقة");
    expect(clause).toContain("خفّفي");
    expect(clause).toContain("2 من 3");
  });

  it("mostly-easy weeks direct more challenge, keeping RIR bounds", () => {
    const clause = workoutFeedbackClause({ done: 4, rated: 4, easy: 3, hard: 0 });
    expect(clause).toContain("خفيفة");
    expect(clause).toContain("زيدي التحدي");
    expect(clause).toContain("RIR");
  });

  it("balanced weeks hold the level", () => {
    const clause = workoutFeedbackClause({ done: 4, rated: 4, easy: 1, hard: 1 });
    expect(clause).toContain("مناسبة");
    expect(clause).toContain("حافظي");
  });

  it("a hard/easy tie never picks a direction", () => {
    const clause = workoutFeedbackClause({ done: 4, rated: 4, easy: 2, hard: 2 });
    expect(clause).toContain("حافظي");
  });
});
