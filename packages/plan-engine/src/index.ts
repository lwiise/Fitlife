export { buildPlanContext, getBeneficiaries } from "./buildContext";
export type {
  PlanPromptContext,
  PlanPromptContextMom,
  PlanPromptContextMember,
  Beneficiary,
} from "./buildContext";

export {
  createPlanRows,
  runMealPlanGeneration,
  generateMealPlan,
} from "./generate";
export type { GenerateResult } from "./generate";

export { buildMemberSystemPrompt } from "./systemPrompt";

export { streamAnthropic, stripMarkdownFence, computeCostUsd } from "./anthropic";
export type { StreamResult } from "./anthropic";

export {
  MacrosSchema,
  IngredientSchema,
  MealSchema,
  DaySchema,
  MemberPlanSchema,
  MealPlanSchema,
} from "./schema";
export type { Macros, Ingredient, Meal, Day, MemberPlan, MealPlan } from "./schema";

export { PLAN_MODEL, PLAN_MEMBER_MAX_TOKENS, PRICING_USD_PER_MTOK } from "./constants";

export * from "./errors";
