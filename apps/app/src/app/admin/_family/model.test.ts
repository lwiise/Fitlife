import { describe, expect, it } from "vitest";
import { FAMILY_TABS } from "@/lib/admin/console-types";
import {
  FAMILY_TAB_LABEL,
  emailMatches,
  familyName,
  familyPagePath,
  familyTabHref,
  familyTabLabel,
  firstParam,
  isAuditFailure,
  listToStrings,
  parseFamilyTab,
  subscriberRouteKind,
  tabSections,
  yesNo,
} from "./model";

const ID = "3f2c6a52-7a5b-4c1e-9d9a-0b1c2d3e4f50";

describe("firstParam", () => {
  it("reads a single value, the first of repeated ones, and nothing", () => {
    expect(firstParam("meal")).toBe("meal");
    expect(firstParam(["runs", "meal"])).toBe("runs");
    expect(firstParam([])).toBeUndefined();
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam(null)).toBeUndefined();
  });
});

describe("parseFamilyTab", () => {
  it("accepts every family tab", () => {
    for (const tab of FAMILY_TABS) expect(parseFamilyTab(tab)).toBe(tab);
  });

  it("falls back to the summary for anything else", () => {
    expect(parseFamilyTab(undefined)).toBe("summary");
    expect(parseFamilyTab("")).toBe("summary");
    expect(parseFamilyTab("Meal")).toBe("summary");
    expect(parseFamilyTab("health")).toBe("summary");
    expect(parseFamilyTab("__proto__")).toBe("summary");
    expect(parseFamilyTab("toString")).toBe("summary");
  });

  it("uses the first of repeated values", () => {
    expect(parseFamilyTab(["exercise", "meal"])).toBe("exercise");
    expect(parseFamilyTab(["nope", "meal"])).toBe("summary");
  });
});

describe("isAuditFailure", () => {
  it("is only the exact audit_failed code", () => {
    expect(isAuditFailure("audit_failed")).toBe(true);
    expect(isAuditFailure(["audit_failed"])).toBe(true);
    expect(isAuditFailure("audit_failed ")).toBe(false);
    expect(isAuditFailure("other")).toBe(false);
    expect(isAuditFailure(undefined)).toBe(false);
  });
});

describe("family page links", () => {
  it("links the summary to the bare page and every other tab by ?tab=", () => {
    expect(familyPagePath(ID)).toBe(`/admin/subscribers/${ID}`);
    expect(familyTabHref(ID, "summary")).toBe(`/admin/subscribers/${ID}`);
    expect(familyTabHref(ID, "meal")).toBe(`/admin/subscribers/${ID}?tab=meal`);
    expect(familyTabHref(ID, "account")).toBe(`/admin/subscribers/${ID}?tab=account`);
  });

  it("round-trips: every tab's link parses back to that tab", () => {
    for (const tab of FAMILY_TABS) {
      const query = new URL(familyTabHref(ID, tab), "https://x.test").searchParams.get("tab");
      expect(parseFamilyTab(query)).toBe(tab);
    }
  });

  it("encodes the id", () => {
    expect(familyPagePath("a/b")).toBe("/admin/subscribers/a%2Fb");
  });
});

describe("tabs", () => {
  it("names every tab in both languages", () => {
    expect(Object.keys(FAMILY_TAB_LABEL).sort()).toEqual([...FAMILY_TABS].sort());
    for (const tab of FAMILY_TABS) {
      expect(familyTabLabel(tab, "ar")).not.toBe("");
      expect(familyTabLabel(tab, "en")).not.toBe("");
    }
    expect(familyTabLabel("household", "ar")).toBe("الأسرة والصحة");
    expect(familyTabLabel("runs", "en")).toBe("AI runs");
  });

  it("reads only what each tab shows", () => {
    expect(tabSections("summary")).toEqual(["meal", "workout"]);
    expect(tabSections("meal")).toEqual(["meal", "household"]);
    expect(tabSections("exercise")).toEqual(["workout"]);
    expect(tabSections("household")).toEqual(["household"]);
    expect(tabSections("runs")).toEqual(["runs"]);
    expect(tabSections("billing")).toEqual([]);
    expect(tabSections("account")).toEqual([]);
  });
});

describe("familyName", () => {
  it("keeps a real name and names the nameless", () => {
    expect(familyName("  هند العتيبي ", "ar")).toBe("هند العتيبي");
    expect(familyName("", "ar")).toBe("بدون اسم");
    expect(familyName("   ", "en")).toBe("No name");
    expect(familyName(null, "en")).toBe("No name");
  });
});

describe("emailMatches", () => {
  it("matches the way the server action compares (trimmed, any case)", () => {
    expect(emailMatches("hind@example.com", "hind@example.com")).toBe(true);
    expect(emailMatches("  HIND@Example.com ", "hind@example.com")).toBe(true);
    expect(emailMatches("hind@example.com", " Hind@Example.COM ")).toBe(true);
  });

  it("refuses anything else", () => {
    expect(emailMatches("hind@example.co", "hind@example.com")).toBe(false);
    expect(emailMatches("", "hind@example.com")).toBe(false);
    expect(emailMatches("hind@example.com", null)).toBe(false);
    expect(emailMatches("", "")).toBe(false);
    expect(emailMatches("   ", "   ")).toBe(false);
  });
});

describe("listToStrings", () => {
  it("reads plain strings and named objects", () => {
    expect(listToStrings(["فول سوداني", "سمسم"])).toEqual(["فول سوداني", "سمسم"]);
    expect(
      listToStrings([{ name_ar: "حليب" }, { name: "Egg" }, { label: "قمح" }, { name_ar: "بيض", name: "Egg" }]),
    ).toEqual(["حليب", "Egg", "قمح", "بيض"]);
  });

  it("keeps an unknown object readable and drops empty entries", () => {
    expect(listToStrings([{ code: 7 }])).toEqual(['{"code":7}']);
    expect(listToStrings([null, undefined, "", "  ", 3])).toEqual(["3"]);
  });

  it("is empty for anything that is not a list", () => {
    expect(listToStrings(null)).toEqual([]);
    expect(listToStrings("حليب")).toEqual([]);
    expect(listToStrings({ name_ar: "حليب" })).toEqual([]);
  });
});

describe("yesNo", () => {
  it("answers yes, no, or unanswered", () => {
    expect(yesNo(true, "ar")).toBe("نعم");
    expect(yesNo(false, "en")).toBe("No");
    expect(yesNo(null, "ar")).toBe("—");
    expect(yesNo(undefined, "en")).toBe("—");
  });
});

describe("subscriberRouteKind", () => {
  it("tells the four screens apart", () => {
    expect(subscriberRouteKind(`/admin/subscribers/${ID}`)).toBe("family");
    expect(subscriberRouteKind(`/admin/subscribers/${ID}/`)).toBe("family");
    expect(subscriberRouteKind(`/admin/subscribers/${ID}/health`)).toBe("health");
    expect(subscriberRouteKind(`/admin/subscribers/${ID}/plan/${ID}`)).toBe("viewer");
    expect(subscriberRouteKind(`/admin/subscribers/${ID}/workout/${ID}`)).toBe("viewer");
  });

  it("reads an unexpected path as the family page", () => {
    expect(subscriberRouteKind("")).toBe("family");
    expect(subscriberRouteKind("/admin")).toBe("family");
    expect(subscriberRouteKind(`/admin/subscribers/${ID}/other`)).toBe("family");
  });
});
