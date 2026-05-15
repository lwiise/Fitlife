# Fit Life 2.0 — Build Guidelines for Claude Code

## Product
SaaS nutrition platform for Gulf families. Primary audience: Saudi/Gulf housewives 25-45. Unique angle: ONE subscription serves the whole household including the domestic worker, each in their own language. 7 languages supported. AI-powered personalized meal plans via Claude API.

## Design Philosophy
We are NOT building a generic AI landing page. We are NOT using:
- Generic purple gradients
- Floating glass cards
- Stock photos of women holding salads
- Center-aligned hero with two buttons
- Generic "Trusted by 10,000+ users" lines

We ARE building:
- A confident, warm, Gulf-native experience
- Editorial layout (asymmetric where appropriate, not everything center-aligned)
- Real product screenshots, not mockup placeholders
- Arabic-first design (RTL is the default, not the afterthought)
- Mobile-first (70% of users are on phones)

## Brand
- Primary: #4E2490 (deep purple) — buttons, headings, brand elements
- Accent Yellow: #F2BB16 — highlights, badges, CTAs on dark surfaces
- Accent Pink: #C5458F — secondary headings, decorative gradients
- Lavender: #D9B0FC — backgrounds, soft accents only (no text)
- Surface: #EBEFF2 — primary page background (never pure white)
- Ink: #1A1023 — body text (purple-tinted black)

## Typography
- Font: Tajawal (already loaded via next/font/google)
- H1: 48-72px (display), weight 800, line-height 1.1
- H2: 36-48px, weight 700, line-height 1.2
- H3: 24-32px, weight 700
- Body: 16-18px, weight 400, line-height 1.7 (Arabic needs more line-height than English)
- Small: 14px, weight 500
- Use Tajawal 500 for buttons and UI labels, never 400

## Tone of Voice (Arabic Copy)
- Speak directly to the woman of the house (the buyer): "أنتِ"
- Warm but confident, never saccharine. Never use exclamation marks in body copy.
- Specific, not generic: "خطة لخادمتك بلغتها" not "متعدد اللغات"
- Short sentences. Gulf Arabic norms, not Levantine or Egyptian phrasing.
- Numbers are powerful: lead with specific figures whenever you can.
- Never translate from English. Write Arabic-first.

## Component Rules
- Every component lives in src/components/sections/ for page sections, or src/components/ui/ for shadcn primitives
- All components are React Server Components by default. Only use "use client" when truly needed (interactive state, animations).
- Use shadcn/ui logical classes (start-*, end-*, ms-*, me-*) NEVER physical (left-*, right-*, ml-*, mr-*)
- Every section gets its own component file
- No inline styles. All styles via Tailwind utilities.
- No boolean prop proliferation (no isCompact, hasBorder, isHighlighted). Use composition patterns instead.

## Accessibility Rules
- Yellow (#F2BB16) NEVER used for body text on light background
- Pink (#C5458F) only for headings 24px+ or large CTAs
- All interactive elements: min 44x44px tap target
- All images: meaningful alt text in Arabic
- All sections: proper semantic HTML (section, header, nav, article)
- Focus rings visible and on-brand
- prefers-reduced-motion respected on all animations

## Performance Rules
- LCP target: under 1.5s
- All images via next/image with explicit width/height
- Above-the-fold content: zero client-side JS where possible
- Lighthouse score target: 95+ on mobile

## What "Done" Looks Like for Each Section
Every section must:
1. Look exceptional on a 375px mobile viewport FIRST
2. Then scale up beautifully to 1440px desktop
3. Have a clear single conversion goal (or supporting goal)
4. Use Arabic copy that I (the developer's instruction set) will provide
5. Be a separate component file imported into src/app/page.tsx
