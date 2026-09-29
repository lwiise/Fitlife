import type { Entry } from "./types";

/**
 * Admin strings for the families list, its toolbar and the side panel.
 * Every key starts with `fl_` so the merged dictionary in ../i18n.ts can
 * never collide with another module's keys.
 */
export const FAMILIES_STRINGS = {} as const satisfies Record<string, Entry>;
