import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { t } from "@/lib/admin/i18n";
import { ERROR_STRINGS, errorString, type ErrorStringKey } from "@/lib/admin/strings/errors";

/**
 * Some client components sit on EVERY route of a part of the console: the
 * error boundaries render ErrorView everywhere, the sign-in page renders
 * AdminLoginForm, and the subscriber segment's loading skeleton is on the
 * family page, the health page and both plan views. Whatever they import —
 * directly or through another module — ships with each of those routes. The
 * admin dictionary (lib/admin/i18n, both languages, every surface) must not
 * be among it.
 */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const I18N = path.join(SRC, "lib/admin/i18n.ts");

const ON_EVERY_ROUTE = [
  "app/admin/error.tsx",
  "app/admin/(console)/error.tsx",
  "app/admin/_shell/ErrorView.tsx",
  "app/admin/_components/AdminLoginForm.tsx",
  "app/admin/_family/RouteSkeleton.tsx",
];

/** The file a module specifier resolves to, or null (a package). */
function resolve(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && !candidate.endsWith(path.sep) && /\.tsx?$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** Every module a file pulls into its bundle (type-only imports are erased). */
function runtimeImports(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  const source = readFileSync(file, "utf8");
  const specs = [
    ...source.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^;]*?\bfrom\s+["']([^"']+)["']/gms),
  ].map((m) => m[1] ?? "");
  for (const spec of specs) {
    const target = resolve(spec, file);
    if (target) runtimeImports(target, seen);
  }
  return seen;
}

describe("strings that reach every admin route", () => {
  it.each(ON_EVERY_ROUTE)("%s never pulls in the dictionary", (file) => {
    const reached = runtimeImports(path.join(SRC, file));
    expect([...reached].map((f) => path.relative(SRC, f))).not.toContain(path.relative(SRC, I18N));
  });

  it("the walk does find the dictionary where it is imported", () => {
    // A control: a component that does use t() is caught.
    const reached = runtimeImports(path.join(SRC, "app/admin/_blocks/MealWeekExplorer.tsx"));
    expect(reached.has(I18N)).toBe(true);
  });

  it("errorString answers exactly what t() does for the same keys", () => {
    for (const key of Object.keys(ERROR_STRINGS) as ErrorStringKey[]) {
      expect(errorString(key, "ar")).toBe(t(key, "ar"));
      expect(errorString(key, "en")).toBe(t(key, "en"));
    }
  });
});
