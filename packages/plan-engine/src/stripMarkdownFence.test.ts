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
