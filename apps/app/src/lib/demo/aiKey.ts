import "server-only";

import { DEMO_API_KEY, demoAiEmailList, isDemoEmail } from "@fitlife/plan-engine";
import { getAnthropicKey } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The key an AI call should use for this account: the real Anthropic key, or
 * the demo sentinel when the account is listed in DEMO_AI_EMAILS (see
 * packages/plan-engine/src/demo). The demo check runs FIRST so a demo account
 * works even where ANTHROPIC_API_KEY is not set.
 */
export function anthropicKeyForEmail(email: string | null | undefined): string {
  return isDemoEmail(email) ? DEMO_API_KEY : getAnthropicKey();
}

/**
 * Same, from a user id. Only looks the account up when demo mode is configured
 * at all, so accounts on a deployment without DEMO_AI_EMAILS pay nothing extra.
 * A failed lookup falls back to the real key: the account is then treated like
 * any real one rather than silently served demo content.
 */
export async function anthropicKeyForUser(userId: string): Promise<string> {
  if (demoAiEmailList().length === 0) return getAnthropicKey();
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(userId);
    return anthropicKeyForEmail(data.user?.email);
  } catch {
    return getAnthropicKey();
  }
}
