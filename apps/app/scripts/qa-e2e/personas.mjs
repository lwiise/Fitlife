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
    label: "UNDER-18 owner — signup accepts it (pinned known bug)",
    // deadEnds.test.ts pins this: the owner is planned with adult BMR/TDEE while
    // assembly stamps is_child. Checking whether it is still live in prod.
    fields: { display_name: "جود", birth_year: "2011", height_cm: "155", weight_kg: "50", target_weight_kg: "" },
    preferred: [/تحسين الحالة الصحية/, /نشاط خفيف|خفيف/, /نادراً/],
    scope: "meals",
    expect: "either rejected at signup/wizard, or generates with adult targets (the bug)",
  },
];

export function getPersona(key) {
  const p = PERSONAS.find((x) => x.key === key);
  if (!p) {
    throw new Error(`unknown persona "${key}". Known: ${PERSONAS.map((x) => x.key).join(", ")}`);
  }
  return p;
}
