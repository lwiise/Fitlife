import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/admin";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { PhoneBarTitle } from "./PhoneBarTitle";

const render = () => renderToString(createElement(PhoneBarTitle, { labels: { families: "العائلات" } }));
const ID = "63636363-0000-4000-8000-000000000001";

beforeEach(() => {
  pathname = "/admin";
});

describe("PhoneBarTitle — the phone's one bar", () => {
  it("names the families list in the bar (the page keeps its heading for assistive tech)", () => {
    pathname = "/admin/families";
    const out = render();
    expect(out).toContain('class="ad-top-title ad-phone-only"');
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain("العائلات");
    expect(out).not.toContain("<a");
  });

  it("links a family's page back to the families list", () => {
    for (const path of [`/admin/subscribers/${ID}`, `/admin/subscribers/${ID}/`]) {
      pathname = path;
      const out = render();
      // The server renders the plain list; the saved view applies on hydration.
      expect(out).toContain('href="/admin/families?view=all"');
      expect(out).toContain("ad-ph-back ad-phone-only");
    }
  });

  it("leaves every other page its own heading and way back", () => {
    for (const path of [
      "/admin",
      `/admin/subscribers/${ID}/health`,
      `/admin/subscribers/${ID}/plan/${ID}`,
      `/admin/subscribers/${ID}/workout/${ID}`,
      "/admin/insights",
    ]) {
      pathname = path;
      expect(render(), path).toBe("");
    }
  });
});
