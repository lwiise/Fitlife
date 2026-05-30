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
    timeoutMs = 240_000,
  } = params;

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
          messages: [{ role: "user", content: userMessage }],
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
      throw new AnthropicCallError(
        `Anthropic API ${res.status}: ${errText.slice(0, 500)}`,
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
              if (delta?.type === "text_delta") text += delta.text ?? "";
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

export function stripMarkdownFence(text: string): string {
  const fence = text.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/);
  if (fence && fence[1]) return fence[1];
  return text.trim();
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
