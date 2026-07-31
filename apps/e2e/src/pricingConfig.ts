/**
 * The suite's single door onto the app's pricing configuration.
 *
 * Why not `import { PRICING_TIERS } from "@fitlife/config"` directly?
 * `@fitlife/config` ships raw TypeScript (`main: ./src/index.ts`) and resolves
 * through a pnpm symlink under `node_modules`. Playwright transpiles the
 * TypeScript it loads but deliberately skips `node_modules`, so in ESM mode the
 * bare specifier fails at runtime with:
 *
 *   SyntaxError: The requested module '@fitlife/config' does not provide an
 *   export named 'PRICING_TIERS'
 *
 * tsconfig `paths` does not fix it either — Playwright's ESM loader ignores path
 * mapping. Importing the source by relative path keeps the file outside
 * `node_modules`, so it is transpiled normally.
 *
 * The ugly path is confined to this one module on purpose: everything else in the
 * suite imports from here, and the suite keeps reading prices and variant ids from
 * the app's real single source of truth rather than a retyped copy that could
 * silently drift.
 */

export {
  PRICING_TIERS,
  getTierCadenceByVariantId,
  getVariantId,
  TRIAL_DAYS,
  type Cadence,
  type Tier,
  type TierDefinition,
} from "../../../packages/config/src/pricing.js";
