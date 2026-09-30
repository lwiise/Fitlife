import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { joinText, listSep } from "@/lib/admin/separators";
import { Count, Sep, joinSep } from "./Sep";

/**
 * The console's separators. Beside an Arabic-Indic digit a middle dot «·»
 * reads as the digit zero «٠» («كل العائلات · ١٤» read as 140), so the
 * visible UI draws <Sep/> between items and <Count/> beside a label, and
 * text-only places join with listSep — the Arabic comma in Arabic.
 */

const p = (...children: ReactNode[]) => renderToString(createElement("p", null, ...children));
const SEP = '<span class="ad-sep" aria-hidden="true"></span>';

describe("Sep", () => {
  it("is a decorative element, not a glyph", () => {
    expect(renderToString(createElement(Sep))).toBe(SEP);
  });
});

describe("joinSep", () => {
  it("draws one rule between each pair, a word space on either side", () => {
    const out = p(joinSep("١٤ عائلة", "٧ مدفوعة", "٤ تجريبية"));
    expect(out.split(SEP)).toHaveLength(3);
    // Spaces around the rule keep the items two words for a screen reader
    // (the rule itself is hidden) and give the line somewhere to wrap.
    expect(out.replace(/<!-- -->/g, "")).toBe(`<p>١٤ عائلة ${SEP} ٧ مدفوعة ${SEP} ٤ تجريبية</p>`);
    expect(out).not.toContain("·");
  });

  it("drops empty items, so an optional part is just `cond ? x : null`", () => {
    const out = p(joinSep(null, "أ", false, "", undefined, "ب"));
    expect(out.split(SEP)).toHaveLength(2);
    expect(p(joinSep("أ", null))).not.toContain("ad-sep");
    expect(joinSep()).toEqual([]);
    expect(joinSep(null, false, "")).toEqual([]);
  });

  it("takes a list spread, never as one item (that would drop its separators)", () => {
    const parts = ["النادي", "مبتدئة"];
    expect(p(joinSep(...parts)).split(SEP)).toHaveLength(2);
    // @ts-expect-error — a list is not an item: spread it.
    expect(joinSep(parts)).toHaveLength(1);
  });

  it("keys each item by its place in the list, so it keeps its identity", () => {
    const keys = (nodes: ReactNode[]) => nodes.map((n) => (isValidElement(n) ? n.key : null));
    expect(keys(joinSep("أ", "ب"))).toEqual(["0", "1"]);
    // An optional part coming and going does not re-key the ones after it.
    expect(keys(joinSep(null, "ب"))).toEqual(["1"]);
  });
});

describe("Count", () => {
  it("sets a count apart as its own element after a plain space — no separator", () => {
    const out = p("كل العائلات", createElement(Count, null, "١٤")).replace(/<!-- -->/g, "");
    expect(out).toBe('<p>كل العائلات <span class="ad-count">١٤</span></p>');
  });
});

describe("listSep and joinText (text-only places)", () => {
  it("joins Arabic with the Arabic comma and English with a middle dot", () => {
    expect(listSep("ar")).toBe("، ");
    expect(listSep("en")).toBe(" · ");
    expect(joinText(["الأحد", "اليوم", null, false, "", undefined], "ar")).toBe("الأحد، اليوم");
    expect(joinText(["Sunday", "Today"], "en")).toBe("Sunday · Today");
    expect(joinText([], "ar")).toBe("");
  });

  it("never puts «·» beside an Arabic digit", () => {
    expect(joinText(["١٤ عائلة", "٧ مدفوعة"], "ar")).not.toContain("·");
  });
});

// ── The source ──────────────────────────────────────────────────────────────

const here = path.dirname(fileURLToPath(import.meta.url));
const ADMIN = path.resolve(here, "..");
const SRC = path.resolve(here, "../../..");
const LIB = path.join(SRC, "lib/admin");
const COMPONENTS = path.join(ADMIN, "_components");
const INSIGHTS_PAGE = path.join(ADMIN, "(console)/insights/page.tsx");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") out.push(...sourceFiles(full));
    } else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The files a source file imports from inside the app ("@/…" or relative). */
function localImports(file: string): string[] {
  const out: string[] = [];
  for (const match of readFileSync(file, "utf8").matchAll(/\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
    const spec = match[1] ?? "";
    const base = spec.startsWith("@/")
      ? path.join(SRC, spec.slice(2))
      : spec.startsWith(".")
        ? path.resolve(path.dirname(file), spec)
        : null;
    const hit = base
      ? ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]
          .map((suffix) => base + suffix)
          .find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
      : undefined;
    if (hit) out.push(hit);
  }
  return out;
}

/**
 * The `_components` files the console renders. That directory is the old
 * panel's: most of it serves only the Insights page, which is hidden (it
 * redirects to /admin), but some of it is live — the account tab's danger
 * zone, the login form. So it is not skipped wholesale: a file there is
 * scanned when the console imports it, directly or through another. The
 * Insights page counts as an importer again as soon as its flag is flipped.
 */
function liveComponentFiles(adminFiles: readonly string[]): Set<string> {
  const insightsHidden =
    existsSync(INSIGHTS_PAGE) && /INSIGHTS_HIDDEN: boolean = true/.test(readFileSync(INSIGHTS_PAGE, "utf8"));
  const queue = adminFiles.filter(
    (file) => !file.startsWith(COMPONENTS + path.sep) && !(insightsHidden && file === INSIGHTS_PAGE),
  );
  const reached = new Set<string>(queue);
  while (queue.length > 0) {
    for (const dep of localImports(queue.pop()!)) {
      if (dep.startsWith(ADMIN + path.sep) && !reached.has(dep)) {
        reached.add(dep);
        queue.push(dep);
      }
    }
  }
  return new Set([...reached].filter((file) => file.startsWith(COMPONENTS + path.sep)));
}

/** The source with its comments blanked (line numbers kept). */
function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/(^|[^:\\"'`])\/\/[^\n]*/g, "$1");
}

describe("the console source", () => {
  const adminFiles = sourceFiles(ADMIN);
  const live = liveComponentFiles(adminFiles);

  it("scans the old components the console still renders, not just its own", () => {
    const rel = [...live].map((file) => path.relative(ADMIN, file));
    expect(rel).toEqual(
      expect.arrayContaining(["_components/AccountDangerZone.tsx", "_components/AdminLoginForm.tsx"]),
    );
  });

  it("writes no «·» — visible items take <Sep/>, text takes listSep()", () => {
    const files = [
      ...adminFiles.filter((file) => !file.startsWith(COMPONENTS + path.sep) || live.has(file)),
      ...sourceFiles(path.join(LIB, "strings")),
      path.join(LIB, "i18n.ts"),
    ];
    expect(files.length).toBeGreaterThan(50);
    const offenders: string[] = [];
    for (const file of files) {
      withoutComments(readFileSync(file, "utf8"))
        .split("\n")
        .forEach((line, i) => {
          if (line.includes("·")) offenders.push(`${path.relative(ADMIN, file)}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it("draws the rule as a border — forced colors repaint a filled box as Canvas, erasing it", () => {
    const css = readFileSync(path.join(ADMIN, "admin.css"), "utf8");
    const rule = /\.admin-root span\.ad-sep \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/border-inline-start:\s*1px solid currentColor/);
    expect(rule).not.toMatch(/background/);
  });
});
