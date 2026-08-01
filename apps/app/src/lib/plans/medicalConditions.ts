// Sara's medical-condition lists. The catalogue itself now lives in the ENGINE
// (packages/plan-engine/src/medicalConditionLabels.ts) because the generation
// prompt needs the same Arabic labels the wizard chips use — it was rendering
// the bare slug («تعاني من: ibs»). Re-exported here so every existing import
// path keeps working and there is exactly one list per group.
//
// GATE_CONDITIONS slugs MUST match HIGH_RISK_MEDICAL_FLAGS in the engine
// (packages/plan-engine/src/buildContext.ts) so selecting one triggers the
// medical gate. STABLE_CONDITIONS inform the plan but never gate.

export {
  GATE_CONDITIONS,
  STABLE_CONDITIONS,
  conditionLabelAr,
  type ConditionOption,
} from "@fitlife/plan-engine";

/**
 * True if any selected condition is a high-risk gate condition. Delegates to
 * the engine's list (plan-engine/medicalGate) rather than re-deriving one from
 * GATE_CONDITIONS above — that second list is the UI's chip roster, and the two
 * had already drifted by one slug (`unexplained_symptoms`).
 */
export { hasHighRiskCondition as hasGateCondition } from "@fitlife/plan-engine";
