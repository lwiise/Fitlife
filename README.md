# Fit Life 2.0

Smart nutrition platform for Gulf families. Built as a monorepo; a single Next.js app (`apps/app`) serves both the marketing landing page and the authenticated SaaS app.

## Live Deployment

Single Netlify site. The marketing landing page and the SaaS app are served by the same Next.js app (`apps/app`); the landing page lives under `apps/app/src/marketing`.

- **URL:** https://fitlife-app-mvp.netlify.app/
- **Code:** `apps/app/` (landing page under `apps/app/src/marketing`)
- **Config:** `apps/app/netlify.toml`
- **Netlify base directory:** `apps/app`
- **Local dev:** `pnpm dev:app` (http://localhost:3001)

Deploys from the GitHub repo on push to `main`. Turborepo caching means unchanged packages rebuild in seconds.

**Custom domain:** The site currently uses Netlify's native subdomain. A custom domain can be added in Netlify Site settings → Domain management without any code changes.

## Local Development

```bash
pnpm install
pnpm dev:app    # App + landing on http://localhost:3001
```

## Environment Variables

Each app uses its own `.env.local`:
- `apps/app/.env.example` documents required variables
- For production, set environment variables in each Netlify site's Settings → Environment variables

## Project Structure

```
fitlife/
├── apps/
│   └── app/          # SaaS app + marketing landing (Next.js 16)
├── packages/
│   ├── config/       # Shared brand tokens + constants
│   ├── ui/           # Shared UI components
│   └── tsconfig/     # Shared TypeScript configs
├── .claude/          # Claude Code config (agents, settings)
├── .agents/          # Claude Code skills
├── turbo.json        # Turborepo pipeline
└── pnpm-workspace.yaml
```

## Tech Stack

- Next.js 16 (Turbopack)
- TypeScript (strict mode)
- Tailwind CSS v4
- shadcn/ui (RTL-enabled)
- Motion 12 (formerly Framer Motion)
- Supabase (auth + database)
- Anthropic Claude API (meal plan generation)
- Lemonsqueezy (payments)
- Resend (transactional email)
- Sentry (error tracking)
- Netlify (deployment)
