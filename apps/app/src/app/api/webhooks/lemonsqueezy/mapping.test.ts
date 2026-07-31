import { describe, it, expect } from "vitest";
import { mapLemonsqueezyStatus } from "./mapping";

describe("mapLemonsqueezyStatus", () => {
  it("maps on_trial to trialing", () => {
    expect(mapLemonsqueezyStatus("on_trial")).toBe("trialing");
  });

  it("maps active to active", () => {
    expect(mapLemonsqueezyStatus("active")).toBe("active");
  });

  // A pause is a deliberate churn-deflection استراحة, not a billing failure —
  // it must never trigger the past_due payment banner.
  it("maps paused to paused", () => {
    expect(mapLemonsqueezyStatus("paused")).toBe("paused");
  });

  it.each(["past_due", "unpaid"])(
    "maps %s to past_due",
    (status) => {
      expect(mapLemonsqueezyStatus(status)).toBe("past_due");
    },
  );

  it("maps cancelled to cancelled", () => {
    expect(mapLemonsqueezyStatus("cancelled")).toBe("cancelled");
  });

  it("maps expired to expired", () => {
    expect(mapLemonsqueezyStatus("expired")).toBe("expired");
  });

  it.each(["", "unknown", "trialing", "ACTIVE", "deleted"])(
    "returns null for unknown status %j",
    (status) => {
      expect(mapLemonsqueezyStatus(status)).toBeNull();
    },
  );
});

