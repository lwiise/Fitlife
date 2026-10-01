import { describe, expect, it } from "vitest";
import { SCRIPTED_FIELD, toggleReturn } from "./toggleReturn";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("toggleReturn", () => {
  it("refreshes the route the router is on for a scripted post, whatever `next` says", () => {
    // Pressed while «٧ أيام» was still loading: the form still carried the
    // page being left. Redirecting there undid the range just chosen.
    expect(toggleReturn(form({ [SCRIPTED_FIELD]: "1", next: "/admin" }))).toEqual({ kind: "refresh" });
    expect(toggleReturn(form({ [SCRIPTED_FIELD]: "1" }))).toEqual({ kind: "refresh" });
  });

  it("redirects a plain HTML post to the path the server rendered into the form", () => {
    expect(toggleReturn(form({ next: "/admin/families?view=attention" }))).toEqual({
      kind: "redirect",
      to: "/admin/families?view=attention",
    });
    // The field's empty default (onSubmit never ran) is not scripted.
    expect(toggleReturn(form({ [SCRIPTED_FIELD]: "", next: "/admin?range=7d" }))).toEqual({
      kind: "redirect",
      to: "/admin?range=7d",
    });
  });

  it("never redirects outside the console", () => {
    for (const next of ["https://evil.example", "//evil.example", "/dashboard", ""]) {
      expect(toggleReturn(form({ next }))).toEqual({ kind: "redirect", to: "/admin" });
    }
    expect(toggleReturn(form({}))).toEqual({ kind: "redirect", to: "/admin" });
  });
});
