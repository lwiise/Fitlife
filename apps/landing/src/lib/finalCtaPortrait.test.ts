import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The closing section's portrait ships in BOTH copies of the offer page
// (apps/landing and the app's /landing route). These guard the ways that
// arrangement rots: one copy replaced and not the other, an unoptimised
// original committed by mistake, or a re-crop that stops matching the 4:5 box
// FinalCTAPortrait reserves — which would letterbox or crop her.
const here = dirname(fileURLToPath(import.meta.url));
const landingCopy = join(here, "..", "..", "public", "final-cta-woman.webp");
const appCopy = join(
  here,
  "..",
  "..",
  "..",
  "app",
  "public",
  "final-cta-woman.webp",
);

/** Width/height out of a WebP header, without pulling in an image library. */
function webpSize(file: string) {
  const b = readFileSync(file);
  expect(b.toString("ascii", 0, 4)).toBe("RIFF");
  expect(b.toString("ascii", 8, 12)).toBe("WEBP");
  const format = b.toString("ascii", 12, 16);
  if (format === "VP8X") {
    return { width: (b.readUIntLE(24, 3) & 0xffffff) + 1, height: (b.readUIntLE(27, 3) & 0xffffff) + 1 };
  }
  if (format === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  // Lossy VP8: dimensions sit after the 3-byte start code in the keyframe header.
  return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
}

describe("final CTA portrait", () => {
  it("is byte-identical in both copies of the offer page", () => {
    expect(readFileSync(appCopy)).toEqual(readFileSync(landingCopy));
  });

  it("matches the 4:5 box the component reserves", () => {
    const { width, height } = webpSize(landingCopy);
    // FinalCTAPortrait passes width={1122} height={1402}; a re-crop that
    // changes the ratio would letterbox her or crop her head.
    expect(width / height).toBeCloseTo(4 / 5, 2);
    expect(width).toBe(1122);
    expect(height).toBe(1402);
  });

  it("ships optimised, not as the original export", () => {
    // The source PNG was 1.77 MB; the WebP is ~57 KB. Anything approaching the
    // original means someone committed the raw export again.
    expect(statSync(landingCopy).size).toBeLessThan(200 * 1024);
  });
});
