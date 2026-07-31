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
 * expands the COMPOSED household through this to get the sequence of members the
 * app will ask about — used as the cross-check (and the fallback) for the
 * screen-derived identity below.
 */
export const HOUSEHOLD_QUEUE_ORDER = ["husband", "adult", "child", "preg", "maid"];

// Matches BOTH the persona's short label ("طفل") and the picker's own full label
// ("خدامة تطبخ للعائلة", "امرأة حامل/مرضعة"), so the queue can be expanded from
// what the picker was READ BACK as holding, not only from what was requested.
const LABEL_TO_KIND = [
  [/^زوج|^زوجة/, "husband"],
  [/بالغ/, "adult"],
  [/طفل/, "child"],
  [/حامل|مرضعة/, "preg"],
  [/خدامة/, "maid"],
];

/**
 * The wizard NAMES the member it is asking about, in its own sticky <h1>:
 * MemberWizard renders TYPE_TITLES[type] (or «إضافة الزوج» when role="dad") and
 * HousekeeperForm renders «إضافة خدامة».
 *
 * Reading that beats counting screens. Position-only tracking is only ever as
 * correct as the household composition was, and when the composition was wrong it
 * failed SILENTLY: a husband's 175cm/82kg went into a 7-year-old's form, the run
 * stayed green, and the damage surfaced half an hour later as a member count.
 */
//
// CAVEAT — «إضافة الزوج» is rendered only when role === "dad", and
// OnboardingFamilyBuilder passes role={isMale ? "other_adult" : "dad"}. So a MALE
// owner's spouse is titled «إضافة فرد بالغ», identical to a second adult, and no
// screen text can tell them apart. The queue disambiguates by position there;
// this table is the primary signal only for the cases where the screen is
// actually unambiguous.
export const MEMBER_SCREEN_KINDS = [
  [/إضافة الزوج|إضافة الزوجة/, "husband"],
  [/إضافة فرد بالغ/, "adult"],
  [/إضافة طفل/, "child"],
  [/إضافة فرد \(حامل\)|إضافة فرد \(مرضعة\)|حامل أو مرضعة/, "preg"],
  [/إضافة خدامة/, "maid"],
];

/**
 * MemberWizard's "X من N" batch counter (its TYPE_NOUNS + memberIndex), rendered
 * only while collecting several members of one type. It is the ONLY place the
 * index WITHIN a batch is visible on screen — without it the second child of two
 * is indistinguishable from the first, and they exist precisely to be different
 * ages.
 */
export const MEMBER_BATCH_BADGE = /^(البالغ|الطفل|الحامل|المرضعة)\s+(\d+)\s+من\s+(\d+)$/;

/**
 * Identify the member the wizard is asking about from the screen alone.
 *
 * `h1s` is EVERY visible h1, not the first one: the onboarding builder renders
 * each member wizard as a `fixed inset-0` overlay over the members page, whose own
 * h1 («عائلتك») stays in the DOM and stays visible, so first-in-document-order
 * always returns the page's heading and never the wizard's.
 *
 * Returns null when no member wizard is up (the picker itself, or a screen we
 * don't recognise) — the caller must NOT guess from that.
 */
export function memberFromScreen(h1s, badge) {
  for (const text of h1s ?? []) {
    const hit = MEMBER_SCREEN_KINDS.find(([re]) => re.test(text));
    if (!hit) continue;
    const m = badge ? MEMBER_BATCH_BADGE.exec(badge) : null;
    return {
      kind: hit[1],
      index: m ? Number(m[2]) - 1 : 0,
      batch: m ? Number(m[3]) : 1,
      via: text,
    };
  }
  return null;
}

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
