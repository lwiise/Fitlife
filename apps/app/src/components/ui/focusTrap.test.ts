import { afterEach, describe, expect, it, vi } from "vitest";
import { trapTab } from "./focusTrap";

// The app's tests run in node (no DOM), and trapTab touches only a handful of
// DOM members — so it is exercised against minimal fakes of exactly those.

type FakeEl = { name: string; focus: () => void; getClientRects: () => unknown[] };

function setup(opts: { hidden?: string[] } = {}) {
  const doc = { activeElement: null as unknown };
  vi.stubGlobal("document", doc);
  const mk = (name: string): FakeEl => ({
    name,
    focus() {
      doc.activeElement = this;
    },
    getClientRects: () => (opts.hidden?.includes(name) ? [] : [{}]),
  });
  const items = ["radio", "textarea", "cancel", "confirm"].map(mk);
  const panel = {
    querySelectorAll: () => items,
    contains: (n: unknown) => n === panel || items.includes(n as FakeEl),
  };
  const outside = mk("page-button");
  const key = (k: string, shiftKey = false) => {
    const e = { key: k, shiftKey, preventDefault: vi.fn() };
    trapTab(e as unknown as KeyboardEvent, panel as unknown as HTMLElement);
    return e;
  };
  const focused = () => (doc.activeElement as FakeEl | null)?.name ?? doc.activeElement;
  return { doc, items, panel, outside, key, focused };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("trapTab", () => {
  it("wraps Tab from the last control to the first, and Shift+Tab back", () => {
    const { items, key, focused } = setup();
    items[3]!.focus();
    expect(key("Tab").preventDefault).toHaveBeenCalled();
    expect(focused()).toBe("radio");
    expect(key("Tab", true).preventDefault).toHaveBeenCalled();
    expect(focused()).toBe("confirm");
  });

  it("leaves Tab alone between two inner controls", () => {
    const { items, key, focused } = setup();
    items[1]!.focus();
    expect(key("Tab").preventDefault).not.toHaveBeenCalled();
    expect(focused()).toBe("textarea");
  });

  // A dialog with a form focuses its own panel on open: the first Tab must land
  // on the first control, not escape to the sheet or page behind.
  it("moves in from the panel itself", () => {
    const { doc, panel, key, focused } = setup();
    doc.activeElement = panel;
    key("Tab");
    expect(focused()).toBe("radio");
    doc.activeElement = panel;
    key("Tab", true);
    expect(focused()).toBe("confirm");
  });

  it("pulls focus back in from outside the panel", () => {
    const { outside, key, focused } = setup();
    outside.focus();
    key("Tab");
    expect(focused()).toBe("radio");
  });

  it("skips controls that are not rendered", () => {
    const { items, key, focused } = setup({ hidden: ["confirm"] });
    items[2]!.focus();
    key("Tab");
    expect(focused()).toBe("radio");
  });

  it("ignores every key but Tab", () => {
    const { items, key, focused } = setup();
    items[3]!.focus();
    expect(key("Escape").preventDefault).not.toHaveBeenCalled();
    expect(focused()).toBe("confirm");
  });
});
