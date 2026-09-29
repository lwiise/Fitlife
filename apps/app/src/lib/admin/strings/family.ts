import type { Entry } from "./types";

/**
 * Admin strings for the full family page and its tabs (meal, exercise, household, billing, runs, account).
 * Every key starts with `fm_` so the merged dictionary in ../i18n.ts can
 * never collide with another module's keys.
 */
export const FAMILY_STRINGS = {} as const satisfies Record<string, Entry>;
