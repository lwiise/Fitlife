// All exercise animation definitions — ids must exactly match
// packages/plan-engine/src/workout/exerciseCatalog.ts (the app-side
// integrity test enforces file coverage).
import { LEGS } from "./legs.mjs";
import { PUSH } from "./push.mjs";
import { PULL } from "./pull.mjs";
import { CORE } from "./core.mjs";
import { MOBILITY } from "./mobility.mjs";
import { STRETCH } from "./stretch.mjs";
import { CARDIO } from "./cardio.mjs";

export const ALL = [...LEGS, ...PUSH, ...PULL, ...CORE, ...MOBILITY, ...STRETCH, ...CARDIO];
