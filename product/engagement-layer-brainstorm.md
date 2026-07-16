# Fit Life 2.0 — Engagement Layer Brainstorm
### Streaks · Progress Tracking · Family Leaderboard — rebuilt for a Gulf household

**Date:** 2026-07-14
**Status:** Brainstorm / product direction — nothing here is committed to build yet.
**How this was produced:** 5 codebase-mapping passes (dashboard, plan viewers, data layer, channels/tiers, family model) → 6 independent ideation lenses (behavioral science, Gulf culture, family dynamics, product mechanics, retention economics, differentiation) → 2 adversarial red-team passes (cultural safety + clinical guardrails; cheap-gamification + feasibility). ~45 raw ideas were generated; what follows is the surviving, sharpened set.

---

## 1. The thesis (read this first)

The extraordinary version of this feature is **not** streaks, points, or a leaderboard. Every competitor has those, and on this brand (premium, فصحى, warm-confident) generic gamification is poison — the codebase itself contains old comments explicitly rejecting "fake per-meal completion," and that instinct was correct.

The extraordinary version is a closed loop nobody else can copy:

> **The mom tells the app what her house actually cooked and what her family actually loved — and next week's AI plan visibly changes because of it, and tells her why.**

"سارة عدّلت خطتك: فطورك صار أخف تحضيراً — لاحظنا أنه أكثر وجبة تفوتك."

That single sentence converts check-ins from engagement theater into **steering**. After eight weeks, the plan is measurably *hers* — her family's palate, her hosting rhythm, her Fridays. Leaving Fit Life would mean abandoning her family's taste memory and starting from zero with a stranger. That is the retention moat: **the plan that learns you** (خطة تشبهك). Streaks, progress, and family mechanics all exist to feed and celebrate that loop — never for their own sake.

Three structural insights from the codebase and culture shape everything below:

1. **Only the mom logs in.** Family members are data rows; the housekeeper's view runs inside the mom's session. So v1 mechanics must work through one phone in ≤15 seconds a day, and multi-member participation is an infrastructure project (tokens), not a UI project.
2. **The honest unit is "I cooked it," not "they ate it."** The mom can truthfully verify what left her kitchen. One tap on a shared dish should cascade to everyone who eats it — that's the product's "one سفرة" insight expressed as a mechanic.
3. **Hospitality is the streak-killer — and the signature opportunity.** Every Western streak punishes the عزيمة. A Gulf-native product marks guest days **gold** and counts them as honor. This one design decision is the loudest possible "built for this house, not translated into it."

Bonus urgency: the pricing page **already sells** "weight & measurement tracking," "before/after photos," "weekly reports," and "monthly family reports" — none exist in code. Parts of this layer aren't new promises; they're honesty debt.

---

## 2. What the codebase gives us (verified 07/2026)

**Ready-made anchors**
- Stable identity keys for events: `member_id` (`"mom"` | `family_members.id` UUID) + `day_index` (0–6) + `slot` (`breakfast/lunch/dinner/snack`). Meals have **no UUIDs** — identity is positional/name-based.
- `weight_kg` + `target_weight_kg` per adult (single scalars — no history table anywhere).
- Per-member `daily_calories_target`, macros, `day_total` already in `plan_data`.
- The dashboard stat-card grid has an open 5th slot; `TodaysMealsClient` already receives `planId` (currently unused — it was waiting for check-ins).
- `chat_messages` (metadata-only, RLS `user_id`-scoped, `(user_id, created_at)` index) is the house pattern for any new event table.
- The Netlify background-function dispatch pattern (`dispatch.ts` + `x-internal-secret`, per-kind idempotency locks) is reusable for new generation modes.
- wa.me deep-link sharing exists client-side (zero backend).
- Admin already computes trial watchlists and retention cohorts — the targeting brain for lifecycle work exists.

**Hard constraints**
- **No event/tracking tables of any kind.** Everything is current-state.
- **No push, no email (RESEND_API_KEY is an unwired placeholder), no SMS, no scheduler/cron.** In-app pull + wa.me is the entire channel inventory today.
- Meal `day_index` is week-start-anchored; workout `day_index` is weekday-anchored → every event row must also stamp a **`local_date`** (Riyadh) at write time as the universal join key.
- Weekly regeneration replaces `plan_data` wholesale (new row, old → archived); per-member regens swap slices in place → completion/vote data must survive by `local_date` + a server-minted **`canonical_key`** per recipe, never by array index.
- The Anthropic prompt uses a **cached `STATIC_SYSTEM` block** — all dynamic personalization digests must live in the per-request context, and must be threaded through **both** `buildContext.ts` **and** the background function's SDK-free mirror (this repo has already been bitten by missing the mirror).
- Migrations are applied manually to prod; next number is **00017**.

---

## 3. The engagement architecture

One data spine, four surfaces, one payoff:

```
                    ┌─ THE SPINE (new tables, week 1) ─────────────────┐
                    │ meal_checkins   (plan_id, day_index, slot,       │
                    │                  local_date, status, reason)     │
                    │ member_exceptions (sparse; dish-directed only)   │
                    │ meal_verdicts   (canonical_key, member_id, vote) │
                    │ body_logs       (member_id, recorded_on, kg)     │
                    │ canonical_key minted server-side at plan persist │
                    └──────────────────────────────────────────────────┘
   feeds ↓                    feeds ↓                    feeds ↓
┌───────────────┐   ┌─────────────────────┐   ┌────────────────────────┐
│ DAILY RITUAL  │   │ WEEKLY PAYOFF       │   │ PROGRESS & VALUE       │
│ ختام اليوم    │   │ خطة تشبهك +         │   │ رسالتك الأسبوعية +     │
│ ≤15 sec,      │   │ "سارة عدّلت خطتك"   │   │ وزنكِ الخاص (private)  │
│ retroactive   │   │ evidence-cited      │   │ + wa.me share card     │
└───────────────┘   └─────────────────────┘   └────────────────────────┘
                              ↑
              phase 2: the cook's «تم الطبخ» token view
              (ground-truth adherence, zero mom effort)
```

**The data-honesty contract (cross-cutting, non-negotiable):**
- Unanswered = unknown. Never prefill "cooked," never count silence as "skipped."
- Sara only claims what the event log can prove; sparse week → she says so or stays silent. Fabricated insight ("لاحظنا أنك…") about an unlogged week is the fastest way to make the product read as نصب.
- **Rewards may attach to rituals and verdicts — never to adherence counts.** The moment a streak reward depends on self-reported cooking, lie-taps poison the very data the AI learns from.

---

## 4. The feature catalog (survivors, sharpened by red-team)

Effort: S ≈ days, M ≈ 1–2 weeks, L ≈ 3+ weeks. ★ = signature potential.

### Tier 1 — The core loop (v1)

#### 4.1 ختام اليوم — the honest daily check-in (M)
One screen, three big chips per meal slot: **طبختها كما هي / بدّلتها / تجاوزتها**, with reason chips on swap/skip (ضيوف، أكلنا خارج البيت، طلبنا اليوم، ما توفرت المقادير). Shared dishes cascade one tap → all members eating that recipe; a rare per-member exception is **dish-directed** («ما ناسبه الطبق هذه المرة»), never child-consumption surveillance («ما أكل» is banned copy).
- **Retroactive-first:** the mom's natural visit is *morning* ("what do I cook today"), so the sheet opens on yesterday with a 48-hour grace window. No push channel needed.
- Budget: **under 15 seconds** or it dies by week 3.
- «طلبنا اليوم» (delivery) is a first-class, shame-free answer — HungerStation is Riyadh reality; if takeout feels like confession, logging stops.
- Build: `meal_checkins` keyed household-level `(meal_plan_id, day_index, slot)` + `local_date`, **extensible slot enum** (Ramadan will add سحور/إفطار/غبقة — design the keys now, build the season later). Lives in `TodaysMealsClient` (its unused `planId` prop finally earns its keep) + inline on `MealCard`.

#### 4.2 أصوات المائدة — the table's verdict ★ (M, folded into 4.1's sheet)
On any cooked dish: member avatars with three states (أحبه / عادي / ما يُعاد). Verdicts are recipe-directed by copy design — a husband's "not again" critiques *Sara's recipe*, never his wife's cooking. Three wins → the dish turns gold and enters **أطباقنا الذهبية**, the family hall of fame; golden dishes are deterministically injected into the next generation's skeleton (like the exercise catalog embed — never trust model compliance for a promise containing "guaranteed").
- Vetoes become Arabic avoid-clauses in the dynamic prompt; a vetoed dish reappearing under a synonym is a trust-destroying event, so identity rides the server-minted `canonical_key` (normalized name + primary protein), minted **before** the first vote row ever lands.
- Child refusals trigger **re-introduction logic** (same ingredient, different preparation, spaced retries — exposure science says 8–15 tries), not exclusion, or every picky household converges on beige food in two months.
- Kids' angle is **self-referential only**: each child earns their own «مغامرة» milestone per new food *tried*. The inter-sibling "مغامر المائدة" crown was killed by red-team — a weekly courage contest between siblings creates a designated loser and pressures the picky (often neurodivergent) child. No sibling comparison, ever.

#### 4.3 خطة تشبهك — the plan that learns you ★★ (M, the payoff)
At generation time, a bounded (~500-token) adherence + verdict digest goes into the **dynamic** prompt block (both `buildContext.ts` and the bg mirror; never the cached static block). The model must emit `week_changes[]` (max 3): `{change_ar, because_ar}` — rendered as **«سارة عدّلت خطتك»** cards at the top of `PlanViewer`.
- **Minimum-signal guard:** below N real events, the section is omitted entirely. Silence beats fabrication.
- Every `because_ar` must cite renderable evidence («تجاوزتم عشاء الثلاثاء والخميس») and lead with the adaptation, never enumerate failures.
- Killed by red-team: the fake WhatsApp-voice-note skin (deceptive skeuomorphism — users will tap play). The changelog card *is* the value.

#### 4.4 رسالتك الأسبوعية + حصاد الأسبوع — Sara's letter and the value receipt ★ (M)
Lazily generated on first visit after the plan week ends (the `dayIndex > 6` condition already exists in `TodaysMealsClient`) — no scheduler needed. Contents: cooked-days count vs her own rhythm, the week's golden dish, kids' new-food milestones, weight delta (private section), and one forward intention. Plus the **receipt**: real counts only — «٢١ وجبة مخططة، ٥ أفراد، ٣ لغات». The "≈400 SAR nutritionist equivalent" framing was killed for the weekly surface (infomercial smell + inviting a weekly cancel-question) — that math moves to the **cancel flow**, where value defense belongs.
- v1 letter is **template + computed numbers, zero LLM prose** (protects margin on the 29 SAR tier); LLM prose becomes a pro+ upgrade later.
- The wa.me share card is a separate artifact: aggregate, positives-only, **schema-incapable** of containing weight, skips, or any per-member health detail. Mom's family group is a status surface; no card may ever embarrass her.
- This retires the promised-but-unbuilt "weekly reports" (and later, a monthly rollup covers "monthly family reports").

#### 4.5 وزنكِ الخاص — the private weight journey (M)
Weigh-in sheet gated to the existing weekly regeneration tap (prefilled **masked** — tap-to-reveal; this phone gets handed to the housekeeper and children), skippable forever without nagging. Writes dated `body_logs`; sparkline toward `target_weight_kg` lives only behind deliberate navigation, unreachable at the *routing* level from any cook/child/shared surface, never in letters or share cards.
- Plateau ≥3 weeks → a **visible supportive plan response** («سارة عدّلت سعراتك») via a deterministic in-code calorie rule (the `activityLevel.ts` derivation pattern) — a naked flat line is churn's best moment.
- Pregnancy/postpartum profiles: no target sparkline, no loss framing (clinically wrong). Adults 18+ by `birth_year`, not just `member_type`. Weekly cap, no red negative-delta coloring, one-tap target removal — the 25-45 postpartum demographic is the *actual* elevated ED-risk group; the set was careful about children and nearly forgot her.
- Retires the promised "weight & measurement tracking."
- PDPL: `body_logs` (and every new table) joins the /settings export + hard-delete in the same PR that creates it.

### Tier 2 — Rhythm and ritual (fast follows)

#### 4.6 إيقاع أسبوعك — the forgiving streak (S–M, after 2+ weeks of live check-in data)
The mom declares her week (3–7 cooking days; Friday-out families deselect Friday; a travel week = صفر, excluded, streak intact). A ring fills against **her own** target; the counter that persists is **weeks honored** («الأسبوع السادس على عهدك») — never consecutive days. One repair per week via a reason chip, and the reason feeds the AI digest (frequent «ضيوف» → Sara builds a flexible hosting day into next week).
- **إكرام الضيف:** guest days are marked **gold** and *counted* — recorded and celebrated, never "pardoned" (إذن/pardon framing was killed: no Saudi woman needs an app's permission to be generous; hospitality is identity, not deviation).
- Killed: all flame/fire iconography (no dignified فصحى name exists for a "streak flame" — and when a mechanic can't be named in the brand voice, that's a kill signal, not a copywriting task). Purple/gold ring, restrained.
- No rewards attach to the count (data-honesty contract).

#### 4.7 جمعة البيت — the Friday table ★ (S, a skin over 4.1–4.3, not a new system)
Thursday: the dashboard reveals Friday's centerpiece lunch as a hero card (one deterministic skeleton rule marks Friday with a centerpiece requirement + a log-only compliance guard, same pattern as the cookbook guard in `generate.ts`). The polished deliverable is the **WhatsApp invitation card** — «غداء الجمعة عند أم سلطان: مندي بالفرن» — with whisper-quiet app branding: a forwarded card in the in-law group must read as *her* invitation, not a Fit Life ad. Friday evening: a 3-chip verdict that feeds the digest.
- First-class **«الجمعة عند الأهل»** state: rotational extended-family Fridays count as the table honored — the ritual must never punish the most cherished version of itself.

#### 4.8 ضيوف الليلة — guest mode ★ (M–L)
«عندنا ضيوف الليلة» → 3 questions (how many, lunch/dinner, عادي أم عزيمة) → a hospitality add-on menu appears *beside* the week's plan (never wiping it), flows into the housekeeper's translated view, and offers an invitation share.
- **Latency is the feature:** a 6pm guest panic can't wait on the 6-minute two-phase pipeline. Build as a single-call, small-budget, streamed generation — sub-60 seconds or don't ship.
- **The AI never experiments on guests.** Menus draw from the family's golden dishes + the classical hospitality repertoire (كبسة، مندي، جريش) with conservative, generous headcount math. The عزيمة is not a diet moment: no calories, no "healthy" framing, no visible branding to guests. One failed novel recipe in front of fifteen guests is the single worst outcome this product can produce.
- Measured as a monthly moment-of-magic and share-driver, never as DAU.

#### 4.9 قائمة السوق — the grocery list (S–M, pure utility)
Aggregated ingredients for the week (shared-mode quantities from `per_member_portions`), organized by section, checkable, PDF-able via the existing exporter — timed to surface Thursday (the national shopping evening). Red-team's sleeper insight: **utility out-retains gamification every time**, and checked-off items are a passive prior on "will she cook it" — free adherence signal with zero logging burden. This was buried as a footnote in the raw ideas and deserves first-class status.

### Tier 3 — The un-copyable moat (phase 2–3)

#### 4.10 مفاتيح البيت — member access tokens (M–L, **infrastructure, not a feature**)
Signed, revocable token URLs (`/m/[token]`) minted and revoked only by the mom. **v1 = exactly one token type: the cook.** Husband/child views ship only after cook-token telemetry proves non-mom taps happen (realistic adoption: cook daily — valuable; husband occasionally; child novelty-then-zero; building three bespoke view types ×7 languages up front is how this dies half-finished).
- Tokens *will* be forwarded into WhatsApp groups — design leak-harmless by construction: no PII beyond the plan slice, short-lived, one-tap revoke/rotate in settings from day one, writes via API route with service-role + token verification.
- Route-level scope audit: no surface reachable from a husband/child token may render the mom's goal, weight, or target strings. A child token is pull-only, no calories, no settings — and never receives prompts of any kind.

#### 4.11 تم الطبخ + جواز الوصفات — the cook's tap and her recipe passport ★★ (M, gated on 4.10)
The housekeeper's translated view (on her token) gains one giant button per recipe: **«تم الطبخ»** in her language. Her tap is `source='cook'` — the highest-integrity adherence signal in the entire system, captured by the only person actually at the stove, powering the whole loop with **zero mom effort**. Cooking a recipe family 3 times stamps it "mastered" into her **Recipe Passport**.
- **Honest framing (red-team):** this is task *coordination*, which is normal in an employer household — design it as coordination and **hard-ban derived analytics**: no per-cook completion rates, no history views, no streaks on her, nothing exportable about her performance. Unconfirmed renders neutral, never red — the app must not manufacture employer-employee friction (she cooked but didn't tap: her hands were wet, the tablet was off).
- The morning card is «تحضيرات اليوم» (never «أمر المطبخ» — command-register aimed at an employee was flagged and killed).
- The passport is real only if it's **hers**: a portable culinary-skills record (recipe families, cuisines mastered) exportable at offboarding — domestic workers change employers; if it evaporates when she leaves, the dignity promise was decoration. PDPL: she is a data subject who is not the account holder — minimal data, a deletion path, and her name on **no** share card without explicit opt-in.
- The mom gets a prefilled thank-you in the worker's language (genuinely useful — mom may not write Tagalog or Amharic) that she must *send herself*; one-tap scripted gratitude is hollow.
- This is the mechanic nobody else on earth can ship, because nobody else has the household's cook inside the product.

#### 4.12 مواسم البيت — the Ramadan/Hijri engine ★★ (L, **DEFERRED — founder decision 07/2026: out of scope for this initiative; revisit ~2 months before Ramadan 1448 ≈ Feb 2027**)

> Founder call: Ramadan is not near — we take care of it when Ramadan is around the corner. Nothing below is being built now. The ONLY obligation that survives into v1 is the extensible slot enum (one design decision, zero build), so that the season later becomes a config change instead of a data migration. Spec preserved for when we pick it up:
Ramadan flips the product natively: slots become **سحور / إفطار / غبقة** (generation prompts + check-in keys + viewer + cook view, ×7 languages), the day pivots on Maghrib, workout timing suggests post-taraweeh, Shawwal gets a gentle reset, and the season ends in a shareable static recap («اجتمعت سفرتكم ٥٤ مرة هذا الشهر»).
- **Today's only obligation:** keep 4.1's slot enum extensible. Build the season when it's ~2 months out — seasonal code shipped 7 months early rots.
- Red-team guardrails, all mandatory: Ramadan start/end via **remote-config keyed to the official announcement** (pre-computed Umm-al-Qura can miss the moon-sighting by a day — flipping to سحور mode early is unrecoverable credibility loss); the app never advises whether anyone *may* fast — medical questions get «استشيري طبيبك», religious ones «يُسأل عنها أهل العلم»; the tracker counts **home-cooked iftars only**, never fasts or any عبادة; a discreet **«يوم إفطار»** toggle restructures the day for non-fasting days and *never asks why* (menstruating/postpartum women don't fast — asking the reason would be the most intimate privacy violation in the product); Maghrib times carry «الإفطار مع الأذان» framing, never a countdown-to-eat.
- The cinematic "Wrapped" animation route was cut from season v1 (design-heavy build for a 30-day window); a beautiful static card covers 80% of the share value.

### Tier 4 — Lifecycle retention (cheap, ship alongside v1)

- **بيتكِ يُدار من هنا — day-3 trial checklist (S):** replace the passive trial countdown with three steps: أنشئي خطتكم ← شاركي عرض المساعدة (housekeeper handoff via wa.me) ← سجّلي أول يوم. Branch: households with no domestic worker never see the handoff step. The 7-day trial ends before the "plan learned you" payoff can manifest — either manufacture the aha by day 3–5 (handoff + one honored veto via manual regen) or test a 14-day trial.
- **ذاكرة مائدتكم — the family ledger (S–M):** lifetime counts (weeks, meals, members, languages) + a heart on `MealCard` saving recipes into the family's own cookbook. Shown **once, factually** in the cancel flow — and the loss-proof promise must be real: ledger + saved recipes exportable as PDF *after* cancellation, or it's memory-hostage-taking that converts churned users into detractors.
- **استراحة السفر — travel pause (S–M):** LemonSqueezy pause API surfaced *before* cancel, proactively bannered in early June (the Gulf summer-exodus churn event). Paused state keeps the ledger visible; return = one-tap regeneration. Pauses count as saves in admin cohorts.
- **عام على مائدتكم — renewal-week recap (S):** within 7 days of `current_period_end`, a celebratory factual recap + the annual-switch math (١٢٣٨ بدلاً من ١٥٤٨). No countdowns, no red.

---

## 5. Killed ideas — and why (keep this list; these will be re-proposed someday)

| Idea | Why it died |
| --- | --- |
| **دوري البيوت — ranked league of houses** | Both red-teams, independently: ranking ~20 households on feeding-the-family guarantees a visible bottom third in a culture where the سفرة is the woman's public honor; kunya + city + family size is *not* anonymous (it's exactly how neighbors identify each other); needs matchmaking scale, a nightly rollup scheduler, and verified units — none exist; competitive scoring over self-reports guarantees lie-taps that poison the AI's training data for everyone. Salvage (later): absolute-bar cohort "seasons" — every house that honors *its own* rhythm earns the crest; aggregate counts only («٣٤٠ بيتاً أكملت موسمها»); no ranking, no names. |
| **نبض السفرة — composite 0-100 household score** | A weekly grade on her homemaking — a "62" is a weekly insult delivered by a paid service. "Gathered" and "variety" sub-rings measure nothing real. The one honest ring (cooked-rate) folds into the weekly letter. |
| **Growth trees / constellations (بركة البيت)** | FarmVille skin on a فصحى brand; and naming an app metric بركة ties divine blessing to subscription behavior — theologically presumptuous and screenshot-bait for exactly the wrong audience. |
| **Variable-ratio "gem recipe" unlocks** | Slot-machine reinforcement aimed at mothers, wearing Coach Sara's real cookbook as skin — brand-toxic and self-contradictory (if the recipe is right for this family, why is the app withholding it behind a dice roll?). Unlocks become milestone-based and predictable, or don't exist. |
| **Streak flames / fire iconography** | No dignified فصحى name exists for it. When a mechanic can't be named in the brand voice, that's the verdict. |
| **Fake WhatsApp voice-note UI for Sara** | Deceptive skeuomorphism — users will tap play. Real TTS is a cost/quality/rights problem for later; the changelog card is the actual value. |
| **"≈400 SAR nutritionist equivalent" on the weekly receipt** | Equating AI output to a licensed clinician invites the نصب backlash + scope-of-practice optics, and a weekly price reminder prompts the cancel-question 52×/year. Real counts weekly; value-math at the cancel flow only. |
| **مغامر المائدة — inter-sibling "tried new food" crown** | A weekly courage contest between siblings creates a designated loser and pressures the picky child — violates division-of-responsibility feeding despite looking safe. Per-child self-referential milestones only. |
| **Per-child «أكل / ما أكل» roll call** | Nightly consumption surveillance of children — precisely what the portions-only child stance exists to prevent. Exceptions are dish-directed only. |
| **يومك بين الصلوات — prayer-rhythm day rail** | Cultural dress on a UX gimmick: adds no information (Gulf meal timing is already ambient around Dhuhr/Maghrib), imports prayer-calculation edge cases where a 3-minute error is a religious failure, and *pointing at* prayer times reads performative on a Gulf-native brand — they should be ambient. Salvaged slice: the Maghrib/iftar clock inside Ramadan mode. |
| **موعد الخطة — Thursday synchronized plan drop** | A synchronized "moment" nobody can be notified of isn't a moment; lazy-on-visit generation (the only available pattern) is definitionally unsynchronized. The grocery list buried inside it was promoted to a first-class utility (4.9). |

---

## 6. Non-negotiable guardrails (apply to everything, forever)

1. **Children:** no goals, no calories, no weight, no consumption tracking, no sibling comparison — participation and food-curiosity only, self-referential. (Extends the stance already in code.)
2. **Weight is private even inside the family.** Masked prefill, deliberate-gesture reveal, route-level isolation from every shared/cook/child surface, never in letters or share cards. And note the inversion risk: if the *husband* creates the account, "mom's login is the safe" fails by architecture — onboarding copy should establish the account belongs to the woman of the house, and per-person privacy should hold even against the account owner where feasible.
3. **The housekeeper is coordinated with, never surveilled.** No completion rates, no missed-days views, no performance exports; neutral rendering of unconfirmed; her data is minimal, deletable, portable at offboarding, and never shared without her opt-in.
4. **Religion is never gamified.** No tracking of fasts, prayers, or any عبادة; no fiqh or medical rulings; official-announcement calendars, not astronomy alone.
5. **No shame states anywhere.** No red for missed days, no negative-delta coloring, no confirm-shaming in cancel flows, no fake urgency. Retention a Saudi mom would defend to her husband.
6. **وضع هادئ — quiet mode (build early, it's cheap):** one tap pauses every streak, letter, prompt and celebration, no questions asked, nothing lost. Death, hospitalization, postpartum confinement — an engagement machine that keeps cheering through a mourning week destroys the brand. Auto-offer it after 10+ silent days instead of a guilt nudge.
7. **Solo mode is designed, not degraded.** The solo subscriber (newlywed, divorced, widowed) must never see a room of empty chairs — hide family framing entirely; her version is a personal rhythm + a heavier Sara relationship. (The code already hides member tabs for solo plans; the engagement layer must follow.)
8. **Data honesty:** unanswered ≠ skipped; Sara cites evidence or stays silent; rewards attach to rituals and verdicts, never adherence counts.
9. **Copy register:** every feature name needs a Gulf فصحى pass before ship (red-team caught «أمر المطبخ» as command-register, «كتم» as plain wrong, «طبختها» as عامية on a فصحى surface). Where no dignified Arabic name exists, the mechanic itself is suspect. Every new surface multiplies ×7 languages — price the translation surface, not just dev-hours.
10. **PDPL:** every new table joins /settings export + hard-delete in the PR that creates it.

---

## 7. Roadmap

### v1 — "The Loop" (2–4 weeks) — prove the thesis before building anything else
> Thesis to prove: *logging what we actually cooked makes next week's plan visibly better — so the mom keeps logging, and keeps the subscription.*

- **Week 1 — schema before UI (migration 00017+):** `meal_checkins` (household-level + `local_date`, extensible slots), sparse `member_exceptions`, `meal_verdicts`, `body_logs`, server-minted `canonical_key` at plan-persist. Retrofitting identity onto live event rows is the project-killer — this ships first. Then the ختام اليوم sheet (retroactive-first, 48h grace, verdicts folded into the same surface — one ritual, not two).
- **Week 2 — the payoff:** digest → dynamic prompt (both `buildContext` and the bg mirror), avoid-clauses, deterministic golden-dish injection, `week_changes[]` with evidence + minimum-signal guard, «سارة عدّلت خطتك» cards.
- **Week 3 — the visible reward:** weekly letter (template + numbers), positives-only share card, weigh-in sheet at the regeneration moment + private sparkline. Retires two pricing-page promises.
- **Week 4 — measurement + lifecycle cheapies:** instrumentation & cohort dashboards (the check-in table doubles as the analytics spine — **without this there is no way to know if any of it worked**), day-3 trial checklist, travel pause, cancel-flow ledger.
- Cold start: seed avoid-clauses from already-collected `dislikes`; letter #1 is framed as the baseline week; no surface ever renders empty-and-accusing.
- **Success criteria (define before launch):** W1→W4 weekly-active retention vs pre-launch cohort; check-in coverage %; % of regens honoring ≥1 avoid-clause (sampled QA); letter open + share rate; trial→paid delta for checklist completers.

### v2 — Rhythm & the second human (next 4–8 weeks, gated on v1 metrics)
إيقاع أسبوعك (forgiving streak) → مفاتيح البيت cook token → تم الطبخ + تحضيرات اليوم (cook coordination) → جمعة البيت (Friday skin + invitation card) → ضيوف الليلة (fast single-call guest mode) → قائمة السوق if not already shipped → وضع هادئ + solo mode polish.

### v3 — The moat (gated on v2)
جواز الوصفات passport + offboarding export → husband/child tokens if cook telemetry justifies → monthly family report rollup → absolute-bar cohort seasons (the safe descendant of the league).

**Deferred by founder decision (07/2026): the entire Ramadan/Hijri engine (4.12).** Picked up again ~2 months before Ramadan 1448 (≈ Feb 2027). Until then the only trace of it in the codebase is the extensible slot enum in the v1 event schema.

### The channel decision (strategic, not a feature)
The set's biggest structural weakness is the no-notification hole, and there are exactly three honest ways out — worth deciding early:
1. **WhatsApp Business API** (paid, not wa.me links): one templated weekly message («خطة أسبوعك جاهزة») in THE Gulf channel would likely outperform half this document. Cost/approval process applies.
2. **PWA + Web Push:** iOS Safari ≥16.4 supports push for home-screen-installed PWAs — which makes "add Fit Life to your home screen" itself a v2 engagement mechanic (and the icon on her home screen is ambient retention).
3. **The humans:** the cook's daily kitchen presence and the family WhatsApp group (via share cards) are notification channels that already exist. The design above leans on them deliberately.
Also cross-cutting: one **notification/prompt budget** owner — summed naively, this document generates 10+ prompts/week; cap at one daily ambient surface + one weekly moment, or the mom mutes the ritual that feeds everything.

### Also decide (open questions for the founder)
- **Trial length:** 7 days vs the ~14-day learn-loop payoff — manufacture the day-3 aha, or lengthen the trial?
- **Tier gating:** letter numbers free / LLM prose pro+? Golden-dish count by tier? (Map to the pricing copy already being sold.)
- **Unit economics:** digests/letters/guest menus each add tokens — price the weekly AI cost of the full stack against the 29 SAR tier; add the new generation kinds to the admin cost map (which currently excludes workout rows from per-plan costs).
- **حفظ النعمة (food waste):** red-team's strongest *missed* idea — anti-waste is a Gulf-native moral value with active national campaigns, zero shame surface, and direct AI relevance (portion accuracy). «ما رمينا نعمة هذا الأسبوع» could be the second great cooperative metric. Deserves its own brainstorm.
- **School calendar as a season:** lunchbox season, exam weeks (easy dinners), summer collapse — `school_meal_handling` already exists in the schema and nothing uses it seasonally.
- **Non-Saudi Gulf:** per-country Ramadan announcements, UAE's Sat–Sun weekend breaking the Thursday/Friday spine — config, not Saudi defaults exported.

---

## 8. One-paragraph summary for the pitch deck

Fit Life's engagement layer is not a points system — it is the house's memory. Each evening the mom closes her day in fifteen seconds: what her kitchen cooked, what her family loved, gold-marked days when guests were honored. Each week, Coach Sara answers with a plan that visibly changed because of it — and tells her why. Her weight journey stays hers alone; her children are never measured, only celebrated for curiosity; and her housekeeper is coordinated with dignity in her own language and builds a recipe passport she keeps for life. Nothing to grind, nothing to lose, no one shamed: just a home that runs a little better every week, and an app that would take months of family memory with it if she ever left. (And when Ramadan approaches, the season slots into the same spine — by design, not by migration.)
