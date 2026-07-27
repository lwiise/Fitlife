// Filling the family-member wizard.
//
// Shared because getting it wrong FAILS SILENTLY and cost a whole matrix run:
// journey.mjs's generic filler did not know these ids, put "2" in the birth year,
// left the name blank, and every household persona died on
// «أكملي الاسم وسنة الميلاد». family-add.mjs already had the mapping; journey.mjs
// did not. One copy now.
//
// The member wizard uses ABBREVIATED ids (m-name, m-by, m-h, m-w), so rules match
// on patterns rather than column names.

/**
 * The order OnboardingFamilyBuilder.start() queues member types in. journey.mjs
 * walks this to know WHICH member the wizard is currently asking about, because
 * the screens themselves look identical — and an adult's birth year fails a
 * child's form.
 */
export const HOUSEHOLD_QUEUE_ORDER = ["husband", "adult", "child", "preg", "maid"];

const LABEL_TO_KIND = [
  [/^زوج|^زوجة/, "husband"],
  [/بالغ/, "adult"],
  [/طفل/, "child"],
  [/حامل|مرضعة/, "preg"],
  [/خدامة/, "maid"],
];

/**
 * Expand a persona's `household` into the flat sequence of members the wizard
 * will ask about, in the app's own queue order. A stepper with count 3 yields
 * three entries.
 */
export function expandHousehold(household) {
  if (!household?.length) return [];
  const byKind = new Map();
  for (const row of household) {
    const hit = LABEL_TO_KIND.find(([re]) => re.test(row.label));
    if (!hit) continue;
    const kind = hit[1];
    const n = row.type === "stepper" ? (row.count ?? 0) : 1;
    byKind.set(kind, (byKind.get(kind) ?? 0) + n);
  }
  const out = [];
  for (const kind of HOUSEHOLD_QUEUE_ORDER) {
    for (let i = 0; i < (byKind.get(kind) ?? 0); i++) out.push({ kind, index: i });
  }
  return out;
}

const YEAR = new Date().getFullYear();

/**
 * Values for one member. Ages are deliberately DISTINCT per index — fam-4's two
 * children exist to prove different ages produce different portion sizes, which
 * a shared default would silently defeat.
 */
export function memberValues(member) {
  const { kind, index } = member ?? { kind: "adult", index: 0 };
  if (kind === "child") {
    const ages = [7, 12, 9, 15, 5];
    const age = ages[index % ages.length];
    return {
      name: ["سلمان", "ريما", "بدر", "جواهر", "تركي"][index % 5],
      birthYear: String(YEAR - age),
      height: String(110 + age * 4),
      weight: String(20 + age * 2.5),
      age,
    };
  }
  if (kind === "husband") {
    return { name: "خالد", birthYear: "1985", height: "175", weight: "82", age: YEAR - 1985 };
  }
  if (kind === "preg") {
    return { name: "هيا", birthYear: "1995", height: "163", weight: "70", age: YEAR - 1995 };
  }
  if (kind === "maid") {
    // Housekeeper: name + reading language only. No health data is collected.
    return { name: "ماريا", birthYear: null, height: null, weight: null, age: null };
  }
  return { name: "منيرة", birthYear: "1980", height: "165", weight: "74", age: YEAR - 1980 };
}

/**
 * Build the id→value rules for the member currently being filled.
 *
 * An unmapped NUMERIC field is deliberately left alone by the caller rather than
 * given a made-up value: a wrong number passes the form and fails validation
 * server-side, where it looks like a product bug instead of a harness gap.
 */
export function memberFieldRules(member) {
  const v = memberValues(member);
  const rules = [[/name/i, v.name]];
  if (v.birthYear) rules.push([/(^|-)by$|birth|year/i, v.birthYear]);
  if (v.height) rules.push([/(^|-)h$|height/i, v.height]);
  if (v.weight) rules.push([/(^|-)w$|weight/i, v.weight]);
  rules.push([/tw|target/i, "70"], [/waist/i, "92"], [/hip/i, "100"]);
  return rules;
}
