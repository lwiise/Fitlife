// Arabic-Indic numerals for the signed-in app's figures («١٤ وجبة»). One
// formatter so a screen never mixes ١٤ with 14.

const INT = new Intl.NumberFormat("ar-SA", { useGrouping: false });
const DEC = new Intl.NumberFormat("ar-SA", {
  useGrouping: false,
  maximumFractionDigits: 2,
});
const PCT = new Intl.NumberFormat("ar-SA", {
  style: "percent",
  maximumFractionDigits: 0,
});
const DIGITS_AR = "٠١٢٣٤٥٦٧٨٩";

/** 14 → «١٤». Rounds to an integer. */
export function arNum(n: number): string {
  return INT.format(Math.round(n));
}

/** 0.5 → «٠٫٥». Keeps up to two decimals, for figures arNum's rounding would
 * falsify: half a cup of an ingredient is not «١». */
export function arDec(n: number): string {
  return DEC.format(n);
}

/** 0.64 → «٦٤٪». */
export function arPct(frac: number): string {
  return PCT.format(frac);
}

/** The Western digits inside a stored string («8-12») → «٨-١٢». For values
 * that arrive as text rather than numbers (a workout's rep range), so they
 * match the figures around them. Everything else in the string is untouched. */
export function arDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => DIGITS_AR[Number(d)]!);
}
