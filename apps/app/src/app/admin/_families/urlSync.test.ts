import { describe, expect, it } from "vitest";
import { TYPING_WRITE_DELAY_MS } from "./listModel";
import { UrlSync, type UrlHost } from "./urlSync";

const PATH = "/admin/families";

/** A document location, a history log and a hand-driven clock. */
function fakeHost(search = "", hash = "") {
  const doc = { pathname: PATH, search: search ? `?${search}` : "", hash };
  const writes: string[] = [];
  const timers = new Map<number, { run: () => void; at: number }>();
  let now = 0;
  let seq = 0;
  const host: UrlHost = {
    location: () => ({ ...doc }),
    replace: (url) => {
      writes.push(url);
      const next = new URL(url, "https://admin.test");
      doc.pathname = next.pathname;
      doc.search = next.search;
      doc.hash = next.hash;
    },
    setTimeout: (run, ms) => {
      seq += 1;
      timers.set(seq, { run, at: now + ms });
      return seq;
    },
    clearTimeout: (id) => {
      if (id !== undefined) timers.delete(id);
    },
  };
  return {
    host,
    doc,
    writes,
    /** Let `ms` pass, running the timers that fall due. */
    tick(ms: number) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.run();
        }
      }
    },
    /** A navigation committed: the document is on another page now. */
    navigate(pathname: string, search = "") {
      doc.pathname = pathname;
      doc.search = search ? `?${search}` : "";
    },
  };
}

describe("UrlSync — writing", () => {
  it("writes anything but the search text at once, keeping the hash", () => {
    const f = fakeHost("", "#top");
    const sync = new UrlSync(f.host);
    sync.push(PATH, "view=attention");
    expect(f.writes).toEqual([`${PATH}?view=attention#top`]);
    sync.push(PATH, "");
    expect(f.writes.at(-1)).toBe(`${PATH}#top`);
  });

  it("waits while the operator types: one history write for a burst of keystrokes", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.push(PATH, "q=a");
    f.tick(100);
    sync.push(PATH, "q=ab");
    f.tick(100);
    sync.push(PATH, "q=abc");
    expect(f.writes).toEqual([]);
    f.tick(TYPING_WRITE_DELAY_MS);
    expect(f.writes).toEqual([`${PATH}?q=abc`]);
  });

  it("writes nothing when the URL already says it, and drops a write that became moot", () => {
    const f = fakeHost("view=active");
    const sync = new UrlSync(f.host);
    sync.push(PATH, "view=active");
    sync.push(PATH, "view=active&q=x");
    sync.push(PATH, "view=active"); // typed, then deleted
    f.tick(TYPING_WRITE_DELAY_MS * 2);
    expect(f.writes).toEqual([]);
  });

  it("flush() writes what waits now; with nothing waiting it does nothing", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.flush();
    expect(f.writes).toEqual([]);
    sync.push(PATH, "q=hind");
    sync.flush();
    expect(f.writes).toEqual([`${PATH}?q=hind`]);
    f.tick(TYPING_WRITE_DELAY_MS);
    expect(f.writes).toHaveLength(1);
  });

  it("cancel() drops what waits", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.push(PATH, "q=hind");
    sync.cancel();
    f.tick(TYPING_WRITE_DELAY_MS);
    expect(f.writes).toEqual([]);
  });

  it("never writes onto another page's history entry", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.push(PATH, "q=hind");
    f.navigate("/admin/subscribers/abc");
    f.tick(TYPING_WRITE_DELAY_MS);
    sync.flush();
    sync.push(PATH, "view=attention");
    expect(f.writes).toEqual([]);
    expect(f.doc.pathname).toBe("/admin/subscribers/abc");
  });
});

describe("UrlSync — leaving (hold)", () => {
  it("writes the search that waits BEFORE the navigation, never after it (tap within 300ms of typing)", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.push(PATH, "q=hin");
    sync.hold(); // the card tap: the console calls router.push right after
    expect(f.writes).toEqual([`${PATH}?q=hin`]);
    f.tick(TYPING_WRITE_DELAY_MS * 2);
    expect(f.writes).toHaveLength(1);
  });

  it("refuses every write while held (↓ then ⏎: the late panel open writes nothing)", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    const token = sync.hold();
    sync.holdShown(token);
    sync.push(PATH, "open=00000000-0000-4000-8000-000000000001");
    sync.push(PATH, "q=x");
    f.tick(TYPING_WRITE_DELAY_MS);
    expect(sync.isHeld()).toBe(true);
    expect(f.writes).toEqual([]);
  });

  it("ends only after its pending state was on screen and gone again", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    const token = sync.hold();
    // A render that ran before the hold knows nothing of it: kept.
    sync.holdGone();
    expect(sync.isHeld()).toBe(true);
    sync.holdShown(token);
    expect(sync.isHeld()).toBe(true);
    // The navigation settled and the page stayed.
    sync.holdGone();
    expect(sync.isHeld()).toBe(false);
    sync.push(PATH, "view=ended");
    expect(f.writes).toEqual([`${PATH}?view=ended`]);
  });

  it("a newer hold is not ended by an older one's pending state", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    const first = sync.hold();
    sync.hold();
    sync.holdShown(first);
    sync.holdGone();
    expect(sync.isHeld()).toBe(true);
  });
});

describe("UrlSync — a navigation the console did not start (a link elsewhere)", () => {
  it("writes nothing while it is on its way — a sort, a filter, a keystroke all wait", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.navigationStarted(); // the rail's «نظرة عامة» took the click
    sync.push(PATH, "sort=beneficiaries");
    sync.push(PATH, "tier=starter");
    sync.push(PATH, "tier=starter&q=hind");
    f.tick(TYPING_WRITE_DELAY_MS * 2);
    sync.flush(); // a pointer press, the search box losing focus
    expect(f.writes).toEqual([]);
    expect(sync.isPaused()).toBe(true);
    // Only the console's own leaving refuses a panel open; a pause does not.
    expect(sync.isHeld()).toBe(false);
  });

  it("drops a typed write that was waiting when the link took the click", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.push(PATH, "q=hin");
    sync.navigationStarted();
    f.tick(TYPING_WRITE_DELAY_MS * 2);
    expect(f.writes).toEqual([]);
  });

  it("ends when a URL from outside arrives, and the list writes again", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.navigationStarted();
    // The frame's own push replaced the navigation and landed on this page.
    f.doc.search = "?view=attention";
    sync.settle("view=attention");
    expect(sync.isPaused()).toBe(false);
    sync.push(PATH, "view=attention&sort=status&dir=asc");
    expect(f.writes).toEqual([`${PATH}?view=attention&sort=status&dir=asc`]);
  });

  it("is not ended by the echo of the console's own earlier write", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.push(PATH, "view=active"); // written before the click
    sync.navigationStarted();
    sync.settle("view=active"); // its echo renders while the link's page loads
    expect(sync.isPaused()).toBe(true);
    sync.push(PATH, "view=active&sort=status");
    expect(f.writes).toEqual([`${PATH}?view=active`]);
  });

  it("ends when the browser moves to another entry (back/forward replaced it)", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.navigationStarted();
    sync.navigationEnded();
    sync.push(PATH, "page=2");
    expect(f.writes).toEqual([`${PATH}?page=2`]);
  });

  it("gives way to the console's own leaving, whose hold then decides", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.navigationStarted();
    const token = sync.hold(); // Enter on a row: a newer navigation
    expect(sync.isHeld()).toBe(true);
    sync.holdShown(token);
    sync.holdGone(); // that navigation settled and the page stayed
    expect(sync.isPaused()).toBe(false);
    sync.push(PATH, "view=ended");
    expect(f.writes).toEqual([`${PATH}?view=ended`]);
  });
});

describe("UrlSync — echoes", () => {
  it("knows its own writes until their echo is seen", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.push(PATH, "view=attention");
    expect(sync.isOwnEcho("view=attention")).toBe(true);
    expect(sync.isOwnEcho("view=active")).toBe(false);
    sync.settle("view=attention");
    expect(sync.isOwnEcho("view=attention")).toBe(false);
  });

  it("an echo that lands after the next keystroke is still recognised (no older text put back)", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.push(PATH, "q=ab");
    f.tick(TYPING_WRITE_DELAY_MS); // «ab» written
    sync.push(PATH, "q=abc"); // «c» typed before the echo rendered
    // The echo of «ab» arrives: the console must not adopt it.
    expect(sync.isOwnEcho("q=ab")).toBe(true);
    sync.settle("q=ab");
    f.tick(TYPING_WRITE_DELAY_MS);
    expect(f.writes).toEqual([`${PATH}?q=ab`, `${PATH}?q=abc`]);
    expect(sync.isOwnEcho("q=abc")).toBe(true);
  });

  it("an echo retires every earlier write (echoes can arrive as one)", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.push(PATH, "sort=status&dir=asc");
    sync.push(PATH, "sort=signupAt");
    sync.settle("sort=signupAt");
    expect(sync.isOwnEcho("sort=status&dir=asc")).toBe(false);
    expect(sync.isOwnEcho("sort=signupAt")).toBe(false);
  });

  it("a URL from outside forgets every write still awaiting its echo", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    sync.push(PATH, "view=attention");
    sync.settle("view=active"); // back/forward, a link
    expect(sync.isOwnEcho("view=attention")).toBe(false);
  });

  it("remembers a bounded number of writes", () => {
    const f = fakeHost();
    const sync = new UrlSync(f.host);
    for (let page = 2; page <= 40; page += 1) sync.push(PATH, `page=${page}`);
    expect(sync.isOwnEcho("page=40")).toBe(true);
    expect(sync.isOwnEcho("page=2")).toBe(false);
  });

  it("a write skipped because the URL already said it is not awaited", () => {
    const f = fakeHost("view=active");
    const sync = new UrlSync(f.host);
    sync.push(PATH, "view=active");
    expect(sync.isOwnEcho("view=active")).toBe(false);
  });
});
