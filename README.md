# Fit Life 2.0

Smart nutrition platform for Gulf families. Built as a monorepo with a marketing landing page and an authenticated SaaS app.

## Live Deployments

### Landing Page
- **URL:** https://fitlife-landing.netlify.app/
- **Code:** `apps/web/`
- **Config:** root `netlify.toml`
- **Local dev:** `pnpm dev:web` (http://localhost:3000)

### SaaS App
- **URL:** https://fitlife-app-mvp.netlify.app/
- **Code:** `apps/app/`
- **Config:** `apps/app/netlify.toml`
- **Netlify base directory:** `apps/app`
- **Local dev:** `pnpm dev:app` (http://localhost:3001)

Both sites deploy from the same GitHub repo on push to `main`. Turborepo caching means unchanged apps rebuild in seconds.

**Custom domains:** Both sites currently use Netlify's native subdomains. A custom domain can be added in Netlify Site settings → Domain management without any code changes.

## Local Development

```bash
pnpm install
pnpm dev:web    # Landing page on http://localhost:3000
pnpm dev:app    # SaaS app on http://localhost:3001
```

Run both simultaneously in separate terminals.

## Environment Variables

Each app uses its own `.env.local`:
- `apps/app/.env.example` documents required variables
- For production, set environment variables in each Netlify site's Settings → Environment variables

## Project Structure

```
fitlife/
├── apps/
│   ├── web/          # Landing page (Next.js 16)
│   └── app/          # SaaS app (Next.js 16)
├── packages/
│   ├── config/       # Shared brand tokens + constants
│   ├── ui/           # Shared UI components
│   └── tsconfig/     # Shared TypeScript configs
├── .claude/          # Claude Code config (agents, settings)
├── .agents/          # Claude Code skills
├── netlify.toml      # Landing page Netlify config
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
