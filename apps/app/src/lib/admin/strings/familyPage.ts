import type { Entry } from "./types";

/**
 * Admin strings for the full family page's own chrome: the page head, the
 * tab bodies' panels, the plan/program/health views and the account tab.
 * (The shared family blocks keep theirs in ./family.ts.) Every key starts
 * with `fp_` so the merged dictionary in ../i18n.ts can never collide with
 * another module's keys.
 */
export const FAMILY_PAGE_STRINGS = {} as const satisfies Record<string, Entry>;
