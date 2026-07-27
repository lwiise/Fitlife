-- 00023 — allow 'paused' in subscriptions.status
--
-- Migration 00001 defined the status CHECK with 'paused' included; 00004 dropped
-- and re-added it WITHOUT 'paused' while renaming 'on_trial' → 'trialing'. The
-- pause feature («استراحة», the churn-deflection offer on the cancel screen) was
-- built against the original list, so every pause has been writing a value the
-- database rejects:
--
--   * /api/subscription/pause calls LemonSqueezy FIRST (billing really does
--     stop), then writes status='paused'. That write raises 23514 and the route
--     never read the error — it returned {paused:true} 200. The row stayed
--     'active' with its old current_period_end, so isSubscriptionActive() kept
--     granting meal plans, workout plans and advisor chat — real Anthropic spend
--     — to someone who is no longer paying.
--   * The authoritative subscription_paused webhook DOES check the error, so it
--     500s and LemonSqueezy retries it to permanent failure.
--   * subscription_updated carrying status='paused' 500s for the same reason,
--     discarding that event's cancel_at_period_end / current_period_end /
--     cadence writes as collateral.
--   * subscription/page.tsx renders PausedNotice (and the «عدتُ مبكراً» resume
--     button) only when status === 'paused' — unreachable, so a paused customer
--     has no way back.
--
-- Additive and safe to re-run: no existing row can hold 'paused' (the constraint
-- has been rejecting it), so widening the allowed set cannot fail validation.

alter table public.subscriptions drop constraint if exists subscriptions_status_check;

alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('trialing', 'active', 'paused', 'past_due', 'cancelled', 'expired'));
