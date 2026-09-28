import { describe, expect, it } from "vitest";
import { partOfDay, pickTicket } from "./ticket";

const row = (key: string, slot: string, status: string | null, eaters = 1) => ({
  key,
  slot,
  status,
  eaterIds: Array.from({ length: eaters }, (_, i) => `m${i}`),
});

const day = [
  row("b", "breakfast", null, 3),
  row("l", "lunch", null, 4),
  row("s", "snack", null, 2),
  row("d", "dinner", null, 4),
];

describe("partOfDay", () => {
  it("splits the Riyadh day at 11:00 and 17:00", () => {
    expect(partOfDay(6)).toBe("breakfast");
    expect(partOfDay(10)).toBe("breakfast");
    expect(partOfDay(11)).toBe("lunch");
    expect(partOfDay(16)).toBe("lunch");
    expect(partOfDay(17)).toBe("dinner");
    expect(partOfDay(23)).toBe("dinner");
  });
});

describe("pickTicket", () => {
  it("holds the current part of the day's main meal while it is open", () => {
    expect(pickTicket(day, 8)?.key).toBe("b");
    expect(pickTicket(day, 13)?.key).toBe("l");
    expect(pickTicket(day, 20)?.key).toBe("d");
  });

  it("moves forward once answered and never goes back", () => {
    const rows = day.map((r) => (r.key === "b" ? { ...r, status: "cooked" } : r));
    expect(pickTicket(rows, 9)?.key).toBe("l");
    // At 1pm an unmarked breakfast does not pull the ticket backwards.
    expect(pickTicket(day, 13)?.key).toBe("l");
  });

  it("never puts a snack on the ticket", () => {
    const rows = day.map((r) => (r.slot === "snack" ? r : { ...r, status: "cooked" }));
    expect(pickTicket(rows, 15)).toBeNull();
  });

  it("is empty once the evening meal is answered", () => {
    const rows = day.map((r) => (r.key === "d" ? { ...r, status: "skipped" } : r));
    expect(pickTicket(rows, 21)).toBeNull();
  });

  it("leads with the pot that feeds the most people when a slot holds two dishes", () => {
    const rows = [row("own", "lunch", null, 1), row("pot", "lunch", null, 3)];
    expect(pickTicket(rows, 12)?.key).toBe("pot");
  });
});
