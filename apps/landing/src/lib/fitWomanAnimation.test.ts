import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The closing section's Lottie ships in BOTH copies of the offer page
// (apps/landing and the app's /landing route) and is generated, never
// hand-edited: `node scripts/fit-woman-lottie/generate.mjs` writes both.
// These guard the ways that arrangement can rot — an edit to one copy, an
// asset that quietly grows too heavy to lazy-load, and a loop that no longer
// closes on the pose it opened with.
const here = dirname(fileURLToPath(import.meta.url));
const landingCopy = join(here, "..", "..", "public", "lottie", "fit-woman.json");
const appCopy = join(
  here,
  "..",
  "..",
  "..",
  "app",
  "public",
  "lottie",
  "fit-woman.json",
);

describe("fit-woman animation", () => {
  it("is byte-identical in both copies of the offer page", () => {
    expect(readFileSync(appCopy)).toEqual(readFileSync(landingCopy));
  });

  it("is a valid, self-contained Lottie composition", () => {
    const anim = JSON.parse(readFileSync(landingCopy, "utf8"));
    expect(anim.v).toBeTypeOf("string");
    expect(anim.fr).toBeGreaterThan(0);
    expect(anim.op).toBeGreaterThan(anim.ip);
    expect(Array.isArray(anim.layers)).toBe(true);
    expect(anim.layers.length).toBeGreaterThan(0);
    // Must load straight from /public with no companion files.
    expect(anim.assets).toEqual([]);
  });

  it("reserves the 4:5 box the component paints into", () => {
    const anim = JSON.parse(readFileSync(landingCopy, "utf8"));
    // FitWomanLottie renders `aspect-[4/5]`; a mismatch would letterbox her.
    expect(anim.w / anim.h).toBeCloseTo(4 / 5, 3);
  });

  it("loops seamlessly — every animated property ends where it began", () => {
    const anim = JSON.parse(readFileSync(landingCopy, "utf8"));
    const seams: string[] = [];
    for (const layer of anim.layers) {
      for (const [prop, value] of Object.entries(layer.ks) as [
        string,
        { a: number; k: { t: number; s: number[] }[] },
      ][]) {
        if (value.a !== 1) continue;
        const keys = value.k;
        const first = keys.at(0);
        const last = keys.at(-1);
        if (!first || !last) continue;
        // Only properties keyed across the whole loop have to rejoin; the
        // sparks deliberately start and end at rest inside the window.
        if (first.t !== 0 || last.t !== anim.op) continue;
        if (JSON.stringify(first.s) !== JSON.stringify(last.s)) {
          seams.push(`${layer.nm}.${prop}`);
        }
      }
    }
    expect(seams).toEqual([]);
  });

  it("stays small enough to lazy-load without a budget fight", () => {
    // ~27 KB raw, a couple of KB over the wire once gzipped.
    expect(statSync(landingCopy).size).toBeLessThan(64 * 1024);
  });
});
