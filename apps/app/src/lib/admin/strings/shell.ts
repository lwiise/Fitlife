import type { Entry } from "./types";

/**
 * Admin strings for the console frame — top bar, rail, command palette, toggles.
 * Every key starts with `sh_` so the merged dictionary in ../i18n.ts can
 * never collide with another module's keys.
 */
export const SHELL_STRINGS = {} as const satisfies Record<string, Entry>;
