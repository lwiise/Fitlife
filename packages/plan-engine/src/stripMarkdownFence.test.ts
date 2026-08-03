import { describe, it, expect } from "vitest";
import { stripMarkdownFence } from "./anthropic";

// Every case below must end up JSON.parse-able, because that is the actual
// contract: generate.ts feeds this straight into JSON.parse, and a SyntaxError
// there costs a whole DAY of the plan (re-rolled six times, then shipped empty).
const parses = (s: string) => JSON.parse(stripMarkdownFence(s));

describe("stripMarkdownFence", () => {
  it("passes through bare JSON", () => {
    expect(parses('{"a":1}')).toEqual({ a: 1 });
  });

  it("unwraps a closed ```json fence", () => {
    expect(parses('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("unwraps a closed bare ``` fence", () => {
    expect(parses('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  // Regression — production, 2026-07-26. The day model opened a ```json fence
  // and never closed it. The old regex required a closing fence at end-of-text,
  // so the raw reply went to JSON.parse and died on the backtick:
  //   Unexpected token '`', "```json\n{"... is not valid JSON
  it("recovers JSON from an UNCLOSED fence", () => {
    expect(parses('```json\n{"day_index":6,"meals":[]}')).toEqual({
      day_index: 6,
      meals: [],
    });
  });

  // Regression — production, 2026-07-25. The model narrated before answering:
  //   Unexpected token 'أ', "أولاً سأحس"... is not valid JSON
  it("recovers JSON after an Arabic prose preamble", () => {
    expect(parses('أولاً سأحسب السعرات لهذا اليوم.\n{"day_index":5,"meals":[]}')).toEqual({
      day_index: 5,
      meals: [],
    });
  });

  it("recovers JSON with prose on BOTH sides", () => {
    expect(parses('إليك الخطة:\n```json\n{"a":1}\n```\nأتمنى أن تعجبك.')).toEqual({ a: 1 });
  });

  it("keeps nested braces intact", () => {
    expect(parses('preamble {"m":{"macros":{"protein_g":40}}} trailing')).toEqual({
      m: { macros: { protein_g: 40 } },
    });
  });

  it("leaves text with no object alone, so the caller fails exactly as before", () => {
    expect(stripMarkdownFence("  no json here  ")).toBe("no json here");
  });

  it("does not invent an object from a truncated reply", () => {
    // Genuinely unrecoverable (no closing brace) — must stay a parse failure
    // rather than silently yielding something wrong.
    expect(() => parses('```json\n{"day_index":6,"meals":[')).toThrow();
  });
});

/**
 * The two TRANSLATION schemas are arrays, not objects — the only array-shaped
 * payloads in the codebase, and the case this helper's own comment said did not
 * exist ("callers all expect a single JSON OBJECT"). Slicing an unfenced
 * `[{…},{…}]` from its first brace to its last produced `{…},{…}`, which is not
 * JSON; a single-element array became a bare object that then failed the array
 * schema. Both left the day untranslated behind a console.warn, so whether the
 * housekeeper got her recipes depended on whether the model fenced that reply.
 */
describe("stripMarkdownFence — array payloads (translation)", () => {
  it("passes through a bare JSON array", () => {
    expect(parses('[{"i":0,"name":"Hind"}]')).toEqual([{ i: 0, name: "Hind" }]);
  });

  it("keeps every element of a multi-item array", () => {
    const out = parses('[{"i":0,"recipe_name":"Eggs"},{"i":1,"recipe_name":"Rice"}]');
    expect(out).toHaveLength(2);
    expect(out[1].recipe_name).toBe("Rice");
  });

  it("recovers an array from an UNCLOSED fence", () => {
    expect(parses('```json\n[{"i":0,"name":"Hind"}]')).toEqual([{ i: 0, name: "Hind" }]);
  });

  it("recovers an array after a prose preamble", () => {
    expect(parses('Here are the translations:\n[{"i":0,"name":"Hind"}]')).toEqual([
      { i: 0, name: "Hind" },
    ]);
  });

  it("keeps arrays nested INSIDE an object working as before", () => {
    // The object opens first, so this must still take the brace path.
    expect(parses('preamble {"meals":[{"a":1},{"b":2}]} trailing')).toEqual({
      meals: [{ a: 1 }, { b: 2 }],
    });
  });

  it("does not invent an array from a truncated reply", () => {
    expect(() => parses('[{"i":0,"name":"Hin')).toThrow();
  });
});
