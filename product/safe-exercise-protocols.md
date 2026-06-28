# SAFE_EXERCISE_PROTOCOLS

Conservative per-condition prescription rules the unified skeleton **must adhere to**. Injected into
`STATIC_SYSTEM` as an ephemeral-cached block (like `SARA_COOKBOOK`), so it bills at ~10% after the
first call. The model proposes sessions; these rules **constrain** what it may propose. Safety
precedence is absolute: **these caps override the member's stated goal, always.**

> Implementation note (Fit Life): authored as `SAFE_EXERCISE_PROTOCOLS` in
> `packages/plan-engine/src/exerciseProtocols.ts`. It is **NOT** spliced into `STATIC_SYSTEM` (which
> is shared with the chat advisor and sent on every meal generation). Phase 2 injects it as its own
> gated cached block on the exercise-generation path only. **This document is the English source of
> truth for clinician sign-off**; the Arabic const is a faithful rendering of it.

Grounded in ACSM *Guidelines for Exercise Testing and Prescription*, 11th ed. (pregnancy Box 6.3/6.4 &
Table 6.6; hypertension & youth FITT tables; contraindications Box 4.1) and the ACOG/Canadian PA-in-
pregnancy guidelines they cite.

> ⚠️ **Pre-production sign-off required.** This is a conservative draft grounded in published
> guidelines. Before it gates real plans for pregnant, postpartum, or medical members, have it
> reviewed by a qualified clinician/exercise physiologist. The product already routes these members
> through mandatory doctor-consult; this library does not replace that.

---

## 0. Global hard rules (every member)

1. **Screening verdict is binding.** Use `intensityCeiling` and `intensityMode` from
   `computeExerciseScreening()` as hard caps. Never exceed the ceiling regardless of goal.
2. **No deficit for pregnant, lactating, or child members** — enforced in the EnergyBudget, restated
   here so the skeleton never frames a session as "burning for weight loss" for them.
3. **Exercise is a health floor, never a compensation loop.** Never tie session volume to "earning"
   food or to that day's intake. Intake is weekly-stable.
4. **MSK exclusions are mandatory.** Any flagged joint/injury removes loading and high-impact patterns
   for that region (see §6).
5. **Clearance gate.** If any GATE condition below is met, do **not** emit a vigorous plan — emit only
   light activity (or nothing) and surface the clearance requirement.

## 1. Universal stop-signs (surface to every exercise member)

Stop and seek care if: chest pain/discomfort, severe or unusual shortness of breath, dizziness or
fainting, palpitations or irregular heartbeat, or severe unusual fatigue. (Mirrors the onboarding
symptom screen — ACSM major signs/symptoms.)

---

## 2. Sedentary / deconditioned (no condition flags)

- **ENVELOPE:** start light-to-moderate; ACSM progressive transitional phase ~2–3 months before any
  vigorous work. Prioritize frequency and consistency over intensity early.
- **PROGRESSION:** increase one FITT variable at a time, gradually.

## 3. Pregnancy  *(ACSM Box 6.3/6.4, Table 6.6)*

- **GATE → refuse + require clearance** if any **absolute contraindication**: hemodynamically
  significant heart disease, incompetent cervix/cerclage, intrauterine growth restriction, multiple
  gestation at preterm-labor risk, persistent 2nd/3rd-trimester bleeding, placenta previa after
  26–28 wk, preeclampsia/pregnancy-induced or uncontrolled hypertension, premature labor, restrictive
  lung disease, ruptured membranes, severe anemia, uncontrolled thyroid disease, uncontrolled Type 1
  diabetes.
- **CAUTION → conservative + clearance** on relative contraindications: symptomatic anemia, eating
  disorder, extreme obesity, very sedentary history, orthopedic limitations, recurrent pregnancy loss,
  poorly controlled seizure/T1DM.
- **ENVELOPE (uncomplicated):** ≥150 min/wk or 20–30 min/day, most/all days (≥3 d/wk). **Moderate
  only**, governed by the talk test — RPE ~13–14 (6–20) / 5–6 (0–10). Previously inactive → reduce
  intensity/duration, not frequency.
- **TYPE:** walking, stationary cycling, swimming/aquafit, modified yoga/Pilates, low-impact aerobics,
  light resistance.
- **EXCLUDE:** maximal-effort work; contact/fall-risk/collision activity; supine-dominant positions
  after the first trimester; scuba; high-altitude novel exertion; hot/humid overexertion.
- **STOP-SIGNS (pregnancy-specific, Box 6.4):** vaginal bleeding or fluid leak, calf pain/swelling,
  chest pain, dizziness/faintness not resolving on rest, headache, muscle weakness affecting balance,
  regular painful contractions, shortness of breath before or persisting after exertion.
- **MODE:** talk-test / RPE-led; HR zones are unreliable in pregnancy.

## 4. Postpartum / lactating  *(staged by weeks + delivery type)*

- **NO deficit** — maintenance + lactation increment in the budget.
- **GATE:** before medical clearance to resume (commonly ~6 wk vaginal, longer for **C-section**),
  light mobility/walking and breathing only — no loading, no impact, no core flexion under load.
- **DELIVERY TYPE:** C-section → longer healing, delay abdominal/loaded work further.
- **PELVIC FLOOR / DIASTASIS flag:** exclude high-impact, heavy lifting, and crunching/flexion; favor
  pelvic-floor and deep-core rehab progressions before any loading.
- **PROGRESSION:** rebuild gradually from light; treat as deconditioned regardless of pre-pregnancy
  fitness.

## 5. Hypertension  *(ACSM FITT table)*

- **GATE → defer + clearance** if uncontrolled: resting systolic ≥180 and/or diastolic ≥110.
- **ENVELOPE:** aerobic ≥5–7 d/wk, **moderate** (40–59% HRR; RPE 12–13), ≥30 min/d; resistance at
  moderate intensity; add neuromotor 2–3 d/wk.
- **EXCLUDE:** heavy resistance and **Valsalva / breath-holding**; avoid large single-session jumps in
  any FITT variable.
- **MODE:** if `hrMeds = yes` (beta-blocker/CCB) → **RPE**, since HR is blunted (set by screening).

## 6. Type 2 diabetes / PCOS

- **ENVELOPE:** combined aerobic + resistance; aerobic most days, resistance 2–3 d/wk.
- **CAUTION:** if on glucose-lowering meds, note hypoglycemia awareness and timing; foot-care note for
  diabetes (appropriate footwear, inspect feet).

## 7. Children & adolescents  *(ACSM youth FITT)*

- **NO calorie/load targeting** — never prescribe to a kid like an adult.
- **ENVELOPE:** ≥60 min/day, mostly **play-based** moderate-to-vigorous aerobic; muscle- and
  bone-strengthening ≥3 d/wk *as part of* that 60 min; vigorous ≥3 d/wk.
- **TYPE:** unstructured active play, age-appropriate, enjoyable, varied. Strength work only with
  proper technique/supervision and light load.
- **EXCLUDE:** maximal-effort testing, heavy load, adult-style progression.

## 8. MSK exclusions (from `exercise_profile` flags)

Map each flagged region to removed patterns, e.g.:
- **Lower back** → no loaded spinal flexion/heavy hinge; favor neutral-spine, core stability.
- **Knee** → no deep loaded flexion/high-impact plyometrics; favor low-impact, controlled ROM.
- **Shoulder** → no overhead loading/heavy press; favor scapular stability, pain-free ROM.
- **Recent surgery** → treat region as off-limits pending clearance.

---

*Citations trace to ACSM 11th ed. (Boxes 4.1, 6.3, 6.4; Table 6.6; hypertension & youth FITT tables)
and the ACOG/Canadian pregnancy guidelines referenced therein. Numbers are conservative defaults —
confirm against the source and clinician sign-off before production.*
