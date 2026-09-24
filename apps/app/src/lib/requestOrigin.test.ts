import { describe, it, expect } from "vitest";
import { checkoutReturnOrigin } from "./requestOrigin";

const APP = "https://fitlife-app-mvp.netlify.app";

function req(url: string, origin?: string | null): Request {
  const headers = new Headers();
  if (origin != null) headers.set("origin", origin);
  return new Request(url, { method: "POST", headers });
}

describe("checkoutReturnOrigin", () => {
  it("uses the Origin header when it matches where the request was served", () => {
    expect(checkoutReturnOrigin(req(`${APP}/api/checkout`, APP), APP)).toBe(APP);
  });

  it("accepts the configured app origin even when served from another host", () => {
    const r = req("https://deploy-preview-12--fitlife.netlify.app/api/checkout", APP);
    expect(checkoutReturnOrigin(r, APP)).toBe(APP);
  });

  it("falls back to the request origin for the literal 'null'", () => {
    const r = req("https://fitlife-app-mvp.netlify.app/api/checkout", "null");
    expect(checkoutReturnOrigin(r, APP)).toBe(APP);
  });

  it("ignores an unrelated or malformed Origin header", () => {
    expect(checkoutReturnOrigin(req(`${APP}/x`, "https://evil.example"), APP)).toBe(APP);
    expect(checkoutReturnOrigin(req(`${APP}/x`, "not a url"), APP)).toBe(APP);
    expect(checkoutReturnOrigin(req(`${APP}/x`, "javascript:alert(1)"), APP)).toBe(APP);
  });

  it("uses the request origin when no header is sent", () => {
    const r = req("https://preview.example.com/api/checkout");
    expect(checkoutReturnOrigin(r, APP)).toBe("https://preview.example.com");
  });

  it("never returns a trailing path", () => {
    expect(checkoutReturnOrigin(req(`${APP}/api/checkout?x=1`, `${APP}`), APP)).toBe(APP);
  });
});
