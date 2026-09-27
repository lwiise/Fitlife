import { describe, expect, it } from "vitest";
import { activeNavKey, isFocusRoute, NAV_ITEMS } from "./nav";

describe("app navigation", () => {
  it("has exactly the five approved tabs, in order", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "الرئيسية",
      "الخطة",
      "المستشارة",
      "العائلة",
      "حسابي",
    ]);
  });

  it("maps every signed-in page to its tab", () => {
    expect(activeNavKey("/dashboard")).toBe("home");
    expect(activeNavKey("/recap")).toBe("home");
    expect(activeNavKey("/plan")).toBe("plan");
    expect(activeNavKey("/plan/history/abc")).toBe("plan");
    expect(activeNavKey("/chat")).toBe("chat");
    expect(activeNavKey("/family/edit/x/health")).toBe("family");
    expect(activeNavKey("/profile/health")).toBe("account");
    expect(activeNavKey("/subscription")).toBe("account");
    expect(activeNavKey("/journey")).toBe("account");
    expect(activeNavKey("/settings")).toBe("account");
  });

  it("does not treat a prefix of a word as a match", () => {
    expect(activeNavKey("/planner")).toBeNull();
    expect(activeNavKey("/chats")).toBeNull();
  });

  it("drops the shell only for the wizard and the cook's view", () => {
    expect(isFocusRoute("/family/add")).toBe(true);
    expect(isFocusRoute("/family/add/housekeeper")).toBe(true);
    expect(isFocusRoute("/plan/housekeeper")).toBe(true);
    expect(isFocusRoute("/family")).toBe(false);
    expect(isFocusRoute("/family/edit/x")).toBe(false);
    expect(isFocusRoute("/plan")).toBe(false);
  });
});
