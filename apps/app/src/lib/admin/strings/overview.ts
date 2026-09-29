import type { Entry } from "./types";

/**
 * Admin strings for the overview — metric tiles, range controls, chart, cost and engagement tiles.
 * Every key starts with `ov_` so the merged dictionary in ../i18n.ts can
 * never collide with another module's keys.
 */
export const OVERVIEW_STRINGS = {} as const satisfies Record<string, Entry>;
