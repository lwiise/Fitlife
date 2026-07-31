// Test personas for journey.mjs — one per distinct BRANCH of the product, not
// per field value. A variation earns a row here only if it changes a gate, a
// target, or the shape of the wizard; things that only change a prompt string
// (cuisine, cooking method, water band…) are varied ACROSS these rows instead
// of adding new ones.
//
// Labels below are the real Arabic strings from the UI:
//   goals            apps/app/src/app/profile/labels.ts GOALS
//   conditions       apps/app/src/lib/plans/medicalConditions.ts
//   pregnancy        apps/app/src/app/onboarding/mom/MomWizard.tsx (pregnancy step)
//
// Field semantics:
//   fields       overrides for inputs matched by id
//   preferred    ORDERED label patterns; the first match in an unanswered option
//                group wins, else the group's first option is taken
//   force        patterns clicked on EVERY attempt if not already selected —
//                use for choices the driver would otherwise never make, because
//                the group is optional (conditions) or its default is wrong
//                (sex defaults to أنثى, pregnancy to «لست حاملاً»)
//   chips        free-text chip inputs, matched on placeholder
//   scope        "meals" | "workout" — which plan-scope branch to take
//   household    members screen: toggles and steppers to apply before the CTA

export const PERSONAS = [
  {
    key: "solo-loss",
    email: "cloud+2@gmail.com",
    label: "Solo female · fat loss · no conditions · meals only (baseline)",
    fields: { display_name: "نورة", birth_year: "1992", height_cm: "162", weight_kg: "78", target_weight_kg: "68" },
    preferred: [/خسارة الدهون/, /نشاط خفيف|خفيف/, /نادراً/],
    chips: [{ match: /كبدة/, chips: ["كبدة"] }],
    scope: "meals",
    expect: "7/7 days, Gregorian week header, no #418, كبدة absent",
  },
  {
    key: "pregnant",
    email: "cloud+3@gmail.com",
    label: "Pregnant · month 5 · NOT high-risk · meals only",
    // Historically a dead end: the engine gate fired on is_pregnant alone while
    // the wizard never showed the doctor checkbox. Fixed in 8ae68d1 — this is
    // the regression test for it.
    fields: { display_name: "لطيفة", birth_year: "1997", height_cm: "165", weight_kg: "68", target_weight_kg: "" },
    preferred: [/تحسين الحالة الصحية/, /نشاط خفيف|خفيف/, /نادراً/],
    force: [/^حامل$/, /^5$/, /^لا$/],
    chips: [{ match: /بيض، دجاج/, chips: ["بيض"] }],
    scope: "meals",
    expect: "doctor step appears; primary_goal=pregnancy_lactation; plan generates",
  },
  {
    key: "lactating",
    email: "cloud+4@gmail.com",
    label: "Lactating · exclusive · 3mo postpartum · meals only",
    fields: { display_name: "مريم", birth_year: "1994", height_cm: "160", weight_kg: "72", target_weight_kg: "65" },
    preferred: [/تحسين الحالة الصحية/, /نشاط خفيف|خفيف/, /نادراً/],
    force: [/^مرضعة$/],
    scope: "meals",
    expect: "feeding mode + months-postpartum required; doctor step always; pregnancy_lactation goal",
  },
  {
    key: "male-gym",
    email: "cloud+5@gmail.com",
    label: "MALE owner · build muscle · GYM workout · knee injury",
    fields: { display_name: "فهد", birth_year: "1990", height_cm: "178", weight_kg: "84", target_weight_kg: "88" },
    preferred: [/بناء كتلة عضلية/, /نشاط متوسط|متوسط/, /نادراً/],
    // sex defaults to أنثى, so male must be forced. Gym must be forced too —
    // it zeroes the equipment list and reveals the injury-note field.
    force: [/^ذكر$/, /^النادي$|نادي|صالة/, /^الركبة$/],
    scope: "workout",
    expect: "9-step wizard (no pregnancy step); masculine copy; equipment=[]; knee-safe program",
  },
  {
    key: "family-maid",
    email: "cloud+6@gmail.com",
    label: "Family · mom + husband + child(7) + housekeeper (Tagalog)",
    fields: { display_name: "هند", birth_year: "1987", height_cm: "168", weight_kg: "71", target_weight_kg: "64" },
    preferred: [/خسارة الدهون/, /نشاط متوسط|متوسط/, /أحياناً/],
    scope: "meals",
    household: [
      { label: "زوج", type: "toggle" },
      { label: "طفل", type: "stepper", count: 1 },
      { label: "خدامة", type: "toggle" },
    ],
    beneficiaries: 3, // mom + husband + child; the housekeeper is excluded
    expect: "family-wide screen appears; starter cap truncates to mom; housekeeper view + translation",
  },
  {
    key: "stable-pcos",
    email: "cloud+7@gmail.com",
    label: "STABLE condition (PCOS) · fat loss — goal must SURVIVE",
    fields: { display_name: "سارة", birth_year: "1993", height_cm: "163", weight_kg: "80", target_weight_kg: "70" },
    preferred: [/خسارة الدهون/, /نشاط خفيف|خفيف/, /نادراً/],
    force: [/تكيس المبايض/],
    scope: "meals",
    expect: "doctor step appears (owner rule = ANY condition) but primary_goal stays fat_loss",
  },
  {
    key: "gate-heart",
    email: "cloud+8@gmail.com",
    label: "GATE condition (heart disease) · improve health — goal HIJACKED",
    fields: { display_name: "منى", birth_year: "1975", height_cm: "158", weight_kg: "88", target_weight_kg: "75" },
    preferred: [/تحسين الحالة الصحية/, /نشاط قليل|خفيف/, /نادراً/],
    force: [/أمراض القلب/],
    scope: "meals",
    expect: "doctor gate blocks until confirmed; primary_goal becomes metabolic_health",
  },
  {
    key: "under-18",
    email: "cloud+9@gmail.com",
    label: "UNDER-18 owner — must now be REFUSED (P0 fix)",
    // Was a pinned known bug (adult BMR/TDEE while assembly stamped is_child).
    // OWNER_MIN_AGE now rejects it server-side, so this flipped from
    // "reproduce the bug" to "prove the fix" — a generation here is a FAILURE.
    fields: { display_name: "جود", birth_year: "2011", height_cm: "155", weight_kg: "50", target_weight_kg: "" },
    preferred: [/تحسين الحالة الصحية/, /نشاط خفيف|خفيف/, /نادراً/],
    scope: "meals",
    expectRejection: true,
    expect: "REFUSED at the identity step; Arabic message points to adding minors as family members",
  },

  // ── Group B — the coach's six goals ───────────────────────────────────────
  // One per goal so mapUserGoalToSara is exercised across its whole range and
  // the resulting day targets can be compared against each other (a deficit and
  // a surplus must not come out the same).
  {
    key: "solo-muscle",
    label: "Solo female · build muscle (surplus) · meals only",
    fields: { display_name: "دانة", birth_year: "1995", height_cm: "167", weight_kg: "60", target_weight_kg: "65" },
    preferred: [/بناء كتلة عضلية/, /نشاط متوسط|متوسط/, /أحياناً/],
    scope: "meals",
    expect: "primary_goal=build_muscle; day targets ABOVE maintenance; protein high",
  },
  {
    key: "solo-recomp",
    label: "Solo female · recomposition · meals only",
    fields: { display_name: "ريم", birth_year: "1991", height_cm: "164", weight_kg: "70", target_weight_kg: "66" },
    preferred: [/إعادة تكوين|ريكومب|recomp/, /نشاط متوسط|متوسط/, /نادراً/],
    scope: "meals",
    expect: "recomposition mapping; near-maintenance calories with high protein",
  },
  {
    key: "solo-maintain",
    label: "Solo female · maintain weight · meals only",
    fields: { display_name: "الجوهرة", birth_year: "1989", height_cm: "161", weight_kg: "58", target_weight_kg: "58" },
    preferred: [/ثبات الوزن|الحفاظ/, /نشاط خفيف|خفيف/, /نادراً/],
    scope: "meals",
    expect: "maintain → no deficit; target ≈ TDEE",
  },
  {
    key: "solo-athletic",
    label: "Solo female · athletic performance · meals+workout",
    fields: { display_name: "شهد", birth_year: "1998", height_cm: "170", weight_kg: "63", target_weight_kg: "63" },
    preferred: [/أداء رياضي|رياضي/, /نشاط عالي|عالي/, /أحياناً/],
    scope: "workout",
    expect: "athletic goal; high activity multiplier; workout plan also generates",
  },
  {
    key: "solo-health",
    label: "Solo female · improve health · no conditions · meals only",
    fields: { display_name: "أمل", birth_year: "1986", height_cm: "159", weight_kg: "75", target_weight_kg: "" },
    preferred: [/تحسين الحالة الصحية/, /نشاط خفيف|خفيف/, /نادراً/],
    scope: "meals",
    expect: "general_health with NO condition — must not require the doctor gate",
  },

  // ── Group C — lifecycle gap the 07/2026 fix closed ────────────────────────
  {
    key: "postpartum-nonlactating",
    label: "Postpartum 6mo, NOT lactating (formula-fed) · meals only",
    // months_postpartum used to be stored only for LACTATING owners, so a woman
    // who formula-feeds got no recovery rules at all. The wizard now asks
    // «هل ولدتِ خلال آخر 12 شهراً؟» when she is neither pregnant nor lactating.
    fields: { display_name: "بشاير", birth_year: "1994", height_cm: "166", weight_kg: "74", target_weight_kg: "66" },
    preferred: [/خسارة الدهون/, /نشاط خفيف|خفيف/, /نادراً/],
    force: [/^لست حاملاً|^لست حامل/, /^نعم$/, /^6$/],
    scope: "meals",
    expect: "postpartum question appears; months_postpartum stored; recovery clause NOT lactation calories",
  },
  {
    key: "pregnant-highrisk",
    label: "Pregnant · month 7 · HIGH-RISK · doctor gate must block",
    fields: { display_name: "غادة", birth_year: "1990", height_cm: "163", weight_kg: "77", target_weight_kg: "" },
    preferred: [/تحسين الحالة الصحية/, /نشاط خفيف|خفيف/, /نادراً/],
    force: [/^حامل$/, /^7$/, /^نعم$/],
    scope: "meals",
    expect: "high-risk → doctor confirmation REQUIRED before any generation is allowed",
  },

  // ── Group A — households. Beneficiaries = mom + members, housekeeper EXCLUDED.
  // On the starter trial (max_people: 1) the members are STORED and the tier-cap
  // interstitial fires; only mom's plan generates. Multi-member generation needs
  // a paid subscription — deferred, see the plan.
  {
    key: "fam-2",
    label: "Household 2 · mom + husband",
    fields: { display_name: "العنود", birth_year: "1990", height_cm: "165", weight_kg: "70", target_weight_kg: "63" },
    preferred: [/خسارة الدهون/, /نشاط خفيف|خفيف/, /نادراً/],
    scope: "meals",
    household: [{ label: "زوج", type: "toggle" }],
    beneficiaries: 2,
    expect: "husband stored in family_members; tier cap (starter=1) surfaces",
  },
  {
    key: "fam-3",
    label: "Household 3 · mom + husband + child(7)",
    fields: { display_name: "موضي", birth_year: "1988", height_cm: "162", weight_kg: "73", target_weight_kg: "66" },
    preferred: [/خسارة الدهون/, /نشاط متوسط|متوسط/, /أحياناً/],
    scope: "meals",
    household: [
      { label: "زوج", type: "toggle" },
      { label: "طفل", type: "stepper", count: 1 },
    ],
    beneficiaries: 3,
    expect: "child stored with birth_year; child planned by PORTIONS not BMR when it generates",
  },
  {
    key: "fam-4",
    label: "Household 4 · mom + husband + 2 children (7 and 12)",
    fields: { display_name: "نوف", birth_year: "1985", height_cm: "160", weight_kg: "76", target_weight_kg: "68" },
    preferred: [/خسارة الدهون/, /نشاط متوسط|متوسط/, /أحياناً/],
    scope: "meals",
    household: [
      { label: "زوج", type: "toggle" },
      { label: "طفل", type: "stepper", count: 2 },
    ],
    beneficiaries: 4,
    expect: "two children of DIFFERENT ages → different portion sizes",
  },
  {
    key: "fam-5",
    label: "Household 5 (+housekeeper) · mom + husband + 2 children + maid",
    // The cap boundary that is easy to get wrong: 5 PEOPLE in the house but only
    // 4 beneficiaries, because max_people excludes the housekeeper.
    fields: { display_name: "لولوة", birth_year: "1984", height_cm: "167", weight_kg: "79", target_weight_kg: "70" },
    preferred: [/خسارة الدهون/, /نشاط متوسط|متوسط/, /أحياناً/],
    scope: "meals",
    household: [
      { label: "زوج", type: "toggle" },
      { label: "طفل", type: "stepper", count: 2 },
      { label: "خدامة", type: "toggle" },
    ],
    beneficiaries: 4,
    expect: "housekeeper stored but NOT counted toward max_people; her language drives translation",
  },
  {
    key: "fam-6",
    label: "Household 6 · mom + husband + 3 children + second adult",
    fields: { display_name: "الجازي", birth_year: "1982", height_cm: "158", weight_kg: "82", target_weight_kg: "72" },
    preferred: [/خسارة الدهون/, /نشاط متوسط|متوسط/, /أحياناً/],
    scope: "meals",
    household: [
      { label: "زوج", type: "toggle" },
      { label: "بالغ ثاني", type: "stepper", count: 1 },
      { label: "طفل", type: "stepper", count: 3 },
    ],
    beneficiaries: 6,
    expect: "6 beneficiaries = the family-tier cap exactly; all 6 stored",
  },
];

export function getPersona(key) {
  const p = PERSONAS.find((x) => x.key === key);
  if (!p) {
    throw new Error(`unknown persona "${key}". Known: ${PERSONAS.map((x) => x.key).join(", ")}`);
  }
  return p;
}
