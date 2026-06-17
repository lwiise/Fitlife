/**
 * Typed errors for the plan-generation pipeline.
 * Each subclass sets `this.name` so callers can branch on `err.name`.
 */

export class OnboardingIncompleteError extends Error {
  constructor() {
    super("Onboarding incomplete");
    this.name = "OnboardingIncompleteError";
  }
}

export class MedicalGateError extends Error {
  constructor() {
    super("Medical consultation required");
    this.name = "MedicalGateError";
  }
}

export class RateLimitError extends Error {
  constructor(public daysUntilReset: number) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
  }
}

export class AnthropicCallError extends Error {
  // retryAfterMs: when the failure is a 429/529 carrying a Retry-After header, the
  // server-advised wait (ms). The retry loop honors it so we wait out the actual
  // rate-limit window instead of a much shorter exponential backoff.
  constructor(
    message: string,
    public cause?: unknown,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "AnthropicCallError";
  }
}

export class PlanValidationError extends Error {
  constructor(message: string, public rawResponse?: string) {
    super(message);
    this.name = "PlanValidationError";
  }
}
