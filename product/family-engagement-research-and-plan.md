# Family Engagement & Retention — Research + Build Plan

**Status:** Working draft (07/2026). Companion to `product/engagement-layer-brainstorm.md`.
Branch: `claude/family-leaderboard-design-48yt9l`.
**Central decision still open** — see §5. Nothing here is committed to build until the cooperative-vs-competitive fork is settled.

**Owner brief that started this:** _"A leaderboard where all the family members compete with each other in achieving goals… it should not be private… the leaderboard is first in terms of following the meals + following the exercises + achieving the goals. Most important is we keep the user engaged and paying — whatever works best with human behavior."_

---

## 0. How to read this

The owner's instinct is competition. The honest finding is that the behavioral-science evidence on competition is **genuinely mixed and partly supports that instinct** — but the culturally-specific evidence for *this* audience (Saudi women, one household phone, postpartum-inclusive) and the *paid-retention* (not just activity) evidence both point to a **cooperative family-team with upward aspiration**, not a public head-to-head ranking. This doc lays out both sides so the call can be made on evidence, not vibes.

> ⚠️ **Verification caveat.** The deep-research run's adversarial verification stage was rate-limited and did not complete. Claims below are attributed to named sources and cross-checked against well-established literature, but the specific industry percentages (RevenueCat/Adapty/vendor blogs) should be treated as *directional, not audited*. The peer-reviewed RCTs (Centola; Patel STEP UP) and the Gulf-specific studies are the load-bearing evidence and are described from their abstracts/snippets. A re-verification pass is queued.

---

## 1. What the research actually says

### 1a. Competition works on behavior — this is real, don't dismiss it
- **Zhang, Brackbill, Yang, Centola — 4-arm RCT, 790 people** (Preventive Medicine Reports). Weekly exercise-class attendance: **competition/social-comparison 35.7, comparison+team 38.5, control 20.3, social-support-only 16.8.** Social comparison drove ~90% more activity than non-comparison arms — and **pure social support performed *worse* than control.** Direct challenge to any "cooperation always wins" assumption.
- **Patel et al. — STEP UP RCT, 602 adults, JAMA Internal Medicine 2019.** 24-week intervention + 12-week follow-up. **Competition produced the largest step gains AND was the only arm whose effect persisted after incentives were removed** (+569 steps at follow-up, P=.009). This is the *durability* signal that matters for retention, not just a short-term DAU spike.

**Caveats that matter for us:** both studies pit **arm's-length strangers** against each other, measure **activity/adherence not 6–12-month paid retention**, and STEP UP's competition was carefully, equitably designed. Response is **heterogeneous** (STEP UP secondary analysis: socially-motivated people benefit most; less-social/at-risk people respond weakly) — a single competitive mechanic helps some household members and disengages others.

### 1b. …but naive public ranking demotivates the bottom and can harm
- **Social comparison is asymmetric** (Computers in Human Behavior 2022): **upward** comparison raises self-efficacy and motivation; **downward** comparison *thwarts* it and predicts **less** activity. A leaderboard forces most participants into the unfavorable position by construction.
- **"Excess competition" is a named harm vector.** BJPsych Open qualitative study lists eight negative consequences of diet/fitness apps — including **excess competition** — that trigger/reinforce disordered eating, with weight-as-proxy flagged as especially risky for women. Reinforced by the National Alliance for Eating Disorders and an AP (June 2026) clinician synthesis: streaks/points/targets convert routine logging into shame and, for those who already equate "thinner is better," binge-eating risk.
- **Streaks flip to anxiety.** UX-practitioner and clinical sources converge: once "keep the streak alive" overtakes the real behavior, you get **anxiety-driven retention** and **streak-loss churn**. Forgiveness patterns (log a rest day without breaking the streak; guest days honored) are the mitigation.

### 1c. The durable-motivation framework is SDT, and it favors autonomy + relatedness
- **mHealth SDT SEM study (JMIR/PMC):** continued use is driven by **autonomous** motivation (autonomy/competence/relatedness); controlled/extrinsic motivation predicts long-term maintenance far worse. A competitive leaderboard pressures autonomy rather than supporting it → weaker long-term bet.
- **Gamification meta-analysis (Springer ETR&D):** gamification reliably lifts **autonomy and relatedness**, but has **minimal effect on competence** — i.e., the durable levers are choice-preserving, cooperative, social-connection framings, not competence-signalling ranks.
- **Motivation-crowding (Frontiers in Psychology 2024):** extrinsic rewards can "crowd-in" motivation in some designs, but **over-reliance fails once the reward stops.** Effect is contingent on design, not automatic.

### 1d. Habit durability = identity + easy + felt success (not points)
- **Fogg (B=MAP):** raising **Ability** (making the healthy action easier) is more sustainable than pumping Motivation; **"you change best by feeling good, not by feeling bad"** — habits consolidate through felt success, not guilt/shame.
- **Clear (identity votes):** durable habits attach to **identity** ("I'm someone who feeds my family well"), not outcomes or external rewards. Each action is a vote for a self-image.
- **Fogg vs Eyal:** durable retention needs the **reinforcement loop** (Trigger→Action→Reward→Investment), not just the first action — but bounded by Eyal's own "regret test."

### 1e. What actually drives PAID retention (the money question)
- **Motivation loss is the #1 churn driver (~38%)**, ahead of cost and lack of personalization/progress-tracking (Lifecycle Architect). The leaderboard targets motivation — legitimate — but personalization/progress is the adjacent, under-built lever.
- **Activation = delivered value, not onboarding completion.** The "aha" is a first personalized insight/meal/workout. Fitness apps lose 60–70% of signups in week 1 by never reaching it; users without ~3 completions in week 1 churn 4–5×; a 10-pt Day-1 activation lift → 15–20% better 30-day retention.
- **Accountability partner → 2–3× higher 90-day retention** (Sahha). The strongest social-retention stat found — and it's **support/accountability, not competition.**
- **Annual billing is the biggest LTV lever in Health & Fitness** (RevenueCat: category RLTV ≈ $35.64, ~68% annual). But annual renewal at the year mark is only ~25%, ~35% of annual cancels happen in month 1, and **~95% of cancelled annual subs never return** → **prevention >> win-back**, and the pre-renewal + first-month windows are where retention is won or lost.
- **H&F has the highest trial-to-paid (~35%) but the lowest first-renewal (~30%)** (Adapty) — acquisition is easy here, *keeping* people is the hard part. Baseline is brutal: ~46.8% of premium subs churn within 90 days.

### 1f. Gulf/Saudi-specific evidence — the tiebreaker for THIS product
- **CHI 2026, "No One Should Know I Used This App"** (20 young Saudi women): privacy in the GCC is a **collective** value tied to **family honor and social conformity**, not an individual concern; using a wellness app can carry fear of being "discovered." **Public ranking/social-comparison mechanics misalign with these values.** Surface-level Arabic translation of Western designs limits adoption.
- **Twazon** (JMIR mHealth 2019) — a purpose-built Arabic weight-loss app for Saudi women: 83% attrition over 4 months; engaged users got real results (−1.3 kg, −4.9 cm waist). Crucially, the **social-network feature was rated *most in need of improvement*, while the individually-useful trackers were most favored** — for this exact audience, social/competitive mechanics were *not* what drove value or retention.
- **Weight-management apps in Saudi Arabia** (JMIR 2020): Arabic apps showed the **lowest engagement despite high functionality** — bolting on features (including gamified/social) doesn't create engagement; **culturally-relevant delivered value** does.
- **Menopause co-design** (BMC Public Health 2026) + **Saudi women PA beliefs** (2023): what motivates is content that **validates lived challenges and makes her feel understood/empowered**, and **aspirational upward modeling** (~60% motivated by watching active influencers) — *not* head-to-head competition. Lack of family support is a barrier, so **family-as-support** is the culturally-fit social lever.

---

## 2. Synthesis — where "max engagement" and "max paid retention" diverge

| Lever | Short-term engagement (DAU) | Durable paid retention (LTV) | Verdict for Fit Life |
| --- | --- | --- | --- |
| Public head-to-head ranking | ↑ (for the socially-motivated) | ↓ for the bottom 60%; culturally corrosive here; ED-risk | **Avoid as public ranking** |
| Competitive *energy* (a shared target, momentum) | ↑ | ↑ if framed cooperatively/aspirationally | **Keep the energy, change the shape** |
| Cooperative family-team goal | ↑ (relatedness) | ↑ (SDT + family-as-support + one-subscription model) | **Core mechanic** |
| Upward aspiration (celebrate the leader, no designated loser) | ↑ | ↑ | **Yes** |
| Honest-ritual scoring (point for the act of marking, not the outcome) | neutral | ↑ (keeps AI data clean, no lie-taps) | **Yes — non-negotiable** |
| Streaks (punitive) | ↑ then ↓ | ↓ (anxiety, streak-loss churn) | **No** (self-referential "weeks honored" only, per existing contract) |
| The adaptive loop («سارة عدّلت خطتك») | ↑ | ↑↑ (attacks #1 churn driver: motivation loss + personalization) | **Highest ROI, already 80% built, no UI** |
| Annual-billing nudge at a milestone | — | ↑↑ (biggest LTV lever) | **Yes, timed to a win** |

**The reconciliation:** capture competition's *momentum and visibility* through a **cooperative family season with upward aspiration and honest-ritual scoring** — everyone pulls the same rope toward a shared house goal, the leader is celebrated, no one is ranked last, the numbers (weight) never appear, and points are earned by *honestly marking* (following the plan or truthfully saying you didn't), never by the outcome. This is exactly the "comparison scaffolded by support" middle path that the 2025 Frontiers retention study found sustainable, and it's the only shape that survives the Gulf collective-privacy and ED-harm evidence.

This also **agrees with the guardrails we already checked into** `engagement-layer-brainstorm.md` §6 and `CLAUDE.md` (no shame states; rewards never on adherence counts; children never compared; housekeeper never surveilled; weight private even inside the family; solo mode never degraded). Those weren't arbitrary — the research is why.

---

## 3. The plan (sequenced by retention ROI, not by which feature is flashiest)

### Phase 0 — Turn on the loop we already built (highest ROI, no leaderboard)
The single biggest retention miss today: **`week_changes` («سارة عدّلت خطتك») ships inside `plan_data` but has no customer-facing UI.** The "app that learns you" is the aha the retention data rewards, and it's already generated.
- **0.1** Build the «سارة عدّلت خطتك» card at the top of `PlanViewer` (data already there — `schema.ts` `week_changes`). Shows what Sara changed this week and *why*, citing the family's real marks.
- **0.2** Wire a write surface for verdicts / day-close. `closeDay` and `meal_verdicts` exist but **no UI calls them**, so golden-dishes/vetoes/top-dish are starved. A lightweight «ختام اليوم» sheet feeds the loop.
- **Why first:** attacks the #1 churn driver (motivation loss / "it doesn't adapt to me") and creates the reinforcement loop Fogg/Eyal say durability requires — before adding any social layer on top.

### Phase 1 — «موسم بيتنا» (working name): the cooperative family season
The reframed "leaderboard." A weekly **shared** season, opt-in adults, aligned to the plan week.
- **1.1 Honest-ritual scoring.** A member earns the same contribution for `طبختها` (cooked) as for `تجاوزتها + طلبنا اليوم` (honestly didn't) — the point is for *marking*, never the outcome. Ungameable by design; keeps the AI's training data clean (guardrail 8). Score = % of *your own* week's commitments honored.
- **1.2 Cooperative shape.** Every member's honest marks add to a **family total** toward a shared house goal («أكملنا موسمنا»), not a ranked list. The most-consistent member is **celebrated** (upward aspiration), but there is **no designated last place** — soft rendering for everyone below, never red, never a number.
- **1.3 Membership:** opt-in adults (mom + 18+). **Children** get a non-ranked celebration lane (curiosity milestones, self-referential — never compared, per the killed inter-sibling crown). **Housekeeper never appears.** **Solo households never see it** (guardrail 7 — the feature disappears, not degrades).
- **1.4 Identity framing** over points: «أنتِ من يعتني ببيته» — Clear's identity vote, not a score-shaming tone.
- **PDPL:** any new table joins `/api/account/export` + hard-delete in the same PR (guardrail 10).

### Phase 2 — Workout tracking (prerequisite for the "following exercises" pillar)
**There is no workout completion tracking anywhere today** — `WorkoutViewer` is read-only. The exercise pillar of the owner's brief cannot exist without this, and it's valuable standalone.
- **2.1** Migration `00020`: `workout_checkins` (per-member, `local_date`-stamped like meals; sessions keyed by `workout_plan_id + member_id + day_index`; include the DELETE policy from day one — the trap 00017 hit).
- **2.2** Session check-in UI in `WorkoutViewer` (mirror the MealCard chip pattern: done / honestly-moved / skipped, 48h grace window, no future pre-marking).
- **2.3** Feed workout marks into Phase-1 scoring as the movement pillar.

### Phase 3 — Goal achievement as public *celebration*, private *numbers*
The owner's "achieving goals" pillar — done without ever exposing weight.
- **3.1** Milestone events: when an eligible adult reaches their target, fire a family-visible **«أنجزت هدفها»** celebration. The **achievement is public; the kilograms are never** on any shared surface (weight stays route-isolated on `/journey`). This is the "public goal" the owner wants, shorn of the ED/privacy hazard.
- **3.2** Self-referential «إيقاع أسبوعك» ring (already specced) as each member's private progress, feeding a *positive* contribution to the season.

### Cross-cutting retention levers (from §1e — do these regardless)
- **Annual-billing nudge timed to a win** (season completed / goal milestone), not a countdown. Biggest LTV lever; ~95% of cancelled annuals never return, so prevention is everything. The existing `RenewalRecapCard` is the surface.
- **Fast activation:** get a first «سارة عدّلت» moment inside week 1.
- **No cancel-flow dark patterns** — FTC exposure (~76% of subscription apps use ≥1 dark pattern; "click to cancel") and, for a trust brand, corrosive. Our contract already bans confirm-shaming; keep it.

---

## 4. What this is NOT (explicit non-goals, from the evidence)
- Not a public head-to-head ranking of family members on adherence.
- Not weight/goal *numbers* on any shared surface.
- Not streak-flames or punitive streaks (self-referential "weeks honored" only).
- Not children compared to each other, ever. Not the housekeeper on any board.
- Not rewards attached to adherence counts (lie-taps poison the AI).

---

## 5. The one decision that gates everything

**How competitive is the shape?**

- **Option A — Cooperative family season (recommended by the evidence).** Shared house goal, upward aspiration, celebrate the leader, no designated loser, honest-ritual scoring, no numbers. Best fit for Gulf collective-privacy + ED-harm + paid-retention evidence, and consistent with the guardrails already in the repo.
- **Option B — Soft head-to-head ranking, adults opt-in.** A visible per-member order. Stronger short-term activation for the socially-motivated (Centola/STEP UP), but the bottom-of-board demotivation, the Gulf privacy/honor risk, the Twazon "social feature least valued" signal, and the ED-harm evidence all cut against it — and it requires **amending §6 of the contract and CLAUDE.md**, which both red-teams wrote.
- **Option C — Hybrid.** Cooperative family total as the headline (public), with an *optional, private-to-each-member* "how am I doing vs. my own best" self-comparison. No cross-member ranking surfaced.

**Recommendation: A, with C's self-referential private view.** It keeps the competitive *energy and momentum* the owner wants, is the durable-retention play for this specific audience, and doesn't require unwinding safeguards the research just independently validated.

---

## 6. Open sub-decisions (after §5 is settled)
1. Sequence: Phase 0 first (recommended — higher retention ROI) or lead with Phase 1?
2. v1 pillars: meals-only first, or build workout tracking (Phase 2) into v1 so "exercise" counts from launch?
3. Weighting when a member has all three pillars — strawman meals 45 / movement 35 / rituals 20, redistributed when a pillar is absent.
4. A فصحى name that passes guardrail 9 (candidates: «موسم بيتنا», «معاً», «رحلة بيتنا» — «تحدّي» implies competition, use with care).
