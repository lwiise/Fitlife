/**
 * The families list's rows on their way from the server page to the console.
 *
 * Every family crosses to the browser (the list filters, sorts and pages in
 * memory), so the rows are the bulk of the page's payload — and as objects,
 * more than half of each row's bytes were its field names, repeated once per
 * family. Here a row travels as a tuple of its values, in a fixed order, and
 * is rebuilt into the same FamilyRow on the client: the names cross once, in
 * this file. Values are not reshaped (dates stay the ISO strings the loader
 * made, booleans stay booleans), so what the console works on is exactly
 * what the server had.
 *
 * `unpackFamilyRow` builds the FamilyRow literally, field by field: a field
 * added to the contract fails compilation here until it is carried
 * (rowCodec.test.ts round-trips a full row).
 */

import type {
  FamilyFlag,
  FamilyRow,
  PlanCellState,
  SubscriptionCancelState,
} from "@/lib/admin/console-types";

/** One FamilyRow as a tuple of its values (see the order in packFamilyRow). */
export type PackedFamilyRow = [
  userId: string,
  displayName: string | null,
  email: string | null,
  tier: string | null,
  status: string | null,
  cadence: string | null,
  signupAt: string,
  trialEndsAt: string | null,
  currentPeriodEnd: string | null,
  endsAt: string | null,
  cancelAtPeriodEnd: boolean,
  beneficiaries: number,
  hasHousekeeper: boolean,
  overLimit: boolean,
  plansGenerated: number,
  failedPlans: number,
  lastActivityAt: string | null,
  lifetimeAiCostUsd: number,
  onboardingComplete: boolean,
  meal: [state: PlanCellState, daysReady: number | null, daysTotal: number, masked: boolean],
  workout: [state: PlanCellState, masked: boolean],
  flags: FamilyFlag[],
  cancelState: SubscriptionCancelState,
];

export function packFamilyRow(row: FamilyRow): PackedFamilyRow {
  return [
    row.userId,
    row.displayName,
    row.email,
    row.tier,
    row.status,
    row.cadence,
    row.signupAt,
    row.trialEndsAt,
    row.currentPeriodEnd,
    row.endsAt,
    row.cancelAtPeriodEnd,
    row.beneficiaries,
    row.hasHousekeeper,
    row.overLimit,
    row.plansGenerated,
    row.failedPlans,
    row.lastActivityAt,
    row.lifetimeAiCostUsd,
    row.onboardingComplete,
    [row.meal.state, row.meal.daysReady, row.meal.daysTotal, row.meal.masked],
    [row.workout.state, row.workout.masked],
    row.flags,
    row.cancelState,
  ];
}

export function unpackFamilyRow(packed: PackedFamilyRow): FamilyRow {
  const [
    userId,
    displayName,
    email,
    tier,
    status,
    cadence,
    signupAt,
    trialEndsAt,
    currentPeriodEnd,
    endsAt,
    cancelAtPeriodEnd,
    beneficiaries,
    hasHousekeeper,
    overLimit,
    plansGenerated,
    failedPlans,
    lastActivityAt,
    lifetimeAiCostUsd,
    onboardingComplete,
    [mealState, daysReady, daysTotal, mealMasked],
    [workoutState, workoutMasked],
    flags,
    cancelState,
  ] = packed;
  return {
    userId,
    displayName,
    email,
    tier,
    status,
    cadence,
    signupAt,
    trialEndsAt,
    currentPeriodEnd,
    endsAt,
    cancelAtPeriodEnd,
    beneficiaries,
    hasHousekeeper,
    overLimit,
    plansGenerated,
    failedPlans,
    lastActivityAt,
    lifetimeAiCostUsd,
    onboardingComplete,
    meal: { state: mealState, daysReady, daysTotal, masked: mealMasked },
    workout: { state: workoutState, masked: workoutMasked },
    flags,
    cancelState,
  };
}

export function packFamilyRows(rows: readonly FamilyRow[]): PackedFamilyRow[] {
  return rows.map(packFamilyRow);
}

export function unpackFamilyRows(packed: readonly PackedFamilyRow[]): FamilyRow[] {
  return packed.map(unpackFamilyRow);
}
