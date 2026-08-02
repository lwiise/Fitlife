import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAN_RUN_BUDGET_MS,
  FINALIZE_RESERVE_MS,
  dayLoopDeadline,
} from "@fitlife/plan-engine";

import {
  GENERATION_SILENCE_LIMIT_MS,
  SERVER_VERDICT_MARGIN_MS,
  STALE_GENERATION_MIN,
  WORKER_ACK_LIMIT_MS,
  ageMsFrom,
  generationHasStalled,
  workerAckedFromPlanData,
} from "./generationTiming";

/**
 * THE regression this file exists for: the two generating screens used to give
 * up after a fixed 13 minutes while the background function is allowed to run
 * for ~15 — so a healthy run got «العملية تاخذ وقت أطول من المتوقع» and a
 * refresh from there just restarted the same 13-minute clock.
 *
 * The ordering below is what makes that unrepresentable. It is asserted against
 * the engine's OWN budget constants rather than against copies, so if anyone
 * later raises the background function's budget, this fails instead of quietly
 * recreating the bug.
 */
describe("client patience vs. server runtime", () => {
  it("never gives up before the background function's hard budget", () => {
    expect(GENERATION_SILENCE_LIMIT_MS).toBeGreaterThan(DEFAULT_PLAN_RUN_BUDGET_MS);
  });

  it("never gives up before the day loop's own deadline", () => {
    // The latest a run can still be legitimately working, for both the
    // translation and no-translation shapes of the budget.
    const start = 0;
    expect(GENERATION_SILENCE_LIMIT_MS).toBeGreaterThan(dayLoopDeadline(start, false));
    expect(GENERATION_SILENCE_LIMIT_MS).toBeGreaterThan(dayLoopDeadline(start, true));
  });

  it("gives the server's reclassifier a chance to answer first", () => {
    // resolveStaleness turns a silent row into failed/partial-ready at exactly
    // STALE_GENERATION_MIN. The client must land AFTER that, so the user gets a
    // real screen (the plan, or the retry state) rather than the generic card.
    const serverVerdictMs = STALE_GENERATION_MIN * 60_000;
    expect(GENERATION_SILENCE_LIMIT_MS).toBeGreaterThan(serverVerdictMs);
    expect(GENERATION_SILENCE_LIMIT_MS - serverVerdictMs).toBe(SERVER_VERDICT_MARGIN_MS);
  });

  it("leaves room for the finalize reserve on top of the day loop", () => {
    // The terminal row is written inside FINALIZE_RESERVE_MS after the day loop
    // ends — the moment the OLD 13-minute clock fired inside of.
    expect(GENERATION_SILENCE_LIMIT_MS).toBeGreaterThan(
      dayLoopDeadline(0, false) + FINALIZE_RESERVE_MS,
    );
  });

  it("would have failed for the 13-minute wall clock it replaced", () => {
    const OLD_TIMEOUT_MS = 780_000;
    expect(OLD_TIMEOUT_MS).toBeLessThan(DEFAULT_PLAN_RUN_BUDGET_MS);
    expect(OLD_TIMEOUT_MS).toBeLessThan(dayLoopDeadline(0, false));
  });
});

describe("generationHasStalled", () => {
  it("stays patient while the row is being written", () => {
    const now = 1_000_000_000;
    // A run that wrote a snapshot one second ago is alive, however long the
    // whole generation has already taken.
    expect(generationHasStalled(now - 1_000, now)).toBe(false);
    expect(generationHasStalled(now - GENERATION_SILENCE_LIMIT_MS + 1, now)).toBe(false);
  });

  it("declares a stall only once nothing has written for the full limit", () => {
    const now = 1_000_000_000;
    expect(generationHasStalled(now - GENERATION_SILENCE_LIMIT_MS, now)).toBe(true);
    expect(generationHasStalled(now - GENERATION_SILENCE_LIMIT_MS - 60_000, now)).toBe(
      true,
    );
  });

  it("does not fire at the old 13-minute mark", () => {
    // The exact customer-visible symptom: 13 minutes into a live run.
    const now = 1_000_000_000;
    expect(generationHasStalled(now - 780_000, now)).toBe(false);
  });
});

describe("ageMsFrom", () => {
  const now = Date.parse("2026-07-31T12:00:00.000Z");

  it("measures the age of a real timestamp", () => {
    expect(ageMsFrom("2026-07-31T11:55:00.000Z", now)).toBe(5 * 60_000);
  });

  it("floors at zero for a future timestamp", () => {
    // Clock skew between DB and app server must not read as negative age.
    expect(ageMsFrom("2026-07-31T12:05:00.000Z", now)).toBe(0);
  });

  it("fails toward patience on degraded input", () => {
    // A stall is a claim that the server died; every unusable input must read as
    // "just written" so we never invent one.
    expect(ageMsFrom(null, now)).toBe(0);
    expect(ageMsFrom(undefined, now)).toBe(0);
    expect(ageMsFrom("not-a-date", now)).toBe(0);
    expect(ageMsFrom("", now)).toBe(0);
  });

  it("keeps a reloaded tab on the same timeline", () => {
    // The reload loop, end to end. The status route computes `age_ms` with
    // ageMsFrom; a freshly-mounted card rebuilds its silence clock as
    // `now - age_ms`. A row silent for 14 minutes must therefore still read as
    // 14 minutes old to a brand-new card — not as brand new itself, which is
    // what let the old card grant a dead run another full window on every
    // refresh.
    const ageMs = ageMsFrom("2026-07-31T11:46:00.000Z", now);
    expect(ageMs).toBe(14 * 60_000);

    const rebuiltLastWriteAt = now - ageMs;
    expect(generationHasStalled(rebuiltLastWriteAt, now)).toBe(false);
    // ...and two minutes later that same row has crossed the line, rather than
    // buying itself another window by being refreshed.
    expect(generationHasStalled(rebuiltLastWriteAt, now + 2 * 60_000)).toBe(true);
  });

  it("resets the silence clock when the worker writes again", () => {
    // A live run's age_ms keeps coming back small, so the clock is continuously
    // rebuilt near `now` and the stall never fires — however long the whole
    // generation legitimately takes. This is the defect-1 case: 20 minutes of
    // honest work must not be called stuck.
    const twentyMinutesIn = now + 20 * 60_000;
    const freshAgeMs = 2_000; // a day snapshot landed two seconds ago
    expect(
      generationHasStalled(twentyMinutesIn - freshAgeMs, twentyMinutesIn),
    ).toBe(false);
  });
});

/**
 * The invocation-ACK verdict. The worker stamps `worker_ack_at` before any model
 * call, so its absence is a much sharper signal than silence — and it must be
 * answered much sooner, since a run that never started will never start.
 */
describe("worker ACK verdict", () => {
  it("resolves far sooner than the generic stall", () => {
    // The whole point: "never started" must not cost the customer the same
    // fifteen minutes as "still working".
    expect(WORKER_ACK_LIMIT_MS).toBeLessThan(GENERATION_SILENCE_LIMIT_MS);
    expect(WORKER_ACK_LIMIT_MS).toBeLessThan(STALE_GENERATION_MIN * 60_000);
  });

  it("still gives a healthy worker room to ACK", () => {
    // The ACK is written before the first model call, so it lands in ~1s. A
    // limit under ~10s would start failing live runs on cold starts alone.
    expect(WORKER_ACK_LIMIT_MS).toBeGreaterThanOrEqual(30_000);
  });

  it("keeps the client's broken-poll fallback strictly after the server's verdict", () => {
    // Same ordering rule as the 15-minute case: the server's specific answer
    // must always beat the client's generic one.
    const clientBrokenPollAt = WORKER_ACK_LIMIT_MS + SERVER_VERDICT_MARGIN_MS;
    expect(clientBrokenPollAt).toBeGreaterThan(WORKER_ACK_LIMIT_MS);
    expect(clientBrokenPollAt).toBeLessThan(GENERATION_SILENCE_LIMIT_MS);
  });
});

/**
 * The read path and the dispatch lock must agree on whether a run is alive.
 * When they didn't, the plan failed at 90 seconds saying «حاولي مرة ثانية» while
 * the lock answered every retry with 409 «خطتك قيد التجهيز الآن» for the next
 * fourteen minutes — an error whose only instruction the app itself refused.
 */
describe("workerAckedFromPlanData", () => {
  it("treats the empty object createPlanRows inserts as no ACK", () => {
    expect(workerAckedFromPlanData({})).toBe(false);
  });

  it("counts the worker's ACK stamp as proof it ran", () => {
    expect(workerAckedFromPlanData({ worker_ack_at: "2026-07-31T22:00:00Z" })).toBe(true);
  });

  it("counts a real snapshot as proof it ran", () => {
    expect(workerAckedFromPlanData({ week_start_date: "2026-08-02", members: [] })).toBe(
      true,
    );
  });

  it("fails toward patience on anything unreadable", () => {
    // Never condemn a live run on a degraded read.
    expect(workerAckedFromPlanData(null)).toBe(true);
    expect(workerAckedFromPlanData(undefined)).toBe(true);
    expect(workerAckedFromPlanData("garbage")).toBe(true);
    expect(workerAckedFromPlanData([])).toBe(true);
    expect(workerAckedFromPlanData(42)).toBe(true);
  });

  it("lets the lock release before the user is told to retry", () => {
    // The ordering that removes the dead end: whatever the read path condemns at
    // WORKER_ACK_LIMIT_MS, the dispatch guard can sweep at the same instant.
    expect(WORKER_ACK_LIMIT_MS).toBeLessThan(STALE_GENERATION_MIN * 60_000);
  });
});
