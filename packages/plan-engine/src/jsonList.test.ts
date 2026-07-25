import { describe, it, expect } from "vitest";
import { toStringList } from "./jsonList";

describe("toStringList", () => {
  it("passes plain string arrays through — the shape every writer produces", () => {
    expect(toStringList(["فول سوداني", "لاكتوز"])).toEqual([
      "فول سوداني",
      "لاكتوز",
    ]);
  });

  it("returns [] for every non-array shape", () => {
    expect(toStringList(null)).toEqual([]);
    expect(toStringList(undefined)).toEqual([]);
    expect(toStringList("فول سوداني")).toEqual([]);
    expect(toStringList({ name_ar: "فول" })).toEqual([]);
    expect(toStringList(42)).toEqual([]);
  });

  it("trims and drops blank entries", () => {
    expect(toStringList(["  لاكتوز  ", "", "   ", "غلوتين"])).toEqual([
      "لاكتوز",
      "غلوتين",
    ]);
  });

  it("decodes object entries instead of dropping them", () => {
    // The whole point of consolidating: the two AI-prompt paths used to drop
    // these silently while the admin view and chat displayed them.
    expect(
      toStringList([{ name_ar: "فول سوداني" }, { name: "peanut" }, { label: "soy" }]),
    ).toEqual(["فول سوداني", "peanut", "soy"]);
  });

  it("prefers name_ar over name over label", () => {
    expect(
      toStringList([{ name_ar: "فول", name: "peanut", label: "legume" }]),
    ).toEqual(["فول"]);
    expect(toStringList([{ name: "peanut", label: "legume" }])).toEqual([
      "peanut",
    ]);
  });

  it("handles mixed string and object arrays", () => {
    expect(toStringList(["لاكتوز", { name_ar: "غلوتين" }])).toEqual([
      "لاكتوز",
      "غلوتين",
    ]);
  });

  it("drops objects carrying no readable term rather than emitting JSON", () => {
    // Injecting {"foo":1} into an allergy constraint would be a nonsense
    // instruction to the model — worse than omitting it.
    expect(toStringList([{ foo: 1 }, { name_ar: "" }, {}, null, 7])).toEqual([]);
    expect(toStringList([{ foo: 1 }, "لاكتوز"])).toEqual(["لاكتوز"]);
  });

  it("accepts a numeric name value", () => {
    expect(toStringList([{ name_ar: 5 }])).toEqual(["5"]);
  });
});
