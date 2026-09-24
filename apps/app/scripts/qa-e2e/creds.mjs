// Shared helper for the diagnostic scripts: discover the deployed app's public
// Supabase credentials and sign in as a QA account.
//
// run.mjs deliberately keeps its own inline copy — it is the harness and stays
// self-contained. These helpers exist so the diagnostic companions (probe,
// timeline, analyze, cleanup) don't each carry the same block.

import { createClient } from "@supabase/supabase-js";

export const BASE =
  process.env.FITLIFE_BASE_URL ?? "https://fitlife-app-mvp.netlify.app";

/**
 * The QA accounts these scripts create live on PRODUCTION. This used to default
 * to a literal committed here, so every QA household ever minted shared one
 * password that anyone with repository access could read — and CLAUDE.md
 * records QA households left live for days. No default: the operator sets it
 * per session (12+ characters), and it never enters the repo.
 */
export const PASSWORD = requireTestPassword();

function requireTestPassword() {
  const value = process.env.FITLIFE_TEST_PASSWORD ?? "";
  if (value.length < 12) {
    throw new Error(
      "FITLIFE_TEST_PASSWORD must be set to 12+ characters — QA accounts are created on production and must not share a password that lives in the repo.",
    );
  }
  return value;
}

const URL_RE = /https:\/\/[a-z0-9-]+\.supabase\.co/;
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

function pickAnonKey(text) {
  for (const tok of text.match(JWT_RE) ?? []) {
    try {
      const payload = JSON.parse(
        Buffer.from(tok.split(".")[1], "base64url").toString("utf8"),
      );
      if (payload.role === "anon") return tok;
    } catch {
      /* not a JWT we care about */
    }
  }
  return null;
}

/**
 * Both values are NEXT_PUBLIC_* and therefore inlined into the served bundle.
 * Env vars win when set.
 */
export async function discoverSupabaseCreds() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY };
  }
  const html = await (await fetch(`${BASE}/auth/login`)).text();
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) =>
    m[1].startsWith("http") ? m[1] : `${BASE}${m[1]}`,
  );
  let url = html.match(URL_RE)?.[0] ?? null;
  let anon = pickAnonKey(html);
  for (const src of scripts) {
    if (url && anon) break;
    let body;
    try {
      body = await (await fetch(src)).text();
    } catch {
      continue;
    }
    url ??= body.match(URL_RE)?.[0] ?? null;
    anon ??= pickAnonKey(body);
  }
  if (!url || !anon) {
    throw new Error(
      `Could not discover Supabase creds (url=${!!url}, anon=${!!anon}). ` +
        `Set SUPABASE_URL / SUPABASE_ANON_KEY to override.`,
    );
  }
  return { url, anon };
}

/** Sign in as a QA account; returns { sb, userId }. Exits on failure. */
export async function signInAs(email, password = PASSWORD) {
  const { url, anon } = await discoverSupabaseCreds();
  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`sign-in failed for ${email}: ${error.message}`);
    process.exit(1);
  }
  return { sb, userId: data.user.id, user: data.user };
}
