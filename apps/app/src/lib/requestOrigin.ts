/**
 * The origin a hosted checkout should send the customer back to.
 *
 * The checkout and plan-change routes return to the EXACT origin the browser
 * is on, so the post-payment redirect carries the session cookie. They read
 * it from the Origin header, which is only trustworthy in two shapes: a real
 * http(s) origin that matches where the request itself was served, or the
 * configured app URL. Anything else — the literal "null" browsers send for
 * opaque origins, a malformed value, an unrelated host — falls back to the
 * request's own origin, then to the configured app URL. (The previous chain
 * `header ?? new URL(request.url).origin ?? appUrl` could return "null", and
 * its last fallback was dead code because `.origin` is always a string.)
 */
export function checkoutReturnOrigin(request: Request, appUrl: string): string {
  const requestOrigin = safeOrigin(request.url);
  const configured = safeOrigin(appUrl);
  const header = safeOrigin(request.headers.get("origin"));
  if (header && (header === requestOrigin || header === configured)) return header;
  return requestOrigin ?? configured ?? appUrl;
}

function safeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
