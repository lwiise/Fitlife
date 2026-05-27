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

export { STATIC_SYSTEM, buildSkeletonPrompt, buildDayPrompt } from "./systemPrompt";

export { streamAnthropic, stripMarkdownFence, computeCostUsd } from "./anthropic";
export type { StreamResult } from "./anthropic";

export {
  MacrosSchema,
  IngredientSchema,
  PerMemberPortionSchema,
  MealSchema,
  DaySchema,
  MemberPlanSchema,
  MealPlanSchema,
  PRIMARY_GOALS,
  LOCALE_CODES,
} from "./schema";
export type {
  Macros,
  Ingredient,
  PerMemberPortion,
  Meal,
  Day,
  MemberPlan,
  MealPlan,
  LocaleCode,
} from "./schema";

export { PLAN_MODEL, PLAN_MAX_TOKENS, PRICING_USD_PER_MTOK } from "./constants";

export * from "./errors";
