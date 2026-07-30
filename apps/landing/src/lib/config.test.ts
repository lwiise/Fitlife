import { describe, expect, it } from "vitest";
import { buildWhatsappUrl, CONFIG } from "./config";

describe("CONFIG", () => {
  it("keeps the price story coherent: savings = original − bundle", () => {
    expect(CONFIG.originalValue - CONFIG.bundlePrice).toBe(CONFIG.savings);
  });

  it("builds a wa.me url with the Arabic message percent-encoded", () => {
    const url = buildWhatsappUrl(CONFIG.whatsappNumber, CONFIG.whatsappMessage);
    expect(url.startsWith(`https://wa.me/${CONFIG.whatsappNumber}?text=`)).toBe(
      true,
    );
    const encoded = url.split("?text=")[1] ?? "";
    expect(decodeURIComponent(encoded)).toBe(CONFIG.whatsappMessage);
    // Raw spaces or Arabic letters in the query would break some WA clients.
    expect(encoded).not.toMatch(/[\s؀-ۿ]/u);
  });
});
