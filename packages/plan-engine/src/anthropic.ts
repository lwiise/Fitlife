import { pricingForModel } from "./constants";
import { AnthropicCallError } from "./errors";

export interface StreamResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  stopReason: string | null;
}

/**
 * Stream the Anthropic Messages API as SSE over plain `fetch` (no SDK, so this
 * bundles cleanly inside the Netlify background function). Non-streaming
 * requests that take >~5 min hit undici's header timeout ("fetch failed");
 * streaming returns headers immediately and Anthropic sends periodic `ping`
 * events that keep the body connection alive, so long generations don't time out.
 */
export async function streamAnthropic(params: {
  apiKey: string;
  model: string;
  maxTokens: number;
  systemPrompt: string;
  // Large static prefix (e.g. Sara's methodology) identical across calls — sent
  // as a cached system block so repeated parallel calls only pay ~10% input
  // cost for it after the first. Optional; plain string if omitted.
  systemStatic?: string;
  userMessage?: string;
  // Multi-turn conversation (chat). When provided, used as the request `messages`
  // verbatim; otherwise a single user turn is built from `userMessage`. Existing
  // (generation) callers omit this and are unaffected.
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  // Called with each text delta as it streams in, so a caller can forward tokens
  // live (e.g. the chat route piping to the client). Generation callers omit it
  // and just use the buffered `text` returned at the end.
  onText?: (delta: string) => void;
  // Hard wall-clock cap for the whole request — connect AND streaming body. A
  // stalled SSE body (no more pings, half-open socket) would otherwise block
  // reader.read() forever, hanging the day loop and never flipping generating
  // off. Aborting kills both. Defaults to 4 min; callers inherit it.
  timeoutMs?: number;
}): Promise<StreamResult> {
  const {
    apiKey,
    model,
    maxTokens,
    systemPrompt,
    systemStatic,
    userMessage = "أنشئي الخطة الآن.",
    messages,
    onText,
    timeoutMs = 240_000,
  } = params;

  const requestMessages =
    messages && messages.length > 0
      ? messages
      : [{ role: "user" as const, content: userMessage }];

  const system = systemStatic
    ? [
        {
          type: "text",
          text: systemStatic,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: systemPrompt },
      ]
    : systemPrompt;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: requestMessages,
          stream: true,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new AnthropicCallError(
          `Anthropic stream timeout after ${timeoutMs}ms`,
          err,
        );
      }
      throw new AnthropicCallError(
        err instanceof Error ? err.message : "Anthropic request failed",
        err,
      );
    }

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      // Anthropic returns Retry-After (integer seconds) on 429/529. Capture it so
      // the day-loop retry waits out the real rate-limit window instead of the
      // (much shorter) exponential backoff, which otherwise exhausts retries mid-window.
      const ra = res.headers.get("retry-after");
      const retryAfterMs =
        ra && /^\d+$/.test(ra.trim()) ? Number(ra.trim()) * 1000 : undefined;
      throw new AnthropicCallError(
        `Anthropic API ${res.status}: ${errText.slice(0, 500)}`,
        undefined,
        retryAfterMs,
      );
    }

    let text = "";
    let tokensIn = 0;
    let tokensOut = 0;
    let stopReason: string | null = null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }

          switch (evt.type) {
            case "message_start": {
              const usage = (
                evt.message as { usage?: { input_tokens?: number } }
              )?.usage;
              if (usage?.input_tokens != null) tokensIn = usage.input_tokens;
              break;
            }
            case "content_block_delta": {
              const delta = evt.delta as { type?: string; text?: string };
              if (delta?.type === "text_delta") {
                const chunk = delta.text ?? "";
                text += chunk;
                if (chunk) onText?.(chunk);
              }
              break;
            }
            case "message_delta": {
              const usage = evt.usage as { output_tokens?: number } | undefined;
              if (usage?.output_tokens != null) tokensOut = usage.output_tokens;
              const delta = evt.delta as { stop_reason?: string };
              if (delta?.stop_reason) stopReason = delta.stop_reason;
              break;
            }
            case "error": {
              throw new AnthropicCallError(
                `Anthropic stream error: ${JSON.stringify(evt.error).slice(0, 500)}`,
              );
            }
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        throw new AnthropicCallError(
          `Anthropic stream timeout after ${timeoutMs}ms`,
          err,
        );
      }
      throw err;
    }

    return { text, tokensIn, tokensOut, stopReason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Recover the JSON payload from a model reply.
 *
 * The fast path is a closed fence wrapping the WHOLE reply. That used to be the
 * only path, and everything else fell through to JSON.parse — which cost a whole
 * DAY of a plan each time it happened, because a SyntaxError is treated as a
 * transient content failure: the day re-rolls twice, fails, and the
 * second-chance wave re-rolls it twice more. Six full day-sized calls, then the
 * day ships EMPTY in a paid plan with nothing surfaced in the UI.
 *
 * Two real production failures (2026-07-25/26), both with perfectly good JSON
 * sitting inside the reply:
 *   - an Arabic prose preamble before the object ("أولاً سأحسب…")
 *   - a ```json fence that was opened and never closed
 *
 * So when the reply is not cleanly fenced, fall back to the outermost JSON span.
 *
 * That span is NOT always braces. The comment here used to assert "callers all
 * expect a single JSON OBJECT (day slice, skeleton, translation)" — and the
 * first two do, but BOTH translation schemas are arrays. So an unfenced
 * `[{…},{…}]` was sliced from its first `{` to its last `}`, yielding
 * `{…},{…}` — not JSON at all — and an unfenced single-element `[{…}]` became a
 * bare object that then failed the array schema. Either way the day was left
 * untranslated behind a console.warn, so whether the housekeeper got her recipes
 * came down to whether the model happened to fence that particular reply.
 *
 * Pick the bracket that actually opens the payload, and close with its match. If
 * there is no plausible JSON the text is returned unchanged and the caller's
 * parse fails exactly as it did before — this only ever widens what can be
 * recovered.
 */
export function stripMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence && fence[1]) return fence[1];
  const objOpen = trimmed.indexOf("{");
  const arrOpen = trimmed.indexOf("[");
  // Whichever comes first is the outer value; an object whose fields hold arrays
  // still starts with `{`, so object payloads behave exactly as before.
  const isArray = arrOpen !== -1 && (objOpen === -1 || arrOpen < objOpen);
  const open = isArray ? arrOpen : objOpen;
  const close = trimmed.lastIndexOf(isArray ? "]" : "}");
  if (open !== -1 && close > open) return trimmed.slice(open, close + 1);
  return trimmed;
}

export function computeCostUsd(
  tokensIn: number,
  tokensOut: number,
  model: string,
): number {
  const rate = pricingForModel(model);
  const cost =
    (tokensIn / 1_000_000) * rate.input + (tokensOut / 1_000_000) * rate.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
