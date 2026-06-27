import { pricingForModel } from "./constants";
import { AnthropicCallError } from "./errors";

export interface StreamResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  stopReason: string | null;
}

// Opus 4.7 / 4.8 and the Fable/Mythos family removed temperature/top_p/top_k —
// sending temperature to them returns a 400. The default skeleton model is Opus
// 4.7, so we drop temperature for these rather than risk breaking every run if a
// SKELETON_TEMPERATURE env is set while the skeleton is still on Opus.
function modelRejectsSamplingParams(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.includes("opus-4-7") ||
    m.includes("opus-4-8") ||
    m.includes("fable") ||
    m.includes("mythos")
  );
}

let warnedTemperatureDropped = false;

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
  // Optional sampling temperature (0–1). Lower = more deterministic (better for
  // hitting macro targets on the mechanical day phase). Omitted by default → the
  // model's own default. NOTE: Opus 4.7+/4.8 and Fable/Mythos REMOVED sampling
  // params — sending temperature there 400s — so it's dropped for those models
  // (see modelRejectsSamplingParams), keeping the default Opus skeleton safe.
  temperature?: number;
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
    temperature,
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

  // Build the request body, including temperature only when supplied AND the
  // target model actually accepts sampling params (see modelRejectsSamplingParams).
  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system,
    messages: requestMessages,
    stream: true,
  };
  if (temperature !== undefined) {
    if (modelRejectsSamplingParams(model)) {
      if (!warnedTemperatureDropped) {
        warnedTemperatureDropped = true;
        console.warn(
          `[anthropic] dropping temperature for ${model} (this model family rejects sampling params)`,
        );
      }
    } else {
      requestBody.temperature = temperature;
    }
  }

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
        body: JSON.stringify(requestBody),
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
