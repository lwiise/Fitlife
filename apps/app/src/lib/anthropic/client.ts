import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicKey } from "@/lib/env";

let _client: Anthropic | undefined;

/**
 * Returns a cached Anthropic SDK instance. Constructed lazily on first call
 * so that module evaluation never reads the API key — keeps build green when
 * ANTHROPIC_API_KEY is unset.
 */
export function getAnthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: getAnthropicKey() });
  }
  return _client;
}
