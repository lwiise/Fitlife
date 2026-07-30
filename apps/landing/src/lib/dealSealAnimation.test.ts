import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The closing section's Lottie ships in BOTH copies of the offer page
// (apps/landing and the app's /landing route) and is generated, never
// hand-edited: `node scripts/deal-seal-lottie/generate.mjs` writes both.
// These guard the two ways that arrangement can rot — an edit to one copy, and
// an asset that quietly grows into something too heavy to lazy-load.
const here = dirname(fileURLToPath(import.meta.url));
const landingCopy = join(here, "..", "..", "public", "lottie", "deal-seal.json");
const appCopy = join(
  here,
  "..",
  "..",
  "..",
  "app",
  "public",
  "lottie",
  "deal-seal.json",
);

describe("deal-seal animation", () => {
  it("is byte-identical in both copies of the offer page", () => {
    expect(readFileSync(appCopy)).toEqual(readFileSync(landingCopy));
  });

  it("is a valid, looping Lottie composition", () => {
    const anim = JSON.parse(readFileSync(landingCopy, "utf8"));
    expect(anim.v).toBeTypeOf("string");
    expect(anim.fr).toBeGreaterThan(0);
    expect(anim.op).toBeGreaterThan(anim.ip);
    expect(anim.w).toBe(anim.h); // the component reserves an aspect-square box
    expect(Array.isArray(anim.layers)).toBe(true);
    expect(anim.layers.length).toBeGreaterThan(0);
    // No external assets: the file must be self-contained to load from /public.
    expect(anim.assets).toEqual([]);
  });

  it("stays small enough to lazy-load without a budget fight", () => {
    // ~20 KB raw, under 2 KB over the wire once gzipped.
    expect(statSync(landingCopy).size).toBeLessThan(64 * 1024);
  });
});
