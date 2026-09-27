// Arabic-Indic numerals for the signed-in app's figures («١٤ وجبة»). One
// formatter so a screen never mixes ١٤ with 14.

const INT = new Intl.NumberFormat("ar-SA", { useGrouping: false });
const PCT = new Intl.NumberFormat("ar-SA", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** 14 → «١٤». Rounds to an integer. */
export function arNum(n: number): string {
  return INT.format(Math.round(n));
}

/** 0.64 → «٦٤٪». */
export function arPct(frac: number): string {
  return PCT.format(frac);
}
