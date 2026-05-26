# Fit Life 2.0 — Build Guidelines for Claude Code

## Product
SaaS nutrition platform for Gulf families. Primary audience: Saudi/Gulf housewives 25-45. Unique angle: ONE subscription serves the whole household including the domestic worker, each in their own language. 7 languages supported. AI-powered personalized meal plans.

## Design Philosophy — READ EVERY TIME
We are NOT building a generic AI landing page. Before writing ANY component, the frontend-design skill must be active and you must apply its 4-dimension framework.

FORBIDDEN patterns (these are AI slop):
- Generic purple gradient on white backgrounds
- Floating glass-morphism cards
- Stock photos of women holding salads
- Center-aligned hero with two stacked buttons
- "Trusted by 10,000+ users" lines
- Inter or Geist font fallbacks (use ONLY Tajawal for Arabic, system-ui as last resort)
- 50/50 symmetric layouts
- Bouncy entrance animations on everything
- Gradient blobs as background decoration

REQUIRED patterns:
- Editorial layout (asymmetric where appropriate)
- Confident, warm, Gulf-native experience
- Arabic-first design (RTL is default, not afterthought)
- Mobile-first (70% of users on phones)
- Real product screenshots, not generic mockups
- Restrained motion (premium feel, not playful)

## Brand
- Primary: #4E2490 (deep purple)
- Accent Yellow: #F2BB16
- Accent Pink: #C5458F
- Lavender: #D9B0FC
- Surface: #EBEFF2 (NEVER pure white)
- Ink: #1A1023 (body text)

## Typography
- Font: Tajawal ONLY
- H1: 48-72px, weight 800, line-height 1.1
- H2: 36-48px, weight 700, line-height 1.2
- H3: 24-32px, weight 700
- Body: 16-18px, weight 400, line-height 1.7 (Arabic needs more line-height)
- NO letter-spacing on Arabic text

## Tone (Arabic Copy)
- Address the woman of the house: "أنتِ"
- Warm but confident, NEVER saccharine
- NO exclamation marks in body copy
- Specific over generic
- Short sentences
- Gulf Arabic norms (NOT Levantine or Egyptian phrasing)
- Numbers are powerful — lead with figures when possible
- NEVER translate from English; write Arabic-first

## Component Rules
- Sections in src/components/sections/
- Shadcn primitives in src/components/ui/
- React Server Components by default; "use client" only when needed
- Logical Tailwind classes only (start-*, end-*, ms-*, me-*) — NEVER physical (left-*, right-*, ml-*, mr-*)
- No boolean prop proliferation — use composition
- No inline styles

## Accessibility
- Yellow (#F2BB16) NEVER for body text on light bg
- Pink (#C5458F) only for headings 24px+ or large CTAs
- All interactive elements: min 44x44px tap target
- Meaningful Arabic alt text on all images
- Semantic HTML (section, header, nav, article)
- Focus rings visible and on-brand
- All animations respect prefers-reduced-motion

## Performance
- LCP target: under 1.5s
- All images via next/image with explicit width/height
- Above-the-fold: zero client-side JS where possible
- Lighthouse target: 95+ mobile

## Workflow Rule
Before building ANY section, you must:
1. Confirm frontend-design skill is loaded
2. Walk through the 4-dimension framework for that section
3. Wait for my approval of the design direction
4. Then write code

## Architecture Changes Since Original Handoff (May 24-26, 2026)

**Auth method**: Switched from magic-link (passwordless) to email + password. Supabase auth via signInWithPassword and signUp. Forms include both email and password inputs.

**Site architecture**: Merged from two Netlify sites to one unified site.
- Single production site: fitlife-app-mvp.netlify.app
- Landing page lives at apps/app/src/marketing (the live one)
- apps/web is DEAD CODE — do not edit
- Old fitlife-landing.netlify.app site is decommissioned

**Database migration baseline**: Production Supabase has migrations 00001 through 00005 applied. Migration 00005 added per-member fields (member_type, sex, allergies, dislikes, trimester, school_meal_handling, picky_eater) and family-wide preferences (cuisine, dietary_restrictions, cooking_methods, meal_out_frequency).

**Onboarding restructure (Prompt 1.8c)**: 5 family-wide questions → Mom's 8 personal questions → sequential per-member additions with branched wizards (adult/child/pregnant/lactating). Solo plans hide member tabs.

**AI generation**: Day-by-day streaming, incremental per-member updates that don't wipe existing family plans when adding/editing one member.

**Plan engine package**: Lives at packages/plan-engine (was originally inline in apps/app).

**Settings page**: PDPL compliance shipped — /settings has account info + data export + immediate hard-delete via typed-confirmation modal. Public routes /privacy and /terms exist with placeholder Markdown content (needs real legal text before scaling).
