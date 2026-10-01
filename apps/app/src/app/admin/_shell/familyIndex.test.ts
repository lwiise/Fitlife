import { describe, expect, it } from "vitest";
import { parseFamilyIndex } from "./familyIndex";

describe("parseFamilyIndex", () => {
  it("keeps id, name and email — and nothing else a response might carry", () => {
    const body = {
      loadedAt: "2026-09-30T09:00:00Z",
      families: [
        { id: "a", name: "هند", email: "hind@example.com", tier: "family" },
        { id: "b", name: null, email: null },
      ],
    };
    expect(parseFamilyIndex(body)).toEqual([
      { id: "a", name: "هند", email: "hind@example.com" },
      { id: "b", name: null, email: null },
    ]);
  });

  it("drops entries it cannot search or open, and reads odd fields as missing", () => {
    const body = {
      families: [
        null,
        "a",
        { name: "no id" },
        { id: "", name: "empty id" },
        { id: 7, name: "numeric id" },
        { id: "c", name: 3, email: ["x"] },
      ],
    };
    expect(parseFamilyIndex(body)).toEqual([{ id: "c", name: null, email: null }]);
  });

  it("is null for anything that is not the index at all", () => {
    expect(parseFamilyIndex(null)).toBeNull();
    expect(parseFamilyIndex("[]")).toBeNull();
    expect(parseFamilyIndex({ error: "Not found" })).toBeNull();
    expect(parseFamilyIndex({ families: {} })).toBeNull();
  });

  it("reads an empty index as an empty list, not a failure", () => {
    expect(parseFamilyIndex({ families: [], loadedAt: "2026-09-30T09:00:00Z" })).toEqual([]);
  });
});
