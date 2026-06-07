import { describe, it, expect } from "vitest";
import { mapLemonsqueezyStatus, deriveCadence } from "./mapping";

describe("mapLemonsqueezyStatus", () => {
  it("maps on_trial to trialing", () => {
    expect(mapLemonsqueezyStatus("on_trial")).toBe("trialing");
  });

  it("maps active to active", () => {
    expect(mapLemonsqueezyStatus("active")).toBe("active");
  });

  it.each(["paused", "past_due", "unpaid"])(
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

describe("deriveCadence", () => {
  const monthlyIds = ["1677645", "1677648", "1677653", "1677655"];
  const annualIds = ["1677781", "1677755", "1677675", "1677749"];

  it.each(monthlyIds)("maps monthly variant id %s to monthly", (id) => {
    expect(deriveCadence(id)).toBe("monthly");
  });

  it.each(annualIds)("maps annual variant id %s to annual", (id) => {
    expect(deriveCadence(id)).toBe("annual");
  });

  it("accepts numeric variant ids", () => {
    expect(deriveCadence(1677645)).toBe("monthly");
    expect(deriveCadence(1677781)).toBe("annual");
  });

  it.each([0, 1, 9999999, "1677646", "not-a-number", ""])(
    "returns null for unknown variant id %j",
    (id) => {
      expect(deriveCadence(id as string | number)).toBeNull();
    },
  );
});
