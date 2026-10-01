import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminContext = vi.fn();
const getAdminLocale = vi.fn();
vi.mock("@/lib/admin/auth", () => ({ getAdminContext: () => getAdminContext() }));
vi.mock("@/lib/admin/locale", () => ({ getAdminLocale: () => getAdminLocale() }));

import { consoleLayoutMetadata, familyPageMetadata, pageMetadata } from "./titles";

const ID = "63636363-0000-4000-8000-000000000001";
const ADMIN = { userId: "admin-1", email: "ops@example.com", role: "super_admin" };

beforeEach(() => {
  getAdminContext.mockReset().mockResolvedValue(ADMIN);
  getAdminLocale.mockReset().mockResolvedValue("ar");
});

describe("console titles", () => {
  it("frames every admin page in the console's own name, never the consumer app's", async () => {
    expect(await consoleLayoutMetadata()).toEqual({
      title: { absolute: "لوحة تحكم Fit Life", template: "%s | لوحة تحكم Fit Life" },
    });
    getAdminLocale.mockResolvedValue("en");
    expect(await consoleLayoutMetadata()).toEqual({
      title: { absolute: "Fit Life Admin", template: "%s | Fit Life Admin" },
    });
  });

  it("names a page in the admin's language", async () => {
    expect(await pageMetadata("nav_overview")).toEqual({ title: "نظرة عامة" });
    getAdminLocale.mockResolvedValue("en");
    expect(await pageMetadata("sh_families")).toEqual({ title: "Families" });
  });

  it("names a family's view after the family", async () => {
    const loadName = vi.fn().mockResolvedValue("هند القحطاني");
    const meta = await familyPageMetadata(ID.toUpperCase(), loadName, (name) => ["الخطة الغذائية", name]);
    expect(meta).toEqual({ title: "الخطة الغذائية، هند القحطاني" });
    expect(loadName).toHaveBeenCalledWith(ID);
  });

  it("reads no name for anyone but an admin, nor for a malformed id", async () => {
    const loadName = vi.fn().mockResolvedValue("هند القحطاني");
    getAdminContext.mockResolvedValue(null);
    expect(await familyPageMetadata(ID, loadName, (name) => ["الخطة الغذائية", name])).toEqual({
      title: "الخطة الغذائية",
    });
    getAdminContext.mockResolvedValue(ADMIN);
    await familyPageMetadata("not-a-uuid", loadName, (name) => [name]);
    expect(loadName).not.toHaveBeenCalled();
  });

  it("leaves a failed name out, and keeps the app name when nothing is left", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("db down"));
    expect(await familyPageMetadata(ID, failing, (name) => ["التفاصيل الصحية", name])).toEqual({
      title: "التفاصيل الصحية",
    });
    expect(await familyPageMetadata(ID, failing, (name) => [name])).toEqual({});
  });
});
