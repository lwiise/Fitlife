import { describe, expect, it } from "vitest";
import {
  OWN_LINK_ATTR,
  awayAfter,
  clickStartsNavigation,
  mayWriteUrl,
  ownLink,
  type NavSignal,
  type SeenClick,
} from "./navWatch";

const ORIGIN = "http://localhost:3011";

/** A plain primary click that Next's <Link> took, on a rail link. */
function click(p: Partial<SeenClick> = {}): SeenClick {
  return {
    defaultPrevented: true,
    button: 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    link: { href: `${ORIGIN}/admin/families`, target: "", download: false, own: false },
    ...p,
  };
}

const link = (href: string, extra: Partial<NonNullable<SeenClick["link"]>> = {}) => ({
  link: { href, target: "", download: false, own: false, ...extra },
});

describe("clickStartsNavigation", () => {
  it("sees a link the router took — a rail, top-bar or drawer link", () => {
    expect(clickStartsNavigation(click(), ORIGIN)).toBe(true);
    expect(
      clickStartsNavigation(click(link(`${ORIGIN}/admin/subscribers/abc?tab=meal`)), ORIGIN),
    ).toBe(true);
  });

  it("counts a link to the overview's own path: the rail's «نظرة عامة» and the brand navigate too", () => {
    expect(clickStartsNavigation(click(link(`${ORIGIN}/admin`)), ORIGIN)).toBe(true);
    expect(clickStartsNavigation(click(link(`${ORIGIN}/admin?range=7d`)), ORIGIN)).toBe(true);
  });

  it("leaves the links the overview follows itself to its transition", () => {
    // A preset or an interval: the overview prevents the click and navigates
    // itself — or, on the option already shown, does nothing at all.
    const preset = click(link(`${ORIGIN}/admin?range=7d`, { own: true }));
    expect(clickStartsNavigation(preset, ORIGIN)).toBe(false);
  });

  it("ignores a click no link took", () => {
    expect(clickStartsNavigation(click({ defaultPrevented: false }), ORIGIN)).toBe(false);
    expect(clickStartsNavigation(click({ link: null }), ORIGIN)).toBe(false);
  });

  it("ignores clicks that open elsewhere: other buttons, modifiers, new tabs, downloads", () => {
    expect(clickStartsNavigation(click({ button: 1 }), ORIGIN)).toBe(false);
    for (const key of ["altKey", "ctrlKey", "metaKey", "shiftKey"] as const) {
      expect(clickStartsNavigation(click({ [key]: true }), ORIGIN)).toBe(false);
    }
    const blank = click(link(`${ORIGIN}/admin/families`, { target: "_blank" }));
    expect(clickStartsNavigation(blank, ORIGIN)).toBe(false);
    const self = click(link(`${ORIGIN}/admin/families`, { target: "_self" }));
    expect(clickStartsNavigation(self, ORIGIN)).toBe(true);
    const file = click(link(`${ORIGIN}/export.csv`, { download: true }));
    expect(clickStartsNavigation(file, ORIGIN)).toBe(false);
  });

  it("ignores another origin and an unreadable href", () => {
    expect(clickStartsNavigation(click(link("https://example.com/admin")), ORIGIN)).toBe(false);
    expect(clickStartsNavigation(click(link("http://[")), ORIGIN)).toBe(false);
  });
});

describe("ownLink", () => {
  it("is the attribute the click reader looks for", () => {
    expect(Object.keys(ownLink)).toEqual([OWN_LINK_ATTR]);
    expect(OWN_LINK_ATTR.startsWith("data-")).toBe(true);
  });
});

/** Replays signals from a quiet page; returns `away` after each. */
function replay(...signals: NavSignal[]): boolean[] {
  const out: boolean[] = [];
  let away = false;
  for (const signal of signals) {
    away = awayAfter(away, signal);
    out.push(away);
  }
  return out;
}

const railClick: NavSignal = { kind: "click", click: click(), origin: ORIGIN };
/** A metric tile: a button, no link. */
const tileClick: NavSignal = {
  kind: "click",
  click: click({ defaultPrevented: false, link: null }),
  origin: ORIGIN,
};
const presetClick: NavSignal = {
  kind: "click",
  click: click(link(`${ORIGIN}/admin?range=7d`, { own: true })),
  origin: ORIGIN,
};

describe("awayAfter", () => {
  it("holds from a rail link until the page renders again", () => {
    // The finding: the rail's «العائلات», then a tile 300 ms later.
    expect(replay(railClick, tileClick)).toEqual([true, true]);
    expect(replay(railClick, tileClick, { kind: "render" })).toEqual([true, true, false]);
  });

  it("holds from a ⌘K destination, which the frame announces before it pushes", () => {
    expect(replay({ kind: "request" }, tileClick)).toEqual([true, true]);
    expect(replay({ kind: "request" }, { kind: "render" })).toEqual([true, false]);
  });

  it("ends when the browser moves to another entry, which replaces what was on its way", () => {
    expect(replay(railClick, { kind: "history" })).toEqual([true, false]);
  });

  it("is not started by the overview's own links, so a no-op preset never strands a pick", () => {
    expect(replay(presetClick, tileClick)).toEqual([false, false]);
  });

  it("stays on through clicks that start nothing", () => {
    expect(replay(railClick, presetClick, tileClick)).toEqual([true, true, true]);
  });
});

describe("mayWriteUrl", () => {
  const quiet = { pending: false, away: false, documentPath: "/admin", pagePath: "/admin" };

  it("writes when nothing is loading and the document is on the overview", () => {
    expect(mayWriteUrl(quiet)).toBe(true);
  });

  it("waits for the overview's own navigation", () => {
    expect(mayWriteUrl({ ...quiet, pending: true })).toBe(false);
  });

  it("waits for a navigation started elsewhere", () => {
    expect(mayWriteUrl({ ...quiet, away: true })).toBe(false);
  });

  it("never writes onto another page's history entry", () => {
    expect(mayWriteUrl({ ...quiet, documentPath: "/admin/families" })).toBe(false);
  });

  it("follows the finding through: the pick reaches the URL only once the page is back", () => {
    let away = false;
    away = awayAfter(away, railClick);
    expect(mayWriteUrl({ ...quiet, away })).toBe(false);
    away = awayAfter(away, tileClick);
    expect(mayWriteUrl({ ...quiet, away })).toBe(false);
    away = awayAfter(away, { kind: "render" });
    expect(mayWriteUrl({ ...quiet, away })).toBe(true);
  });
});
