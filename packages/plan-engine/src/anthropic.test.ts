import { describe, it, expect, vi, afterEach } from "vitest";
import { streamAnthropic } from "./anthropic";

// WS3b: temperature is sent only when supplied AND the target model accepts
// sampling params. Opus 4.7/4.8 + Fable/Mythos reject temperature (400), so it's
// dropped for them — keeping the default Opus skeleton safe even if a stray
// PLAN_SKELETON_TEMPERATURE is set.

function captureBody() {
  const bodies: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body));
    // Non-OK → streamAnthropic throws immediately (no internal retry). We only
    // care about the captured request body.
    return {
      ok: false,
      status: 500,
      body: null,
      text: async () => "boom",
      headers: { get: () => null },
    } as unknown as Response;
  });
  return { bodies, fetchMock };
}

describe("streamAnthropic temperature handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("includes temperature for a model that accepts sampling params (Sonnet)", async () => {
    const { bodies, fetchMock } = captureBody();
    vi.stubGlobal("fetch", fetchMock);
    await streamAnthropic({
      apiKey: "x",
      model: "claude-sonnet-4-6",
      maxTokens: 10,
      systemPrompt: "hi",
      temperature: 0.4,
    }).catch(() => {});
    expect(bodies[0]!.temperature).toBe(0.4);
  });

  it("drops temperature for Opus 4.7 (rejects sampling params → 400)", async () => {
    const { bodies, fetchMock } = captureBody();
    vi.stubGlobal("fetch", fetchMock);
    await streamAnthropic({
      apiKey: "x",
      model: "claude-opus-4-7",
      maxTokens: 10,
      systemPrompt: "hi",
      temperature: 0.4,
    }).catch(() => {});
    expect(bodies[0]).not.toHaveProperty("temperature");
  });

  it("omits temperature entirely when not supplied", async () => {
    const { bodies, fetchMock } = captureBody();
    vi.stubGlobal("fetch", fetchMock);
    await streamAnthropic({
      apiKey: "x",
      model: "claude-sonnet-4-6",
      maxTokens: 10,
      systemPrompt: "hi",
    }).catch(() => {});
    expect(bodies[0]).not.toHaveProperty("temperature");
  });
});
