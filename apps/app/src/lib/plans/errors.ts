/**
 * Typed errors for the plan-generation pipeline.
 * Each subclass sets `this.name` so the route handler can branch on `err.name`.
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
  constructor(message: string, public cause?: unknown) {
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
