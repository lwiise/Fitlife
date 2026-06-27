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
  prepareSharedGroupRegen,
  translateMealPlan,
  runMealPlanTranslation,
  hasPendingGeneration,
} from "./generate";
export type { GenerateResult } from "./generate";

export {
  STATIC_SYSTEM,
  buildSkeletonPrompt,
  buildDayPrompt,
  buildTranslatePrompt,
} from "./systemPrompt";

// Phase-2 groundwork: authored + exported, deliberately NOT in STATIC_SYSTEM. See
// exerciseProtocols.ts header for why (chat-leak / meal-only cost) and the guard test.
export { SAFE_EXERCISE_PROTOCOLS } from "./exerciseProtocols";

// Exercise Phase 2 (foundation) — canonical types + deterministic energy core. The
// app re-exports the types from here; generation does not consume these yet.
export type {
  ExerciseFocus,
  ExerciseSetting,
  Equipment,
  ExerciseType,
  MskRegion,
  AvailabilityDays,
  SessionMinutes,
  DeliveryType,
  IntensityCeiling,
  IntensityMode,
  ExerciseScreening,
  ExerciseProfile,
  MemberType,
  IntensityBand,
  Modality,
  EnergyBudgetMember,
} from "./exercise/types";
export {
  EnergyBudgetSchema,
  HrZoneSchema,
  WorkoutPlanSchema,
  WorkoutDaySchema,
  WorkoutSessionSchema,
  WorkoutRestSchema,
  IntensityBandSchema,
  IntensityModeSchema,
  IntensityCeilingSchema,
} from "./exercise/schema";
export type {
  EnergyBudget,
  HrZone,
  WorkoutPlan,
  WorkoutDay,
  WorkoutSession,
  WorkoutRest,
} from "./exercise/schema";
export { computeEnergyBudget, computeHrZones, rpeForBand } from "./exercise/energyBudget";
export { selectMet, MET_TABLE } from "./exercise/metTable";

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
  planHasContent,
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

export {
  PLAN_MODEL,
  PLAN_MAX_TOKENS,
  PRICING_USD_PER_MTOK_BY_MODEL,
  pricingForModel,
  MEMBER_GEN_MAX_ATTEMPTS,
} from "./constants";

export * from "./errors";
