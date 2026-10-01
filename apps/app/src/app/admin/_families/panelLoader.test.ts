import { describe, expect, it } from "vitest";
import type { FamilyPanelData } from "@/lib/admin/console-types";
import { PANEL_FAMILY_GONE, PANEL_NOT_FOUND, PANEL_UNAVAILABLE } from "@/lib/admin/panelResponse";
import {
  PANEL_CACHE_MAX,
  PANEL_TTL_MS,
  PanelLoader,
  isPanelData,
  panelUrl,
  type PanelFetcher,
} from "./panelLoader";

const PANEL = { header: {}, meal: {}, workout: {}, household: [] } as unknown as FamilyPanelData;

interface Call {
  url: string;
  init: RequestInit;
  signal: AbortSignal;
  respond: (status: number, body?: unknown) => void;
  fail: (error: unknown) => void;
}

/** A fetch whose answers the test hands out; an abort rejects like the real one. */
function fakeFetch() {
  const calls: Call[] = [];
  const fetcher: PanelFetcher = (url, init) =>
    new Promise<Response>((resolve, reject) => {
      const signal = init.signal as AbortSignal;
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      calls.push({
        url,
        init,
        signal,
        respond: (status, body) =>
          resolve(
            new Response(typeof body === "string" ? body : JSON.stringify(body ?? {}), {
              status,
              headers: { "content-type": "application/json" },
            }),
          ),
        fail: reject,
      });
    });
  return { calls, fetcher };
}

function setup() {
  const clock = { at: Date.UTC(2026, 8, 30, 9), now: () => clock.at, todayIso: () => "2026-09-30" };
  const { calls, fetcher } = fakeFetch();
  const loader = new PanelLoader(fetcher, clock);
  return { clock, calls, loader };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("PanelLoader", () => {
  it("fetches a family once, uncached, and keeps the answer with its now and today", async () => {
    const { calls, loader, clock } = setup();
    const pending = loader.load(id(1));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`/api/admin/families/${id(1)}`);
    expect(calls[0]?.init.cache).toBe("no-store");
    calls[0]?.respond(200, PANEL);
    const entry = await pending;
    expect(entry?.result).toEqual({ kind: "ok", data: PANEL });
    expect(entry?.nowIso).toBe(new Date(clock.at).toISOString());
    expect(entry?.todayIso).toBe("2026-09-30");
    expect(loader.peek(id(1))).toBe(entry);
    expect(loader.isFresh(entry!)).toBe(true);
    expect(loader.isLoading(id(1))).toBe(false);
  });

  it("treats the route's marked 404 as an answer (the family is gone) and caches it", async () => {
    const { calls, loader } = setup();
    const pending = loader.load(id(2));
    calls[0]?.respond(404, PANEL_FAMILY_GONE);
    expect((await pending)?.result).toEqual({ kind: "missing" });
    expect(loader.peek(id(2))?.result.kind).toBe("missing");
  });

  it("reads a bare 404 as lost access, not a missing family — never cached, asked again", async () => {
    const { calls, loader } = setup();
    // A session that ended: the route answers every family with its bare 404.
    for (const body of [PANEL_NOT_FOUND, "not json", undefined]) {
      const pending = loader.load(id(30));
      calls[calls.length - 1]?.respond(404, body);
      expect((await pending)?.result).toEqual({ kind: "denied" });
      expect(loader.peek(id(30))).toBeUndefined();
    }
    // An unseen hover prefetch that met it leaves nothing behind: the open
    // that follows asks the route again, and gets the family.
    loader.prefetch(id(31));
    calls[calls.length - 1]?.respond(404, PANEL_NOT_FOUND);
    await flush();
    expect(loader.peek(id(31))).toBeUndefined();
    const before = calls.length;
    const open = loader.load(id(31));
    expect(calls).toHaveLength(before + 1);
    calls[calls.length - 1]?.respond(200, PANEL);
    expect((await open)?.result.kind).toBe("ok");
  });

  it("asks again after a 503 (the admin lookup failed)", async () => {
    const { calls, loader } = setup();
    const pending = loader.load(id(32));
    calls[0]?.respond(503, PANEL_UNAVAILABLE);
    expect((await pending)?.result).toEqual({ kind: "error" });
    expect(loader.peek(id(32))).toBeUndefined();
  });

  it("never caches a failure, so the next open tries again", async () => {
    const { calls, loader } = setup();
    const failures: Array<(call: Call) => void> = [
      (call) => call.respond(500, { error: "Failed to load" }),
      (call) => call.respond(200, "not json"),
      (call) => call.respond(200, { header: {} }),
      (call) => call.fail(new TypeError("network down")),
    ];
    for (const [i, failure] of failures.entries()) {
      const pending = loader.load(id(10 + i));
      failure(calls[calls.length - 1]!);
      expect((await pending)?.result).toEqual({ kind: "error" });
      expect(loader.peek(id(10 + i))).toBeUndefined();
    }
  });

  it("adopts a running prefetch when that family is opened — one fetch, one audit row", async () => {
    const { calls, loader } = setup();
    loader.prefetch(id(3));
    const pending = loader.load(id(3));
    expect(calls).toHaveLength(1);
    calls[0]?.respond(200, PANEL);
    expect((await pending)?.result.kind).toBe("ok");
    // And a later prefetch of a cached family does nothing.
    loader.prefetch(id(3));
    expect(calls).toHaveLength(1);
  });

  it("keeps one prefetch in flight: a newer one aborts the older", async () => {
    const { calls, loader } = setup();
    loader.prefetch(id(4));
    loader.prefetch(id(5));
    expect(calls).toHaveLength(2);
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(calls[1]?.signal.aborted).toBe(false);
    await flush();
    expect(loader.isLoading(id(4))).toBe(false);
    expect(loader.isLoading(id(5))).toBe(true);
  });

  it("never lets a prefetch abort the open family's request", async () => {
    const { calls, loader } = setup();
    const pending = loader.load(id(6));
    loader.prefetch(id(7));
    loader.prefetch(id(8));
    expect(calls[0]?.signal.aborted).toBe(false);
    expect(calls[1]?.signal.aborted).toBe(true);
    calls[0]?.respond(200, PANEL);
    expect((await pending)?.result.kind).toBe("ok");
  });

  it("aborts the previous open request when another family opens", async () => {
    const { calls, loader } = setup();
    const first = loader.load(id(9));
    const second = loader.load(id(20));
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(await first).toBeNull();
    calls[1]?.respond(200, PANEL);
    expect((await second)?.id).toBe(id(20));
    expect(loader.peek(id(9))).toBeUndefined();
  });

  it("abortOpen drops the open request and leaves prefetches running", async () => {
    const { calls, loader } = setup();
    const pending = loader.load(id(21));
    loader.prefetch(id(22));
    loader.abortOpen();
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(calls[1]?.signal.aborted).toBe(false);
    expect(await pending).toBeNull();
    loader.abortAll();
    expect(calls[1]?.signal.aborted).toBe(true);
  });

  it("goes stale after the TTL, and still offers the stale answer to show while refreshing", async () => {
    const { calls, loader, clock } = setup();
    const pending = loader.load(id(23));
    calls[0]?.respond(200, PANEL);
    const entry = (await pending)!;
    clock.at += PANEL_TTL_MS - 1;
    expect(loader.isFresh(entry)).toBe(true);
    clock.at += 1;
    expect(loader.isFresh(entry)).toBe(false);
    expect(loader.peek(id(23))).toBe(entry);
  });

  it("keeps at most PANEL_CACHE_MAX families, least recently used first out", async () => {
    const { calls, loader } = setup();
    for (let n = 0; n < PANEL_CACHE_MAX; n += 1) {
      const pending = loader.load(id(100 + n));
      calls[calls.length - 1]?.respond(200, PANEL);
      await pending;
    }
    // Touch the oldest, then add one more: the second-oldest goes.
    expect(loader.peek(id(100))).toBeDefined();
    const pending = loader.load(id(999));
    calls[calls.length - 1]?.respond(200, PANEL);
    await pending;
    expect(loader.peek(id(100))).toBeDefined();
    expect(loader.peek(id(101))).toBeUndefined();
    expect(loader.peek(id(999))).toBeDefined();
  });
});

describe("panel helpers", () => {
  it("builds the route URL and recognises its answer", () => {
    expect(panelUrl(id(1))).toBe(`/api/admin/families/${id(1)}`);
    expect(isPanelData(PANEL)).toBe(true);
    expect(isPanelData(null)).toBe(false);
    expect(isPanelData({ header: {}, meal: {}, workout: {} })).toBe(false);
    expect(isPanelData({ error: "Not found" })).toBe(false);
  });
});
