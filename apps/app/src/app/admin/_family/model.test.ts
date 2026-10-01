import { describe, expect, it } from "vitest";
import { FAMILY_TABS } from "@/lib/admin/console-types";
import { t } from "@/lib/admin/i18n";
import {
  ACCOUNT_REFUSALS,
  FAMILY_TAB_LABEL,
  accountRefusalText,
  accountTabHref,
  emailMatches,
  familyName,
  familyPagePath,
  familyTabHref,
  familyTabLabel,
  firstParam,
  listToStrings,
  parseAccountRefusal,
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

describe("account refusals", () => {
  it("reads only the exact codes the account actions send", () => {
    for (const refusal of ACCOUNT_REFUSALS) expect(parseAccountRefusal(refusal)).toBe(refusal);
    expect(parseAccountRefusal(["audit_failed", "admin_target"])).toBe("audit_failed");
    expect(parseAccountRefusal("audit_failed ")).toBeNull();
    expect(parseAccountRefusal("AUDIT_FAILED")).toBeNull();
    expect(parseAccountRefusal("other")).toBeNull();
    expect(parseAccountRefusal("toString")).toBeNull();
    expect(parseAccountRefusal("")).toBeNull();
    expect(parseAccountRefusal(undefined)).toBeNull();
  });

  it("returns to the account tab, with the refusal when there is one, and round-trips", () => {
    expect(accountTabHref(ID)).toBe(`/admin/subscribers/${ID}?tab=account`);
    expect(accountTabHref(ID)).toBe(familyTabHref(ID, "account"));
    expect(accountTabHref(ID, "admin_check_failed")).toBe(
      `/admin/subscribers/${ID}?tab=account&error=admin_check_failed`,
    );
    for (const refusal of ACCOUNT_REFUSALS) {
      const query = new URL(accountTabHref(ID, refusal), "https://x.test").searchParams;
      expect(parseFamilyTab(query.get("tab"))).toBe("account");
      expect(parseAccountRefusal(query.get("error"))).toBe(refusal);
    }
  });

  it("states every refusal in both languages, and that nothing happened", () => {
    for (const refusal of ACCOUNT_REFUSALS) {
      for (const locale of ["ar", "en"] as const) {
        const text = accountRefusalText(refusal, locale);
        expect(text.length).toBeGreaterThan(20);
        expect(text).not.toContain("!");
      }
    }
    const ar = ACCOUNT_REFUSALS.map((refusal) => accountRefusalText(refusal, "ar"));
    expect(new Set(ar).size).toBe(ACCOUNT_REFUSALS.length);
    // A failed admin check says so — it never claims the account is an admin's.
    expect(accountRefusalText("admin_check_failed", "en")).toContain("Couldn’t confirm");
    expect(accountRefusalText("admin_check_failed", "en")).toContain("nothing was changed");
    expect(accountRefusalText("admin_target", "ar")).toContain("حساب مشرف");
    expect(accountRefusalText("email_mismatch", "ar")).toContain("فلم يُحذف شيء");
    // The sentences the page already had for these two facts.
    expect(accountRefusalText("audit_failed", "en")).toBe(t("audit_write_failed", "en"));
    expect(accountRefusalText("email_unavailable", "ar")).toBe(t("fp_delete_no_email", "ar"));
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
