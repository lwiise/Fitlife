/**
 * Constrain a caller-supplied `redirect_to` to a path inside this app.
 *
 * Both auth entry points take the destination straight from the query string:
 * the login form hands it to window.location.assign (an absolute URL there
 * navigates clean off-site) and /auth/callback concatenates it onto the origin
 * (where a leading "@" or "." re-points the host). Either one turns a link on
 * the real product domain into a redirect to an attacker's page immediately
 * after a genuine sign-in.
 *
 * Accepts only a single leading "/" followed by something other than "/" or
 * "\" — so "/dashboard" and "/plan?view=workout" pass, while "//evil.example",
 * "https://evil.example", "@evil.example", ".evil.example" and "/\evil.example"
 * (which browsers read as protocol-relative) all fall back to the default.
 *
 * Shared by the client form and the server route on purpose: the two must not
 * drift, since either one alone is enough to leak the redirect.
 */
export const DEFAULT_REDIRECT = "/dashboard";

export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
