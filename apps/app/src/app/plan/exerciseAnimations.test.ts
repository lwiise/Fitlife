import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EXERCISE_CATALOG, FALLBACK_BY_PATTERN } from "@fitlife/plan-engine";

// The viewer requests /lottie/exercises/<exercise_id>.json for any id the
// engine emits — every catalog id (and pattern fallback) must have a bundled,
// valid Lottie file, or a row would expand into a broken animation.
const ANIM_DIR = join(process.cwd(), "public", "lottie", "exercises");

describe("exercise animation assets", () => {
  const files = new Set(
    readdirSync(ANIM_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, "")),
  );

  it("every catalog exercise has its animation file", () => {
    const missing = EXERCISE_CATALOG.filter((e) => !files.has(e.id)).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it("every pattern fallback points at a bundled animation", () => {
    for (const id of Object.values(FALLBACK_BY_PATTERN)) {
      expect(files.has(id)).toBe(true);
    }
  });

  it("no orphan animation files (kept in lockstep with the catalog)", () => {
    const catalogIds = new Set(EXERCISE_CATALOG.map((e) => e.id));
    const orphans = [...files].filter((f) => !catalogIds.has(f));
    expect(orphans).toEqual([]);
  });

  it("each file is a valid looping Lottie sized for the card", () => {
    for (const id of files) {
      const lottie = JSON.parse(readFileSync(join(ANIM_DIR, `${id}.json`), "utf8")) as {
        w: number;
        h: number;
        op: number;
        fr: number;
        layers: unknown[];
      };
      expect(lottie.w).toBe(512);
      expect(lottie.h).toBe(512);
      expect(lottie.fr).toBe(30);
      expect(lottie.op).toBeGreaterThan(30);
      expect(lottie.layers.length).toBeGreaterThan(5);
    }
  });
});
